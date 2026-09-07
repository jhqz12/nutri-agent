import foods from './raw/foods.json'
import supplements from './raw/supplements.json'
import standards from './raw/standards.json'
import formulas from './raw/formulas.json'
import exercises from './raw/exercises.json'
import preferences from './raw/preferences.json'
import type { RawLibraries } from '../nutritionTypes'

export const rawLibraryVersions = {
  foods: 'foods-v1.0',
  supplements: 'supplements-v1.0',
  standards: 'standards-v1.0',
  formulas: 'formulas-v1.0',
  exercises: 'exercises-v1.0',
  preferences: 'preferences-v1.0'
} as const

export const rawLibraries: RawLibraries = {
  foods,
  supplements,
  standards,
  formulas,
  exercises,
  preferences
} as unknown as RawLibraries
