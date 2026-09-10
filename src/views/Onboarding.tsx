import { useState } from 'react'
import { ArrowRight, HeartPulse } from 'lucide-react'
import { useAppState } from '../state/AppContext'

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
          <label>年龄<input type="number" min="10" max="100" inputMode="numeric" placeholder="岁" value={age} onChange={(event) => setAge(event.target.value)} /></label>
          <label>身高<input type="number" min="100" max="250" inputMode="decimal" placeholder="cm" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} /></label>
          <label>体重<input type="number" min="30" max="400" step="0.1" inputMode="decimal" placeholder="kg" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} /></label>
          <label>目标体重（可选）<input type="number" min="30" max="400" step="0.1" inputMode="decimal" placeholder="kg" value={targetWeightKg} onChange={(event) => setTargetWeightKg(event.target.value)} /></label>
          <label>体脂率（可选）<input type="number" min="3" max="70" step="0.1" inputMode="decimal" placeholder="%" value={bodyFatPercent} onChange={(event) => setBodyFatPercent(event.target.value)} /></label>
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
