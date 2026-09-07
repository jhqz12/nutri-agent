import { describe, expect, it } from 'vitest'
import { parseRecipeText } from './recipeTextParser'

describe('食谱文本识别', () => {
  it('识别带标签的中文食谱', () => {
    const result = parseRecipeText('鸡腿蔬菜饭，餐别：食堂，食材：米饭200克、鸡腿肉180克、蔬菜300克，热量：720千卡，蛋白质：55克，脂肪：22克，碳水：76克，价格：中')

    expect(result.warnings).toHaveLength(0)
    expect(result.recipes).toHaveLength(1)
    expect(result.recipes[0]).toMatchObject({ name: '鸡腿蔬菜饭', category: '午餐', calories: 720, protein: 55, fat: 22, carbs: 76, price: '中' })
  })

  it('支持竖线分隔并给可选字段默认值', () => {
    const result = parseRecipeText('金枪鱼拌饭 | 外食 | 热量930kcal | 蛋白质66g | 脂肪30g | 碳水96g')

    expect(result.recipes[0]).toMatchObject({ name: '金枪鱼拌饭', category: '晚餐', servingLabel: '1份', source: '文字识别导入' })
  })

  it('营养数据不完整时不导入并说明缺项', () => {
    const result = parseRecipeText('鸡蛋汤，热量120千卡，蛋白质10克')

    expect(result.recipes).toHaveLength(0)
    expect(result.warnings[0]).toContain('脂肪、碳水')
  })
})
