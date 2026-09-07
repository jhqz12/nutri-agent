import { rawLibraryVersions, rawLibraries } from '../data'
import type {
  AppState, DayType, EngineResult, FoodRecord, FormulaRecord, MacroResult,
  MealEnergyRule, MenuItem, NutrientLedgerRow, RawLibraries, SupplementRecord
} from '../nutritionTypes'
import { getEffectiveLibraries, getLibraryVersion } from './overlay'
import { getFoodCategory, getGeneratedFoodStepGrams, mergeDuplicateMenuItems, normalizeGeneratedFoodGrams, normalizeMenuItemToGrams } from './foodUnits'
import { limitMenuVariety } from './mealPlanner'
import { calculateMealCalories, mealCalorieRange } from './mealEnergy'

const round = (value: number, digits = 0) => Number(value.toFixed(digits))

export function determineDayType(state: AppState, date = new Date()): DayType {
  if (state.manual.dayType) return state.manual.dayType
  if (state.profile.plannedDayType) return state.profile.plannedDayType
  const start = new Date(`${state.profile.cycleStartDate}T00:00:00`)
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const days = Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86400000))
  const sequence: DayType[] = state.profile.trainingPattern === '练3休1'
    ? ['推', '拉', '腿', '休']
    : ['推', '休', '拉', '休', '腿', '休']
  return sequence[days % sequence.length]
}

export function getEffectiveLibrariesForState(state: AppState): RawLibraries {
  const baseLibraries: RawLibraries = {
    ...rawLibraries,
    foods: [...rawLibraries.foods, ...(state.customFoods ?? [])],
    supplements: [...rawLibraries.supplements, ...(state.customSupplements ?? [])],
    formulas: [...rawLibraries.formulas, ...(state.customFormulas ?? [])]
  }
  return getEffectiveLibraries(baseLibraries, state.overrides)
}

export function isFormulaAvailable(state: AppState, formula: FormulaRecord): boolean {
  if (!formula.requiresBodyFat) return true
  const bodyFat = state.profile.bodyFatPercent
  return bodyFat !== null && Number.isFinite(bodyFat) && bodyFat > 0 && bodyFat < 80
}

function calculateBmr(state: AppState, formula: FormulaRecord): number {
  const { sex, weightKg, heightCm, age, bodyFatPercent } = state.profile
  if (formula.energyEquation === 'revisedHarrisBenedict') {
    return sex === '男'
      ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
      : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age
  }
  if (formula.energyEquation === 'cunningham') {
    if (bodyFatPercent === null || bodyFatPercent <= 0 || bodyFatPercent >= 80) throw new Error('Cunningham公式需要可靠体脂率。')
    const fatFreeMassKg = weightKg * (1 - bodyFatPercent / 100)
    return 500 + 22 * fatFreeMassKg
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === '男' ? 5 : -161)
}

export function calculateMacro(state: AppState, formula: FormulaRecord, date = new Date()): MacroResult {
  const { weightKg } = state.profile
  const bmr = Math.round(calculateBmr(state, formula))
  const tdee = Math.round(bmr * formula.activityFactor)
  const dayType = determineDayType(state, date)
  const isRestDay = dayType === '休'
  const protein = round(weightKg * formula.proteinPerKg, 1)
  const fat = round(weightKg * formula.fatPerKg, 1)
  const ratioCarbs = round(weightKg * (isRestDay ? formula.restCarbsPerKg : formula.trainingCarbsPerKg), 1)
  const trainingTarget = Math.max(bmr, tdee - formula.calorieDeficit)
  const energyTarget = isRestDay ? Math.round(trainingTarget * formula.restCaloriesFactor) : trainingTarget
  const ratioTarget = Math.round(protein * 4 + fat * 9 + ratioCarbs * 4)
  const calculatedTarget = formula.macroMode === 'weightRatios' ? ratioTarget : energyTarget
  const targetCalories = state.manual.targetCalories === null ? Math.max(bmr, calculatedTarget) : Math.max(bmr, Math.round(state.manual.targetCalories))
  const carbs = state.manual.targetCalories !== null || formula.macroMode === 'remainingCalories'
    ? round(Math.max(0, (targetCalories - protein * 4 - fat * 9) / 4), 1)
    : ratioCarbs
  return {
    bmr, tdee, targetCalories, protein, fat, carbs, dayType, isRestDay,
    usedManualCalories: state.manual.targetCalories !== null,
    formulaId: formula.id,
    formulaName: formula.name,
    energyEquation: formula.energyEquation,
    formulaFallbackReason: null
  }
}

