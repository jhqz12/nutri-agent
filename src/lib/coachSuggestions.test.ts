import { describe, expect, it } from 'vitest'
import type { CoachPlanSuggestion, Exercise, WorkoutSession } from '../types'
import { hasRecentTrainingRedFlag, validateCoachSuggestion } from './coachSuggestions'

const exercise: Exercise = {
  id: 'press', name: '上斜哑铃推', targetArea: '上胸', sets: 3, minReps: 8,
  maxReps: 12, weightKg: 10, incrementKg: 0.5, targetRir: 3, restSeconds: 120,
  steps: '', commonErrors: '', alternative: '', stopCriteria: ''
}

function suggestion(weightKg: number): CoachPlanSuggestion {
  return {
    id: 'suggestion', planId: 'push', exerciseId: exercise.id,
    exerciseName: exercise.name, reason: '测试建议', changes: { weightKg }
  }
}

function session(patch: Partial<WorkoutSession['logs'][number]> = {}, nextDayWorse = false): WorkoutSession {
  return {
    id: 'session', date: '2026-08-10', split: '推', sleepHours: 7, energy: 6,
    nextDayWorse,
    logs: [{
      id: 'set', exerciseId: exercise.id, setNumber: 1, weightKg: 10, reps: 10,
      rir: 3, formQuality: '稳定', pain: 0, numbness: false, electricShock: false,
      weakness: false, backPull: false, notes: '', ...patch
    }]
  }
}

describe('AI教练计划建议安全校验', () => {
  it('近期出现神经症状时阻止增重', () => {
    const sessions = [session({ numbness: true })]
    expect(hasRecentTrainingRedFlag(sessions)).toBe(true)
    expect(validateCoachSuggestion(exercise, suggestion(10.5), sessions)).toContain('不能应用增重')
  })

  it('次日加重时阻止增重', () => {
    expect(validateCoachSuggestion(exercise, suggestion(10.5), [session({}, true)])).toContain('不能应用增重')
  })

  it('阻止超过5%的单次增重', () => {
    expect(validateCoachSuggestion(exercise, suggestion(11), [session()])).toContain('5%')
  })

  it('允许无红旗且不超过5%的增重，也允许减重', () => {
    expect(validateCoachSuggestion(exercise, suggestion(10.5), [session()])).toBeNull()
    expect(validateCoachSuggestion(exercise, suggestion(9), [session({ pain: 4 })])).toBeNull()
  })
})
