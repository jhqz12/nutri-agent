import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, ChevronDown, ChevronRight, Dices, Edit3, ListChecks, Plus, Save, Shuffle, Utensils, X } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import { useNutritionState } from '../state/NutritionContext'
import type { ScheduleItem } from '../types'
import { createId } from '../lib/ids'
import { formatLocalDate, getPlanForDate } from '../lib/trainingPlans'
import { buildScheduleRow, dailyPlanCategoryClass, getActivePlan, materializeItems, readCheckedRows, toggleCheckedRow } from '../lib/dailyPlan'
import { calculateEngine, calculateMacro, getEffectiveLibrariesForState } from '../lib/engine'
import { analyzePlanNutrition } from '../lib/planNutrition'
import { displayMealName } from '../lib/foodUnits'

const categoryClass: Record<ScheduleItem['category'], string> = {
  生活: 'category-life', 工作: 'category-work', 饮食: 'category-food', 训练: 'category-training', 睡眠: 'category-sleep', 补剂: 'category-supplement'
}

const emptyItem: Omit<ScheduleItem, 'id'> = {
  title: '', time: '09:00', durationMinutes: 30, category: '生活', reminderMinutes: 10, notes: '', completed: false
}

interface TimelineEntry {
  id: string
  time: string
  title: string
  category: ScheduleItem['category']
  notes: string
  amountLabel: string
  source: 'dailyplan' | 'life'
  done: boolean
}