function foodScale(food: FoodRecord, item: MenuItem): number {
  if (item.unit === 'g') return item.amount / 100
  if (food.gramsPerUnit) return item.amount * food.gramsPerUnit / 100
  return item.amount * food.servingAmount / 100
}

export function calculateMenuTotals(menu: MenuItem[], foods: FoodRecord[]) {
  return menu.reduce((total, item) => {
    const food = foods.find((entry) => entry.id === item.foodId)
    if (!food) return total
    const scale = foodScale(food, item)
    total.calories += food.calories * scale
    total.protein += (food.protein ?? 0) * scale
    total.fat += (food.fat ?? 0) * scale
    total.carbs += (food.carbs ?? 0) * scale
    total.fiber += (food.fiber ?? 0) * scale
    return total
  }, { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 })
}

export function calculateDailyTotals(state: AppState, libraries: RawLibraries, locks: Record<string, string>, menu: MenuItem[]) {
  const totals = calculateMenuTotals(menu, libraries.foods)
  for (const dose of state.supplementDoses.filter((item) => item.enabled && !locks[item.supplementId])) {
    const supplement = libraries.supplements.find((item) => item.id === dose.supplementId)
    if (!supplement) continue
    totals.calories += (supplement.calories ?? 0) * dose.amount
    totals.protein += (supplement.nutrients.protein ?? 0) * dose.amount
    totals.fat += (supplement.nutrients.fat ?? 0) * dose.amount
    totals.carbs += (supplement.nutrients.carbs ?? 0) * dose.amount
  }
  return {
    calories: round(totals.calories), protein: round(totals.protein, 1), fat: round(totals.fat, 1),
    carbs: round(totals.carbs, 1), fiber: round(totals.fiber, 1)
  }
}

type MainMeal = '早餐' | '午餐' | '晚餐'

function maximumFoodGrams(food: FoodRecord, meal: MainMeal): number {
  if (/鸡蛋/.test(food.name)) return (food.gramsPerUnit ?? 50) * 4
  if (/酸奶/.test(food.name) && food.servingUnit === '杯') return food.gramsPerUnit ?? 200
  const category = getFoodCategory(food)
  if (category === '主食') return meal === '早餐' ? 200 : meal === '午餐' ? 400 : 350
  if (category === '蛋白质') return meal === '早餐' ? 250 : meal === '午餐' ? 300 : 250
  if (category === '脂肪') return 30
  return 0
}

function chooseExistingFoodToIncrease(menu: MenuItem[], foods: FoodRecord[], meal: MainMeal, macro: MacroResult): MenuItem | null {
  const totals = calculateMenuTotals(menu, foods)
  const nutrientDeficits = {
    protein: Math.max(0, macro.protein - totals.protein),
    fat: Math.max(0, macro.fat - totals.fat),
    carbs: Math.max(0, macro.carbs - totals.carbs)
  }
  const candidates = menu.flatMap((item) => {
    if (item.meal !== meal) return []
    const food = foods.find((entry) => entry.id === item.foodId)
    if (!food) return []
    const maximum = maximumFoodGrams(food, meal)
    if (maximum <= 0 || item.amount >= maximum) return []
    const step = getGeneratedFoodStepGrams(food)
    const actualStep = Math.min(step, maximum - item.amount)
    const scale = actualStep / 100
    const usefulness =
      Math.min(nutrientDeficits.protein, (food.protein ?? 0) * scale) / Math.max(1, macro.protein) * 2 +
      Math.min(nutrientDeficits.fat, (food.fat ?? 0) * scale) / Math.max(1, macro.fat) * 1.5 +
      Math.min(nutrientDeficits.carbs, (food.carbs ?? 0) * scale) / Math.max(1, macro.carbs)
    return [{ item, calories: food.calories * scale, usefulness }]
  })
  if (!candidates.length) return null
  candidates.sort((left, right) => right.usefulness - left.usefulness || right.calories - left.calories)
  return candidates[0].item
}

