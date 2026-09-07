import { describe, expect, it } from 'vitest'
import { calculateBmr, calculateTarget, generateMealPlan, sumMeals } from './nutrition'
import { defaultRecipes, defaultState } from '../data/defaults'

describe('营养计算', () => {
  it('按Mifflin-St Jeor计算男性基础代谢', () => {
    expect(calculateBmr(defaultState.profile)).toBe(2050)
  })

  it('训练日按当前体重系数计算三大营养素', () => {
    const target = calculateTarget(defaultState.profile, true)
    expect(target.calories).toBe(2646)
    expect(target.protein).toBe(172.8)
    expect(target.fat).toBe(97.2)
    expect(target.carbs).toBe(270)
  })

  it('为指定餐数生成有效份量', () => {
    const target = calculateTarget(defaultState.profile, true)
    const plan = generateMealPlan(defaultRecipes, 3, target, [], 100)
    expect(plan).toHaveLength(3)
    expect(plan.every((meal) => meal.servings >= 0.5 && meal.servings <= 2)).toBe(true)
    expect(sumMeals(plan, defaultRecipes).calories).toBeGreaterThan(0)
  })
})
