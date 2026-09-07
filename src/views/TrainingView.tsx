import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, Bot, CheckCircle2, ClipboardCheck, Dumbbell, FileText, FolderPlus,
  ImagePlus, Pencil, Plus, Save, Trash2, X
} from 'lucide-react'
import { useAppState } from '../state/AppContext'
import type {
  Exercise, TrainingFrequency, TrainingRecommendation, TrainingTemplate,
  WorkoutSession, WorkoutSetLog
} from '../types'
import { createId } from '../lib/ids'
import { recommendNextLoad } from '../lib/training'
import { convertTrainingTemplate, isExerciseEnabled } from '../lib/trainingPlans'
import { parseTrainingText } from '../lib/trainingTextParser'
import { CoachPanel } from './training/CoachPanel'

const emptyExercise: Omit<Exercise, 'id'> = {
  name: '', targetArea: '', sets: 2, minReps: 8, maxReps: 12, weightKg: 0, incrementKg: 2.5,
  targetRir: 3, restSeconds: 120, steps: '', commonErrors: '', alternative: '', enabled: true,
  mediaUrl: '', stopCriteria: '麻木、电击感、突然无力、疼痛达到3分或腰背牵拉扩散时停止。'
}

function makeSetLogs(exercises: Exercise[]): WorkoutSetLog[] {
  return exercises.flatMap((exercise) => Array.from({ length: exercise.sets }, (_, index) => ({
    id: createId('set'), exerciseId: exercise.id, setNumber: index + 1, weightKg: exercise.weightKg,
    reps: exercise.minReps, rir: exercise.targetRir, formQuality: '稳定' as const, pain: 0,
    numbness: false, electricShock: false, weakness: false, backPull: false, notes: ''
  })))
}

