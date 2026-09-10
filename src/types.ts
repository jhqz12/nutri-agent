export type TabId = 'today' | 'training' | 'nutrition' | 'plan' | 'progress' | 'data' | 'settings'
export type TrainingSplit = string
export type TrainingTemplate = '三分化' | '五分化' | '自定义'
export type TrainingFrequency = '连续循环' | '练一休一'
export type RecommendationType = '增加重量' | '保持' | '减重' | '休息' | '停止并评估'
export type MealCategory = '早餐' | '午餐' | '晚餐' | '日间加餐'
export type AiProvider = 'deepseek' | 'openai'
export type CoachBasis = '公开计划' | '框架推断' | '科学边界'
export type CoachRiskLevel = '正常' | '谨慎' | '停止并评估'

export interface Profile {
  name: string
  sex: 'male' | 'female'
  age: number
  heightCm: number
  weightKg: number
  bodyFatPercent: number | null
  targetWeightKg: number
  activityFactor: number
  trainingCalories: number
  restCalories: number
  proteinGrams: number
  trainingFatGrams: number
  restFatGrams: number
}

export interface ScheduleItem {
  id: string
  title: string
  time: string
  durationMinutes: number
  category: '生活' | '工作' | '饮食' | '训练' | '睡眠' | '补剂'
  reminderMinutes: number
  notes: string
  completed: boolean
}

export interface Exercise {
  id: string
  name: string
  targetArea: string
  sets: number
  minReps: number
  maxReps: number
  weightKg: number
  incrementKg: number
  targetRir: number
  restSeconds: number
  steps: string
  commonErrors: string
  alternative: string
  stopCriteria: string
  enabled?: boolean
  mediaUrl?: string
}

export interface PlanDay {
  id: string
  name: TrainingSplit
  exercises: Exercise[]
}

export interface TrainingCycleAnchor {
  date: string
  planId: string | null
  isRestDay: boolean
}

export interface WorkoutSetLog {
  id: string
  exerciseId: string
  setNumber: number
  weightKg: number
  reps: number
  rir: number
  formQuality: '稳定' | '轻微变形' | '明显变形'
  pain: number
  numbness: boolean
  electricShock: boolean
  weakness: boolean
  backPull: boolean
  notes: string
}

export interface WorkoutSession {
  id: string
  date: string
  split: TrainingSplit
  sleepHours: number
  energy: number
  nextDayWorse: boolean
  logs: WorkoutSetLog[]
}

export interface TrainingRecommendation {
  type: RecommendationType
  exerciseId: string
  suggestedWeightKg: number
  reasons: string[]
}

export interface CoachPlanSuggestion {
  id: string
  planId: string
  exerciseId: string
  exerciseName: string
  reason: string
  changes: Partial<Pick<Exercise, 'sets' | 'minReps' | 'maxReps' | 'weightKg'>>
}

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  basis?: CoachBasis
  riskLevel?: CoachRiskLevel
  suggestions?: CoachPlanSuggestion[]
}

export type DailyPlanItemKind = '饮食' | '补剂' | '训练' | '全天'
export type DailyPlanDayType = 'training' | 'rest'
export type DailyPlanMode = 'fixed' | 'random'

export interface DailyPlanItem {
  id: string
  time: string
  label: string
  kind: DailyPlanItemKind
  foodName: string
  foodId?: string | null
  supplementId?: string | null
  amount: number
  unit: string
  note: string
  locked: boolean
}

export interface DailyPlanTemplate {
  id: string
  name: string
  dayType: DailyPlanDayType
  active: boolean
  items: DailyPlanItem[]
  updatedAt: string
  source?: string
  userImported?: boolean
}

export interface FoodItem {
  id: string
  name: string
  unit: 'g' | 'ml' | '份'
  calories: number
  protein: number
  fat: number
  carbs: number
  source: string
}

export interface Recipe {
  id: string
  name: string
  category: MealCategory
  ingredients: string
  servingLabel: string
  calories: number
  protein: number
  fat: number
  carbs: number
  price: string
  source: string
}

export interface MealSelection {
  id: string
  slot: number
  recipeId: string
  servings: number
  locked: boolean
}

export interface BodyLog {
  id: string
  date: string
  weightKg: number
  waistCm: number
  sleepHours: number
  steps: number
  cyclingMinutes: number
  energy: number
  backDiscomfort: number
  numbnessEvents: number
  trainingVolume: number
  dietAdherence: number
  systolic?: number | null
  diastolic?: number | null
}

export interface Supplement {
  id: string
  name: string
  dose: string
  time: string
  enabled: boolean
}

export interface AppState {
  dataVersion: number
  trainingTemplate: TrainingTemplate
  trainingFrequency: TrainingFrequency
  trainingCycleStartedAt: string
  trainingCycleAnchor: TrainingCycleAnchor
  profile: Profile
  schedule: ScheduleItem[]
  planDays: PlanDay[]
  sessions: WorkoutSession[]
  foods: FoodItem[]
  recipes: Recipe[]
  meals: MealSelection[]
  bodyLogs: BodyLog[]
  coachMessages: CoachMessage[]
  supplements: Supplement[]
  mealCount: number
  isTrainingDay: boolean
  dailyPlans: DailyPlanTemplate[]
  dailyPlanMode: DailyPlanMode
  lastUpdatedAt: string
}

export interface MacroTotals {
  calories: number
  protein: number
  fat: number
  carbs: number
}

export interface NutritionTarget extends MacroTotals {
  bmr: number
  tdee: number
}

export interface ImportPreview {
  headers: string[]
  rows: Record<string, unknown>[]
  errors: string[]
}
