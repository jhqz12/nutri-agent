import { describe, expect, it } from 'vitest'
import { defaultLegExercises, defaultPullExercises, defaultPushExercises, defaultState } from '../data/defaults'
import { migrateState } from './storage'
import type { Exercise } from '../types'

const customExercise: Exercise = {
  id: 'custom-leg-exercise',
  name: '自定义腿部动作',
  targetArea: '测试',
  sets: 2,
  minReps: 8,
  maxReps: 10,
  weightKg: 0,
  incrementKg: 1,
  targetRir: 3,
  restSeconds: 60,
  steps: '',
  commonErrors: '',
  alternative: '',
  stopCriteria: ''
}

describe('训练数据升级', () => {
  it('为旧数据补入腿日动作，同时保留用户原有动作', () => {
    const legacyState = structuredClone(defaultState)
    legacyState.dataVersion = 1
    legacyState.planDays.find((day) => day.name === '腿')!.exercises = [customExercise]

    const migrated = migrateState(legacyState)
    const exercises = migrated.planDays.find((day) => day.name === '腿')!.exercises

    expect(migrated.dataVersion).toBe(8)
    expect(migrated.trainingCycleAnchor).toEqual({
      date: migrated.trainingCycleStartedAt,
      planId: migrated.planDays[0]?.id ?? null,
      isRestDay: false
    })
    expect(exercises).toHaveLength(defaultLegExercises.length + 1)
    expect(exercises.some((exercise) => exercise.id === customExercise.id)).toBe(true)
  })

  it('同一版本再次加载时不会重复添加动作', () => {
    const migrated = migrateState({ ...structuredClone(defaultState), dataVersion: 1 })
    const migratedAgain = migrateState(migrated)
    const exercises = migratedAgain.planDays.find((day) => day.name === '腿')!.exercises

    expect(exercises).toHaveLength(defaultLegExercises.length)
  })

  it('把第二版数据升级为带推拉动作的第三版', () => {
    const previousState = structuredClone(defaultState)
    previousState.dataVersion = 2
    previousState.planDays.find((day) => day.name === '推')!.exercises = []
    previousState.planDays.find((day) => day.name === '拉')!.exercises = []

    const migrated = migrateState(previousState)

    expect(migrated.planDays.find((day) => day.name === '推')!.exercises).toHaveLength(defaultPushExercises.length)
    expect(migrated.planDays.find((day) => day.name === '拉')!.exercises).toHaveLength(defaultPullExercises.length)
  })

  it('把第六版数据升级为带AI对话的第七版，且不改原训练记录', () => {
    const previousState = structuredClone(defaultState)
    previousState.dataVersion = 6
    previousState.sessions = [{
      id: 'session-existing', date: '2026-08-09', split: '推', sleepHours: 7,
      energy: 6, nextDayWorse: false, logs: []
    }]
    delete (previousState as Partial<typeof previousState>).coachMessages

    const migrated = migrateState(previousState)

    expect(migrated.dataVersion).toBe(8)
    expect(migrated.coachMessages).toEqual([])
    expect(migrated.sessions[0]?.id).toBe('session-existing')
  })
})
