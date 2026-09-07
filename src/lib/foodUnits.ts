import type { FoodCategory, FoodRecord, MenuItem } from '../nutritionTypes'

export const foodCategories: FoodCategory[] = ['主食', '蛋白质', '脂肪', '蔬菜', '水果', '坚果', '调味', '其他']

export function getDefaultFoodGrams(food: FoodRecord): number {
  // 食材库里的常用量是用户资料，必须保留原值（例如36克不能被改成40克）。
  if (food.servingUnit === 'g') return Math.max(0, Math.round(food.servingAmount * 10) / 10)
  if (food.gramsPerUnit && food.gramsPerUnit > 0) {
    return Math.max(0, Math.round(food.servingAmount * food.gramsPerUnit * 10) / 10)
  }
  return 100
}

export function getGeneratedFoodStepGrams(food: FoodRecord): number {
  if (food.gramsPerUnit && ['个', '片', '袋', '杯', '瓶'].includes(food.servingUnit)) return food.gramsPerUnit
  const category = getFoodCategory(food)
  if (category === '脂肪' || category === '坚果') return 5
  return 10
}

export function normalizeGeneratedFoodGrams(food: FoodRecord, grams: number): number {
  const step = getGeneratedFoodStepGrams(food)
  let normalized = Math.max(step, Math.round(grams / step) * step)
  if (/鸡蛋/.test(food.name)) normalized = Math.min(normalized, (food.gramsPerUnit ?? 50) * 4)
  if (/酸奶/.test(food.name) && food.servingUnit === '杯') normalized = Math.min(normalized, food.gramsPerUnit ?? 200)
  return Math.round(normalized * 10) / 10
}

export function getManualAmountWarning(food: FoodRecord, grams: number): string | null {
  if (grams <= 0) return null
  const gramsPerUnit = food.gramsPerUnit ?? 0
  if (/鸡蛋/.test(food.name) && gramsPerUnit > 0 && grams > gramsPerUnit * 4) return '单餐已超过4个鸡蛋的自动建议上限；仍可保存，请确认这是你的实际安排。'
  if (/酸奶/.test(food.name) && food.servingUnit === '杯' && gramsPerUnit > 0 && grams % gramsPerUnit !== 0) return `常用1杯为${gramsPerUnit}克；仍可按实际克重保存。`
  if (grams < getGeneratedFoodStepGrams(food)) return '该分量低于自动配餐的最小可执行步进；仍可手动保存。'
  return null
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function formatFoodAmount(food: FoodRecord, grams: number): string {
  if (food.servingUnit === 'g' || !food.gramsPerUnit) return `${grams}克`
  const count = grams / food.gramsPerUnit
  return `${grams}克（约${formatCount(count)}${food.servingUnit}，每${food.servingUnit}${food.gramsPerUnit}克）`
}

export function normalizeMenuItemToGrams(item: MenuItem, food?: FoodRecord): MenuItem {
  const category = food ? getFoodCategory(food) : null
  const meal = category === '坚果' ? '坚果' : category === '水果' ? '日间加餐' : item.meal
  if (item.unit === 'g') return { ...item, meal, amount: Math.max(0, item.amount), unit: 'g' }
  const gramsPerUnit = food?.gramsPerUnit ?? (food?.servingUnit === 'g' ? food.servingAmount : null)
  const grams = gramsPerUnit ? item.amount * gramsPerUnit : item.amount
  return { ...item, meal, amount: Math.max(0, Math.round(grams * 10) / 10), unit: 'g' }
}

export function isNutFood(food: FoodRecord): boolean {
  return /核桃|开心果|巴旦木|杏仁|腰果|榛子|坚果|南瓜子/.test(food.name)
}

export function getFoodCategory(food: FoodRecord): FoodCategory {
  if (food.category && foodCategories.includes(food.category)) return food.category
  if (isNutFood(food)) return '坚果'
  if (/苹果|橙|蓝莓|香蕉|猕猴桃|梨|葡萄|水果/.test(food.name)) return '水果'
  if (/菠菜|油麦菜|黄瓜|西红柿|番茄|菌菇|蔬菜|青菜|冬瓜/.test(food.name)) return '蔬菜'
  if (/油|猪油|黄油/.test(food.name) || (food.fat ?? 0) >= 80) return '脂肪'
  if (/饭|米|面包|燕麦|藜麦|杂豆|红薯|山药|土豆|主食/.test(food.name) || (food.carbs ?? 0) >= Math.max(12, (food.protein ?? 0) * 2)) return '主食'
  if (/蛋|肉|鱼|虾|豆腐|酸奶|牛奶|蛋白粉/.test(food.name) || (food.protein ?? 0) >= 8) return '蛋白质'
  if (/葱|姜|蒜|胡椒|盐|酱|调味/.test(food.name)) return '调味'
  return '其他'
}

export function defaultTendencyForCategory(category: FoodCategory): string[] {
  if (category === '主食') return ['早餐', '午餐', '晚餐']
  if (category === '蛋白质' || category === '蔬菜' || category === '脂肪' || category === '调味') return ['早餐', '午餐', '晚餐']
  if (category === '水果' || category === '坚果') return ['日间加餐']
  return ['早餐', '午餐', '晚餐']
}

export function mergeDuplicateMenuItems(menu: MenuItem[], foods: FoodRecord[]): MenuItem[] {
  const merged = new Map<string, MenuItem>()
  for (const item of menu) {
    const food = foods.find((entry) => entry.id === item.foodId)
    const normalized = normalizeMenuItemToGrams(item, food)
    const key = `${normalized.meal}:${normalized.foodId}`
    const current = merged.get(key)
    if (current) current.amount += normalized.amount
    else merged.set(key, { ...normalized, unit: 'g' })
  }
  return [...merged.values()].map((item) => ({ ...item, amount: Math.round(item.amount * 10) / 10 }))
}

export function displayMealName(meal: MenuItem['meal']): '早餐' | '午餐' | '晚餐' | '加餐' {
  return meal === '坚果' || meal === '日间加餐' ? '加餐' : meal
}

export function mealForFood(group: '早餐' | '午餐' | '晚餐' | '加餐', food: FoodRecord): MenuItem['meal'] {
  const category = getFoodCategory(food)
  if (category === '坚果') return '坚果'
  if (category === '水果') return '日间加餐'
  return group === '加餐' ? '日间加餐' : group
}

export function foodAllowedInGroup(food: FoodRecord, group: '早餐' | '午餐' | '晚餐' | '加餐'): boolean {
  const category = getFoodCategory(food)
  if (category === '坚果' || category === '水果') return group === '加餐'
  if (group === '加餐') return food.tendency.includes('日间加餐')
  return food.tendency.includes(group)
}

