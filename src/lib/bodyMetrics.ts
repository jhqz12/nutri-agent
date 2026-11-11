import type { BodyFeedbackTag, BodyLog, WorkoutSession } from '../types'

/**
 * 这个模块只做「从已有记录里算出来」的事，不存任何状态。
 * 原则：所有输入都不改原数组，所有输出都是可直接显示的值或 null。
 */

export const FEEDBACK_TAGS: BodyFeedbackTag[] = ['疲惫', '做组耐力不够', '力量下降', '关节不适', '状态很好']

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 把 YYYY-MM-DD 转成当天 0 点的时间戳，避免时区把日期算偏。 */
function toDayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return Number.NaN
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

/** 两个日期相差多少天（b - a）。 */
export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from)
}

/** 日期是否落在「最近 days 天」窗口内（含今天）。 */
function isWithinLastDays(date: string, days: number, today: string): boolean {
  const gap = daysBetween(date, today)
  return Number.isFinite(gap) && gap >= 0 && gap <= days - 1
}

function sortByDate<T extends { date: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date))
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function average(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export interface WeightTrend {
  /** 常态体重：最近若干条记录的均值，用来过滤掉水分/称重误差的抖动。 */
  normalWeight: number | null
  /** 周环比：最近 7 条均重 减去 之前 7 条均重。负数=在降。 */
  weekChange: number | null
  /** 最新一次空腹体重与常态体重的偏离。 */
  deviationFromNormal: number | null
  /** 最近一次记录的空腹体重。 */
  latestWeight: number | null
  sampleCount: number
}

/**
 * 体重趋势。
 * 用「记录条数」而不是「日历天数」做窗口：称重频率不稳定时，
 * 按条数取能保证每个窗口真的有可比的数据量。
 */
export function calculateWeightTrend(logs: BodyLog[], windowSize = 7): WeightTrend {
  const valid = sortByDate(logs.filter((log) => Number(log.weightKg) > 0))
  if (!valid.length) {
    return { normalWeight: null, weekChange: null, deviationFromNormal: null, latestWeight: null, sampleCount: 0 }
  }

  const recent = valid.slice(-windowSize)
  const previous = valid.slice(-windowSize * 2, -windowSize)
  const recentAverage = average(recent.map((log) => log.weightKg))
  const previousAverage = average(previous.map((log) => log.weightKg))
  const latestWeight = valid[valid.length - 1].weightKg

  return {
    normalWeight: recentAverage === null ? null : round(recentAverage, 1),
    weekChange: recentAverage === null || previousAverage === null ? null : round(recentAverage - previousAverage, 1),
    deviationFromNormal: recentAverage === null ? null : round(latestWeight - recentAverage, 1),
    latestWeight: round(latestWeight, 1),
    sampleCount: valid.length
  }
}

export interface TrainingDurationStats {
  sessionCount: number
  totalMinutes: number
  averageMinutes: number | null
}

/** 最近 N 天的训练时长统计。没填时长的训练不计入分钟数。 */
export function calculateTrainingDuration(sessions: WorkoutSession[], days = 7, today = todayString()): TrainingDurationStats {
  const inWindow = sessions.filter((session) => isWithinLastDays(session.date, days, today))
  const minutes = inWindow
    .map((session) => Number(session.durationMinutes) || 0)
    .filter((value) => value > 0)
  const totalMinutes = minutes.reduce((sum, value) => sum + value, 0)
  return {
    sessionCount: inWindow.length,
    totalMinutes,
    averageMinutes: minutes.length ? Math.round(totalMinutes / minutes.length) : null
  }
}

export interface CheatMealStats {
  count: number
  daysSinceLast: number | null
  lastDate: string | null
}

/** 最近 N 天的放纵餐次数，以及距上一次放纵餐多少天。 */
export function calculateCheatMeals(logs: BodyLog[], days = 7, today = todayString()): CheatMealStats {
  const cheatLogs = sortByDate(logs.filter((log) => log.cheatMeal))
  const inWindow = cheatLogs.filter((log) => isWithinLastDays(log.date, days, today))
  const last = cheatLogs[cheatLogs.length - 1]
  return {
    count: inWindow.length,
    daysSinceLast: last ? Math.max(0, daysBetween(last.date, today)) : null,
    lastDate: last?.date ?? null
  }
}

export interface AppetiteStats {
  average: number | null
  latest: number | null
  /** 食欲明显不稳（1～2 分）的天数。 */
  unstableDays: number
}

/** 最近 N 天的食欲稳定情况（1～5）。 */
export function calculateAppetite(logs: BodyLog[], days = 7, today = todayString()): AppetiteStats {
  const records = sortByDate(logs.filter((log) => isWithinLastDays(log.date, days, today) && typeof log.appetiteStability === 'number'))
  const values = records.map((log) => Number(log.appetiteStability))
  const mean = average(values)
  return {
    average: mean === null ? null : round(mean, 1),
    latest: values.length ? values[values.length - 1] : null,
    unstableDays: values.filter((value) => value <= 2).length
  }
}

export interface FeedbackCount {
  tag: BodyFeedbackTag
  count: number
}

/** 最近 N 天身体反馈标签的频次，从多到少。 */
export function calculateFeedbackCounts(sessions: WorkoutSession[], days = 7, today = todayString()): FeedbackCount[] {
  const counts = new Map<BodyFeedbackTag, number>()
  for (const session of sessions) {
    if (!isWithinLastDays(session.date, days, today)) continue
    for (const tag of session.feedbackTags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

/** 把分钟数变成「1小时20分」这种更好读的写法。 */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (!hours) return `${rest}分`
  if (!rest) return `${hours}小时`
  return `${hours}小时${rest}分`
}

/** 带正负号显示体重变化，例如 +0.4 / -1.2。 */
export function formatSigned(value: number | null, unit = 'kg'): string {
  if (value === null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}${unit}`
}
