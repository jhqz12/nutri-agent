import { describe, expect, it } from 'vitest'
import { rawLibraries } from '../data'
import { calculateMealCalories, defaultMealEnergyRules, mealCalorieRange, normalizeMealEnergyRules } from './mealEnergy'

describe('餐次热量规则', () => {
  it('默认范围保证午餐高于早餐', () => {
    const breakfast = defaultMealEnergyRules.find((item) => item.meal === '早餐')!
    const lunch = defaultMealEnergyRules.find((item) => item.meal === '午餐')!
    expect(breakfast.maxPercent).toBeLessThan(lunch.minPercent)
    expect(mealCalorieRange(2646, lunch)).toEqual({ min: 926, target: 1058, max: 1191 })
  })

  it('不完整旧设置会补齐四餐默认值', () => {
    expect(normalizeMealEnergyRules([{ meal: '早餐', minPercent: 22, targetPercent: 25, maxPercent: 28 }])).toHaveLength(4)
  })

  it('按菜单克重计算每餐热量', () => {
    const totals = calculateMealCalories([{ foodId: 'F01', meal: '早餐', amount: 100, unit: 'g' }], rawLibraries.foods)
    expect(totals.早餐).toBe(143)
  })
})
