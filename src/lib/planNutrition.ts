import type { DailyPlanItem, DailyPlanTemplate, MacroTotals } from '../types'
import type { FoodRecord, SupplementRecord } from '../nutritionTypes'

/**
 * 日计划营养分析：优先用 item 自带的精确营养值；否则按食物名/补剂名在「食材库 + 补剂库」里
 * 匹配每100g营养值（或每份补剂含量）× 份量，算出每项、每餐、全天的热量与三大营养素。
 * 食材库是唯一真相来源——用户在食材库改营养值，这里自动联动，日计划→今日随之更新。
 * 统计范围：「饮食」「全天」按食材库取数；「补剂」按补剂库取数（蛋白粉等含热量/蛋白）。
 */

interface Per100g { calories: number; protein: number; fat: number; carbs: number }

// 兜底：库匹配不到时的常用标准值
const PER_100G: Record<string, Per100g> = {
  '动物黄油': { calories: 717, protein: 0.9, fat: 81, carbs: 0.1 },
  '发酵茶': { calories: 0, protein: 0, fat: 0, carbs: 0 },
  '燕麦': { calories: 389, protein: 13, fat: 7, carbs: 67 },
  '全蛋': { calories: 143, protein: 12.6, fat: 9.9, carbs: 1.3 },
  '土豆': { calories: 77, protein: 2, fat: 0.1, carbs: 17.5 },
  '红薯': { calories: 90, protein: 1.6, fat: 0.1, carbs: 20 },
  '生米': { calories: 346, protein: 7.4, fat: 0.8, carbs: 77.9 },
  '瘦牛肉': { calories: 125, protein: 22, fat: 4, carbs: 0 },
  '鸡肉': { calories: 172, protein: 21, fat: 8.5, carbs: 0 },
  '鸡胸': { calories: 118, protein: 23, fat: 2.6, carbs: 0 },
  '香蕉': { calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8 },
  '柚子': { calories: 42, protein: 0.8, fat: 0.2, carbs: 10.7 },
  '蛋白粉': { calories: 400, protein: 80, fat: 5, carbs: 5 }
}

function splitCandidates(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return []
  if (trimmed.includes('/')) return trimmed.split('/').map((part) => part.trim()).filter(Boolean)
  if (/[、或]/.test(trimmed)) return trimmed.split(/[、或]/).map((part) => part.trim()).filter(Boolean)
  return [trimmed]
}

// 日计划里的食物简称 → 食材库关键词（按顺序命中，第一个匹配的库记录被采用）
const FOOD_ALIASES: Array<[RegExp, string[]]> = [
  [/黄油/, ['动物黄油']],
  [/茶/, ['发酵茶']],
  [/葡萄糖/, ['葡萄糖粉']],
  [/燕麦/, ['干燕麦片', '燕麦']],
  [/全麦面包|面包/, ['全麦面包']],
  [/蛋白粉/, ['蛋白粉']],
  [/蛋清/, ['蛋清']],
  [/全蛋|鸡蛋|^蛋/, ['鲜鸡蛋']],
  [/糙米/, ['熟糙米饭', '糙米']],
  [/生米|大米|米饭/, ['生米']],
  [/土豆|马铃薯/, ['土豆']],
  [/红薯|甘薯|地瓜/, ['蒸红薯']],
  [/山药/, ['蒸山药']],
  [/鸡胸/, ['去皮鸡胸肉']],
  [/鸡肉|鸡腿|去皮鸡/, ['去皮鸡腿肉', '去皮鸡胸肉']],
  [/牛肉|牛里脊|里脊|瘦猪/, ['瘦猪牛里脊']],
  [/香蕉/, ['香蕉']],
  [/柚子/, ['柚子']],
  [/苹果/, ['苹果']],
  [/橙/, ['橙子']]
]

// 补剂简称 → 补剂库关键词
const SUPPLEMENT_ALIASES: Array<[RegExp, string[]]> = [
  [/维c|维生素c|vc/i, ['维生素C']],
  [/维b|维生素b|复合b|b族/i, ['B族复合']],
  [/维d|维生素d|d3/i, ['D3+K2']],
  [/铬/, ['吡啶甲酸铬']],
  [/肌酸/, ['肌酸']],
  [/鱼油|epa/i, ['鱼油']],
  [/镁/, ['苏糖酸镁']],
  [/蛋白粉/, ['蛋白粉']]
]

function findFoodInLibrary(name: string, foods: FoodRecord[]): FoodRecord | null {
  if (!foods.length) return null
  const exact = foods.find((food) => food.name === name)
  if (exact) return exact
  for (const [pattern, keywords] of FOOD_ALIASES) {
    if (pattern.test(name)) {
      for (const keyword of keywords) {
        const hit = foods.find((food) => food.name.includes(keyword) || keyword.includes(food.name))
        if (hit) return hit
      }
    }
  }
  return null
}

function findSupplementInLibrary(name: string, supplements: SupplementRecord[]): SupplementRecord | null {
  if (!supplements.length) return null
  const exact = supplements.find((supplement) => supplement.name === name)
  if (exact) return exact
  for (const [pattern, keywords] of SUPPLEMENT_ALIASES) {
    if (pattern.test(name)) {
      for (const keyword of keywords) {
        const hit = supplements.find((supplement) => supplement.name.includes(keyword) || keyword.includes(supplement.name))
        if (hit) return hit
      }
    }
  }
  return null
}

