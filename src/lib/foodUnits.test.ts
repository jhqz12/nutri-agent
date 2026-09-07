import { describe, expect, it } from 'vitest'
import { rawLibraries } from '../data'
import { formatFoodAmount, getDefaultFoodGrams, getFoodCategory, getManualAmountWarning, mergeDuplicateMenuItems, normalizeGeneratedFoodGrams, normalizeMenuItemToGrams } from './foodUnits'

describe('食材克重换算', () => {
  it('鸡蛋按每个50克显示生活单位备注', () => {
    const egg = rawLibraries.foods.find((food) => food.id === 'F01')!
    expect(formatFoodAmount(egg, 100)).toBe('100克（约2个，每个50克）')
  })

  it('用户定义的36克常用量不被自动取整', () => {
    const milkPowder = { ...rawLibraries.foods.find((food) => food.id === 'F28')!, servingUnit: 'g' as const, servingAmount: 36, gramsPerUnit: undefined }
    expect(getDefaultFoodGrams(milkPowder)).toBe(36)
  })

  it('旧的一杯酸奶迁移为200克', () => {
    const yogurt = rawLibraries.foods.find((food) => food.id === 'F28')!
    expect(normalizeMenuItemToGrams({ foodId: 'F28', meal: '早餐', amount: 1, unit: '杯' }, yogurt)).toEqual({
      foodId: 'F28', meal: '早餐', amount: 200, unit: 'g'
    })
  })

  it('自动配餐把鸡蛋限制为最多4个并让酸奶保持整杯', () => {
    const egg = rawLibraries.foods.find((food) => food.id === 'F01')!
    const yogurt = rawLibraries.foods.find((food) => food.id === 'F28')!
    expect(normalizeGeneratedFoodGrams(egg, 483)).toBe(200)
    expect(normalizeGeneratedFoodGrams(yogurt, 0.3)).toBe(200)
  })

  it('手动超过建议只提醒，不修改用户输入', () => {
    const egg = rawLibraries.foods.find((food) => food.id === 'F01')!
    expect(getManualAmountWarning(egg, 250)).toContain('仍可保存')
  })

  it('同一餐同一食材会合并克重', () => {
    expect(mergeDuplicateMenuItems([
      { foodId: 'F23', meal: '早餐', amount: 100, unit: 'g' },
      { foodId: 'F23', meal: '早餐', amount: 50, unit: 'g' }
    ], rawLibraries.foods)).toEqual([{ foodId: 'F23', meal: '早餐', amount: 150, unit: 'g' }])
  })

  it('旧食材可以按名称和营养推断类别', () => {
    expect(getFoodCategory(rawLibraries.foods.find((food) => food.id === 'F14')!)).toBe('主食')
    expect(getFoodCategory(rawLibraries.foods.find((food) => food.id === 'F08')!)).toBe('蛋白质')
  })
})