export function TrainingView() {
  const { state, setState } = useAppState()
  const [workspaceMode, setWorkspaceMode] = useState<'plan' | 'coach'>('plan')
  const [planId, setPlanId] = useState(state.planDays[0]?.id ?? '')
  const [showExerciseForm, setShowExerciseForm] = useState(false)
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null)
  const [exerciseDraft, setExerciseDraft] = useState(emptyExercise)
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [newPlanName, setNewPlanName] = useState('')
  const [showTextImport, setShowTextImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [notice, setNotice] = useState('')
  const [session, setSession] = useState<WorkoutSession | null>(null)
  const [recommendations, setRecommendations] = useState<TrainingRecommendation[]>([])
  const plan = state.planDays.find((day) => day.id === planId) ?? state.planDays[0]
  const activeExercises = useMemo(() => plan?.exercises.filter(isExerciseEnabled) ?? [], [plan])
  const totalSets = useMemo(() => activeExercises.reduce((sum, exercise) => sum + exercise.sets, 0), [activeExercises])
  const parsedImport = useMemo(() => parseTrainingText(importText), [importText])

  useEffect(() => {
    if (plan && plan.id !== planId) setPlanId(plan.id)
  }, [plan, planId])

  const openNewExercise = () => {
    setExerciseDraft(emptyExercise)
    setEditingExerciseId(null)
    setNotice('')
    setShowExerciseForm(true)
  }

  const openEditExercise = (exercise: Exercise) => {
    const { id: _id, ...draft } = exercise
    setExerciseDraft({ ...emptyExercise, ...draft })
    setEditingExerciseId(exercise.id)
    setNotice('')
    setShowExerciseForm(true)
  }

  const saveExercise = () => {
    if (!plan || !exerciseDraft.name.trim() || exerciseDraft.sets < 1 || exerciseDraft.maxReps < exerciseDraft.minReps) {
      setNotice('请填写动作名称，并检查组数和次数范围。')
      return
    }
    const nextExercise: Exercise = {
      ...exerciseDraft,
      name: exerciseDraft.name.trim(),
      id: editingExerciseId ?? createId('exercise')
    }
    setState((current) => ({
      ...current,
      planDays: current.planDays.map((day) => day.id === plan.id
        ? {
            ...day,
            exercises: editingExerciseId
              ? day.exercises.map((exercise) => exercise.id === editingExerciseId ? nextExercise : exercise)
              : [...day.exercises, nextExercise]
          }
        : day)
    }))
    setShowExerciseForm(false)
  }

  const removeExercise = (id: string) => {
    if (!plan || !window.confirm('确定删除这个动作吗？已有训练记录不会删除。')) return
    setState((current) => ({
      ...current,
      planDays: current.planDays.map((day) => day.id === plan.id
        ? { ...day, exercises: day.exercises.filter((exercise) => exercise.id !== id) }
        : day)
    }))
  }

  const toggleExercise = (id: string, enabled: boolean) => {
    if (!plan) return
    setState((current) => ({
      ...current,
      planDays: current.planDays.map((day) => day.id === plan.id
        ? { ...day, exercises: day.exercises.map((exercise) => exercise.id === id ? { ...exercise, enabled } : exercise) }
        : day)
    }))
  }

  const changeTemplate = (template: TrainingTemplate) => {
    if (template === state.trainingTemplate) return
    if (template !== '自定义' && !window.confirm(`转换为${template}会重新归类动作，但不会删除动作和训练记录。继续吗？`)) return
    const planDays = convertTrainingTemplate(state.planDays, template)
    const today = new Date().toISOString().slice(0, 10)
    setState((current) => ({
      ...current,
      trainingTemplate: template,
      planDays,
      trainingCycleStartedAt: today,
      trainingCycleAnchor: { date: today, planId: planDays[0]?.id ?? null, isRestDay: false }
    }))
    setPlanId(planDays[0]?.id ?? '')
    setSession(null)
  }

  const changeFrequency = (frequency: TrainingFrequency) => {
    const today = new Date().toISOString().slice(0, 10)
    setState((current) => ({
      ...current,
      trainingFrequency: frequency,
      trainingCycleStartedAt: today,
      trainingCycleAnchor: { date: today, planId: current.planDays[0]?.id ?? null, isRestDay: false }
    }))
  }

  const addPlanDay = () => {
    const name = newPlanName.trim().slice(0, 12)
    if (!name) return
    if (state.planDays.some((day) => day.name === name)) {
      setNotice('这个训练日已经存在。')
      return
    }
    const nextPlan = { id: createId('plan'), name, exercises: [] }
    setState((current) => ({
      ...current,
      trainingTemplate: '自定义',
      planDays: [...current.planDays, nextPlan]
    }))
    setPlanId(nextPlan.id)
    setNewPlanName('')
    setShowPlanForm(false)
  }

  const removePlanDay = () => {
    if (!plan || state.planDays.length <= 1 || !window.confirm(`确定删除“${plan.name}日”吗？其中动作会一并移出计划。`)) return
    const nextPlans = state.planDays.filter((day) => day.id !== plan.id)
    setState((current) => ({ ...current, trainingTemplate: '自定义', planDays: nextPlans }))
    setPlanId(nextPlans[0]?.id ?? '')
    setSession(null)
  }

  const importParsedExercises = () => {
    if (!plan || !parsedImport.exercises.length) return
    const existingNames = new Set(plan.exercises.map((exercise) => exercise.name.trim().toLowerCase()))
    const additions = parsedImport.exercises.filter((exercise) => !existingNames.has(exercise.name.trim().toLowerCase()))
    if (!additions.length) {
      setNotice('识别出的动作都已存在，没有重复导入。')
      return
    }
    setState((current) => ({
      ...current,
      planDays: current.planDays.map((day) => day.id === plan.id
        ? { ...day, exercises: [...day.exercises, ...additions] }
        : day)
    }))
    setNotice(`已导入${additions.length}个动作。`)
    setImportText('')
    setShowTextImport(false)
  }

  const handleMediaFile = (file: File | undefined) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setNotice('只支持 JPG、PNG、WebP 或 GIF。')
      return
    }
    if (file.size > 512 * 1024) {
      setNotice('本地图片不能超过512KB；较大的图片或GIF请填写网址。')
      return
    }
    const embeddedSize = state.planDays.flatMap((day) => day.exercises)
      .reduce((sum, exercise) => sum + (exercise.mediaUrl?.startsWith('data:') ? exercise.mediaUrl.length : 0), 0)
    if (embeddedSize + file.size * 1.4 > 3_500_000) {
      setNotice('本地图片总量接近浏览器上限，请改用图片网址。')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setExerciseDraft((current) => ({ ...current, mediaUrl: reader.result as string }))
    }
    reader.onerror = () => setNotice('图片读取失败，请换一张图片或使用网址。')
    reader.readAsDataURL(file)
  }

  const startSession = () => {
    if (!plan || !activeExercises.length) return
    setSession({
      id: createId('session'), date: new Date().toISOString().slice(0, 10), split: plan.name,
      sleepHours: 7, energy: 6, nextDayWorse: false, logs: makeSetLogs(activeExercises)
    })
  }

  const updateLog = (id: string, patch: Partial<WorkoutSetLog>) => setSession((current) => current
    ? ({ ...current, logs: current.logs.map((log) => log.id === id ? { ...log, ...patch } : log) })
    : null)

  const saveSession = () => {
    if (!session || !plan) return
    const previous = [...state.sessions].reverse().find((item) => item.split === session.split)
    setRecommendations(activeExercises.map((exercise) => recommendNextLoad(exercise, session, previous)))
    setState((current) => ({ ...current, sessions: [...current.sessions, session] }))
    setSession(null)
  }

  const applyRecommendation = (recommendation: TrainingRecommendation) => {
    if (recommendation.type === '停止并评估' || recommendation.type === '休息') return
    setState((current) => ({
      ...current,
      planDays: current.planDays.map((day) => ({
        ...day,
        exercises: day.exercises.map((exercise) => exercise.id === recommendation.exerciseId
          ? { ...exercise, weightKg: recommendation.suggestedWeightKg }
          : exercise)
      }))
    }))
    setRecommendations((current) => current.filter((item) => item.exerciseId !== recommendation.exerciseId))
  }

  if (!plan) return <div className="empty-state"><Dumbbell size={28} /><strong>还没有训练日</strong></div>

  return (
    <div className="view-stack">
      <section className="training-workspace-switch">
        <div className="segmented-control" aria-label="训练工作区">
          <button className={workspaceMode === 'plan' ? 'is-selected' : ''} onClick={() => setWorkspaceMode('plan')}><Dumbbell size={16} />训练计划</button>
          <button className={workspaceMode === 'coach' ? 'is-selected' : ''} onClick={() => setWorkspaceMode('coach')}><Bot size={16} />AI教练</button>
        </div>
        <span>{workspaceMode === 'plan' ? '管理动作并记录训练' : '先分析建议，确认后才修改计划'}</span>
      </section>

      {workspaceMode === 'coach' ? <CoachPanel /> : <>
      <section className="training-config">
        <label>训练结构
          <select value={state.trainingTemplate} onChange={(event) => changeTemplate(event.target.value as TrainingTemplate)}>
            <option>三分化</option><option>五分化</option><option>自定义</option>
          </select>
        </label>
        <label>训练频率
          <select value={state.trainingFrequency} onChange={(event) => changeFrequency(event.target.value as TrainingFrequency)}>
            <option>连续循环</option><option>练一休一</option>
          </select>
        </label>
        <span>本轮从 {state.trainingCycleStartedAt} 开始</span>
        <button className="button" onClick={() => { setNotice(''); setShowPlanForm(true) }}><FolderPlus size={16} />添加训练日</button>
        <button className="button" onClick={() => { setNotice(''); setShowTextImport(true) }}><FileText size={16} />文本导入</button>
      </section>

      <section className="split-toolbar">
        <div className="segmented-control plan-tabs" aria-label="选择训练日">
          {state.planDays.map((day) => <button key={day.id} className={plan.id === day.id ? 'is-selected' : ''} onClick={() => { setPlanId(day.id); setSession(null) }}>{day.name}日</button>)}
        </div>
        <div className="toolbar-actions">
          <span>启用{activeExercises.length}/{plan.exercises.length}个动作 · {totalSets}组</span>
          <button className="button" onClick={openNewExercise}><Plus size={16} />添加动作</button>
          <button className="button primary" onClick={startSession} disabled={!activeExercises.length}><ClipboardCheck size={16} />记录本次训练</button>
          {state.planDays.length > 1 && <button className="icon-button destructive" aria-label={`删除${plan.name}日`} onClick={removePlanDay}><Trash2 size={16} /></button>}
        </div>
      </section>

      {notice && <div className="notice">{notice}</div>}

      <section>
        <div className="section-heading"><div><h2>{plan.name}日动作</h2><p>关闭“启用”后动作会留在动作库，但不计入本次训练。</p></div></div>
        {!plan.exercises.length ? (
          <div className="empty-state"><Dumbbell size={28} /><strong>还没有动作</strong><p>可以手动添加，或粘贴文字批量识别。</p><button className="button primary" onClick={openNewExercise}><Plus size={16} />添加动作</button></div>
        ) : (
          <div className="exercise-list">
            {plan.exercises.map((exercise) => (
              <article className={isExerciseEnabled(exercise) ? 'exercise-row' : 'exercise-row is-disabled'} key={exercise.id}>
                {exercise.mediaUrl
                  ? <img className="exercise-media" src={exercise.mediaUrl} alt={`${exercise.name}示意`} loading="lazy" referrerPolicy="no-referrer" />
                  : <div className="exercise-index">{exercise.name.slice(0, 1)}</div>}
                <div className="exercise-main"><div><strong>{exercise.name}</strong><span>{exercise.targetArea}</span></div><p>{exercise.steps || '尚未填写动作步骤。'}</p></div>
                <div className="exercise-prescription"><strong>{exercise.sets} × {exercise.minReps}～{exercise.maxReps}</strong><span>{exercise.weightKg}kg · RIR {exercise.targetRir}</span><small>休息{exercise.restSeconds}秒</small></div>
                <div className="exercise-actions">
                  <label className="switch-label compact-switch"><input type="checkbox" checked={isExerciseEnabled(exercise)} onChange={(event) => toggleExercise(exercise.id, event.target.checked)} />启用</label>
                  <button className="icon-button" aria-label={`编辑${exercise.name}`} onClick={() => openEditExercise(exercise)}><Pencil size={16} /></button>
                  <button className="icon-button destructive" aria-label={`删除${exercise.name}`} onClick={() => removeExercise(exercise.id)}><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {recommendations.length > 0 && <section className="recommendations"><div className="section-heading"><div><h2>下一循环建议</h2><p>确认后才会修改计划重量。</p></div></div>{recommendations.map((item) => { const exercise = activeExercises.find((entry) => entry.id === item.exerciseId); return <div className={`recommendation-row recommendation-${item.type}`} key={item.exerciseId}><div>{item.type === '停止并评估' ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}<span><strong>{exercise?.name}：{item.type}</strong><small>{item.reasons.join(' ')}</small></span></div><div><b>{item.suggestedWeightKg}kg</b>{!['停止并评估', '休息'].includes(item.type) && <button className="button compact" onClick={() => applyRecommendation(item)}>应用</button>}</div></div>})}</section>}

      {showPlanForm && <div className="dialog-backdrop"><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="plan-title"><div className="dialog-header"><h2 id="plan-title">添加自定义训练日</h2><button className="icon-button" onClick={() => setShowPlanForm(false)} aria-label="关闭"><X size={18} /></button></div><label>训练日名称<input value={newPlanName} maxLength={12} placeholder="例如：腹、手臂、全身A" onChange={(event) => setNewPlanName(event.target.value)} /></label><div className="dialog-actions"><button className="button" onClick={() => setShowPlanForm(false)}><X size={16} />取消</button><button className="button primary" disabled={!newPlanName.trim()} onClick={addPlanDay}><Save size={16} />添加</button></div></section></div>}

      {showTextImport && <div className="dialog-backdrop"><section className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="dialog-header"><div><h2 id="import-title">导入到{plan.name}日</h2><p>一行一个动作，识别后先预览，不会直接覆盖已有动作。</p></div><button className="icon-button" onClick={() => setShowTextImport(false)} aria-label="关闭"><X size={18} /></button></div><textarea className="training-import-text" value={importText} placeholder={'高位下拉 3组×10-12次 40kg 余力3 休息120秒\n坐姿划船，3组12次，目标：背部，要点：躯干稳定'} onChange={(event) => setImportText(event.target.value)} />{parsedImport.exercises.length > 0 && <div className="import-exercise-preview">{parsedImport.exercises.map((exercise) => <div key={exercise.id}><strong>{exercise.name}</strong><span>{exercise.sets}组 × {exercise.minReps}～{exercise.maxReps}次</span><span>{exercise.weightKg}kg · 余力{exercise.targetRir}</span></div>)}</div>}{parsedImport.warnings.map((warning) => <p className="field-error" key={warning}>{warning}</p>)}<div className="dialog-actions"><button className="button" onClick={() => setShowTextImport(false)}><X size={16} />取消</button><button className="button primary" disabled={!parsedImport.exercises.length} onClick={importParsedExercises}><Save size={16} />导入{parsedImport.exercises.length}个动作</button></div></section></div>}

      {showExerciseForm && <div className="dialog-backdrop"><section className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="exercise-title"><div className="dialog-header"><h2 id="exercise-title">{editingExerciseId ? '编辑' : '添加'}{plan.name}日动作</h2><button className="icon-button" onClick={() => setShowExerciseForm(false)} aria-label="关闭"><X size={18} /></button></div><div className="form-grid three-columns">
        <label>动作名称<input value={exerciseDraft.name} onChange={(event) => setExerciseDraft({ ...exerciseDraft, name: event.target.value })} /></label>
        <label>目标部位<input value={exerciseDraft.targetArea} onChange={(event) => setExerciseDraft({ ...exerciseDraft, targetArea: event.target.value })} /></label>
        <label className="switch-label form-switch"><input type="checkbox" checked={exerciseDraft.enabled !== false} onChange={(event) => setExerciseDraft({ ...exerciseDraft, enabled: event.target.checked })} />加入当前训练</label>
        <label>组数<input type="number" min="1" max="10" value={exerciseDraft.sets} onChange={(event) => setExerciseDraft({ ...exerciseDraft, sets: Number(event.target.value) })} /></label>
        <label>最低次数<input type="number" min="1" value={exerciseDraft.minReps} onChange={(event) => setExerciseDraft({ ...exerciseDraft, minReps: Number(event.target.value) })} /></label>
        <label>最高次数<input type="number" min="1" value={exerciseDraft.maxReps} onChange={(event) => setExerciseDraft({ ...exerciseDraft, maxReps: Number(event.target.value) })} /></label>
        <label>当前重量kg<input type="number" min="0" step="0.5" value={exerciseDraft.weightKg} onChange={(event) => setExerciseDraft({ ...exerciseDraft, weightKg: Number(event.target.value) })} /></label>
        <label>最小加重量kg<input type="number" min="0.25" step="0.25" value={exerciseDraft.incrementKg} onChange={(event) => setExerciseDraft({ ...exerciseDraft, incrementKg: Number(event.target.value) })} /></label>
        <label>目标余力<input type="number" min="0" max="6" value={exerciseDraft.targetRir} onChange={(event) => setExerciseDraft({ ...exerciseDraft, targetRir: Number(event.target.value) })} /></label>
        <label>组间休息秒<input type="number" min="30" max="600" value={exerciseDraft.restSeconds} onChange={(event) => setExerciseDraft({ ...exerciseDraft, restSeconds: Number(event.target.value) })} /></label>
        <label className="media-url-field">图片或GIF网址<input type="url" value={exerciseDraft.mediaUrl ?? ''} placeholder="https://..." onChange={(event) => setExerciseDraft({ ...exerciseDraft, mediaUrl: event.target.value })} /></label>
        <label className="file-input-label"><ImagePlus size={16} />本地小图或GIF（≤512KB）<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => handleMediaFile(event.target.files?.[0])} /></label>
        {exerciseDraft.mediaUrl && <div className="exercise-media-preview"><img src={exerciseDraft.mediaUrl} alt="动作媒体预览" referrerPolicy="no-referrer" /><button className="button compact" onClick={() => setExerciseDraft({ ...exerciseDraft, mediaUrl: '' })}>移除图片</button></div>}
        <label className="full-field">动作步骤<textarea value={exerciseDraft.steps} onChange={(event) => setExerciseDraft({ ...exerciseDraft, steps: event.target.value })} /></label>
        <label>常见错误<textarea value={exerciseDraft.commonErrors} onChange={(event) => setExerciseDraft({ ...exerciseDraft, commonErrors: event.target.value })} /></label>
        <label>替代动作<textarea value={exerciseDraft.alternative} onChange={(event) => setExerciseDraft({ ...exerciseDraft, alternative: event.target.value })} /></label>
        <label>停止标准<textarea value={exerciseDraft.stopCriteria} onChange={(event) => setExerciseDraft({ ...exerciseDraft, stopCriteria: event.target.value })} /></label>
      </div>{notice && <p className="field-error">{notice}</p>}<div className="dialog-actions"><button className="button" onClick={() => setShowExerciseForm(false)}><X size={16} />取消</button><button className="button primary" onClick={saveExercise}><Save size={16} />保存动作</button></div></section></div>}

      {session && <div className="dialog-backdrop"><section className="dialog workout-dialog" role="dialog" aria-modal="true" aria-labelledby="workout-title"><div className="dialog-header"><div><h2 id="workout-title">记录{plan.name}日训练</h2><p>备用动作不会进入本次记录。</p></div><button className="icon-button" onClick={() => setSession(null)} aria-label="关闭"><X size={18} /></button></div><div className="session-meta"><label>睡眠小时<input type="number" min="0" max="16" step="0.5" value={session.sleepHours} onChange={(event) => setSession({ ...session, sleepHours: Number(event.target.value) })} /></label><label>精力 0～10<input type="number" min="0" max="10" value={session.energy} onChange={(event) => setSession({ ...session, energy: Number(event.target.value) })} /></label><label className="checkbox-label"><input type="checkbox" checked={session.nextDayWorse} onChange={(event) => setSession({ ...session, nextDayWorse: event.target.checked })} />次日不适加重</label></div><div className="set-log-list">{activeExercises.map((exercise) => <div className="set-log-group" key={exercise.id}><h3>{exercise.name}<span>{exercise.stopCriteria}</span></h3>{session.logs.filter((log) => log.exerciseId === exercise.id).map((log) => <div className="set-log-row" key={log.id}><b>第{log.setNumber}组</b><label>kg<input type="number" step="0.5" value={log.weightKg} onChange={(event) => updateLog(log.id, { weightKg: Number(event.target.value) })} /></label><label>次数<input type="number" min="0" value={log.reps} onChange={(event) => updateLog(log.id, { reps: Number(event.target.value) })} /></label><label>余力<input type="number" min="0" max="10" value={log.rir} onChange={(event) => updateLog(log.id, { rir: Number(event.target.value) })} /></label><label>疼痛<input type="number" min="0" max="10" value={log.pain} onChange={(event) => updateLog(log.id, { pain: Number(event.target.value) })} /></label><label>动作<select value={log.formQuality} onChange={(event) => updateLog(log.id, { formQuality: event.target.value as WorkoutSetLog['formQuality'] })}><option>稳定</option><option>轻微变形</option><option>明显变形</option></select></label><div className="symptom-checks">{([['numbness','麻木'],['electricShock','电击感'],['weakness','无力'],['backPull','腰背牵拉']] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={log[key]} onChange={(event) => updateLog(log.id, { [key]: event.target.checked })} />{label}</label>)}</div></div>)}</div>)}</div><div className="dialog-actions"><button className="button" onClick={() => setSession(null)}><X size={16} />取消</button><button className="button primary" onClick={saveSession}><Save size={16} />保存并分析</button></div></section></div>}
      </>}
    </div>
  )
}
