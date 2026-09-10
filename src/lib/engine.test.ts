import { describe, expect, it } from 'vitest'
import { rawLibraries } from '../data'
import { calculateEngine, calculateMacro, calculateMenuTotals, evaluateFourteenDayTrend, generateMenu, getEffectiveLibrariesForState, isFormulaAvailable } from './engine'
import { displayMealName, getFoodCategory } from './foodUnits'
import { calculateMealCalories } from './mealEnergy'
import { createMenuIdea } from './mealPlanner'
import { defaultState } from './nutritionStorage'

// 27岁基准档案：公式验算专用，与实际默认值（中性空档案）分离，避免测试依赖真实身体数据。
const BASELINE_PROFILE = { age: 27, heightCm: 176, weightKg: 108 }

function baselineState() {
  const state = structuredClone(defaultState)
  state.profile = { ...state.profile, ...BASELINE_PROFILE }
  return state
}

describe('27岁基准验算', () => {
  it('输出确认后的硬基准', () => {
    const formula = rawLibraries.formulas[0]
    const training = calculateMacro({ ...baselineState(), manual: { ...baselineState().manual, dayType: '推' } }, formula, new Date('2026-08-02'))
    const rest = calculateMacro({ ...baselineState(), manual: { ...baselineState().manual, dayType: '休' } }, formula, new Date('2026-08-02'))

    expect(training).toMatchObject({ bmr: 2050, tdee: 3178, targetCalories: 2646, protein: 172.8, fat: 97.2, carbs: 270 })
    expect(rest).toMatchObject({ bmr: 2050, tdee: 3178, targetCalories: 2430, protein: 172.8, fat: 97.2, carbs: 216 })
  })

  it('手动热量低于BMR时自动锁定为BMR', () => {
    const formula = rawLibraries.formulas[0]
    const state = { ...baselineState(), manual: { ...baselineState().manual, dayType: '推' as const, targetCalories: 1200 } }
    expect(calculateMacro(state, formula).targetCalories).toBe(2050)
  })
})

describe('专业公式边界', () => {
  it('修订Harris-Benedict可以作为对照公式计算', () => {
    const formula = rawLibraries.formulas.find((item) => item.id === 'FORMULA_03')!
    const result = calculateMacro(baselineState(), formula)

    expect(result.energyEquation).toBe('revisedHarrisBenedict')
    expect(result.bmr).toBeGreaterThan(0)
    expect(result.targetCalories).toBeGreaterThanOrEqual(result.bmr)
  })

  it('Cunningham缺少体脂率时不可启用', () => {
    const formula = rawLibraries.formulas.find((item) => item.id === 'FORMULA_04')!

    expect(isFormulaAvailable(baselineState(), formula)).toBe(false)
  })

  it('Cunningham填写可靠体脂率后可以计算', () => {
    const formula = rawLibraries.formulas.find((item) => item.id === 'FORMULA_04')!
    const state = baselineState()
    state.profile.bodyFatPercent = 30
    const result = calculateMacro(state, formula)

    expect(isFormulaAvailable(state, formula)).toBe(true)
    expect(result.energyEquation).toBe('cunningham')
    expect(result.bmr).toBe(2163)
  })
})

describe('补剂冲突', () => {
  it('葫芦巴2粒时锁死锌镁硼硒片', () => {
    const result = calculateEngine(baselineState())
    expect(result.supplementLocks.S16).toContain('锌40mg')
  })
})

describe('微量元素上限口径', () => {
  it('食物镁超过350mg不会误判为补剂超量', () => {
    const magnesium = calculateEngine(baselineState()).ledger.find((row) => row.id === 'magnesium')
    expect(magnesium?.food).toBeGreaterThan(350)
    expect(magnesium?.status).not.toBe('超量')
  })
})

