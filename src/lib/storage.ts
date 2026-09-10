import type { AppState } from '../types'
import { defaultLegExercises, defaultPullExercises, defaultPushExercises, defaultState } from '../data/defaults'

const STORAGE_KEY = 'personal-fitness-dashboard-v1'
const CURRENT_DATA_VERSION = 7

function appendMissingExercises(
  planDays: AppState['planDays'],
  planName: string,
  planId: string,
  defaults: AppState['planDays'][number]['exercises']
) {
  const plan = planDays.find((day) => day.name === planName)
  if (!plan) {
    planDays.push({ id: planId, name: planName, exercises: structuredClone(defaults) })
    return
  }
  const existingIds = new Set(plan.exercises.map((exercise) => exercise.id))
  const existingNames = new Set(plan.exercises.map((exercise) => exercise.name.trim().toLowerCase()))
  const missingExercises = defaults.filter((exercise) => (
    !existingIds.has(exercise.id) && !existingNames.has(exercise.name.trim().toLowerCase())
  ))
  plan.exercises.push(...structuredClone(missingExercises))
}

export function migrateState(savedState: Partial<AppState>): AppState {
  const mergedState: AppState = {
    ...structuredClone(defaultState),
    ...savedState,
    profile: { ...defaultState.profile, ...savedState.profile }
  }
  const savedVersion = typeof savedState.dataVersion === 'number' ? savedState.dataVersion : 1
  if (savedVersion >= CURRENT_DATA_VERSION) return mergedState

  const planDays = Array.isArray(mergedState.planDays) ? structuredClone(mergedState.planDays) : []
  if (savedVersion < 2) appendMissingExercises(planDays, '腿', 'plan-legs', defaultLegExercises)
  if (savedVersion < 3) {
    appendMissingExercises(planDays, '推', 'plan-push', defaultPushExercises)
    appendMissingExercises(planDays, '拉', 'plan-pull', defaultPullExercises)
  }
  if (savedVersion < 4) {
    mergedState.recipes = mergedState.recipes.map((recipe) => {
      const legacyCategory = recipe.category as string
      return {
        ...recipe,
        category: legacyCategory === '食堂' ? '午餐'
          : legacyCategory === '外食' ? '晚餐'
            : legacyCategory === '加餐' ? '日间加餐' : recipe.category
      }
    })
  }
  if (savedVersion < 5) {
    mergedState.profile = {
      ...mergedState.profile,
      weightKg: 0,
      bodyFatPercent: mergedState.profile.bodyFatPercent ?? null,
      activityFactor: 1.55,
      trainingCalories: 0,
      restCalories: 0,
      proteinGrams: 0,
      trainingFatGrams: 0,
      restFatGrams: 0
    }
  }
  if (savedVersion < 6) {
    mergedState.trainingCycleAnchor = {
      date: mergedState.trainingCycleStartedAt,
      planId: planDays[0]?.id ?? null,
      isRestDay: false
    }
  }
  if (savedVersion < 7) mergedState.coachMessages = []

  for (const plan of planDays) {
    plan.exercises = plan.exercises.map((exercise) => ({
      ...exercise,
      enabled: exercise.enabled ?? true,
      mediaUrl: exercise.mediaUrl ?? ''
    }))
  }

  return {
    ...mergedState,
    dataVersion: CURRENT_DATA_VERSION,
    planDays,
    coachMessages: Array.isArray(mergedState.coachMessages) ? mergedState.coachMessages.slice(-50) : []
  }
}

export function hasStoredState(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return structuredClone(defaultState)
    const parsed = JSON.parse(saved) as Partial<AppState>
    return migrateState({ ...parsed, lastUpdatedAt: parsed.lastUpdatedAt ?? new Date().toISOString() })
  } catch {
    return structuredClone(defaultState)
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastUpdatedAt: new Date().toISOString() }))
}

export function resetState(): AppState {
  localStorage.removeItem(STORAGE_KEY)
  return structuredClone(defaultState)
}
