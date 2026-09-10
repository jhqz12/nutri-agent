import type { DailyPlanItem, DailyPlanTemplate, MacroTotals } from '../types'

/**
 * 日计划营养分析：把谭师食物简写（燕麦/生米/牛肉或鸡肉/全蛋…）映射到每100g营养值，
 * 算出每项、每餐、全天的热量与三大营养素。数值以谭师计算表 + 食材库为准，个别兜底用标准值。
 * 只统计「饮食」与「全天」类项（补剂、训练不计入食物总账）。
 */

interface Per100g { calories: number; protein: number; fat: number; carbs: number }

const PER_100G: Record<string, Per100g> = {
  '动物黄油': { calories: 717, protein: 0.9, fat: 81, carbs: 0.1 },
  '发酵茶': { calories: 0, protein: 0, fat: 0, carbs: 0 },
  '燕麦': { calories: 389, protein: 13, fat: 7, carbs: 67 },
  '全麦面包': { calories: 250, protein: 9, fat: 2.5, carbs: 45 },
  '全蛋': { calories: 143, protein: 12.6, fat: 9.9, carbs: 1.3 },
  '蛋清': { calories: 60, protein: 11, fat: 0.2, carbs: 0.7 },
  '土豆': { calories: 77, protein: 2, fat: 0.1, carbs: 17.5 },
  '红薯': { calories: 90, protein: 1.6, fat: 0.1, carbs: 20 },
  '山药': { calories: 57, protein: 1.9, fat: 0.2, carbs: 12 },
  '南瓜': { calories: 23, protein: 0.7, fat: 0.1, carbs: 5.3 },
  '生米': { calories: 346, protein: 7.4, fat: 0.8, carbs: 77.9 },
  '糙米': { calories: 353, protein: 7.2, fat: 2.2, carbs: 75 },
  '藜麦': { calories: 368, protein: 14, fat: 6, carbs: 64 },
  '瘦牛肉': { calories: 125, protein: 22, fat: 4, carbs: 0 },
  '鸡肉': { calories: 172, protein: 21, fat: 8.5, carbs: 0 },
  '鸡胸': { calories: 118, protein: 23, fat: 2.6, carbs: 0 },
  '鱼肉': { calories: 139, protein: 20.4, fat: 6.3, carbs: 0 },
  '虾': { calories: 80, protein: 18.6, fat: 0.8, carbs: 0 },
  '香蕉': { calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8 },
  '柚子': { calories: 42, protein: 0.8, fat: 0.2, carbs: 10.7 },
  '苹果': { calories: 52, protein: 0.3, fat: 0.2, carbs: 13.8 },
  '橙子': { calories: 47, protein: 0.9, fat: 0.1, carbs: 11.8 },
  '梨': { calories: 50, protein: 0.4, fat: 0.1, carbs: 13 },
  '蛋白粉': { calories: 400, protein: 80, fat: 5, carbs: 5 }
}

function splitCandidates(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return []
  if (trimmed.includes('/')) return trimmed.split('/').map((part) => part.trim()).filter(Boolean)
  if (/[、或]/.test(trimmed)) return trimmed.split(/[、或]/).map((part) => part.trim()).filter(Boolean)
  return [trimmed]
}

function resolveFoodKey(name: string): string | null {
  const n = name.trim()
  if (/黄油/.test(n)) return '动物黄油'
  if (/茶/.test(n)) return '发酵茶'
  if (/全麦面包|面包/.test(n)) return '全麦面包'
  if (/蛋白粉/.test(n)) return '蛋白粉'
  if (/燕麦/.test(n)) return '燕麦'
  if (/蛋清/.test(n)) return '蛋清'
  if (/蛋/.test(n)) return '全蛋'
  if (/糙米/.test(n)) return '糙米'
  if (/藜麦/.test(n)) return '藜麦'
  if (/生米|大米|米饭/.test(n)) return '生米'
  if (/土豆/.test(n)) return '土豆'
  if (/红薯|甘薯/.test(n)) return '红薯'
  if (/山药/.test(n)) return '山药'
  if (/南瓜/.test(n)) return '南瓜'
  if (/鸡胸/.test(n)) return '鸡胸'
  if (/鸡肉|鸡腿|去皮鸡/.test(n)) return '鸡肉'
  if (/牛肉|牛里脊|里脊|牛肉/.test(n)) return '瘦牛肉'
  if (/虾/.test(n)) return '虾'
  if (/鱼|三文/.test(n)) return '鱼肉'
  if (/香蕉/.test(n)) return '香蕉'
  if (/柚子/.test(n)) return '柚子'
  if (/苹果/.test(n)) return '苹果'
  if (/橙/.test(n)) return '橙子'
  if (/梨/.test(n)) return '梨'
  return null
}

