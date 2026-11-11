import { describe, expect, it } from 'vitest'
import type { BodyLog, WorkoutSession } from '../types'
import {
  calculateAppetite, calculateCheatMeals, calculateFeedbackCounts,
  calculateTrainingDuration, calculateWeightTrend, daysBetween, formatMinutes, formatSigned
} from './bodyMetrics'

const TODAY = '2026-09-10'

function makeLog(date: string, patch: Partial<BodyLog> = {}): BodyLog {
  return {
    id: `body-${date}`, date, weightKg: 80, waistCm: 90, sleepHours: 7, steps: 6000,
    cyclingMinutes: 0, energy: 6, backDiscomfort: 2, numbnessEvents: 0,
    trainingVolume: 0, dietAdherence: 80, ...patch
  }
}

function makeSession(date: string, patch: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `session-${date}`, date, split: '推', sleepHours: 7, energy: 6,
    nextDayWorse: false, logs: [], ...patch
  }
}

describe('体重趋势', () => {
  it('用最近 7 条记录算常态体重，并和之前 7 条比较得出周环比', () => {
    // 前 7 条 82kg，后 7 条 80kg
    const logs = [
      ...Array.from({ length: 7 }, (_, index) => makeLog(`2026-08-${String(index + 1).padStart(2, '0')}`, { weightKg: 82 })),
      ...Array.from({ length: 7 }, (_, index) => makeLog(`2026-09-${String(index + 1).padStart(2, '0')}`, { weightKg: 80 }))
    ]

    const trend = calculateWeightTrend(logs)

    expect(trend.normalWeight).toBe(80)
    expect(trend.weekChange).toBe(-2)
    expect(trend.latestWeight).toBe(80)
    expect(trend.deviationFromNormal).toBe(0)
    expect(trend.sampleCount).toBe(14)
  })

  it('没有体重记录时全部返回 null，不返回 NaN', () => {
    const trend = calculateWeightTrend([])
    expect(trend.normalWeight).toBeNull()
    expect(trend.weekChange).toBeNull()
    expect(trend.deviationFromNormal).toBeNull()
  })

  it('记录不足 14 条时周环比为 null，只有常态体重可用', () => {
    const logs = [makeLog('2026-09-08', { weightKg: 79 }), makeLog('2026-09-09', { weightKg: 80 })]
    const trend = calculateWeightTrend(logs)
    expect(trend.normalWeight).toBe(79.5)
    expect(trend.weekChange).toBeNull()
  })
})

describe('训练时长', () => {
  it('只统计窗口内的训练，没填时长的训练不计入分钟数', () => {
    const sessions = [
      makeSession('2026-09-08', { durationMinutes: 60 }),
      makeSession('2026-09-09', { durationMinutes: 90 }),
      makeSession('2026-09-10', { durationMinutes: 0 }),
      makeSession('2026-08-20', { durationMinutes: 120 })
    ]

    const stats = calculateTrainingDuration(sessions, 7, TODAY)

    expect(stats.sessionCount).toBe(3)
    expect(stats.totalMinutes).toBe(150)
    expect(stats.averageMinutes).toBe(75)
  })

  it('窗口内没有训练时平均值为 null', () => {
    const stats = calculateTrainingDuration([makeSession('2026-01-01', { durationMinutes: 60 })], 7, TODAY)
    expect(stats.sessionCount).toBe(0)
    expect(stats.averageMinutes).toBeNull()
  })
})

describe('放纵餐与食欲', () => {
  it('统计近 7 天放纵餐次数和距上次天数', () => {
    const logs = [
      makeLog('2026-09-01', { cheatMeal: true }),
      makeLog('2026-09-05', { cheatMeal: true }),
      makeLog('2026-09-08', { cheatMeal: true }),
      makeLog('2026-09-09', { cheatMeal: false })
    ]

    const stats = calculateCheatMeals(logs, 7, TODAY)

    expect(stats.count).toBe(2)
    expect(stats.daysSinceLast).toBe(2)
    expect(stats.lastDate).toBe('2026-09-08')
  })

  it('从没记过放纵餐时距上次为 null', () => {
    const stats = calculateCheatMeals([makeLog('2026-09-09')], 7, TODAY)
    expect(stats.count).toBe(0)
    expect(stats.daysSinceLast).toBeNull()
  })

  it('统计食欲均值和不稳天数', () => {
    const logs = [
      makeLog('2026-09-06', { appetiteStability: 5 }),
      makeLog('2026-09-07', { appetiteStability: 2 }),
      makeLog('2026-09-08', { appetiteStability: 4 }),
      makeLog('2026-09-09', { appetiteStability: 1 })
    ]

    const stats = calculateAppetite(logs, 7, TODAY)

    expect(stats.average).toBe(3)
    expect(stats.latest).toBe(1)
    expect(stats.unstableDays).toBe(2)
  })
})

describe('身体反馈', () => {
  it('按频次从多到少统计标签', () => {
    const sessions = [
      makeSession('2026-09-08', { feedbackTags: ['疲惫', '做组耐力不够'] }),
      makeSession('2026-09-09', { feedbackTags: ['疲惫'] }),
      makeSession('2026-08-01', { feedbackTags: ['关节不适'] })
    ]

    const counts = calculateFeedbackCounts(sessions, 7, TODAY)

    expect(counts).toEqual([
      { tag: '疲惫', count: 2 },
      { tag: '做组耐力不够', count: 1 }
    ])
  })
})

describe('显示格式', () => {
  it('把分钟数转成小时分钟', () => {
    expect(formatMinutes(0)).toBe('—')
    expect(formatMinutes(45)).toBe('45分')
    expect(formatMinutes(60)).toBe('1小时')
    expect(formatMinutes(95)).toBe('1小时35分')
  })

  it('带正负号显示变化值', () => {
    expect(formatSigned(0.4)).toBe('+0.4kg')
    expect(formatSigned(-1.2)).toBe('-1.2kg')
    expect(formatSigned(null)).toBe('—')
  })

  it('跨月计算天数差', () => {
    expect(daysBetween('2026-08-31', '2026-09-02')).toBe(2)
  })
})
