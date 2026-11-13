import { useState } from 'react'
import { ArrowRight, HeartPulse } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import { NumberField, numberFromText, textFromNumber } from '../components/NumberField'

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const { setState } = useAppState()
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [bodyFatPercent, setBodyFatPercent] = useState('')

  const canSubmit = Number(age) > 0 && Number(heightCm) > 0 && Number(weightKg) > 0

  const submit = () => {
    if (!canSubmit) return
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        sex,
        age: Number(age),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        targetWeightKg: targetWeightKg === '' ? 0 : Number(targetWeightKg),
        bodyFatPercent: bodyFatPercent === '' ? null : Number(bodyFatPercent)
      }
    }))
    onFinish()
  }

  return (
    <div className="dialog-backdrop">
      <section className="dialog onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-head">
          <span className="onboarding-icon"><HeartPulse size={22} aria-hidden="true" /></span>
          <h2 id="onboarding-title">欢迎使用衡动</h2>
          <p>先填好身体档案，训练和饮食才会按你本人来算。这些数据只保存在你自己的浏览器里，不会上传。</p>
        </div>
        <div className="form-grid">
          <label>性别
            <select value={sex} onChange={(event) => setSex(event.target.value as 'male' | 'female')}><option value="male">男</option><option value="female">女</option></select>
          </label>
          <label>年龄<NumberField decimals={false} placeholder="岁" value={numberFromText(age)} onChange={(next) => setAge(textFromNumber(next))} /></label>
          <label>身高<NumberField decimals={false} placeholder="cm" value={numberFromText(heightCm)} onChange={(next) => setHeightCm(textFromNumber(next))} /></label>
          <label>体重<NumberField placeholder="kg" value={numberFromText(weightKg)} onChange={(next) => setWeightKg(textFromNumber(next))} /></label>
          <label>目标体重（可选）<NumberField placeholder="kg" value={numberFromText(targetWeightKg)} onChange={(next) => setTargetWeightKg(textFromNumber(next))} /></label>
          <label>体脂率（可选）<NumberField placeholder="%" value={numberFromText(bodyFatPercent)} onChange={(next) => setBodyFatPercent(textFromNumber(next))} /></label>
        </div>
        {!canSubmit && <p className="onboarding-hint">请先填写年龄、身高、体重，其余可稍后在「设置」里补充。</p>}
        <div className="dialog-actions onboarding-actions">
          <button className="button compact" onClick={onFinish}>稍后再说</button>
          <button className="button primary" disabled={!canSubmit} onClick={submit}>开始使用<ArrowRight size={16} /></button>
        </div>
      </section>
    </div>
  )
}
