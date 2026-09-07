import { useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, Eraser, Send, ShieldAlert, SlidersHorizontal } from 'lucide-react'
import { askAiCoach, getAiConnectionStatus, type AiConnectionStatus, type CoachContextPayload } from '../../lib/aiCoach'
import { createId } from '../../lib/ids'
import { validateCoachSuggestion } from '../../lib/coachSuggestions'
import { useAppState } from '../../state/AppContext'
import type { CoachMessage, CoachPlanSuggestion, Exercise } from '../../types'

const promptExamples = ['复盘最近一次训练', '检查当前计划是否该加重量', '按最近状态安排下一次训练重点']

function describeChanges(exercise: Exercise, suggestion: CoachPlanSuggestion) {
  const descriptions: string[] = []
  const { changes } = suggestion
  if (changes.sets !== undefined && changes.sets !== exercise.sets) descriptions.push(`组数 ${exercise.sets}→${changes.sets}`)
  if (
    changes.minReps !== undefined || changes.maxReps !== undefined
  ) descriptions.push(`次数 ${exercise.minReps}～${exercise.maxReps}→${changes.minReps ?? exercise.minReps}～${changes.maxReps ?? exercise.maxReps}`)
  if (changes.weightKg !== undefined && changes.weightKg !== exercise.weightKg) descriptions.push(`重量 ${exercise.weightKg}→${changes.weightKg}kg`)
  return descriptions
}

