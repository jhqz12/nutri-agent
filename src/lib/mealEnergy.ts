import type { FoodRecord, MealEnergyRule, MealGroup, MenuItem } from '../nutritionTypes'
import { displayMealName } from './foodUnits'

export const defaultMealEnergyRules: MealEnergyRule[] = [
  { meal: '早餐', minPercent: 20, targetPercent: 25, maxPercent: 30 },
  { meal: '午餐', minPercent: 35, targetPercent: 40, maxPercent: 45 },
  { meal: '晚餐', minPercent: 20, targetPercent: 25, maxPercent: 30 },
  { meal: '加餐', minPercent: 0, targetPercent: 10, maxPercent: 10 }
]

export function normalizeMealEnergyRules(rules?: MealEnergyRule[]): MealEnergyRule[] {
  return defaultMealEnergyRules.map((fallback) => {
    const saved = rules?.find((item) => item.meal === fallback.meal)
    if (!saved) return { ...fallback }
    const minPercent = Number.isFinite(saved.minPercent) ? Math.max(0, saved.minPercent) : fallback.minPercent
    const maxPercent = Number.isFinite(saved.maxPercent) ? Math.min(100, Math.max(minPercent, saved.maxPercent)) : fallback.maxPercent
    const targetPercent = Number.isFinite(saved.targetPercent) ? Math.min(maxPercent, Math.max(minPercent, saved.targetPercent)) : fallback.targetPercent
    return { meal: fallback.meal, minPercent, targetPercent, maxPercent }
  })
}

export function calculateMealCalories(menu: MenuItem[], foods: FoodRecord[]): Record<MealGroup, number> {
  const totals: Record<MealGroup, number> = { 早餐: 0, 午餐: 0, 晚餐: 0, 加餐: 0 }
  for (const item of menu) {
    const food = foods.find((entry) => entry.id === item.foodId)
    if (!food) continue
    const grams = item.unit === 'g' ? item.amount : item.amount * (food.gramsPerUnit ?? food.servingAmount)
    totals[displayMealName(item.meal)] += food.calories * grams / 100
  }
  return Object.fromEntries(Object.entries(totals).map(([meal, calories]) => [meal, Math.round(calories)])) as Record<MealGroup, number>
}

export function mealCalorieRange(targetCalories: number, rule: MealEnergyRule) {
  return {
    min: Math.round(targetCalories * rule.minPercent / 100),
    target: Math.round(targetCalories * rule.targetPercent / 100),
    max: Math.round(targetCalories * rule.maxPercent / 100)
  }
}