function resolveFoodKeyFromName(name: string): string | null {
  const candidates = splitCandidates(name)
  for (const candidate of candidates) {
    const key = resolveFoodKey(candidate)
    if (key) return key
  }
  return null
}

function toGrams(item: DailyPlanItem): number {
  const amount = Number.isFinite(item.amount) ? item.amount : 0
  switch (item.unit) {
    case 'g': return amount
    case 'kg': return amount * 1000
    case '个': return amount * 50
    case '根': return amount * 118
    case '勺': return amount * 30
    case '杯': return amount * 200
    case 'ml': return 0
    default: return 0
  }
}

export interface PlanItemNutrition {
  item: DailyPlanItem
  foodKey: string | null
  grams: number
  calories: number
  protein: number
  fat: number
  carbs: number
}

export interface PlanNutrition {
  items: PlanItemNutrition[]
  matchedCount: number
  totalCount: number
  totals: MacroTotals
  bySlot: Record<string, MacroTotals>
  unknownFoods: string[]
}

const round1 = (value: number) => Number(value.toFixed(1))
const round0 = (value: number) => Math.round(value)

function emptyMacro(): MacroTotals { return { calories: 0, protein: 0, fat: 0, carbs: 0 } }

export function analyzeItems(items: DailyPlanItem[]): PlanNutrition {
  const result: PlanItemNutrition[] = []
  const bySlot: Record<string, MacroTotals> = {}
  const unknownFoods: string[] = []
  let matchedCount = 0
  let totalCount = 0

  for (const item of items) {
    if (item.kind !== '饮食' && item.kind !== '全天') continue
    totalCount += 1
    const foodKey = resolveFoodKeyFromName(item.foodName)
    const per100 = foodKey ? PER_100G[foodKey] : null
    if (!foodKey || !per100) {
      unknownFoods.push(item.foodName)
      continue
    }
    matchedCount += 1
    const grams = toGrams(item)
    const scale = grams / 100
    const entry: PlanItemNutrition = {
      item,
      foodKey,
      grams,
      calories: round0(per100.calories * scale),
      protein: round1(per100.protein * scale),
      fat: round1(per100.fat * scale),
      carbs: round1(per100.carbs * scale)
    }
    result.push(entry)
    const slot = item.label || '其他'
    const slotTotal = bySlot[slot] ?? emptyMacro()
    slotTotal.calories += entry.calories
    slotTotal.protein += entry.protein
    slotTotal.fat += entry.fat
    slotTotal.carbs += entry.carbs
    bySlot[slot] = slotTotal
  }

  const totals = result.reduce<MacroTotals>((sum, entry) => ({
    calories: sum.calories + entry.calories,
    protein: round1(sum.protein + entry.protein),
    fat: round1(sum.fat + entry.fat),
    carbs: round1(sum.carbs + entry.carbs)
  }), emptyMacro())

  return { items: result, matchedCount, totalCount, totals, bySlot, unknownFoods }
}

export function analyzePlanNutrition(template: DailyPlanTemplate): PlanNutrition {
  return analyzeItems(template.items)
}

export function compareMacro(actual: MacroTotals, target: MacroTotals) {
  const diff = (key: keyof MacroTotals) => round0(actual[key] - target[key])
  return {
    calories: diff('calories'), protein: diff('protein'), fat: diff('fat'), carbs: diff('carbs')
  }
}