export function TimelineView() {
  const { state, setState } = useAppState()
  const { state: nutritionState, setState: setNutritionState } = useNutritionState()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Omit<ScheduleItem, 'id'>>(emptyItem)
  const [randomSeed, setRandomSeed] = useState(0)
  const [showDone, setShowDone] = useState(false)

  const today = formatLocalDate()
  const todayPlan = getPlanForDate(state.planDays, state.trainingFrequency, state.trainingCycleStartedAt, new Date(), state.trainingCycleAnchor)
  const dayType: 'training' | 'rest' = todayPlan.isRestDay ? 'rest' : 'training'
  const activePlan = getActivePlan(state, dayType)
  const mode = state.dailyPlanMode ?? 'fixed'
  const mealSource = state.mealSource ?? 'plan'

  const result = useMemo(() => calculateEngine(nutritionState), [nutritionState])
  const libraries = useMemo(() => getEffectiveLibrariesForState(nutritionState), [nutritionState])

  // 参考公式：默认用当前公式，也可手动切到任意公式看对比
  const referenceFormulaId = state.referenceFormulaId ?? result.macro.formulaId
  const referenceFormula = libraries.formulas.find((formula) => formula.id === referenceFormulaId)
  const target = referenceFormula ? calculateMacro(nutritionState, referenceFormula) : result.macro

  const planItems = useMemo(() => activePlan ? materializeItems(activePlan, mode, randomSeed) : [], [activePlan, mode, randomSeed])
  const planNutrition = useMemo(() => activePlan ? analyzePlanNutrition(activePlan) : null, [activePlan])

  const summary = mealSource === 'auto'
    ? { calories: Math.round(result.actual.calories), protein: result.actual.protein, fat: result.actual.fat, carbs: result.actual.carbs }
    : { calories: planNutrition?.totals.calories ?? 0, protein: planNutrition?.totals.protein ?? 0, fat: planNutrition?.totals.fat ?? 0, carbs: planNutrition?.totals.carbs ?? 0 }

  const lifeItems = useMemo(() => state.schedule.filter((item) => ['生活', '工作', '睡眠'].includes(item.category)), [state.schedule])

  const [checkedRows, setCheckedRows] = useState<Set<string>>(() => readCheckedRows(today))
  useEffect(() => { setCheckedRows(readCheckedRows(today)) }, [today, dayType, mealSource, mode])

  // 汇总成单一时间轴：日计划项（饮食/补剂/训练/全天）+ 生活项，按时间排序
  const entries = useMemo<TimelineEntry[]>(() => {
    const list: TimelineEntry[] = []
    if (mealSource === 'plan' && activePlan) {
      for (const entry of planItems) {
        const row = buildScheduleRow(entry, dayType)
        const isDone = checkedRows.has(row.id)
        const amountLabel = entry.item.kind === '全天' ? `${entry.item.amount}${entry.item.unit} · 全天` : `${entry.item.amount}${entry.item.unit}`
        list.push({
          id: row.id, time: row.time, title: `${entry.item.label}·${entry.displayName}`, category: row.category,
          notes: entry.item.note, amountLabel, source: 'dailyplan', done: isDone
        })
      }
    } else if (mealSource === 'auto') {
      const meals = ['早餐', '午餐', '晚餐', '加餐'] as const
      for (const meal of meals) {
        for (const menuEntry of result.menu.filter((entry) => displayMealName(entry.meal) === meal)) {
          const food = libraries.foods.find((item) => item.id === menuEntry.foodId)
          const rowId = `auto-${dayType}-${meal}-${menuEntry.foodId}`
          list.push({
            id: rowId, time: '12:00', title: `${meal}·${food?.name ?? '食材缺失'}`, category: '饮食',
            notes: '', amountLabel: `${menuEntry.amount}${menuEntry.unit}`, source: 'dailyplan', done: checkedRows.has(rowId)
          })
        }
      }
      // 自动配餐仍保留补剂/训练项
      for (const entry of planItems.filter((entry) => entry.item.kind === '补剂' || entry.item.kind === '训练')) {
        const row = buildScheduleRow(entry, dayType)
        list.push({
          id: row.id, time: row.time, title: `${entry.item.label}·${entry.displayName}`, category: row.category,
          notes: entry.item.note, amountLabel: `${entry.item.amount}${entry.item.unit}`, source: 'dailyplan', done: checkedRows.has(row.id)
        })
      }
    }
    for (const item of lifeItems) {
      list.push({
        id: item.id, time: item.time, title: item.title, category: item.category,
        notes: item.notes, amountLabel: item.durationMinutes ? `${item.durationMinutes}分钟` : '', source: 'life', done: item.completed
      })
    }
    return list.sort((a, b) => a.time.localeCompare(b.time))
  }, [planItems, lifeItems, mealSource, activePlan, dayType, checkedRows, result.menu, libraries.foods])

  const pending = entries.filter((entry) => !entry.done)
  const done = entries.filter((entry) => entry.done)
  const doneCount = done.length

  const toggleEntry = (entry: TimelineEntry) => {
    if (entry.source === 'dailyplan') {
      const next = toggleCheckedRow(today, entry.id)
      setCheckedRows((current) => {
        const clone = new Set(current)
        if (next) clone.add(entry.id)
        else clone.delete(entry.id)
        return clone
      })
    } else {
      setState((current) => ({
        ...current,
        schedule: current.schedule.map((item) => item.id === entry.id ? { ...item, completed: !item.completed } : item),
        lastUpdatedAt: new Date().toISOString()
      }))
    }
  }

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

  const switchMode = (next: 'fixed' | 'random') => setState((current) => ({ ...current, dailyPlanMode: next, lastUpdatedAt: new Date().toISOString() }))
  const switchMealSource = (next: 'plan' | 'auto') => setState((current) => ({ ...current, mealSource: next, lastUpdatedAt: new Date().toISOString() }))
  const switchReference = (formulaId: string) => setState((current) => ({ ...current, referenceFormulaId: formulaId === result.macro.formulaId ? null : formulaId, lastUpdatedAt: new Date().toISOString() }))
  const reshuffle = () => setRandomSeed((seed) => seed + 1)

  const deltaOf = (key: 'calories' | 'protein' | 'fat' | 'carbs') => Math.round(summary[key] - (key === 'calories' ? target.targetCalories : target[key]))

  const renderEntry = (entry: TimelineEntry) => (
    <li key={entry.id} className={entry.done ? 'is-completed' : ''}>
      <span className={`timeline-marker ${categoryClass[entry.category]}`} aria-hidden="true" />
      <div className="daily-plan-row-body">
        <div className="daily-plan-row-main">
          <strong>{entry.title}</strong>
          <span>{entry.amountLabel}</span>
          {entry.category === '饮食' && summary && <em className="kcal-tag">{entry.id.startsWith('auto') ? '' : ''}</em>}
        </div>
        {entry.notes && <p className="timeline-notes">{entry.notes}</p>}
      </div>
      <div className="row-actions">
        {entry.source === 'life' && (
          <button className="icon-button" aria-label={`编辑${entry.title}`} onClick={() => startEdit(state.schedule.find((item) => item.id === entry.id)!)}><Edit3 size={15} /></button>
        )}
        <button className={entry.done ? 'icon-button is-done' : 'icon-button'} aria-label={entry.done ? `取消完成${entry.title}` : `标记${entry.title}完成`} onClick={() => toggleEntry(entry)}><Check size={16} /></button>
      </div>
    </li>
  )

  return (
    <div className="view-stack">
      <section className="summary-strip" aria-label="今日摘要">
        <div><span>当前计划</span><strong>{todayPlan.isRestDay ? '休息日' : `${todayPlan.plan?.name ?? '未设置'}日`}</strong></div>
        <div><span>已完成</span><strong>{doneCount}/{entries.length}</strong></div>
        <div><span>待完成</span><strong>{pending.length}</strong></div>
        <button className="button primary" onClick={() => { setDraft(emptyItem); setEditing('new') }}><Plus size={16} />添加生活安排</button>
      </section>

      <section className="timeline-section daily-plan-section">
        <div className="section-heading">
          <div>
            <h2>今日时间轴</h2>
            <p>按时间往下捋，完成一项就折叠，下一项自动往上。</p>
          </div>
          <div className="daily-plan-tools">
            <label className="ref-formula">
              <span>参考公式</span>
              <select value={referenceFormulaId} onChange={(e) => switchReference(e.target.value)}>
                {libraries.formulas.map((formula) => (
                  <option key={formula.id} value={formula.id}>{formula.name}</option>
                ))}
              </select>
            </label>
            <div className="mode-switch" role="group" aria-label="饮食来源">
              <button className={mealSource === 'plan' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMealSource('plan')} aria-pressed={mealSource === 'plan'}><ListChecks size={14} />我的计划</button>
              <button className={mealSource === 'auto' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMealSource('auto')} aria-pressed={mealSource === 'auto'}><Utensils size={14} />自动配餐</button>
            </div>
            {mealSource === 'plan' && activePlan && (
              <div className="mode-switch" role="group" aria-label="菜单模式">
                <button className={mode === 'fixed' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMode('fixed')} aria-pressed={mode === 'fixed'}>固定</button>
                <button className={mode === 'random' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMode('random')} aria-pressed={mode === 'random'}><Shuffle size={14} />随机</button>
              </div>
            )}
            {mealSource === 'plan' && mode === 'random' && <button className="button" onClick={reshuffle} aria-label="换一组随机"><Dices size={16} />换一组</button>}
          </div>
        </div>

        <div className="meal-nutrition-summary" aria-label="今日营养合计">
          <div><span>热量</span><strong>{summary.calories}<small> / {target.targetCalories} kcal</small></strong><em className={deltaOf('calories') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('calories') >= 0 ? '+' : ''}{deltaOf('calories')}</em></div>
          <div><span>蛋白质</span><strong>{summary.protein}<small> / {target.protein} g</small></strong><em className={deltaOf('protein') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('protein') >= 0 ? '+' : ''}{deltaOf('protein')}</em></div>
          <div><span>脂肪</span><strong>{summary.fat}<small> / {target.fat} g</small></strong><em className={deltaOf('fat') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('fat') >= 0 ? '+' : ''}{deltaOf('fat')}</em></div>
          <div><span>碳水</span><strong>{summary.carbs}<small> / {target.carbs} g</small></strong><em className={deltaOf('carbs') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('carbs') >= 0 ? '+' : ''}{deltaOf('carbs')}</em></div>
        </div>
        <p className="muted reference-note">对比基准：{target.formulaName}（{referenceFormula?.name ?? result.macro.formulaName}）。切换参考公式可对比不同方案的目标值。</p>

        {activePlan && planNutrition && planNutrition.unknownFoods.length > 0 && (
          <p className="muted">未匹配到营养值的项：{planNutrition.unknownFoods.join('、')}（不计入合计）</p>
        )}

        <div className="daily-plan-timeline">
          {pending.length === 0 && <p className="empty-inline">今天的项目全部完成，做得好。</p>}
          <ul className="timeline-list">{pending.map(renderEntry)}</ul>

          {doneCount > 0 && (
            <div className="done-fold">
              <button className="done-fold-head" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                {showDone ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span>已完成 {doneCount} 项</span>
                <em className="done-count-dot" />
              </button>
              {showDone && <ul className="timeline-list is-done-list">{done.map(renderEntry)}</ul>}
            </div>
          )}
        </div>
      </section>

      {editing && (
        <div className="dialog-backdrop" role="presentation">
          <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-dialog-title">
            <div className="dialog-header"><h2 id="schedule-dialog-title">{editing === 'new' ? '添加生活安排' : '编辑生活安排'}</h2><button className="icon-button" onClick={() => setEditing(null)} aria-label="关闭"><X size={18} /></button></div>
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
