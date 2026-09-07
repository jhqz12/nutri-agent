import { describe, expect, it } from 'vitest'
import { recommendNextLoad } from './training'
import type { Exercise, WorkoutSession, WorkoutSetLog } from '../types'

const exercise: Exercise = { id:'bench',name:'推胸',targetArea:'胸',sets:2,minReps:8,maxReps:12,weightKg:20,incrementKg:1,targetRir:3,restSeconds:120,steps:'',commonErrors:'',alternative:'',stopCriteria:'' }
const makeLog = (id: string, patch: Partial<WorkoutSetLog> = {}): WorkoutSetLog => ({ id,exerciseId:'bench',setNumber:Number(id),weightKg:20,reps:12,rir:3,formQuality:'稳定',pain:0,numbness:false,electricShock:false,weakness:false,backPull:false,notes:'',...patch })
const makeSession = (id: string, logs: WorkoutSetLog[]): WorkoutSession => ({ id,date:'2026-07-21',split:'推',sleepHours:7,energy:6,nextDayWorse:false,logs })

describe('训练建议', () => {
  it('神经症状优先停止评估', () => {
    const session = makeSession('one', [makeLog('1',{numbness:true}),makeLog('2')])
    expect(recommendNextLoad(exercise, session).type).toBe('停止并评估')
  })

  it('连续两次达标后增加但不超过5%', () => {
    const current = makeSession('two',[makeLog('1'),makeLog('2')])
    const previous = makeSession('one',[makeLog('1'),makeLog('2')])
    const result = recommendNextLoad(exercise,current,previous)
    expect(result.type).toBe('增加重量')
    expect(result.suggestedWeightKg).toBe(21)
  })

  it('疼痛达到3分时减重', () => {
    const session = makeSession('one',[makeLog('1',{pain:3}),makeLog('2')])
    expect(recommendNextLoad(exercise,session).type).toBe('减重')
  })
})
