import type { AppState, DailyPlanDayType, DailyPlanItem, DailyPlanItemKind, DailyPlanTemplate, ScheduleItem } from '../types'
import { createId } from './ids'

const CATEGORY_CLASS: Record<DailyPlanItemKind, string> = {
  饮食: 'category-food', 补剂: 'category-supplement', 训练: 'category-training', 全天: 'category-life'
}

const KIND_TO_CATEGORY: Record<DailyPlanItemKind, ScheduleItem['category']> = {
  饮食: '饮食', 补剂: '补剂', 训练: '训练', 全天: '生活'
}

const SLOT_ORDER: string[] = ['全天', '醒后', '早餐', '第二餐', '第三餐', '练前', '练中', '力量后', '有氧', '第四餐', '睡前']

const ALIASES: Record<string, string[]> = {
  '土豆或红薯': ['土豆', '红薯'],
  '牛肉或鸡肉': ['瘦牛肉', '去皮鸡肉', '牛肉', '鸡肉'],
  '发酵茶': ['黑茶', '红茶', '乌龙茶'],
  '燕麦': ['燕麦', '全麦面包', '玉米片'],
  '全蛋': ['全蛋', '蛋清'],
  '生米': ['生米', '糙米', '藜麦'],
  '单杠或中号香蕉': ['中号香蕉', '小号香蕉'],
  '单杠': ['中号香蕉'],
  '柚子': ['柚子', '橙子', '苹果'],
  '鸡胸': ['鸡胸', '鱼']
}

const FOOD_POOL: Record<string, string[]> = {
  '燕麦': ['燕麦', '全麦面包', '玉米片', '糙米'],
  '全蛋': ['全蛋', '蛋清', '鹌鹑蛋'],
  '生米': ['生米', '糙米', '藜麦', '燕麦米'],
  '土豆或红薯': ['土豆', '红薯', '山药', '南瓜'],
  '牛肉或鸡肉': ['瘦牛肉', '去皮鸡肉', '牛肉', '鸡胸', '鱼肉'],
  '发酵茶': ['黑茶', '红茶', '乌龙茶', '普洱'],
  '柚子': ['柚子', '橙子', '苹果', '梨'],
  '香蕉': ['中号香蕉', '小号香蕉', '苹果', '梨']
}

function pickFromFoodPool(name: string): string {
  const candidates = FOOD_POOL[name] ?? [name]
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function parseCandidates(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return [trimmed]
  if (ALIASES[trimmed]) return ALIASES[trimmed]
  if (trimmed.includes('/')) return trimmed.split('/').map((part) => part.trim()).filter(Boolean)
  if (/[、或]/.test(trimmed)) return trimmed.split(/[、或]/).map((part) => part.trim()).filter(Boolean)
  return [trimmed]
}

function deterministicRandom(seed: number) {
  let s = seed | 0 || 1
  return () => {
    s = (s * 9301 + 49297) & 0x7fffffff
    return s / 0x7fffffff
  }
}

export function getActivePlan(state: AppState, dayType: DailyPlanDayType): DailyPlanTemplate | null {
  const plans = state.dailyPlans ?? []
  return plans.find((plan) => plan.active && plan.dayType === dayType) ?? plans.find((plan) => plan.dayType === dayType) ?? null
}

export interface MaterializedItem {
  item: DailyPlanItem
  displayName: string
  isRandomized: boolean
}

export function materializeItems(template: DailyPlanTemplate, mode: 'fixed' | 'random', seed: number): MaterializedItem[] {
  const rand = mode === 'random' ? deterministicRandom(seed) : null
  return template.items.map((entry) => {
    if (entry.kind === '全天' || entry.locked || mode === 'fixed') {
      return { item: entry, displayName: entry.foodName, isRandomized: false }
    }
    const candidates = parseCandidates(entry.foodName)
    if (candidates.length <= 1) {
      return { item: entry, displayName: entry.foodName, isRandomized: false }
    }
    let chosen = candidates[Math.floor((rand ? rand() : Math.random()) * candidates.length)]
    if (FOOD_POOL[chosen] && FOOD_POOL[chosen].length > 1 && rand) {
      const pool = FOOD_POOL[chosen]
      chosen = pool[Math.floor(rand() * pool.length)]
    }
    return { item: entry, displayName: chosen, isRandomized: chosen !== entry.foodName && !entry.foodName.includes(chosen) }
  })
}

export function buildScheduleRow(materialized: MaterializedItem, dayType: DailyPlanDayType): ScheduleItem {
  const { item, displayName } = materialized
  const amount = Number.isFinite(item.amount) ? item.amount : 0
  const title = `${item.label}·${displayName} ${amount}${item.unit}`
  return {
    id: `dailyplan-${dayType}-${item.id}`,
    title,
    time: item.time || '00:00',
    durationMinutes: item.kind === '训练' ? Math.max(5, Math.round(item.amount)) : 5,
    category: KIND_TO_CATEGORY[item.kind],
    reminderMinutes: 0,
    notes: item.note,
    completed: false
  }
}

export function groupItemsBySlot(items: MaterializedItem[]): Array<{ slot: string; rows: MaterializedItem[] }> {
  const groups = new Map<string, MaterializedItem[]>()
  for (const entry of items) {
    const slot = entry.item.label || '其他'
    if (!groups.has(slot)) groups.set(slot, [])
    groups.get(slot)!.push(entry)
  }
  const orderIndex = (slot: string) => {
    const i = SLOT_ORDER.indexOf(slot)
    return i === -1 ? SLOT_ORDER.length : i
  }
  return [...groups.entries()]
    .sort((a, b) => orderIndex(a[0]) - orderIndex(b[0]))
    .map(([slot, rows]) => ({ slot, rows }))
}

export const dailyPlanCategoryClass: Record<DailyPlanItemKind, string> = CATEGORY_CLASS

// ---- 打卡状态（按日期存储，支持「今天打卡」与「昨天缺失」追溯） ----

function checkKeyForDate(date: string, rowId: string): string {
  return `dailyplan-check-${date}-${rowId}`
}

export function readCheckedRows(date: string): Set<string> {
  const checked = new Set<string>()
  if (typeof window === 'undefined') return checked
  const prefix = `dailyplan-check-${date}-`
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i)
    if (key && key.startsWith(prefix) && window.localStorage.getItem(key) === '1') {
      checked.add(key.slice(prefix.length))
    }
  }
  return checked
}

export function toggleCheckedRow(date: string, rowId: string): boolean {
  if (typeof window === 'undefined') return false
  const key = checkKeyForDate(date, rowId)
  const next = window.localStorage.getItem(key) === '1' ? null : '1'
  if (next) window.localStorage.setItem(key, '1')
  else window.localStorage.removeItem(key)
  return next === '1'
}

export { createId }
