import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Bot, Calculator, CheckCircle2, Cloud, Eye, EyeOff, KeyRound, RotateCcw, Save, ShieldCheck, Wifi } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import { useNutritionState } from '../state/NutritionContext'
import { calculateEngine, getEffectiveLibrariesForState, isFormulaAvailable } from '../lib/engine'
import { createOverride } from '../lib/overlay'
import type { DayType } from '../nutritionTypes'
import { registerPushSubscription, sendMagicLink, supabase } from '../lib/supabase'
import {
  getAiConnectionStatus, saveAiConnection, testAiConnection,
  type AiConnectionStatus
} from '../lib/aiCoach'
import type { AiProvider } from '../types'

const aiApiEndpoints: Record<AiProvider, string> = {
  deepseek: 'https://api.deepseek.com/chat/completions',
  openai: 'https://api.openai.com/v1/responses'
}

const aiDraftMemory: { provider: AiProvider; model: string; apiKey: string } = {
  provider: 'deepseek',
  model: 'deepseek-v4-flash',
  apiKey: ''
}

export function SettingsView() {
  const { state, setState, restoreDefaults } = useAppState()
  const { state: nutritionState, setState: setNutritionState } = useNutritionState()
  const [email, setEmail] = useState('')
  const [loginWaiting, setLoginWaiting] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [aiProvider, setAiProvider] = useState<AiProvider>(aiDraftMemory.provider)
  const [aiModel, setAiModel] = useState(aiDraftMemory.model)
  const [aiApiKey, setAiApiKey] = useState(aiDraftMemory.apiKey)
  const [showAiApiKey, setShowAiApiKey] = useState(false)
  const [aiStatus, setAiStatus] = useState<AiConnectionStatus | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMessage, setAiMessage] = useState('')
  const [aiError, setAiError] = useState('')
  const [authEmail, setAuthEmail] = useState<string | null | undefined>(undefined)
  const libraries = useMemo(() => getEffectiveLibrariesForState(nutritionState), [nutritionState])
  const result = useMemo(() => calculateEngine(nutritionState), [nutritionState])
  const formula = libraries.formulas.find((item) => item.id === nutritionState.manual.formulaId) ?? libraries.formulas[0]
  const needsAiApiKey = !aiStatus?.configured || aiStatus.provider !== aiProvider
  const [formulaDraft, setFormulaDraft] = useState({ activityFactor: '', calorieDeficit: '', proteinPerKg: '', fatPerKg: '', trainingCarbsPerKg: '', restCarbsPerKg: '' })

  useEffect(() => {
    if (!formula) return
    setFormulaDraft({
      activityFactor: String(formula.activityFactor),
      calorieDeficit: String(formula.calorieDeficit),
      proteinPerKg: String(formula.proteinPerKg),
      fatPerKg: String(formula.fatPerKg),
      trainingCarbsPerKg: String(formula.trainingCarbsPerKg),
      restCarbsPerKg: String(formula.restCarbsPerKg)
    })
  }, [formula?.id, formula?.activityFactor, formula?.calorieDeficit, formula?.proteinPerKg, formula?.fatPerKg, formula?.trainingCarbsPerKg, formula?.restCarbsPerKg])

  const refreshAiConnectionStatus = useCallback(async (showResult = false) => {
    if (!supabase) {
      setAuthEmail(null)
      setAiStatus(null)
      setAiError('当前站点没有配置云端服务，暂时不能连接AI模型。')
      return
    }
    setAiLoading(true)
    if (showResult) {
      setAiMessage('正在读取云端AI配置…')
      setAiError('')
    }
    try {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      const signedInEmail = data.session?.user.email ?? null
      setAuthEmail(signedInEmail)
      if (!signedInEmail) {
        setAiStatus(null)
        setAiError('当前浏览器尚未登录。邮箱内置浏览器、Edge、微信和手机桌面应用的登录状态不会自动互通。')
        return
      }
      const status = await getAiConnectionStatus()
      setAiStatus(status)
      if (status.provider) {
        setAiProvider(status.provider)
        aiDraftMemory.provider = status.provider
      }
      if (status.model) {
        setAiModel(status.model)
        aiDraftMemory.model = status.model
      }
      setAiError('')
      if (showResult) setAiMessage(status.configured ? '已重新读取云端AI配置。' : '当前账号还没有保存AI配置。')
    } catch (error) {
      setAiError(error instanceof Error ? error.message : '无法读取AI连接状态。')
    } finally {
      setAiLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshAiConnectionStatus()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user.email ?? null)
      window.setTimeout(() => void refreshAiConnectionStatus(), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [refreshAiConnectionStatus])

  useEffect(() => {
    if (!loginWaiting || !supabase) return
    const client = supabase
    const detectLogin = async () => {
      const { data } = await client.auth.getSession()
      if (!data.session?.user.email) return
      setLoginWaiting(false)
      setMessage(`登录成功：${data.session.user.email}，云端训练、饮食和AI配置正在刷新。`)
      await refreshAiConnectionStatus()
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void detectLogin()
    }
    const timer = window.setInterval(() => void detectLogin(), 3000)
    window.addEventListener('focus', detectLogin)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', detectLogin)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loginWaiting, refreshAiConnectionStatus])

  const updateProfile = (key: keyof typeof state.profile, value: string | number | null) => {
    setState((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))
  }

  const updateSupplement = (supplementId: string, patch: { amount?: number; enabled?: boolean }) => {
    setNutritionState((current) => {
      const exists = current.supplementDoses.some((item) => item.supplementId === supplementId)
      const supplementDoses = exists
        ? current.supplementDoses.map((item) => item.supplementId === supplementId ? { ...item, ...patch } : item)
        : [...current.supplementDoses, { supplementId, amount: patch.amount ?? 1, enabled: patch.enabled ?? true }]
      return { ...current, supplementDoses }
    })
  }

  const requestNotifications = async () => {
    try { setMessage(await registerPushSubscription()) }
    catch (error) { setMessage(error instanceof Error ? error.message : '提醒启用失败') }
  }

  const login = async () => {
    setLoginLoading(true)
    try {
      setMessage(await sendMagicLink(email))
      setLoginWaiting(true)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录邮件发送失败。')
    } finally {
      setLoginLoading(false)
    }
  }

  const saveFormulaParameters = () => {
    if (!formula) return
    const patch = Object.fromEntries(Object.entries(formulaDraft).map(([key, value]) => [key, Number(value)]))
    if (Object.values(patch).some((value) => !Number.isFinite(value) || value <= 0)) {
      setMessage('公式参数必须是大于0的数字。')
      return
    }
    setNutritionState((current) => formula.userImported
      ? { ...current, customFormulas: current.customFormulas.map((item) => item.id === formula.id ? { ...item, ...patch, version: `${item.version.split('+')[0]}+${Date.now()}` } : item) }
      : { ...current, overrides: createOverride(current.overrides, 'formulas', formula.id, patch, '设置页修改公式参数') })
    setMessage('公式参数已保存为新的覆盖版本，今日热量、宏量和菜单已重新计算。')
  }

  const saveAiSettings = async () => {
    if (!authEmail) {
      setAiError('请先在当前这个浏览器完成邮箱登录，再保存AI连接。')
      return
    }
    const model = aiModel.trim()
    if (!model) {
      setAiError('请填写你账号中可用的模型名称。')
      return
    }
    if (needsAiApiKey && aiApiKey.trim().length < 12) {
      setAiError(aiStatus?.configured ? '切换AI服务商时需要填写新服务商的完整API密钥。' : '首次配置需要填写完整API密钥。')
      return
    }
    setAiLoading(true)
    setAiError('')
    setAiMessage('正在加密保存配置并连接官方接口…')
    try {
      const status = await saveAiConnection({
        provider: aiProvider,
        model,
        ...(aiApiKey.trim() ? { apiKey: aiApiKey.trim() } : {})
      })
      setAiStatus(status)
      setAiMessage('配置已加密保存，正在连接DeepSeek官方接口…')
      try {
        const testResult = await testAiConnection()
        setAiApiKey('')
        aiDraftMemory.apiKey = ''
        setAiMessage(`配置已加密保存，${testResult.message}`)
      } catch (error) {
        setAiMessage('')
        setAiError(`配置已安全保存，但连接测试失败：${error instanceof Error ? error.message : '请核对API密钥和模型名称。'}`)
      }
    } catch (error) {
      setAiMessage('')
      setAiError(error instanceof Error ? error.message : 'AI连接保存失败。')
    } finally {
      setAiLoading(false)
    }
  }

  const testAiSettings = async () => {
    if (!authEmail) {
      setAiError('当前浏览器没有登录，不能测试连接。')
      return
    }
    setAiLoading(true)
    setAiError('')
    setAiMessage('正在连接官方AI接口…')
    try {
      const result = await testAiConnection()
      setAiMessage(result.message)
    } catch (error) {
      setAiMessage('')
      setAiError(error instanceof Error ? error.message : 'AI连接测试失败。')
    } finally {
      setAiLoading(false)
    }
  }

  return <div className="view-stack">
    <section>
      <div className="section-heading"><div><h2>身体档案</h2><p>这里只保留一套生效档案，修改后训练、饮食和趋势一起更新。</p></div><span className="formula-note">BMR {result.macro.bmr} · TDEE {result.macro.tdee}</span></div>
      <div className="settings-grid profile-settings">
        <label>性别<select value={state.profile.sex} onChange={(event) => updateProfile('sex', event.target.value)}><option value="male">男</option><option value="female">女</option></select></label>
        {([['age', '年龄', 1], ['heightCm', '身高 cm', 1], ['weightKg', '当前体重 kg', 0.1], ['targetWeightKg', '目标体重 kg', 0.1]] as const).map(([key, label, step]) => <label key={key}>{label}<input type="number" min="1" step={step} value={state.profile[key]} onChange={(event) => updateProfile(key, Number(event.target.value))} /></label>)}
        <label>体脂率 %（可选）<input type="number" min="1" max="79" step="0.1" value={state.profile.bodyFatPercent ?? ''} placeholder="Cunningham公式需要" onChange={(event) => updateProfile('bodyFatPercent', event.target.value === '' ? null : Number(event.target.value))} /></label>
      </div>
    </section>

    <section className="settings-rule-panel">
      <div className="section-heading"><div><h2>今日计算规则</h2><p>手动覆盖优先；清空后恢复公式自动计算。</p></div><Calculator size={18} /></div>
      <div className="settings-grid rule-controls">
        <label>当前公式方案<select value={nutritionState.manual.formulaId} onChange={(event) => setNutritionState((current) => ({ ...current, manual: { ...current.manual, formulaId: event.target.value } }))}>{libraries.formulas.map((item) => <option value={item.id} key={item.id} disabled={!isFormulaAvailable(nutritionState, item)}>{item.name}{!isFormulaAvailable(nutritionState, item) ? '（需要体脂率）' : ''}</option>)}</select></label>
        <label>今日属性<select value={nutritionState.manual.dayType ?? ''} onChange={(event) => setNutritionState((current) => ({ ...current, manual: { ...current.manual, dayType: (event.target.value || null) as DayType | null } }))}><option value="">按计划自动判断</option><option value="推">推日</option><option value="拉">拉日</option><option value="腿">腿日</option><option value="休">休息日</option></select></label>
        <label>手动目标热量<input type="number" min={result.macro.bmr} placeholder="留空使用公式" value={nutritionState.manual.targetCalories ?? ''} onChange={(event) => setNutritionState((current) => ({ ...current, manual: { ...current.manual, targetCalories: event.target.value === '' ? null : Number(event.target.value) } }))} /></label>
        <label>训练强度 0～10<input type="number" min="0" max="10" value={nutritionState.manual.trainingIntensity} onChange={(event) => setNutritionState((current) => ({ ...current, manual: { ...current.manual, trainingIntensity: Math.max(0, Math.min(10, Number(event.target.value))) } }))} /></label>
        <label>每日钠硬上限 mg<input type="number" min="500" max="5000" step="100" value={nutritionState.profile.sodiumLimitMg} onChange={(event) => setNutritionState((current) => ({ ...current, profile: { ...current.profile, sodiumLimitMg: Math.max(500, Math.min(5000, Number(event.target.value) || 2000)) } }))} /></label>
      </div>
      <p className="sodium-equivalent-note">当前约等于食盐 {(nutritionState.profile.sodiumLimitMg * 2.5 / 1000).toFixed(1)}g；钠和食盐会同步换算。</p>
      {formula && <div className="formula-parameters"><span>活动系数 <strong>{formula.activityFactor}</strong></span><span>能量模式 <strong>{formula.energyEquation}</strong></span><span>宏量模式 <strong>{formula.macroMode === 'weightRatios' ? '体重系数' : '剩余热量'}</strong></span><span>蛋白 <strong>{formula.proteinPerKg} g/kg</strong></span><span>脂肪 <strong>{formula.fatPerKg} g/kg</strong></span><span>训练碳水 <strong>{formula.trainingCarbsPerKg} g/kg</strong></span><span>休息碳水 <strong>{formula.restCarbsPerKg} g/kg</strong></span></div>}
      <div className="settings-impact"><ShieldCheck size={17} /><span>当前生效：{result.macro.dayType}日 · {result.macro.targetCalories} kcal · 蛋白质 {result.macro.protein}g · 脂肪 {result.macro.fat}g · 碳水 {result.macro.carbs}g</span><button className="button compact" onClick={() => setNutritionState((current) => ({ ...current, manual: { ...current.manual, dayType: null, targetCalories: null } }))}><RotateCcw size={14} />恢复自动</button></div>
      <details className="formula-editor"><summary>修改当前公式参数</summary><div className="formula-editor-grid"><label>活动系数<input type="number" min="1" max="3" step="0.025" value={formulaDraft.activityFactor} onChange={(event) => setFormulaDraft((current) => ({ ...current, activityFactor: event.target.value }))} /></label><label>每日热量缺口<input type="number" min="1" step="10" value={formulaDraft.calorieDeficit} onChange={(event) => setFormulaDraft((current) => ({ ...current, calorieDeficit: event.target.value }))} /></label><label>蛋白质 g/kg<input type="number" min="0.1" step="0.1" value={formulaDraft.proteinPerKg} onChange={(event) => setFormulaDraft((current) => ({ ...current, proteinPerKg: event.target.value }))} /></label><label>脂肪 g/kg<input type="number" min="0.1" step="0.1" value={formulaDraft.fatPerKg} onChange={(event) => setFormulaDraft((current) => ({ ...current, fatPerKg: event.target.value }))} /></label><label>训练日碳水 g/kg<input type="number" min="0.1" step="0.1" value={formulaDraft.trainingCarbsPerKg} onChange={(event) => setFormulaDraft((current) => ({ ...current, trainingCarbsPerKg: event.target.value }))} /></label><label>休息日碳水 g/kg<input type="number" min="0.1" step="0.1" value={formulaDraft.restCarbsPerKg} onChange={(event) => setFormulaDraft((current) => ({ ...current, restCarbsPerKg: event.target.value }))} /></label><button className="button primary" onClick={saveFormulaParameters}><Save size={15} />保存并重算</button></div></details>
    </section>

    <section>
      <div className="section-heading"><div><h2>今日补剂总账</h2><p>这里的用量直接进入微量元素计算；被锁定的补剂不会计入当天总账。</p></div><span className="formula-note">{Object.keys(result.supplementLocks).length} 项锁定</span></div>
      <div className="supplement-ledger-list">{libraries.supplements.map((supplement) => {
        const dose = nutritionState.supplementDoses.find((item) => item.supplementId === supplement.id)
        const lockedReason = result.supplementLocks[supplement.id]
        return <div className={lockedReason ? 'supplement-ledger-row is-locked' : 'supplement-ledger-row'} key={supplement.id}>
          <div><strong>{supplement.name}</strong><span>{supplement.id} · {supplement.timing}</span></div>
          <label>数量<input type="number" min="0" step="0.5" inputMode="decimal" value={(dose?.amount ?? 0) === 0 ? '' : dose?.amount ?? ''} placeholder="0" onChange={(event) => updateSupplement(supplement.id, { amount: event.target.value === '' ? 0 : Math.max(0, Number(event.target.value)) })} /></label>
          <span className="supplement-unit">{supplement.servingUnit}</span>
          <label className="switch-label"><input type="checkbox" checked={dose?.enabled ?? false} disabled={Boolean(lockedReason)} onChange={(event) => updateSupplement(supplement.id, { enabled: event.target.checked })} />启用</label>
          <small>{lockedReason ?? (supplement.dataGaps.length ? `待补：${supplement.dataGaps.join('、')}` : '已进入总账')}</small>
        </div>
      })}</div>
    </section>

    <section className="ai-connection-settings">
      <div className="section-heading">
        <div><h2>AI模型连接</h2><p>供训练页里的AI教练使用。密钥只发送到Supabase后端加密保存，不写入浏览器数据或云同步JSON。</p></div>
        <div className="connection-badges">
          <span className={authEmail ? 'connection-badge is-ready' : 'connection-badge'}><Cloud size={15} />{authEmail === undefined ? '正在检查登录' : authEmail ? '当前浏览器已登录' : '当前浏览器未登录'}</span>
          <span className={aiStatus?.configured ? 'connection-badge is-ready' : 'connection-badge'}><Bot size={15} />{aiStatus?.configured ? 'AI配置已保存' : 'AI尚未配置'}</span>
        </div>
      </div>
      {authEmail ? <div className="ai-login-status is-ready"><CheckCircle2 size={17} /><span>当前浏览器已登录：{authEmail}。AI配置会保存到这个账号。</span></div> : <div className="ai-login-status"><Cloud size={17} /><span>请先完成邮箱登录。登录后的最新版页面会立即读取同一账号的AI配置。</span><button className="button compact" onClick={() => document.getElementById('cloud-login')?.scrollIntoView({ behavior: 'smooth' })}>去登录</button></div>}
      {aiStatus?.configured && <div className="ai-saved-summary"><strong>{aiStatus.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} · {aiStatus.model}</strong><span>云端配置更新时间：{aiStatus.updatedAt ? new Date(aiStatus.updatedAt).toLocaleString('zh-CN', { hour12: false }) : '未知'}</span></div>}
      <div className="ai-connection-grid">
        <label>服务商
          <select value={aiProvider} onChange={(event) => { const provider = event.target.value as AiProvider; const model = provider === 'deepseek' ? 'deepseek-v4-flash' : 'gpt-4.1-mini'; setAiProvider(provider); setAiModel(model); setAiApiKey(''); aiDraftMemory.provider = provider; aiDraftMemory.model = model; aiDraftMemory.apiKey = ''; setAiMessage(''); setAiError('') }}>
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
          </select>
        </label>
        <label>模型名称
          <input list={aiProvider === 'deepseek' ? 'deepseek-model-options' : undefined} value={aiModel} maxLength={80} placeholder={aiProvider === 'deepseek' ? '例如：deepseek-v4-flash' : '填写账号中可用的模型名'} onChange={(event) => { setAiModel(event.target.value); aiDraftMemory.model = event.target.value }} />
          {aiProvider === 'deepseek' && <datalist id="deepseek-model-options"><option value="deepseek-v4-flash" /><option value="deepseek-v4-pro" /></datalist>}
        </label>
        <label className="ai-key-field">API密钥
          <span><input type={showAiApiKey ? 'text' : 'password'} autoComplete="new-password" value={aiApiKey} placeholder={needsAiApiKey ? '首次配置或切换服务商必须填写' : '留空表示继续使用已保存密钥'} onChange={(event) => { setAiApiKey(event.target.value); aiDraftMemory.apiKey = event.target.value }} /><button type="button" className="icon-button" aria-label={showAiApiKey ? '隐藏API密钥' : '显示API密钥'} onClick={() => setShowAiApiKey((current) => !current)}>{showAiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
        </label>
      </div>
      <div className="ai-connection-actions">
        <span><KeyRound size={15} /><span>官方接口：<code>{aiApiEndpoints[aiProvider]}</code>。未保存或测试失败时，密钥只在当前页面内存中暂存；成功后自动清空。</span></span>
        <button className="button" disabled={aiLoading} onClick={() => void refreshAiConnectionStatus(true)}><RotateCcw size={16} />重新读取状态</button>
        <button className="button" disabled={aiLoading || !authEmail || !aiStatus?.configured} onClick={() => void testAiSettings()}><Wifi size={16} />测试连接</button>
        <button className="button primary" disabled={aiLoading || !authEmail || !aiModel.trim()} onClick={() => void saveAiSettings()}><Save size={16} />{aiLoading ? '处理中…' : '保存并测试'}</button>
      </div>
      {aiError && <div className="notice error"><ShieldCheck size={18} />{aiError}</div>}
      {aiMessage && <div className="notice success"><ShieldCheck size={18} />{aiMessage}</div>}
    </section>

    <div className="settings-columns">
      <section><div className="section-heading"><div><h2>提醒与安装</h2><p>安装到手机桌面后，打开方式更接近普通应用。</p></div><Bell size={18} /></div><button className="button primary" onClick={requestNotifications}><Bell size={16} />开启通知权限</button></section>
      <section id="cloud-login"><div className="section-heading"><div><h2>云同步登录</h2><p>{authEmail ? `当前浏览器已登录：${authEmail}` : supabase ? '电脑和手机使用同一邮箱登录后，会读取同一份训练、食材、菜单、补剂和AI配置。' : '当前公网镜像未配置云端，数据保存在这台设备。'}</p></div><Cloud size={18} /></div>{!authEmail && <div className="otp-login-form"><div className="inline-form"><input type="email" autoComplete="email" placeholder="你的邮箱" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="button" disabled={!email.trim() || loginLoading} onClick={() => void login()}>{loginLoading ? '发送中…' : '发送登录邮件'}</button></div>{loginWaiting && <div className="login-waiting"><span>等待登录完成；回到这个页面后会自动检测，也可以手动检查。</span><button className="button compact" onClick={() => void refreshAiConnectionStatus(true)}>重新检测登录状态</button></div>}</div>}</section>
    </div>
    {message && <div className="notice"><ShieldCheck size={18} />{message}</div>}
    <section className="danger-zone"><div><h2>恢复初始数据</h2><p>会清空本机现有训练、日程和记录；原始六库不会被修改。</p></div><button className="button danger" onClick={() => { if (window.confirm('确定清空当前本机数据吗？')) restoreDefaults() }}><RotateCcw size={16} />恢复初始数据</button></section>
  </div>
}
