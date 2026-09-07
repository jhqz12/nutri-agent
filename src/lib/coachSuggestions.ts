import type { CoachPlanSuggestion, Exercise, WorkoutSession } from '../types'

export function hasRecentTrainingRedFlag(sessions: WorkoutSession[]): boolean {
  return sessions.slice(-5).some((session) => (
    session.nextDayWorse || session.logs.some((log) => (
      log.numbness || log.electricShock || log.weakness || log.pain >= 3
    ))
  ))
}

export function validateCoachSuggestion(
  exercise: Exercise,
  suggestion: CoachPlanSuggestion,
  sessions: WorkoutSession[]
): string | null {
  const nextWeight = suggestion.changes.weightKg
  if (nextWeight === undefined || nextWeight <= exercise.weightKg) return null
  if (hasRecentTrainingRedFlag(sessions)) {
    return '近期记录存在麻木、电击感、无力、疼痛≥3分或次日加重，不能应用增重建议。'
  }
  if (exercise.weightKg <= 0 || nextWeight > exercise.weightKg * 1.05 + 0.001) {
    return '这条建议超过单次5%的增重上限，已阻止应用。'
  }
  return null
}
