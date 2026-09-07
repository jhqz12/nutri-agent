import { describe, expect, it } from 'vitest'
import { defaultState } from '../data/defaults'
import { convertTrainingTemplate, getPlanForDate } from './trainingPlans'

describe('训练方案转换', () => {
  it('三分化转五分化时不丢失动作', () => {
    const sourceCount = defaultState.planDays.flatMap((day) => day.exercises).length
    const converted = convertTrainingTemplate(defaultState.planDays, '五分化')

    expect(converted.slice(0, 5).map((day) => day.name)).toEqual(['胸', '背', '腿', '肩', '手臂'])
    expect(converted.flatMap((day) => day.exercises)).toHaveLength(sourceCount)
  })

  it('练一休一会在训练日之间插入休息日', () => {
    const first = getPlanForDate(defaultState.planDays, '练一休一', '2026-07-30', new Date('2026-07-30T12:00:00Z'))
    const second = getPlanForDate(defaultState.planDays, '练一休一', '2026-07-30', new Date('2026-07-31T12:00:00Z'))

    expect(first.isRestDay).toBe(false)
    expect(second.isRestDay).toBe(true)
    expect(second.plan).not.toBeNull()
  })

  it('连续循环会在所有训练日后插入一天休息', () => {
    const fourth = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-02T12:00:00'))
    const fifth = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-03T12:00:00'))

    expect(fourth.isRestDay).toBe(true)
    expect(fifth.plan?.name).toBe('推')
  })

  it('把今天设为拉日后会继续腿日、休息日、推日', () => {
    const anchor = { date: '2026-08-08', planId: 'plan-pull', isRestDay: false }
    const today = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-08T12:00:00'), anchor)
    const tomorrow = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-09T12:00:00'), anchor)
    const rest = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-10T12:00:00'), anchor)
    const nextCycle = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-11T12:00:00'), anchor)

    expect(today.plan?.name).toBe('拉')
    expect(tomorrow.plan?.name).toBe('腿')
    expect(rest.isRestDay).toBe(true)
    expect(nextCycle.plan?.name).toBe('推')
  })

  it('把今天改为休息日会把原计划顺延到明天', () => {
    const anchor = { date: '2026-08-08', planId: 'plan-legs', isRestDay: true }
    const today = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-08T12:00:00'), anchor)
    const tomorrow = getPlanForDate(defaultState.planDays, '连续循环', '2026-07-30', new Date('2026-08-09T12:00:00'), anchor)

    expect(today.isRestDay).toBe(true)
    expect(today.plan?.name).toBe('腿')
    expect(tomorrow.isRestDay).toBe(false)
    expect(tomorrow.plan?.name).toBe('腿')
  })
})