function fillMealsToTargets(menu: MenuItem[], foods: FoodRecord[], macro: MacroResult, energyRules: MealEnergyRule[]): void {
  const mealOrder: MainMeal[] = ['早餐', '午餐', '晚餐']
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const mealCalories = calculateMealCalories(menu, foods)
    const mealsBelowTarget = mealOrder
      .map((meal) => {
        const rule = energyRules.find((item) => item.meal === meal)
        const target = rule ? mealCalorieRange(macro.targetCalories, rule).target : 0
        return { meal, target, gap: target - mealCalories[meal] }
      })
      .filter((item) => item.gap > 8)
      .sort((left, right) => right.gap / Math.max(1, right.target) - left.gap / Math.max(1, left.target))
    if (!mealsBelowTarget.length) break

    let adjusted = false
    for (const mealTarget of mealsBelowTarget) {
      const selected = chooseExistingFoodToIncrease(menu, foods, mealTarget.meal, macro)
      if (!selected) continue
      const food = foods.find((entry) => entry.id === selected.foodId)!
      const maximum = maximumFoodGrams(food, mealTarget.meal)
      const normalStep = getGeneratedFoodStepGrams(food)
      const caloriesPerGram = food.calories / 100
      const gramsForGap = caloriesPerGram > 0 ? Math.max(1, Math.round(mealTarget.gap / caloriesPerGram)) : normalStep
      const step = Math.min(normalStep, gramsForGap, maximum - selected.amount)
      if (step <= 0) continue
      selected.amount = Math.round((selected.amount + step) * 10) / 10
      adjusted = true
      break
    }
    if (!adjusted) break
  }
}

function minimumFoodGrams(food: FoodRecord, meal: MainMeal): number {
  if (food.gramsPerUnit && ['个', '片', '袋', '杯', '瓶'].includes(food.servingUnit)) return food.gramsPerUnit
  const category = getFoodCategory(food)
  if (category === '主食') return meal === '早餐' ? 50 : 100
  if (category === '蛋白质') return 50
  if (category === '脂肪') return 5
  return 0
}

function macroDistance(totals: ReturnType<typeof calculateMenuTotals>, macro: MacroResult): number {
  return (
    ((totals.protein - macro.protein) / Math.max(1, macro.protein)) ** 2 +
    ((totals.fat - macro.fat) / Math.max(1, macro.fat)) ** 2 +
    ((totals.carbs - macro.carbs) / Math.max(1, macro.carbs)) ** 2
  )
}

function balanceMacronutrients(menu: MenuItem[], foods: FoodRecord[], macro: MacroResult): void {
  const mainMeals: MainMeal[] = ['早餐', '午餐', '晚餐']
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const totals = calculateMenuTotals(menu, foods)
    const currentDistance = macroDistance(totals, macro)
    let bestChange: { source: MenuItem; target: MenuItem; removeGrams: number; addGrams: number; distance: number } | null = null

    for (const meal of mainMeals) {
      const adjustable = menu.flatMap((item) => {
        if (item.meal !== meal) return []
        const food = foods.find((entry) => entry.id === item.foodId)
        if (!food || maximumFoodGrams(food, meal) <= 0 || food.calories <= 0) return []
        return [{ item, food }]
      })
      for (const source of adjustable) {
        const minimum = minimumFoodGrams(source.food, meal)
        if (source.item.amount <= minimum) continue
        const normalRemove = getGeneratedFoodStepGrams(source.food)
        for (const target of adjustable) {
          if (target.item === source.item) continue
          const maximum = maximumFoodGrams(target.food, meal)
          if (target.item.amount >= maximum) continue
          const removableCalories = Math.min(normalRemove, source.item.amount - minimum) * source.food.calories / 100
          const addableCalories = (maximum - target.item.amount) * target.food.calories / 100
          const transferCalories = Math.min(removableCalories, addableCalories)
          if (transferCalories <= 0) continue
          const removeGrams = transferCalories / source.food.calories * 100
          const addGrams = transferCalories / target.food.calories * 100
          const nextTotals = {
            ...totals,
            protein: totals.protein - (source.food.protein ?? 0) * removeGrams / 100 + (target.food.protein ?? 0) * addGrams / 100,
            fat: totals.fat - (source.food.fat ?? 0) * removeGrams / 100 + (target.food.fat ?? 0) * addGrams / 100,
            carbs: totals.carbs - (source.food.carbs ?? 0) * removeGrams / 100 + (target.food.carbs ?? 0) * addGrams / 100
          }
          const distance = macroDistance(nextTotals, macro)
          if (distance < currentDistance - 0.000001 && (!bestChange || distance < bestChange.distance)) {
            bestChange = { source: source.item, target: target.item, removeGrams, addGrams, distance }
          }
        }
      }
    }
    if (!bestChange) break
    bestChange.source.amount = Math.round((bestChange.source.amount - bestChange.removeGrams) * 10) / 10
    bestChange.target.amount = Math.round((bestChange.target.amount + bestChange.addGrams) * 10) / 10
  }
}

