import type { Exercise, PlanDay, TrainingCycleAnchor, TrainingFrequency, TrainingTemplate } from '../types'

const templateNames: Record<Exclude<TrainingTemplate, '自定义'>, string[]> = {
  三分化: ['推', '拉', '腿'],
  五分化: ['胸', '背', '腿', '肩', '手臂']
}

const standardNames = new Set(['推', '拉', '腿', '胸', '背', '肩', '手臂'])

export function isExerciseEnabled(exercise: Exercise): boolean {
  return exercise.enabled !== false
}

function classifyExercise(exercise: Exercise, sourcePlan: string, template: Exclude<TrainingTemplate, '自定义'>): string {
  const text = `${exercise.name} ${exercise.targetArea}`.toLowerCase()
  const has = (keywords: string[]) => keywords.some((keyword) => text.includes(keyword))

  if (has(['腿', '髋', '臀', '股四', '股二', '腘绳', '小腿', '提踵', '硬拉'])) return '腿'
  if (template === '三分化') {
    if (has(['胸', '三头', '肱三', '前束', '推举', '推胸', '夹胸', '臂屈伸'])) return '推'
    if (has(['背', '背阔', '划船', '下拉', '后束', '二头', '肱二', '反向飞鸟'])) return '拉'
    if (['胸', '肩'].includes(sourcePlan)) return '推'
    if (sourcePlan === '手臂') return has(['二头', '肱二', '弯举']) ? '拉' : '推'
    if (sourcePlan === '背') return '拉'
    return ['推', '拉', '腿'].includes(sourcePlan) ? sourcePlan : '推'
  }

  if (has(['肩', '前束', '中束', '后束', '侧平举', '前平举', '反向飞鸟'])) return '肩'
  if (has(['二头', '三头', '肱二', '肱三', '弯举', '臂屈伸', '碎颅'])) return '手臂'
  if (has(['胸', '推胸', '夹胸', '卧推', '双杠'])) return '胸'
  if (has(['背', '背阔', '划船', '下拉', '上提'])) return '背'
  if (sourcePlan === '推') return '胸'
  if (sourcePlan === '拉') return '背'
  return ['胸', '背', '腿', '肩', '手臂'].includes(sourcePlan) ? sourcePlan : '胸'
}

export function convertTrainingTemplate(planDays: PlanDay[], target: TrainingTemplate): PlanDay[] {
  if (target === '自定义') return structuredClone(planDays)
  const desiredNames = templateNames[target]
  const result = desiredNames.map((name) => ({ id: `plan-${name}`, name, exercises: [] as Exercise[] }))
  const customPlans = planDays.filter((plan) => !standardNames.has(plan.name)).map((plan) => structuredClone(plan))
  const seenIds = new Set<string>()

  for (const sourcePlan of planDays.filter((plan) => standardNames.has(plan.name))) {
    for (const exercise of sourcePlan.exercises) {
      if (seenIds.has(exercise.id)) continue
      seenIds.add(exercise.id)
      const targetName = classifyExercise(exercise, sourcePlan.name, target)
      const targetPlan = result.find((plan) => plan.name === targetName) ?? result[0]
      targetPlan.exercises.push(structuredClone(exercise))
    }
  }

  return [...result, ...customPlans]
}

function dayNumber(dateText: string): number {
  const [year, month, day] = dateText.split('-').map(Number)
  if (!year || !month || !day) return Math.floor(Date.now() / 86_400_000)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function formatLocalDate(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getPlanForDate(
  planDays: PlanDay[],
  frequency: TrainingFrequency,
  cycleStartedAt: string,
  date = new Date(),
  cycleAnchor?: TrainingCycleAnchor
): { isRestDay: boolean; plan: PlanDay | null } {
  if (!planDays.length) return { isRestDay: true, plan: null }
  const dateText = formatLocalDate(date)
  const anchor = cycleAnchor ?? { date: cycleStartedAt, planId: planDays[0].id, isRestDay: false }
  const anchorDate = dayNumber(anchor.date)
  const dateValue = dayNumber(dateText)
  const effectiveAnchor = dateValue < anchorDate
    ? { date: cycleStartedAt, planId: planDays[0].id, isRestDay: false }
    : anchor
  const offset = Math.max(0, dateValue - dayNumber(effectiveAnchor.date))
  const anchorIndex = Math.max(0, planDays.findIndex((plan) => plan.id === effectiveAnchor.planId))

  if (frequency === '练一休一') {
    if (effectiveAnchor.isRestDay) {
      if (offset % 2 === 0) {
        const nextIndex = (anchorIndex + Math.floor(offset / 2)) % planDays.length
        return { isRestDay: true, plan: planDays[nextIndex] }
      }
      const trainingIndex = (anchorIndex + Math.floor((offset - 1) / 2)) % planDays.length
      return { isRestDay: false, plan: planDays[trainingIndex] }
    }
    if (offset % 2 === 1) {
      const nextIndex = (anchorIndex + Math.floor((offset + 1) / 2)) % planDays.length
      return { isRestDay: true, plan: planDays[nextIndex] }
    }
    const trainingIndex = (anchorIndex + Math.floor(offset / 2)) % planDays.length
    return { isRestDay: false, plan: planDays[trainingIndex] }
  }

  const cycleLength = planDays.length + 1
  if (effectiveAnchor.isRestDay) {
    if (offset === 0) return { isRestDay: true, plan: planDays[anchorIndex] }
    const position = (anchorIndex + offset - 1) % cycleLength
    if (position === planDays.length) return { isRestDay: true, plan: planDays[0] }
    return { isRestDay: false, plan: planDays[position] }
  }
  const position = (anchorIndex + offset) % cycleLength
  if (position === planDays.length) return { isRestDay: true, plan: planDays[0] }
  return { isRestDay: false, plan: planDays[position] }
}
