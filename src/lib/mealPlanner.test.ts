import { describe, expect, it } from 'vitest'
import { rawLibraries } from '../data'
import { createMenuIdea, limitMenuVariety } from './mealPlanner'
import { defaultState } from './nutritionStorage'

describe('食材库联动菜单', () => {
  it('生成结果只使用当前食材库并统一为克', () => {
    const menu = createMenuIdea(rawLibraries.foods, defaultState.menu, () => 0)
    const ids = new Set(rawLibraries.foods.map((food) => food.id))
    expect(menu.every((item) => ids.has(item.foodId))).toBe(true)
    expect(menu.every((item) => item.unit === 'g')).toBe(true)
    expect(menu.some((item) => item.meal === '日间加餐')).toBe(true)
    expect(menu.some((item) => item.meal === '坚果')).toBe(true)
  })

  it('每顿最多保留一种主食和两种蛋白质', () => {
    const menu = limitMenuVariety([
      { foodId: 'F14', meal: '午餐', amount: 100, unit: 'g' },
      { foodId: 'F16', meal: '午餐', amount: 100, unit: 'g' },
      { foodId: 'F08', meal: '午餐', amount: 100, unit: 'g' },
      { foodId: 'F09', meal: '午餐', amount: 100, unit: 'g' },
      { foodId: 'F11', meal: '午餐', amount: 100, unit: 'g' }
    ], rawLibraries.foods)
    expect(menu.filter((item) => ['F14', 'F16'].includes(item.foodId))).toHaveLength(1)
    expect(menu.filter((item) => ['F08', 'F09', 'F11'].includes(item.foodId))).toHaveLength(2)
  })
})
