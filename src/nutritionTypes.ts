export type LibraryName = 'foods' | 'supplements' | 'standards' | 'formulas' | 'exercises' | 'preferences'
export type DayType = '推' | '拉' | '腿' | '休'
export type MeasureUnit = 'g' | '个' | '片' | '袋' | '杯' | '瓶' | '碗' | '粒' | '份' | '适量'
export type FoodCategory = '主食' | '蛋白质' | '脂肪' | '蔬菜' | '水果' | '坚果' | '调味' | '其他'
export type MealGroup = '早餐' | '午餐' | '晚餐' | '加餐'
export type EnergyEquationType = 'mifflin' | 'revisedHarrisBenedict' | 'cunningham'
export type MacroCalculationType = 'weightRatios' | 'remainingCalories'

export interface NutrientMap {
  [key: string]: number | null
}

export interface FoodRecord {
  id: string
  name: string
  servingAmount: number
  servingUnit: MeasureUnit
  gramsPerUnit?: number
  calories: number
  protein: number | null
  proteinType: '动物' | '植物' | '混合' | null
  fat: number | null
  carbs: number | null
  fiber: number | null
  category?: FoodCategory
  fattyAcids: NutrientMap
  micronutrients: NutrientMap
  tendency: string[]
  rules: string[]
  rawDescription: string
  dataGaps: string[]
  sourceName?: string
  sourceUrl?: string
  userAdded?: boolean
  addedAt?: string
}

export interface SupplementRecord {
  id: string
  name: string
  servingAmount: number
  servingUnit: MeasureUnit
  nutrients: NutrientMap
  calories: number | null
  containsOil: boolean
  compound: boolean
  timing: string
  conflicts: string[]
  dataGaps: string[]
  brand?: string
  sourceName?: string
  sourceUrl?: string
  userAdded?: boolean
  addedAt?: string
}

export interface StandardRecord {
  id: string
  name: string
  unit: string
  targetMin: number
  targetMax: number | null
  ul: number | null
  ulScope: '全部来源' | '仅补剂' | '未设定'
  note: string
}

export interface FormulaRecord {
  id: string
  name: string
  active: boolean
  energyEquation: EnergyEquationType
  macroMode: MacroCalculationType
  activityFactor: number
  advancedActivityFactor: number
  calorieDeficit: number
  maxCalorieDeficit: number
  proteinPerKg: number
  fatPerKg: number
  trainingCarbsPerKg: number
  restCarbsPerKg: number
  restCaloriesFactor: number
  restCarbsFactor: number
  sodiumLimitMg: number
  requiresBodyFat: boolean
  sourceName: string
  sourceUrl: string
  applicablePopulation: string
  limitations: string
  reviewStatus?: string
  version: string
  userImported?: boolean
}

export interface ExerciseRecord {
  id: string
  name: string
  target: string
  split: '推' | '拉' | '腿'
  prescription: string
  mediaUrl: string
  cues: string
}

export interface PreferenceRecord {
  id: string
  name: string
  meal: '早餐' | '午餐' | '晚餐' | '日间加餐' | '坚果' | '全局'
  allowedFoodIds: string[]
  forbiddenFoodIds: string[]
  weight: number
  rule: string
}

export interface RawLibraries {
  foods: FoodRecord[]
  supplements: SupplementRecord[]
  standards: StandardRecord[]
  formulas: FormulaRecord[]
  exercises: ExerciseRecord[]
  preferences: PreferenceRecord[]
}

export interface LibraryOverride {
  id: string
  library: LibraryName
  recordId: string
  patch: Record<string, unknown>
  version: number
  note: string
  createdAt: string
  revertedAt: string | null
}

export interface UserProfile {
  sex: '男' | '女'
  age: number
  heightCm: number
  weightKg: number
  bodyFatPercent: number | null
  sodiumLimitMg: number
  healthFlags: string[]
  trainingPattern: '练3休1' | '练1休1'
  cycleStartDate: string
  plannedDayType?: DayType
}

export interface ManualSettings {
  dayType: DayType | null
  targetCalories: number | null
  formulaId: string
  trainingIntensity: number
}

export interface SupplementDose {
  supplementId: string
  amount: number
  enabled: boolean
}

export interface MenuItem {
  foodId: string
  meal: '早餐' | '午餐' | '晚餐' | '日间加餐' | '坚果'
  amount: number
  unit: MeasureUnit
}

export interface MealEnergyRule {
  meal: MealGroup
  minPercent: number
  targetPercent: number
  maxPercent: number
}

export interface BodyLog {
  id: string
  date: string
  weightKg: number
  waistCm: number
  systolic: number | null
  diastolic: number | null
  trainingIntensity: number
  calorieAdherence: number
}

export interface AppState {
  dataVersion: number
  profile: UserProfile
  manual: ManualSettings
  overrides: LibraryOverride[]
  customFoods: FoodRecord[]
  customSupplements: SupplementRecord[]
  customFormulas: FormulaRecord[]
  focusNutrientIds: string[]
  supplementDoses: SupplementDose[]
  menu: MenuItem[]
  recipeDraft: MenuItem[] | null
  recipeAppliedAt: string | null
  mealEnergyRules: MealEnergyRule[]
  bodyLogs: BodyLog[]
  updatedAt: string
}

export interface MacroResult {
  bmr: number
  tdee: number
  targetCalories: number
  protein: number
  fat: number
  carbs: number
  dayType: DayType
  isRestDay: boolean
  usedManualCalories: boolean
  formulaId: string
  formulaName: string
  energyEquation: EnergyEquationType
  formulaFallbackReason: string | null
}

export interface NutrientLedgerRow {
  id: string
  name: string
  unit: string
  target: number
  ul: number | null
  food: number
  supplement: number
  total: number
  status: '不足' | '达标' | '超量' | '数据缺口'
  advice: string
  priority: '重点' | '一般'
  foodSuggestions: Array<{
    foodId: string
    foodName: string
    grams: number
    nutrientAmount: number
  }>
}

export interface EngineResult {
  macro: MacroResult
  actual: { calories: number; protein: number; fat: number; carbs: number; fiber: number }
  menu: MenuItem[]
  ledger: NutrientLedgerRow[]
  supplementLocks: Record<string, string>
  fattyAcids: { omega6: number; omega3: number; ratio: number | null; saturated: number }
  notices: string[]
  versionStamp: string
}
