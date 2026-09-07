import type { Exercise, TrainingRecommendation, WorkoutSession, WorkoutSetLog } from '../types'

function logsForExercise(session: WorkoutSession | undefined, exerciseId: string): WorkoutSetLog[] {
  return session?.logs.filter((log) => log.exerciseId === exerciseId) ?? []
}

export function recommendNextLoad(
  exercise: Exercise,
  currentSession: WorkoutSession,
  previousSession?: WorkoutSession
): TrainingRecommendation {
  const current = logsForExercise(currentSession, exercise.id)
  const previous = logsForExercise(previousSession, exercise.id)
  const reasons: string[] = []
  const risk = current.some((set) => set.numbness || set.electricShock || set.weakness || set.backPull)

  if (risk) {
    reasons.push('记录到麻木、电击感、突然无力或腰背牵拉，当前动作不应继续加量。')
    return { type: '停止并评估', exerciseId: exercise.id, suggestedWeightKg: exercise.weightKg, reasons }
  }
  if (currentSession.nextDayWorse) {
    reasons.push('次日不适加重，需要先恢复再决定是否回归。')
    return { type: '休息', exerciseId: exercise.id, suggestedWeightKg: exercise.weightKg, reasons }
  }
  const poorFormOrPain = current.some((set) => set.pain >= 3 || set.formQuality === '明显变形')
  if (poorFormOrPain) {
    reasons.push('疼痛达到3分或动作明显变形，建议降低10%至15%。')
    return { type: '减重', exerciseId: exercise.id, suggestedWeightKg: roundLoad(exercise.weightKg * 0.875, exercise.incrementKg), reasons }
  }
  if (currentSession.sleepHours < 6 || currentSession.energy < 3) {
    reasons.push('睡眠不足6小时或精力低于3分，本次以降低训练量为主。')
    return { type: '休息', exerciseId: exercise.id, suggestedWeightKg: exercise.weightKg, reasons }
  }
  if (!current.length) {
    reasons.push('还没有完成该动作的有效训练记录。')
    return { type: '保持', exerciseId: exercise.id, suggestedWeightKg: exercise.weightKg, reasons }
  }
  const currentReady = current.length >= exercise.sets && current.every((set) => set.reps >= exercise.maxReps && set.rir >= 2 && set.rir <= 4 && set.formQuality === '稳定')
  const previousReady = previous.length >= exercise.sets && previous.every((set) => set.reps >= exercise.maxReps && set.rir >= 2 && set.rir <= 4 && set.formQuality === '稳定' && set.pain < 3)
  if (currentReady && previousReady) {
    const cappedIncrement = Math.min(exercise.incrementKg, exercise.weightKg * 0.05 || exercise.incrementKg)
    reasons.push('连续两次完成次数上限，保留2至4次余力，动作稳定且没有风险症状。')
    return { type: '增加重量', exerciseId: exercise.id, suggestedWeightKg: roundLoad(exercise.weightKg + cappedIncrement, exercise.incrementKg), reasons }
  }
  if (current.some((set) => set.rir <= 1)) {
    reasons.push('已接近力竭，先保持重量，把动作和余力做稳定。')
  } else {
    reasons.push('尚未连续两次达到次数、余力和动作质量标准。')
  }
  return { type: '保持', exerciseId: exercise.id, suggestedWeightKg: exercise.weightKg, reasons }
}

function roundLoad(value: number, step: number): number {
  if (step <= 0) return Number(value.toFixed(1))
  return Number((Math.round(value / step) * step).toFixed(2))
}
