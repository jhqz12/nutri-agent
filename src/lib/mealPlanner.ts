import type { FoodRecord, MenuItem } from '../nutritionTypes'
import { displayMealName, foodAllowedInGroup, getDefaultFoodGrams, getFoodCategory, isNutFood, mealForFood, mergeDuplicateMenuItems } from './foodUnits'

type MealGroup = '早餐' | '午餐' | '晚餐' | '加餐'

function foodRole(food: FoodRecord): '蛋白' | '主食' | '脂肪' | '果蔬' {
  const category = getFoodCategory(food)
  if (category === '蛋白质') return '蛋白'
  if (category === '主食') return '主食'
  if (category === '脂肪' || category === '坚果') return '脂肪'
  return '果蔬'
}

function choose<T>(items: T[], random: () => number): T | undefined {
  if (!items.length) return undefined
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]
}

export function createMenuIdea(foods: FoodRecord[], currentMenu: MenuItem[], random: () => number = Math.random): MenuItem[] {
  const normalized = currentMenu.map((item) => ({ ...item, unit: 'g' as const }))
  const replaced = normalized.map((item) => {
    const currentFood = foods.find((food) => food.id === item.foodId)
    if (!currentFood) return item
    const group = displayMealName(item.meal) as MealGroup
    const pool = foods.filter((food) => {
      if (!foodAllowedInGroup(food, group)) return false
      if (group === '加餐' && isNutFood(currentFood) !== isNutFood(food)) return false
      return foodRole(food) === foodRole(currentFood)
    })
    const alternatives = pool.filter((food) => food.id !== currentFood.id)
    const selected = choose(alternatives.length ? alternatives : pool, random) ?? currentFood
    return {
      foodId: selected.id,
      meal: mealForFood(group, selected),
      amount: getDefaultFoodGrams(selected),
      unit: 'g' as const
    }
  })
  return limitMenuVariety(mergeDuplicateMenuItems(replaced, foods), foods)
}

export function limitMenuVariety(menu: MenuItem[], foods: FoodRecord[]): MenuItem[] {
  const limits = new Map<string, number>([['主食', 1], ['脂肪', 1], ['蛋白质', 2]])
  const counts = new Map<string, number>()
  return menu.filter((item) => {
    const group = displayMealName(item.meal)
    if (group === '加餐') return true
    const food = foods.find((entry) => entry.id === item.foodId)
    if (!food) return false
    const category = getFoodCategory(food)
    const limit = limits.get(category)
    if (!limit) return true
    const key = `${group}:${category}`
    const nextCount = (counts.get(key) ?? 0) + 1
    counts.set(key, nextCount)
    return nextCount <= limit
  })
}
