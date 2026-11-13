import { describe, expect, it } from 'vitest'
import { clampNumber, numberFromText, sanitizeNumberInput, textFromNumber } from './NumberField'

describe('sanitizeNumberInput', () => {
  it('允许一个小数点，也允许正在输入的 "72." 这种中间状态', () => {
    expect(sanitizeNumberInput('72.5')).toBe('72.5')
    expect(sanitizeNumberInput('72.')).toBe('72.')
    expect(sanitizeNumberInput('.5')).toBe('.5')
  })

  it('多余的小数点只留第一个', () => {
    expect(sanitizeNumberInput('1.2.3')).toBe('1.23')
  })

  it('剔除字母、负号等非数字字符', () => {
    expect(sanitizeNumberInput('abc12x3')).toBe('123')
    expect(sanitizeNumberInput('-5')).toBe('5')
  })

  it('空输入保持为空', () => {
    expect(sanitizeNumberInput('')).toBe('')
  })
})

describe('numberFromText', () => {
  it('空文本与孤立小数点视为没填', () => {
    expect(numberFromText('')).toBeNull()
    expect(numberFromText('   ')).toBeNull()
    expect(numberFromText('.')).toBeNull()
  })

  it('正常数字转成 number', () => {
    expect(numberFromText('72.5')).toBe(72.5)
    expect(numberFromText('0')).toBe(0)
  })
})

describe('textFromNumber', () => {
  it('空值输出空字符串，0 照常输出', () => {
    expect(textFromNumber(null)).toBe('')
    expect(textFromNumber(undefined)).toBe('')
    expect(textFromNumber(0)).toBe('0')
  })
})

describe('clampNumber', () => {
  it('低于下限和高于上限都会被拉回', () => {
    expect(clampNumber(6, 500, 5000)).toBe(500)
    expect(clampNumber(99999, 500, 5000)).toBe(5000)
    expect(clampNumber(2000, 500, 5000)).toBe(2000)
  })

  it('不给边界就原样返回', () => {
    expect(clampNumber(3.5)).toBe(3.5)
  })
})