describe('用户扩展食材库', () => {
  it('用户新增食材会进入有效库并参与食补候选计算', () => {
    const state = baselineState()
    const source = rawLibraries.foods[0]
    state.customFoods = [{
      ...source,
      id: 'UF-TEST',
      name: '测试维生素K食材',
      userAdded: true,
      micronutrients: { ...source.micronutrients, vitaminK: 800 }
    }]

    expect(getEffectiveLibrariesForState(state).foods.some((food) => food.id === 'UF-TEST')).toBe(true)
    const vitaminK = calculateEngine(state).ledger.find((row) => row.id === 'vitaminK')
    if (vitaminK?.status === '不足') {
      expect(vitaminK.foodSuggestions.some((item) => item.foodId === 'UF-TEST')).toBe(true)
    }
  })
})

describe('随机菜单克重平衡', () => {
  it('只调整已选食材，并把三餐与全天热量拉回可执行范围', () => {
    const state = baselineState()
    state.manual.dayType = '推'
    const foods = getEffectiveLibrariesForState(state).foods
    const macro = calculateMacro(state, rawLibraries.formulas[0], new Date('2026-08-04'))
    const idea = createMenuIdea(foods, state.menu, () => 0.42)
    const originalFoodIds = new Set(idea.map((item) => item.foodId))
    const menu = generateMenu(idea, foods, macro, state.mealEnergyRules)
    const totals = calculateMenuTotals(menu, foods)
    const meals = calculateMealCalories(menu, foods)

    expect(totals.calories).toBeGreaterThanOrEqual(macro.targetCalories * 0.92)
    expect(totals.calories).toBeLessThanOrEqual(macro.targetCalories * 1.08)
    expect(totals.protein).toBeGreaterThanOrEqual(macro.protein * 0.85)
    expect(totals.protein).toBeLessThanOrEqual(macro.protein * 1.15)
    expect(totals.fat).toBeGreaterThanOrEqual(macro.fat * 0.85)
    expect(totals.fat).toBeLessThanOrEqual(macro.fat * 1.15)
    expect(totals.carbs).toBeGreaterThanOrEqual(macro.carbs * 0.85)
    expect(totals.carbs).toBeLessThanOrEqual(macro.carbs * 1.15)
    expect(meals.早餐).toBeLessThan(meals.午餐)
    expect(menu.every((item) => originalFoodIds.has(item.foodId))).toBe(true)
    expect(new Set(menu.map((item) => `${item.meal}:${item.foodId}`)).size).toBe(menu.length)
    const eggs = menu.filter((item) => item.foodId === 'F01')
    expect(eggs.every((item) => item.amount <= 200 && item.amount % 50 === 0)).toBe(true)
    const yogurt = menu.filter((item) => item.foodId === 'F28')
    expect(yogurt.every((item) => item.amount === 200)).toBe(true)

    for (const meal of ['早餐', '午餐', '晚餐'] as const) {
      const mealItems = menu.filter((item) => displayMealName(item.meal) === meal)
      const categories = mealItems.map((item) => getFoodCategory(foods.find((food) => food.id === item.foodId)!))
      expect(categories.filter((category) => category === '主食')).toHaveLength(1)
      expect(categories.filter((category) => category === '蛋白质').length).toBeLessThanOrEqual(2)
    }
    for (const item of menu) {
      const category = getFoodCategory(foods.find((food) => food.id === item.foodId)!)
      if (category === '水果' || category === '坚果') expect(displayMealName(item.meal)).toBe('加餐')
    }
  })
})

describe('14天趋势管线', () => {
  it('完整窗口无变化时提示减少碳水', () => {
    const state = baselineState()
    state.bodyLogs = [
      { ...state.bodyLogs[0], id: 'start', date: '2026-08-01', weightKg: 108 },
      { ...state.bodyLogs[0], id: 'end', date: '2026-08-15', weightKg: 108 }
    ]
    expect(evaluateFourteenDayTrend(state, rawLibraries.formulas[0])).toContain('碳水减少15～20g')
  })
})
