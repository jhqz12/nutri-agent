import type { AppState, BodyLog, FoodRecord, MenuItem, SupplementDose } from '../nutritionTypes'
import { rawLibraries } from '../data'
import { mergeDuplicateMenuItems, normalizeMenuItemToGrams } from './foodUnits'
import { defaultMealEnergyRules, normalizeMealEnergyRules } from './mealEnergy'

const STORAGE_KEY = 'nutri-agent-state-v1'
const CURRENT_DATA_VERSION = 4
const today = new Date().toISOString().slice(0, 10)

const defaultMenu: MenuItem[] = [
  { foodId: 'F01', meal: '早餐', amount: 100, unit: 'g' },
  { foodId: 'F15', meal: '早餐', amount: 40, unit: 'g' },
  { foodId: 'F28', meal: '早餐', amount: 200, unit: 'g' },
  { foodId: 'F27', meal: '早餐', amount: 50, unit: 'g' },
  { foodId: 'F05', meal: '坚果', amount: 15, unit: 'g' },
  { foodId: 'F14', meal: '午餐', amount: 150, unit: 'g' },
  { foodId: 'F09', meal: '午餐', amount: 160, unit: 'g' },
  { foodId: 'F21', meal: '午餐', amount: 200, unit: 'g' },
  { foodId: 'F02', meal: '午餐', amount: 10, unit: 'g' },
  { foodId: 'F06', meal: '坚果', amount: 15, unit: 'g' },
  { foodId: 'F25', meal: '日间加餐', amount: 150, unit: 'g' },
  { foodId: 'F13', meal: '晚餐', amount: 120, unit: 'g' },
  { foodId: 'F12', meal: '晚餐', amount: 100, unit: 'g' },
  { foodId: 'F21', meal: '晚餐', amount: 200, unit: 'g' },
  { foodId: 'F18', meal: '晚餐', amount: 80, unit: 'g' }
]

const defaultSupplements: SupplementDose[] = [
  { supplementId: 'S01', amount: 2, enabled: true },
  { supplementId: 'S02', amount: 1, enabled: true },
  { supplementId: 'S03', amount: 1, enabled: true },
  { supplementId: 'S04', amount: 1, enabled: true },
  { supplementId: 'S05', amount: 1, enabled: true },
  { supplementId: 'S06', amount: 1, enabled: true },
  { supplementId: 'S07', amount: 1, enabled: true },
  { supplementId: 'S08', amount: 1, enabled: true },
  { supplementId: 'S09', amount: 1, enabled: true },
  { supplementId: 'S10', amount: 1, enabled: true },
  { supplementId: 'S11', amount: 1, enabled: true },
  { supplementId: 'S12', amount: 1, enabled: true },
  { supplementId: 'S14', amount: 1, enabled: true },
  { supplementId: 'S15', amount: 1, enabled: true },
  { supplementId: 'S16', amount: 1, enabled: true }
]

const firstBodyLog: BodyLog = {
  id: crypto.randomUUID(), date: today, weightKg: 108, waistCm: 110,
  systolic: null, diastolic: null, trainingIntensity: 5, calorieAdherence: 0
}

export const defaultState: AppState = {
  dataVersion: CURRENT_DATA_VERSION,
  profile: {
    sex: '男', age: 27, heightCm: 176, weightKg: 108, bodyFatPercent: null, sodiumLimitMg: 2000,
    healthFlags: ['高血压', '胰岛素抵抗'], trainingPattern: '练3休1', cycleStartDate: today
  },
  manual: { dayType: null, targetCalories: null, formulaId: 'TAN_M_02', trainingIntensity: 5 },
  overrides: [],
  customFoods: [],
  customSupplements: [],
  customFormulas: [],
  focusNutrientIds: ['vitaminD', 'vitaminC', 'vitaminB6', 'vitaminB12', 'calcium', 'magnesium', 'potassium', 'sodium', 'iron', 'zinc', 'selenium', 'epaDha', 'fiber'],
  supplementDoses: defaultSupplements,
  menu: defaultMenu,
  recipeDraft: null,
  recipeAppliedAt: null,
  mealEnergyRules: defaultMealEnergyRules,
  bodyLogs: [firstBodyLog],
  updatedAt: new Date().toISOString()
}

export function createInitialState(): AppState {
  return {
    ...structuredClone(defaultState),
    bodyLogs: [{ ...structuredClone(firstBodyLog), id: crypto.randomUUID() }],
    updatedAt: new Date().toISOString()
  }
}

export function migrateNutritionState(parsed: Partial<AppState>): AppState {
    const savedVersion = typeof parsed.dataVersion === 'number' ? parsed.dataVersion : 1
    const profile = { ...defaultState.profile, ...parsed.profile }
    if (savedVersion < 2) profile.weightKg = 108
    const customFoods = Array.isArray(parsed.customFoods) ? parsed.customFoods.map(normalizeCustomFood) : []
    const foods = [...rawLibraries.foods, ...customFoods]
    const savedMenu = Array.isArray(parsed.menu) ? parsed.menu : defaultMenu
    const menu = mergeDuplicateMenuItems(savedMenu.map((item) => normalizeMenuItemToGrams(item, foods.find((food) => food.id === item.foodId))), foods)
    const savedRecipeDraft = Array.isArray(parsed.recipeDraft) ? parsed.recipeDraft : null
    const recipeDraft = savedRecipeDraft ? mergeDuplicateMenuItems(savedRecipeDraft, foods) : null
  return {
      ...structuredClone(defaultState), ...parsed,
      dataVersion: CURRENT_DATA_VERSION,
      profile,
      manual: { ...defaultState.manual, ...parsed.manual },
      overrides: Array.isArray(parsed.overrides) ? parsed.overrides : [],
      customFoods,
      customSupplements: Array.isArray(parsed.customSupplements) ? parsed.customSupplements : [],
      customFormulas: Array.isArray(parsed.customFormulas) ? parsed.customFormulas : [],
      focusNutrientIds: Array.isArray(parsed.focusNutrientIds) ? parsed.focusNutrientIds : defaultState.focusNutrientIds,
      supplementDoses: Array.isArray(parsed.supplementDoses) ? parsed.supplementDoses : defaultSupplements,
      menu,
      recipeDraft,
      recipeAppliedAt: typeof parsed.recipeAppliedAt === 'string' ? parsed.recipeAppliedAt : null,
      mealEnergyRules: normalizeMealEnergyRules(parsed.mealEnergyRules),
      bodyLogs: Array.isArray(parsed.bodyLogs) ? parsed.bodyLogs : [firstBodyLog]
    }
}

export function hasStoredNutritionState(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return createInitialState()
    return migrateNutritionState(JSON.parse(saved) as Partial<AppState>)
  } catch {
    return createInitialState()
  }
}

function normalizeCustomFood(food: FoodRecord): FoodRecord {
  const micronutrients = { ...(food.micronutrients ?? {}) }
  const legacyFiber = micronutrients.fiber
  delete micronutrients.fiber
  return {
    ...food,
    fiber: food.fiber ?? (typeof legacyFiber === 'number' ? legacyFiber : null),
    micronutrients
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }))
}