function balanceMainCourseEnergy(menu: MenuItem[], foods: FoodRecord[], macro: MacroResult, energyRules: MealEnergyRule[]): void {
  const dinnerRule = energyRules.find((item) => item.meal === '晚餐')
  const lunchRule = energyRules.find((item) => item.meal === '午餐')
  if (!dinnerRule || !lunchRule) return
  const dinnerMain = menu.find((item) => {
    const food = foods.find((entry) => entry.id === item.foodId)
    return item.meal === '晚餐' && Boolean(food && getFoodCategory(food) === '主食')
  })
  const lunchMain = menu.find((item) => {
    const food = foods.find((entry) => entry.id === item.foodId)
    return item.meal === '午餐' && Boolean(food && getFoodCategory(food) === '主食')
  })
  const dinnerFood = foods.find((food) => food.id === dinnerMain?.foodId)
  const lunchFood = foods.find((food) => food.id === lunchMain?.foodId)
  if (!dinnerMain || !lunchMain || !dinnerFood || !lunchFood || dinnerFood.calories <= 0 || lunchFood.calories <= 0) return
  const dinnerRange = mealCalorieRange(macro.targetCalories, dinnerRule)
  const lunchRange = mealCalorieRange(macro.targetCalories, lunchRule)
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const totals = calculateMealCalories(menu, foods)
    if (totals.晚餐 >= dinnerRange.min || totals.午餐 <= lunchRange.min) break
    const addGrams = 10
    const addedCalories = dinnerFood.calories * addGrams / 100
    const removeGrams = Math.max(10, Math.round(addedCalories / lunchFood.calories * 10) * 10)
    if (lunchMain.amount - removeGrams < 100) break
    dinnerMain.amount += addGrams
    lunchMain.amount -= removeGrams
  }
}

export function generateMenu(baseMenu: MenuItem[], foods: FoodRecord[], macro: MacroResult, energyRules: MealEnergyRule[]): MenuItem[] {
  const normalized = structuredClone(baseMenu).map((item) => normalizeMenuItemToGrams(item, foods.find((food) => food.id === item.foodId)))
  const menu = limitMenuVariety(mergeDuplicateMenuItems(normalized, foods), foods)
  const nutAmount = macro.isRestDay ? 20 : 30
  const nuts = menu.filter((item) => item.meal === '坚果')
  const currentNuts = nuts.reduce((sum, item) => sum + item.amount, 0)
  if (currentNuts > 0) nuts.forEach((item) => { item.amount = Math.round(nutAmount * item.amount / currentNuts / 5) * 5 })

  fillMealsToTargets(menu, foods, macro, energyRules)
  balanceMacronutrients(menu, foods, macro)
  const limited = limitMenuVariety(mergeDuplicateMenuItems(menu, foods), foods)
  balanceMainCourseEnergy(limited, foods, macro, energyRules)
  limited.forEach((item) => {
    const food = foods.find((entry) => entry.id === item.foodId)
    if (food) item.amount = normalizeGeneratedFoodGrams(food, item.amount)
  })
  return limited
}

function createSupplementLocks(state: AppState): Record<string, string> {
  const fenugreek = state.supplementDoses.find((item) => item.supplementId === 'S01' && item.enabled)
  if ((fenugreek?.amount ?? 0) >= 2) {
    return { S16: '葫芦巴2粒按锌40mg计算，已占满锌UL；当日禁止锌镁硼硒片。' }
  }
  return {}
}

