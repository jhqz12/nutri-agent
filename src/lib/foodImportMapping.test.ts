import { describe, expect, it } from 'vitest'
import { autoMapFoodColumns, missingFoodImportFields } from './foodImportMapping'

describe('食物表格自动识别', () => {
  it('能识别截图中带单位括号的表头且单位可缺省', () => {
    const mapping = autoMapFoodColumns(['食材', '热量 (kcal)', '蛋白质 (g)', '脂肪 (g)', '碳水 (g)', '钾 (mg)', '镁 (mg)', '铁 (mg)', '锌 (mg)', '钙 (mg)', '硒 (μg)', '核心微量元素作用'])
    expect(mapping.name).toBe('食材')
    expect(mapping.calories).toBe('热量 (kcal)')
    expect(mapping.potassium).toBe('钾 (mg)')
    expect(mapping.unit).toBe('')
    expect(missingFoodImportFields(mapping)).toEqual([])
  })

  it('只有千焦也允许确认导入', () => {
    expect(missingFoodImportFields(autoMapFoodColumns(['食品名称', '能量(kJ)']))).toEqual([])
  })
})
