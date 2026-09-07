import { useMemo, useState } from 'react'
import { Bell, Check, ChevronDown, Clock3, Edit3, Plus, Save, X } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import type { ScheduleItem } from '../types'
import { createId } from '../lib/ids'
import { getPlanForDate, isExerciseEnabled } from '../lib/trainingPlans'

const categoryClass: Record<ScheduleItem['category'], string> = {
  生活: 'category-life', 工作: 'category-work', 饮食: 'category-food', 训练: 'category-training', 睡眠: 'category-sleep', 补剂: 'category-supplement'
}

const emptyItem: Omit<ScheduleItem, 'id'> = {
  title: '', time: '09:00', durationMinutes: 30, category: '生活', reminderMinutes: 10, notes: '', completed: false
}

export function TimelineView() {
  const { state, setState } = useAppState()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Omit<ScheduleItem, 'id'>>(emptyItem)
  const sorted = useMemo(() => [...state.schedule].sort((a, b) => a.time.localeCompare(b.time)), [state.schedule])
  const todayPlan = getPlanForDate(state.planDays, state.trainingFrequency, state.trainingCycleStartedAt, new Date(), state.trainingCycleAnchor)
  const currentSplit = todayPlan.plan
  const currentExercises = currentSplit?.exercises.filter(isExerciseEnabled) ?? []

  const startEdit = (item: ScheduleItem) => {
    const { id: _id, ...rest } = item
    setDraft(rest)
    setEditing(item.id)
  }

  const save = () => {
    if (!draft.title.trim() || draft.durationMinutes <= 0) return
    setState((current) => ({
      ...current,
      schedule: editing === 'new'
        ? [...current.schedule, { ...draft, id: createId('schedule') }]
        : current.schedule.map((item) => item.id === editing ? { ...draft, id: item.id } : item),
      lastUpdatedAt: new Date().toISOString()
    }))
    setEditing(null)
  }

  const toggleDone = (id: string) => setState((current) => ({
    ...current,
    schedule: current.schedule.map((item) => item.id === id ? { ...item, completed: !item.completed } : item)
  }))

  return (
    <div className="view-stack">
      <section className="summary-strip" aria-label="今日摘要">
        <div><span>当前计划</span><strong>{todayPlan.isRestDay ? '休息日' : `${currentSplit?.name ?? '未设置'}日`}</strong></div>
        <div><span>已完成</span><strong>{sorted.filter((item) => item.completed).length}/{sorted.length}</strong></div>
        <div><span>睡眠目标</span><strong>8小时+</strong></div>
        <button className="button primary" onClick={() => { setDraft(emptyItem); setEditing('new') }}><Plus size={16} />添加安排</button>
      </section>

      <section className="timeline-section">
        <div className="section-heading"><div><h2>基础时间轴</h2><p>训练节点可继续展开查看当天动作。</p></div></div>
        <div className="timeline">
          {sorted.map((item) => (
            <div className={item.completed ? 'timeline-row is-completed' : 'timeline-row'} key={item.id}>
              <time>{item.time}</time>
              <span className={`timeline-marker ${categoryClass[item.category]}`} />
              <div className="timeline-body">
                <div className="timeline-main">
                  <div><strong>{item.title}</strong><span>{item.durationMinutes}分钟 · {item.category}</span></div>
                  <div className="row-actions">
                    {item.reminderMinutes > 0 && <span className="reminder"><Bell size={13} />提前{item.reminderMinutes}分钟</span>}
                    <button className="icon-button" aria-label={`编辑${item.title}`} onClick={() => startEdit(item)}><Edit3 size={16} /></button>
                    <button className={item.completed ? 'icon-button is-done' : 'icon-button'} aria-label={`完成${item.title}`} onClick={() => toggleDone(item.id)}><Check size={16} /></button>
                  </div>
                </div>
                {item.notes && <p className="timeline-notes">{item.notes}</p>}
                {item.id === 'schedule-strength' && (
                  <details className="training-expand">
                    <summary><ChevronDown size={15} />{todayPlan.isRestDay ? `今天休息，下次${currentSplit?.name ?? ''}日` : `查看${currentSplit?.name ?? ''}日训练细化`}</summary>
                    {todayPlan.isRestDay ? <p className="empty-inline">今天不安排力量训练，可做轻松步行和无症状活动。</p> : currentExercises.length ? (
                      <div className="compact-table">
                        {currentExercises.map((exercise) => <div key={exercise.id}><strong>{exercise.name}</strong><span>{exercise.sets}组 × {exercise.minReps}～{exercise.maxReps}次</span><span>{exercise.weightKg}kg · 余力{exercise.targetRir}</span></div>)}
                      </div>
                    ) : <p className="empty-inline">{currentSplit?.name ?? '当前'}日还没有启用动作，请到“训练”页面添加。</p>}
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title">
            <div className="dialog-header"><h2 id="schedule-dialog-title">{editing === 'new' ? '添加安排' : '编辑安排'}</h2><button className="icon-button" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button></div>
            <div className="form-grid">
              <label>名称<input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
              <label>开始时间<input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
              <label>持续分钟<input type="number" min="1" value={draft.durationMinutes} onChange={(e) => setDraft({ ...draft, durationMinutes: Number(e.target.value) })} /></label>
              <label>类别<select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as ScheduleItem['category'] })}>{Object.keys(categoryClass).map((category) => <option key={category}>{category}</option>)}</select></label>
              <label>提前提醒<input type="number" min="0" value={draft.reminderMinutes} onChange={(e) => setDraft({ ...draft, reminderMinutes: Number(e.target.value) })} /></label>
              <label className="full-field">备注<textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></label>
            </div>
            <div className="dialog-actions"><button className="button" onClick={() => setEditing(null)}><X size={16} />取消</button><button className="button primary" onClick={save}><Save size={16} />保存</button></div>
          </section>
        </div>
      )}
    </div>
  )
}
