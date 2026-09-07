import { describe, expect, it } from 'vitest'
import { calculateMacroCalories, kilocaloriesToKilojoules, kilojoulesToKilocalories } from './foodEnergy'

describe('食材能量换算', () => {
  it('千卡与千焦可以双向换算', () => {
    expect(kilocaloriesToKilojoules(100)).toBe(418.4)
    expect(kilojoulesToKilocalories(418.4)).toBe(100)
  })

  it('按蛋白质脂肪碳水计算4/9/4估算值', () => {
    expect(calculateMacroCalories(10, 5, 20)).toBe(165)
  })
})