function sumFoodNutrients(menu: MenuItem[], foods: FoodRecord[]) {
  const totals: Record<string, number> = {}
  const unknown = new Set<string>()
  for (const item of menu) {
    const food = foods.find((entry) => entry.id === item.foodId)
    if (!food) continue
    const scale = foodScale(food, item)
    for (const [key, value] of Object.entries(food.micronutrients)) {
      if (key === 'fiber') continue
      if (value === null) unknown.add(key)
      else totals[key] = (totals[key] ?? 0) + value * scale
    }
    if (food.fiber === null) unknown.add('fiber')
    else totals.fiber = (totals.fiber ?? 0) + food.fiber * scale
  }
  return { totals, unknown }
}

function sumSupplementNutrients(state: AppState, supplements: SupplementRecord[], locks: Record<string, string>) {
  const totals: Record<string, number> = {}
  const unknown = new Set<string>()
  for (const dose of state.supplementDoses.filter((item) => item.enabled && !locks[item.supplementId])) {
    const supplement = supplements.find((entry) => entry.id === dose.supplementId)
    if (!supplement) continue
    for (const [key, value] of Object.entries(supplement.nutrients)) {
      if (value === null) unknown.add(key)
      else totals[key] = (totals[key] ?? 0) + value * dose.amount
    }
  }
  return { totals, unknown }
}

function buildLedger(state: AppState, libraries: RawLibraries, locks: Record<string, string>, menu: MenuItem[]): NutrientLedgerRow[] {
  const foodLine = sumFoodNutrients(menu, libraries.foods)
  const supplementLine = sumSupplementNutrients(state, libraries.supplements, locks)
  return libraries.standards.map((standard) => {
    const food = foodLine.totals[standard.id] ?? 0
    const supplement = supplementLine.totals[standard.id] ?? 0
    const total = food + supplement
    const hasGap = foodLine.unknown.has(standard.id) || supplementLine.unknown.has(standard.id)
    let status: NutrientLedgerRow['status'] = total < standard.targetMin ? '不足' : '达标'
    const amountForUpperLimit = standard.ulScope === '仅补剂' ? supplement : total
    if (standard.ul !== null && amountForUpperLimit > standard.ul) status = '超量'
    else if (hasGap && total === 0) status = '数据缺口'
    const gap = Math.max(0, standard.targetMin - total)
    const foodSuggestions = status === '不足'
      ? libraries.foods
        .flatMap((candidate) => {
          const amountPer100g = standard.id === 'fiber' ? candidate.fiber : candidate.micronutrients[standard.id]
          if (typeof amountPer100g !== 'number' || amountPer100g <= 0) return []
          const grams = Math.max(10, Math.ceil(gap / amountPer100g * 10) * 10)
          if (!Number.isFinite(grams) || grams > 500) return []
          return [{ foodId: candidate.id, foodName: candidate.name, grams, nutrientAmount: round(amountPer100g * grams / 100, 1) }]
        })
        .sort((a, b) => a.grams - b.grams)
        .slice(0, 3)
      : []
    const advice = status === '超量' ? `${standard.ulScope === '仅补剂' ? '补剂来源' : '合计'}超过UL ${standard.ul}${standard.unit}，必须削减。`
      : status === '不足' ? `缺口${round(standard.targetMin - total, 1)}${standard.unit}，优先食补并评估单方补剂。`
        : status === '数据缺口' ? '当前原始库没有足够数值，请在覆盖层补录。' : '当前范围达标。'
    return {
      id: standard.id, name: standard.name, unit: standard.unit, target: standard.targetMin, ul: standard.ul,
      food: round(food, 2), supplement: round(supplement, 2), total: round(total, 2), status, advice,
      priority: state.focusNutrientIds.includes(standard.id) ? '重点' : '一般', foodSuggestions
    }
  })
}