export function CoachPanel() {
  const { state, setState } = useAppState()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [connection, setConnection] = useState<AiConnectionStatus | null>(null)
  const [includeProfile, setIncludeProfile] = useState(true)
  const [includePlan, setIncludePlan] = useState(true)
  const [includeSessions, setIncludeSessions] = useState(true)
  const [includeBodyLogs, setIncludeBodyLogs] = useState(true)
  const messages = state.coachMessages.slice(-50)

  useEffect(() => {
    getAiConnectionStatus().then(setConnection).catch((connectionError) => {
      setError(connectionError instanceof Error ? connectionError.message : '无法读取AI连接状态。')
    })
  }, [])

  const sharedSummary = useMemo(() => {
    const items = []
    if (includeProfile) items.push('身体档案')
    if (includePlan) items.push('当前计划')
    if (includeSessions) items.push('最近5次训练')
    if (includeBodyLogs) items.push('最近7天体感')
    return items.length ? items.join('、') : '不附带个人数据'
  }, [includeBodyLogs, includePlan, includeProfile, includeSessions])

  const buildContext = (): CoachContextPayload => ({
    ...(includeProfile ? { profile: {
      age: state.profile.age,
      sex: state.profile.sex,
      heightCm: state.profile.heightCm,
      weightKg: state.profile.weightKg,
      targetWeightKg: state.profile.targetWeightKg
    } } : {}),
    ...(includePlan ? { planDays: state.planDays } : {}),
    ...(includeSessions ? { sessions: state.sessions.slice(-5) } : {}),
    ...(includeBodyLogs ? { bodyLogs: state.bodyLogs.slice(-7) } : {})
  })

  const sendQuestion = async () => {
    const trimmed = question.trim()
    if (!trimmed || loading) return
    if (trimmed.length > 4000) {
      setError('问题不能超过4000字。')
      return
    }
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const reply = await askAiCoach({
        question: trimmed,
        context: buildContext(),
        history: messages.slice(-10).map(({ role, content }) => ({ role, content }))
      })
      const createdAt = new Date().toISOString()
      const nextMessages: CoachMessage[] = [
        { id: createId('coach-user'), role: 'user', content: trimmed, createdAt },
        {
          id: createId('coach-assistant'), role: 'assistant', content: reply.answer,
          basis: reply.basis, riskLevel: reply.riskLevel, suggestions: reply.suggestions,
          createdAt: new Date().toISOString()
        }
      ]
      setState((current) => ({ ...current, coachMessages: [...current.coachMessages, ...nextMessages].slice(-50) }))
      setQuestion('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI教练暂时无法回答。')
    } finally {
      setLoading(false)
    }
  }

  const applySuggestion = (suggestion: CoachPlanSuggestion) => {
    const plan = state.planDays.find((item) => item.id === suggestion.planId)
    const exercise = plan?.exercises.find((item) => item.id === suggestion.exerciseId)
    if (!plan || !exercise) {
      setError('这条建议对应的动作已不存在，无法应用。')
      return
    }
    const changes = describeChanges(exercise, suggestion)
    if (!changes.length) {
      setNotice('当前计划已经与这条建议一致。')
      return
    }
    const validationError = validateCoachSuggestion(exercise, suggestion, state.sessions)
    if (validationError) {
      setError(validationError)
      return
    }
    if (!window.confirm(`确定应用“${exercise.name}”的建议吗？\n${changes.join('；')}\n\n${suggestion.reason}`)) return
    setState((current) => ({
      ...current,
      planDays: current.planDays.map((day) => day.id === suggestion.planId
        ? {
            ...day,
            exercises: day.exercises.map((item) => item.id === suggestion.exerciseId
              ? { ...item, ...suggestion.changes }
              : item)
          }
        : day),
      coachMessages: current.coachMessages.map((message) => ({
        ...message,
        suggestions: message.suggestions?.filter((item) => item.id !== suggestion.id)
      }))
    }))
    setError('')
    setNotice(`已应用${exercise.name}：${changes.join('；')}。原训练记录未修改。`)
  }

  const clearMessages = () => {
    if (!messages.length || !window.confirm('确定清空AI教练对话记录吗？训练计划和训练记录不会删除。')) return
    setState((current) => ({ ...current, coachMessages: [] }))
  }

  return <div className="coach-workspace">
    <section className="coach-intro-band">
      <div><span className="coach-kicker"><Bot size={16} />谭成义公开训练框架</span><h2>训练问题，直接在这里问</h2><p>基于公开资料重建，不是本人私教或医学意见。建议先展示，确认后才会改计划。</p></div>
      <span className={connection?.configured ? 'connection-badge is-ready' : 'connection-badge'}>
        {connection?.configured ? `${connection.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} · ${connection.model}` : '尚未配置模型'}
      </span>
    </section>

    <section className="coach-context-panel">
      <div className="section-heading"><div><h2>本次允许读取</h2><p>{sharedSummary}</p></div><SlidersHorizontal size={18} /></div>
      <div className="coach-context-options">
        <label><input type="checkbox" checked={includeProfile} onChange={(event) => setIncludeProfile(event.target.checked)} />身体档案</label>
        <label><input type="checkbox" checked={includePlan} onChange={(event) => setIncludePlan(event.target.checked)} />当前训练计划</label>
        <label><input type="checkbox" checked={includeSessions} onChange={(event) => setIncludeSessions(event.target.checked)} />最近5次训练</label>
        <label><input type="checkbox" checked={includeBodyLogs} onChange={(event) => setIncludeBodyLogs(event.target.checked)} />最近7天体感</label>
      </div>
    </section>

    <section className="coach-conversation" aria-label="AI教练对话">
      <div className="section-heading"><div><h2>教练对话</h2><p>最多保留最近50条，并随现有账号同步。</p></div>{messages.length > 0 && <button className="icon-button" aria-label="清空AI教练对话" onClick={clearMessages}><Eraser size={17} /></button>}</div>
      {!messages.length ? <div className="coach-empty"><Bot size={28} /><strong>先说你今天遇到的问题</strong><p>可以从动作不适、训练平台、是否加重或下一次训练安排开始。</p></div> : <div className="coach-message-list">
        {messages.map((message) => <article className={`coach-message is-${message.role}`} key={message.id}>
          <div className="coach-message-meta"><strong>{message.role === 'user' ? '我' : 'AI教练'}</strong>{message.basis && <span>{message.basis}</span>}{message.riskLevel && message.riskLevel !== '正常' && <span className={message.riskLevel === '停止并评估' ? 'risk-stop' : 'risk-caution'}>{message.riskLevel}</span>}</div>
          <p>{message.content}</p>
          {message.suggestions?.map((suggestion) => {
            const exercise = state.planDays.find((item) => item.id === suggestion.planId)?.exercises.find((item) => item.id === suggestion.exerciseId)
            const changes = exercise ? describeChanges(exercise, suggestion) : []
            return <div className="coach-suggestion" key={suggestion.id}><div><strong>{suggestion.exerciseName}</strong><span>{changes.join('；') || '动作资料已经变化'}</span><small>{suggestion.reason}</small></div><button className="button compact" disabled={!exercise || !changes.length} onClick={() => applySuggestion(suggestion)}><CheckCircle2 size={15} />确认应用</button></div>
          })}
        </article>)}
      </div>}
    </section>

    <section className="coach-composer">
      <div className="coach-prompt-examples">{promptExamples.map((example) => <button type="button" key={example} onClick={() => setQuestion(example)}>{example}</button>)}</div>
      <label>想问什么<textarea value={question} maxLength={4000} placeholder="例如：结合最近两次训练，我的上斜哑铃推下一次应该维持、减重还是休息？" onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void sendQuestion() }} /></label>
      <div className="coach-composer-actions"><span>{question.length}/4000</span><button className="button primary" disabled={!connection?.configured || !question.trim() || loading} onClick={() => void sendQuestion()}><Send size={16} />{loading ? '分析中…' : '发送'}</button></div>
      {!connection?.configured && <div className="coach-inline-warning"><ShieldAlert size={17} />请先到“设置 → AI模型连接”完成登录和API配置。</div>}
      {error && <div className="notice error"><ShieldAlert size={18} />{error}</div>}
      {notice && <div className="notice success"><CheckCircle2 size={18} />{notice}</div>}
    </section>
  </div>
}
