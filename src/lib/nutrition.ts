import type { MacroTotals, MealSelection, NutritionTarget, Profile, Recipe } from '../types'
import { createId } from './ids'

export function calculateBmr(profile: Profile): number {
  const sexOffset = profile.sex === 'male' ? 5 : -161
  return Math.round(10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + sexOffset)
}

export function calculateTarget(profile: Profile, isTrainingDay: boolean): NutritionTarget {
  const bmr = calculateBmr(profile)
  const tdee = Math.round(bmr * profile.activityFactor)
  const calories = isTrainingDay ? profile.trainingCalories : profile.restCalories
  const protein = profile.proteinGrams
  const fat = isTrainingDay ? profile.trainingFatGrams : profile.restFatGrams
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { bmr, tdee, calories, protein, fat, carbs }
}

export function sumMeals(meals: MealSelection[], recipes: Recipe[]): MacroTotals {
  return meals.reduce<MacroTotals>((total, meal) => {
    const recipe = recipes.find((item) => item.id === meal.recipeId)
    if (!recipe) return total
    total.calories += recipe.calories * meal.servings
    total.protein += recipe.protein * meal.servings
    total.fat += recipe.fat * meal.servings
    total.carbs += recipe.carbs * meal.servings
    return total
  }, { calories: 0, protein: 0, fat: 0, carbs: 0 })
}

export function nutritionScore(total: MacroTotals, target: MacroTotals): number {
  const calorieGap = Math.abs(total.calories - target.calories) / Math.max(target.calories, 1)
  const proteinShortfall = Math.max(0, target.protein - total.protein) / Math.max(target.protein, 1)
  const fatGap = Math.abs(total.fat - target.fat) / Math.max(target.fat, 1)
  const carbGap = Math.abs(total.carbs - target.carbs) / Math.max(target.carbs, 1)
  return calorieGap * 4 + proteinShortfall * 4 + fatGap + carbGap
}

function categoriesForCount(count: number): Array<Recipe['category']> {
  if (count === 2) return ['午餐', '晚餐']
  if (count === 3) return ['早餐', '午餐', '晚餐']
  if (count === 4) return ['早餐', '午餐', '日间加餐', '晚餐']
  return ['早餐', '日间加餐', '午餐', '日间加餐', '晚餐']
}

export function generateMealPlan(
  recipes: Recipe[],
  count: number,
  target: MacroTotals,
  locked: MealSelection[] = [],
  iterations = 1200
): MealSelection[] {
  if (!recipes.length) return []
  const safeCount = Math.min(5, Math.max(2, count))
  const categories = categoriesForCount(safeCount)
  let best: MealSelection[] = []
  let bestScore = Number.POSITIVE_INFINITY

  for (let attempt = 0; attempt < iterations; attempt += 1) {
    const candidate = Array.from({ length: safeCount }, (_, slot) => {
      const existing = locked.find((meal) => meal.slot === slot && meal.locked)
      if (existing) return existing
      const pool = recipes.filter((recipe) => recipe.category === categories[slot])
      const source = pool.length ? pool : recipes
      const recipe = source[Math.floor(Math.random() * source.length)]
      const servings = [0.5, 1, 1.5, 2][Math.floor(Math.random() * 4)]
      return { id: createId('meal'), slot, recipeId: recipe.id, servings, locked: false }
    })
    const score = nutritionScore(sumMeals(candidate, recipes), target)
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

export function isNutritionTargetMet(total: MacroTotals, target: MacroTotals): boolean {
  const calorieOk = Math.abs(total.calories - target.calories) <= target.calories * 0.08
  const proteinOk = total.protein >= target.protein * 0.95
  const fatOk = Math.abs(total.fat - target.fat) <= target.fat * 0.15
  const carbOk = Math.abs(total.carbs - target.carbs) <= target.carbs * 0.15
  return calorieOk && proteinOk && fatOk && carbOk
}
