import { describe, expect, it } from 'vitest'
import { parseTrainingText } from './trainingTextParser'

describe('训练文本识别', () => {
  it('识别常见中文训练记录', () => {
    const result = parseTrainingText('高位下拉 3组×10-12次 40kg 余力3 休息120秒\n坐姿划船，2组15次，目标：背部')

    expect(result.exercises).toHaveLength(2)
    expect(result.exercises[0]).toMatchObject({ name: '高位下拉', sets: 3, minReps: 10, maxReps: 12, weightKg: 40, targetRir: 3, restSeconds: 120 })
    expect(result.exercises[1]).toMatchObject({ name: '坐姿划船', sets: 2, minReps: 15, maxReps: 15, targetArea: '背部' })
  })

  it('空文本不会生成动作', () => {
    expect(parseTrainingText('   ').exercises).toHaveLength(0)
  })
})
