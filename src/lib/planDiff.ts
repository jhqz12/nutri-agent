import type { DailyPlanItem, DailyPlanTemplate, MacroTotals } from '../types'
import { analyzeItems } from './planNutrition'

/** 逐项差异 + 全天营养总量对比，用于「和上一次计划」对比。 */

export interface PlanDiffItem {
  key: string
  time: string
  label: string
  kind: string
  foodName: string
  change: '新增' | '删除' | '份量变化' | '其他变化'
  prevAmount: string
  nextAmount: string
}

export interface PlanDiff {
  items: PlanDiffItem[]
  added: number
  removed: number
  changed: number
  prevTotals: MacroTotals
  nextTotals: MacroTotals
  totalsDelta: { calories: number; protein: number; fat: number; carbs: number }
}

function itemKey(item: DailyPlanItem): string {
  return `${item.time}|${item.label}|${item.kind}|${item.foodName.trim()}`
}

function amountLabel(item: DailyPlanItem): string {
  const amount = Number.isFinite(item.amount) ? item.amount : 0
  return `${amount}${item.unit}`
}

export function diffPlans(prev: DailyPlanTemplate, next: DailyPlanTemplate): PlanDiff {
  const prevMap = new Map<string, DailyPlanItem>()
  for (const item of prev.items) prevMap.set(itemKey(item), item)
  const nextMap = new Map<string, DailyPlanItem>()
  for (const item of next.items) nextMap.set(itemKey(item), item)

  const items: PlanDiffItem[] = []
  const prevKeys = new Set(prevMap.keys())
  const nextKeys = new Set(nextMap.keys())

  for (const key of nextKeys) {
    const nextItem = nextMap.get(key)!
    const prevItem = prevMap.get(key)
    if (!prevItem) {
      items.push({ key, time: nextItem.time, label: nextItem.label, kind: nextItem.kind, foodName: nextItem.foodName, change: '新增', prevAmount: '', nextAmount: amountLabel(nextItem) })
      continue
    }
    if (prevItem.amount !== nextItem.amount || prevItem.unit !== nextItem.unit) {
      items.push({ key, time: nextItem.time, label: nextItem.label, kind: nextItem.kind, foodName: nextItem.foodName, change: '份量变化', prevAmount: amountLabel(prevItem), nextAmount: amountLabel(nextItem) })
    } else if (prevItem.note !== nextItem.note || prevItem.locked !== nextItem.locked) {
      items.push({ key, time: nextItem.time, label: nextItem.label, kind: nextItem.kind, foodName: nextItem.foodName, change: '其他变化', prevAmount: amountLabel(prevItem), nextAmount: amountLabel(nextItem) })
    }
  }

  for (const key of prevKeys) {
    if (nextKeys.has(key)) continue
    const prevItem = prevMap.get(key)!
    items.push({ key, time: prevItem.time, label: prevItem.label, kind: prevItem.kind, foodName: prevItem.foodName, change: '删除', prevAmount: amountLabel(prevItem), nextAmount: '' })
  }

  const order: Record<string, number> = { 新增: 0, 份量变化: 1, 其他变化: 2, 删除: 3 }
  items.sort((a, b) => (order[a.change] - order[b.change]) || a.time.localeCompare(b.time) || a.label.localeCompare(b.label))

  const prevTotals = analyzeItems(prev.items).totals
  const nextTotals = analyzeItems(next.items).totals
  const round0 = (value: number) => Math.round(value)
  return {
    items,
    added: items.filter((item) => item.change === '新增').length,
    removed: items.filter((item) => item.change === '删除').length,
    changed: items.filter((item) => item.change === '份量变化' || item.change === '其他变化').length,
    prevTotals,
    nextTotals,
    totalsDelta: {
      calories: round0(nextTotals.calories - prevTotals.calories),
      protein: round0(nextTotals.protein - prevTotals.protein),
      fat: round0(nextTotals.fat - prevTotals.fat),
      carbs: round0(nextTotals.carbs - prevTotals.carbs)
    }
  }
}