function toGrams(item: DailyPlanItem): number {
  const amount = Number.isFinite(item.amount) ? item.amount : 0
  switch (item.unit) {
    case 'g': return amount
    case 'kg': return amount * 1000
    case '个': return amount * 50
    case '根': return amount * 100
    case '勺': return amount * 15
    case '片': return amount * 1
    case '粒': return amount * 1
    case '份': return amount * 100
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

export function analyzeItems(
  items: DailyPlanItem[],
  foods: FoodRecord[] = [],
  supplements: SupplementRecord[] = []
): PlanNutrition {
  const result: PlanItemNutrition[] = []
  const bySlot: Record<string, MacroTotals> = {}
  const unknownFoods: string[] = []
  let matchedCount = 0
  let totalCount = 0

  const addEntry = (slot: string, entry: PlanItemNutrition) => {
    result.push(entry)
    const slotTotal = bySlot[slot] ?? emptyMacro()
    slotTotal.calories += entry.calories
    slotTotal.protein += entry.protein
    slotTotal.fat += entry.fat
    slotTotal.carbs += entry.carbs
    bySlot[slot] = slotTotal
  }

  for (const item of items) {
    const slot = item.label || '其他'

    // 饮品（ml）与茶类：0 热量，直接跳过
    if (item.unit === 'ml' || /茶/.test(item.foodName)) {
      totalCount += 1
      matchedCount += 1
      continue
    }

    // 1) 精确营养值优先：用户手算的整餐直接采用，分毫不差
    if (Number.isFinite(item.calories)) {
      matchedCount += 1
      totalCount += 1
      addEntry(slot, {
        item,
        foodKey: '精确',
        grams: 0,
        calories: Math.round(item.calories ?? 0),
        protein: round1(item.protein ?? 0),
        fat: round1(item.fat ?? 0),
        carbs: round1(item.carbs ?? 0)
      })
      continue
    }

    // 2) 补剂：从补剂库取（蛋白粉等含热量/蛋白）
    if (item.kind === '补剂') {
      totalCount += 1
      const supplement = item.supplementId
        ? supplements.find((supplement) => supplement.id === item.supplementId)
        : findSupplementInLibrary(item.foodName, supplements)
      if (supplement) {
        matchedCount += 1
        // 补剂按「份」计：amount 即份数（g/ml 按每份克数折算）
        const portions = item.unit === 'g' || item.unit === 'ml' ? item.amount / Math.max(1, supplement.servingAmount) : item.amount
        const scale = portions
        const protein = supplement.nutrients.protein ?? 0
        const fat = supplement.nutrients.fat ?? 0
        const carbs = supplement.nutrients.carbs ?? 0
        addEntry(slot, {
          item,
          foodKey: supplement.name,
          grams: 0,
          calories: round0((supplement.calories ?? 0) * scale),
          protein: round1(protein * scale),
          fat: round1(fat * scale),
          carbs: round1(carbs * scale)
        })
      } else {
        // 补剂库匹配不到时，回退到食材库（葡萄糖粉、蛋白粉等既是食物又常被归为补剂）
        const food = item.foodId
          ? foods.find((food) => food.id === item.foodId)
          : findFoodInLibrary(item.foodName, foods)
        if (food) {
          matchedCount += 1
          const grams = toGrams(item)
          const scale = grams / 100
          addEntry(slot, {
            item,
            foodKey: food.name,
            grams,
            calories: round0(food.calories * scale),
            protein: round1((food.protein ?? 0) * scale),
            fat: round1((food.fat ?? 0) * scale),
            carbs: round1((food.carbs ?? 0) * scale)
          })
        } else {
          unknownFoods.push(item.foodName)
        }
      }
      continue
    }

    // 3) 饮食/全天：从食材库取每100g营养值 × 克数
    if (item.kind === '饮食' || item.kind === '全天') {
      totalCount += 1
      const food = item.foodId
        ? foods.find((food) => food.id === item.foodId)
        : findFoodInLibrary(item.foodName, foods)
      if (food) {
        matchedCount += 1
        const grams = toGrams(item)
        const scale = grams / 100
        addEntry(slot, {
          item,
          foodKey: food.name,
          grams,
          calories: round0(food.calories * scale),
          protein: round1((food.protein ?? 0) * scale),
          fat: round1((food.fat ?? 0) * scale),
          carbs: round1((food.carbs ?? 0) * scale)
        })
      } else {
        unknownFoods.push(item.foodName)
      }
      continue
    }
  }

  const totals = result.reduce<MacroTotals>((sum, entry) => ({
    calories: sum.calories + entry.calories,
    protein: round0(sum.protein + entry.protein),
    fat: round1(sum.fat + entry.fat),
    carbs: round0(sum.carbs + entry.carbs)
  }), emptyMacro())

  return { items: result, matchedCount, totalCount, totals, bySlot, unknownFoods }
}

export function analyzePlanNutrition(
  template: DailyPlanTemplate,
  foods?: FoodRecord[],
  supplements?: SupplementRecord[]
): PlanNutrition {
  return analyzeItems(template.items, foods, supplements)
}

export function compareMacro(actual: MacroTotals, target: MacroTotals) {
  const diff = (key: keyof MacroTotals) => round0(actual[key] - target[key])
  return {
    calories: diff('calories'), protein: diff('protein'), fat: diff('fat'), carbs: diff('carbs')
  }
}