function calculateFattyAcids(menu: MenuItem[], foods: FoodRecord[]) {
  let omega6 = 0; let omega3 = 0; let saturated = 0
  for (const item of menu) {
    const food = foods.find((entry) => entry.id === item.foodId)
    if (!food) continue
    const scale = foodScale(food, item)
    omega6 += (food.fattyAcids.omega6 ?? 0) * scale
    omega3 += (food.fattyAcids.omega3 ?? 0) * scale
    saturated += (food.fattyAcids.saturated ?? 0) * scale
  }
  return { omega6: round(omega6, 2), omega3: round(omega3, 2), ratio: omega3 > 0 ? round(omega6 / omega3, 2) : null, saturated: round(saturated, 2) }
}

function versionStamp(state: AppState) {
  return (Object.keys(rawLibraryVersions) as Array<keyof typeof rawLibraryVersions>)
    .map((library) => `${rawLibraryVersions[library]}+覆盖${getLibraryVersion(state.overrides, library)}`)
    .join(' | ') + ` | 用户食材${state.customFoods.length} | 用户补剂${state.customSupplements.length} | 用户公式${state.customFormulas.length}`
}

export function evaluateFourteenDayTrend(state: AppState, formula: FormulaRecord): string {
  const logs = [...state.bodyLogs].sort((a, b) => a.date.localeCompare(b.date))
  if (logs.length < 2) return '14天趋势数据不足：继续记录体重后再执行迭代。'
  const latest = logs[logs.length - 1]
  const latestDate = new Date(`${latest.date}T00:00:00`)
  const candidates = logs.filter((log) => {
    const difference = (latestDate.getTime() - new Date(`${log.date}T00:00:00`).getTime()) / 86400000
    return difference >= 13
  })
  if (!candidates.length) return '14天趋势数据不足：尚未覆盖完整评估窗口。'
  const start = candidates[candidates.length - 1]
  const change = round(latest.weightKg - start.weightKg, 1)
  if (change <= -2) return `14天体重下降${Math.abs(change)}kg：最新体重已进入公式，宏量和菜单已重算。`
  if (Math.abs(change) < 0.2) return '14天体重基本无变化：建议每日碳水减少15～20g，蛋白质和脂肪保持不变；等待用户确认后应用。'
  return `14天体重变化${change > 0 ? '+' : ''}${change}kg：维持当前缺口并继续观察。`
}

export function calculateEngine(state: AppState, date = new Date()): EngineResult {
  const libraries = getEffectiveLibrariesForState(state)
  const requestedFormula = libraries.formulas.find((item) => item.id === state.manual.formulaId) ?? libraries.formulas[0]
  const formula = requestedFormula && isFormulaAvailable(state, requestedFormula)
    ? requestedFormula
    : libraries.formulas.find((item) => isFormulaAvailable(state, item))
  if (!formula) throw new Error('公式库为空，无法计算。')
  const macro = calculateMacro(state, formula, date)
  if (requestedFormula && requestedFormula.id !== formula.id) macro.formulaFallbackReason = `${requestedFormula.name}缺少所需身体数据，已临时使用${formula.name}。`
  const menu = generateMenu(state.menu, libraries.foods, macro, state.mealEnergyRules)
  const supplementLocks = createSupplementLocks(state)
  const actual = calculateDailyTotals(state, libraries, supplementLocks, menu)
  const ledger = buildLedger(state, libraries, supplementLocks, menu)
  const fattyAcids = calculateFattyAcids(menu, libraries.foods)
  const notices = [
    state.manual.dayType ? `今日训练属性已手动覆盖为${state.manual.dayType}日。` : `今日按${state.profile.trainingPattern}自动判定为${macro.dayType}日。`,
    macro.formulaFallbackReason,
    state.manual.targetCalories !== null ? `今日热量使用手动覆盖值${macro.targetCalories}kcal。` : `今日四项目标由${formula.name}计算。`,
    ...Object.values(supplementLocks),
    state.manual.trainingIntensity >= 8 ? '今日强度较高：保留睡前抗氧化提醒，并复核锌镁总账。' : '今日训练强度未触发高强度补剂升档。',
    macro.isRestDay ? '休息日锌镁需求回落：提示评估停用葫芦巴，不自动扩大补剂剂量。' : '训练日维持锌镁需求档位，仍受RNI和UL双阈值约束。',
    evaluateFourteenDayTrend(state, formula)
  ].filter((notice): notice is string => Boolean(notice))
  return { macro, actual, menu, ledger, supplementLocks, fattyAcids, notices, versionStamp: versionStamp(state) }
}
