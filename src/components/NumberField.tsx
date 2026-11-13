import { useEffect, useRef, useState } from 'react'

/**
 * 全站统一的数字输入框。
 *
 * 为什么不用 <input type="number">：
 * 1) 浏览器对「未完成的输入」会直接返回空字符串 —— 想输 72.5，输入到 "72." 的这一瞬间
 *    输入框会被清空，最后只剩一个 "5"（小数被吞）。
 * 2) 受控组件把数字回填到输入框，默认值 0 会占位，点进去接着打就变成 05、072。
 *
 * 这里改成 text + inputMode：输入过程中以「用户打的字」为准显示，数字只负责往外抛。
 * decimals 关掉时不会禁止打小数点（禁止反而会把 72.5 拼成 725），而是失焦时四舍五入。
 */

/** 把输入框里的原始文本整理成合法数字文本：只留数字和第一个小数点。 */
export function sanitizeNumberInput(raw: string): string {
  const digitsOnly = raw.replace(/[^\d.]/g, '')
  const firstDot = digitsOnly.indexOf('.')
  if (firstDot === -1) return digitsOnly
  return digitsOnly.slice(0, firstDot + 1) + digitsOnly.slice(firstDot + 1).replace(/\./g, '')
}

/** 文本转数字：空文本和单独一个小数点都算「没填」，返回 null。 */
export function numberFromText(text: string): number | null {
  const trimmed = text.trim()
  if (trimmed === '' || trimmed === '.') return null
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

/** 数字转输入框文本，空值返回空字符串。 */
export function textFromNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return String(value)
}

/** 失焦时把越界值拉回 [min, max]。 */
export function clampNumber(value: number, min?: number, max?: number): number {
  let next = value
  if (min !== undefined && next < min) next = min
  if (max !== undefined && next > max) next = max
  return next
}

type NumberFieldProps = {
  value: number | null | undefined
  onChange: (next: number | null) => void
  /** 是否允许小数，默认允许；关掉后连小数点都打不进去 */
  decimals?: boolean
  min?: number
  max?: number
  placeholder?: string
  className?: string
  ariaLabel?: string
  disabled?: boolean
  /** 值为 0 时显示成空，避免默认的 0 占着输入框（默认开启） */
  zeroAsEmpty?: boolean
}

export function NumberField({
  value, onChange, decimals = true, min, max, placeholder, className, ariaLabel, disabled, zeroAsEmpty = true
}: NumberFieldProps) {
  // null 表示「正在跟随外部值」；有内容表示用户正在打字，以这串文本为准显示
  const [text, setText] = useState<string | null>(null)
  const lastEmitted = useRef<number | null>(value ?? null)

  // 外部改值时（比如点了 45/60 分的快捷按钮、清空表单）丢掉本地文本，让输入框跟着变；
  // 自己抛出去的数值绕一圈回来不算外部改值，否则会把 "72." 这种中间态冲掉。
  useEffect(() => {
    if ((value ?? null) !== lastEmitted.current) setText(null)
  }, [value])

  const shown = text ?? (zeroAsEmpty && value === 0 ? '' : textFromNumber(value))

  const emit = (next: number | null) => {
    lastEmitted.current = next
    onChange(next)
  }

  return <input
    type="text"
    inputMode={decimals ? 'decimal' : 'numeric'}
    autoComplete="off"
    className={className ? `number-field ${className}` : 'number-field'}
    value={shown}
    placeholder={placeholder}
    aria-label={ariaLabel}
    disabled={disabled}
    onChange={(event) => {
      const cleaned = sanitizeNumberInput(event.target.value)
      setText(cleaned)
      emit(numberFromText(cleaned))
    }}
    onBlur={() => {
      // 没在打字就不管；打完离开时统一收尾：整数框四舍五入，越界值拉回范围
      if (text === null) return
      const parsed = numberFromText(text)
      setText(null)
      if (parsed === null) { emit(null); return }
      emit(clampNumber(decimals ? parsed : Math.round(parsed), min, max))
    }}
  />
}
