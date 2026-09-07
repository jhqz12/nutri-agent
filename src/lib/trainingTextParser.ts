import type { Exercise } from '../types'
import { createId } from './ids'

export interface ParsedTrainingText {
  exercises: Exercise[]
  warnings: string[]
}

const defaultStopCriteria = '麻木、电击感、突然无力、疼痛达到3分或腰背牵拉扩散时停止。'

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function parseTrainingText(text: string): ParsedTrainingText {
  const warnings: string[] = []
  const exercises: Exercise[] = []
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

  for (const originalLine of lines) {
    if (/^(https?:\/\/|#+\s|动作[：:]?|组数[：:]?|备注[：:]?)/i.test(originalLine)) continue
    const line = originalLine.replace(/^[-*•]\s*/, '').replace(/^\d+[.、)]\s*/, '')
    const prescription = line.match(/(\d+)\s*(?:组\s*[x×*]?|[x×*])\s*(\d+)(?:\s*[-~～至]\s*(\d+))?\s*(?:次)?/i)
    const weight = line.match(/(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)/i)
    const rir = line.match(/(?:rir|余力)\s*[:：]?\s*(\d+)/i)
    const rest = line.match(/休息\s*(\d+)\s*(秒|分钟)?/i)
    const target = line.match(/(?:目标|部位)\s*[:：]\s*([^,，;；|]+)/i)
    const steps = line.match(/(?:要点|步骤|细节)\s*[:：]\s*(.+)$/i)
    let name = line
      .split(/[|｜,，;；]/)[0]
      .replace(/\s+\d+\s*(?:组|[x×*]).*$/i, '')
      .replace(/\s+(?:目标|部位|要点|步骤|细节)\s*[:：].*$/i, '')
      .trim()

    if (name.length < 2 || /^\d+$/.test(name)) {
      warnings.push(`无法识别：${originalLine}`)
      continue
    }
    if (name.length > 40) name = name.slice(0, 40)

    const sets = positiveNumber(prescription?.[1], 3)
    const minReps = positiveNumber(prescription?.[2], 8)
    const maxReps = positiveNumber(prescription?.[3], prescription ? minReps : 12)
    const restValue = positiveNumber(rest?.[1], 120) * (rest?.[2] === '分钟' ? 60 : 1)
    exercises.push({
      id: createId('exercise'),
      name,
      targetArea: target?.[1]?.trim() ?? '待补充',
      sets: Math.min(10, sets),
      minReps: Math.min(100, Math.min(minReps, maxReps)),
      maxReps: Math.min(100, Math.max(minReps, maxReps)),
      weightKg: weight ? positiveNumber(weight[1], 0) : 0,
      incrementKg: 2.5,
      targetRir: rir ? Math.min(6, positiveNumber(rir[1], 3)) : 3,
      restSeconds: Math.min(600, restValue),
      steps: steps?.[1]?.trim() ?? originalLine,
      commonErrors: '',
      alternative: '',
      stopCriteria: defaultStopCriteria,
      enabled: true,
      mediaUrl: ''
    })
  }

  if (!exercises.length && text.trim()) warnings.push('没有识别到动作，请按“一行一个动作”重新整理。')
  return { exercises, warnings }
}
