import { describe, expect, it } from 'vitest'
import { rawLibraries } from '../data'
import { createOverride, getEffectiveLibraries, rollbackOverride } from './overlay'

describe('原始值与覆盖层', () => {
  it('覆盖不修改原始库并可回滚', () => {
    const original = rawLibraries.foods.find((item) => item.id === 'F01')?.calories
    const overrides = createOverride([], 'foods', 'F01', { calories: 150 }, '测试覆盖')
    expect(getEffectiveLibraries(rawLibraries, overrides).foods.find((item) => item.id === 'F01')?.calories).toBe(150)
    expect(rawLibraries.foods.find((item) => item.id === 'F01')?.calories).toBe(original)
    expect(getEffectiveLibraries(rawLibraries, rollbackOverride(overrides, overrides[0].id)).foods.find((item) => item.id === 'F01')?.calories).toBe(original)
  })
})
