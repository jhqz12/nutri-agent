import { beforeEach, describe, expect, it } from 'vitest'
import { rawLibraries } from '../data'
import { createInitialState, loadState } from './nutritionStorage'

beforeEach(() => localStorage.clear())

describe('恢复初始数据', () => {
  it('恢复基准档案并清空覆盖记录', () => {
    const first = createInitialState()
    const second = createInitialState()

    expect(first.profile).toMatchObject({ age: 0, heightCm: 0, weightKg: 0, bodyFatPercent: null })
    expect(first.overrides).toEqual([])
    expect(first.customFormulas).toEqual([])
    expect(first.bodyLogs).toHaveLength(1)
    expect(first.bodyLogs[0].weightKg).toBe(0)
    expect(second.bodyLogs[0].id).not.toBe(first.bodyLogs[0].id)
  })

  it('旧菜单的个和杯会迁移成克', () => {
    localStorage.setItem('nutri-agent-state-v1', JSON.stringify({
      dataVersion: 2,
      customFoods: [],
      menu: [
        { foodId: 'F01', meal: '早餐', amount: 2, unit: '个' },
        { foodId: 'F28', meal: '早餐', amount: 1, unit: '杯' }
      ]
    }))

    const migrated = loadState()
    expect(migrated.menu).toEqual([
      { foodId: 'F01', meal: '早餐', amount: 100, unit: 'g' },
      { foodId: 'F28', meal: '早餐', amount: 200, unit: 'g' }
    ])
  })

  it('旧的重复菜单和微量区纤维会迁移为单一字段', () => {
    const source = rawLibraries.foods[0]
    localStorage.setItem('nutri-agent-state-v1', JSON.stringify({
      dataVersion: 3,
      customFoods: [{ ...source, id: 'UF-LEGACY', fiber: null, micronutrients: { ...source.micronutrients, fiber: 3 } }],
      menu: [
        { foodId: 'UF-LEGACY', meal: '早餐', amount: 50, unit: 'g' },
        { foodId: 'UF-LEGACY', meal: '早餐', amount: 50, unit: 'g' }
      ]
    }))
    const migrated = loadState()
    expect(migrated.customFoods[0].fiber).toBe(3)
    expect(migrated.customFoods[0].micronutrients.fiber).toBeUndefined()
    expect(migrated.menu).toEqual([{ foodId: 'UF-LEGACY', meal: '早餐', amount: 100, unit: 'g' }])
    expect(migrated.mealEnergyRules).toHaveLength(4)
  })
})
