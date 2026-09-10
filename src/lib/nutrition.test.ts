import { describe, expect, it } from 'vitest'
import { calculateBmr, calculateTarget, generateMealPlan, sumMeals } from './nutrition'
import { defaultRecipes, defaultState } from '../data/defaults'
import type { Profile } from '../types'

// 27岁基准档案：公式验算专用，与实际默认值（中性空档案）分离，避免测试依赖真实身体数据。
const baselineProfile: Profile = {
  ...defaultState.profile,
  age: 27, heightCm: 176, weightKg: 108, targetWeightKg: 80,
  trainingCalories: 2646, restCalories: 2430, proteinGrams: 172.8,
  trainingFatGrams: 97.2, restFatGrams: 97.2
}

describe('营养计算', () => {
  it('按Mifflin-St Jeor计算男性基础代谢', () => {
    expect(calculateBmr(baselineProfile)).toBe(2050)
  })

  it('训练日按当前体重系数计算三大营养素', () => {
    const target = calculateTarget(baselineProfile, true)
    expect(target.calories).toBe(2646)
    expect(target.protein).toBe(172.8)
    expect(target.fat).toBe(97.2)
    expect(target.carbs).toBe(270)
  })

  it('为指定餐数生成有效份量', () => {
    const target = calculateTarget(baselineProfile, true)
    const plan = generateMealPlan(defaultRecipes, 3, target, [], 100)
    expect(plan).toHaveLength(3)
    expect(plan.every((meal) => meal.servings >= 0.5 && meal.servings <= 2)).toBe(true)
    expect(sumMeals(plan, defaultRecipes).calories).toBeGreaterThan(0)
  })
})
