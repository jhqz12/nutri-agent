import { useEffect, useMemo, useState } from 'react'
import { Bell, Check, Dices, Edit3, ListChecks, Plus, Save, Shuffle, Sun, Utensils, X } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import { useNutritionState } from '../state/NutritionContext'
import type { ScheduleItem } from '../types'
import { createId } from '../lib/ids'
import { getPlanForDate } from '../lib/trainingPlans'
import { buildScheduleRow, dailyPlanCategoryClass, getActivePlan, groupItemsBySlot, materializeItems } from '../lib/dailyPlan'
import { calculateEngine, getEffectiveLibrariesForState } from '../lib/engine'
import { analyzePlanNutrition } from '../lib/planNutrition'
import { displayMealName } from '../lib/foodUnits'

const categoryClass: Record<ScheduleItem['category'], string> = {
  生活: 'category-life', 工作: 'category-work', 饮食: 'category-food', 训练: 'category-training', 睡眠: 'category-sleep', 补剂: 'category-supplement'
}

const emptyItem: Omit<ScheduleItem, 'id'> = {
  title: '', time: '09:00', durationMinutes: 30, category: '生活', reminderMinutes: 10, notes: '', completed: false
}

interface DietRow { displayName: string; amount: number; unit: string; note: string; isRandomized: boolean }
interface SlotGroup { slot: string; rows: Array<{ item?: never; displayName: string; amount: number; unit: string; note: string; isRandomized: boolean }> }

export function TimelineView() {
  const { state, setState } = useAppState()
  const { state: nutritionState } = useNutritionState()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Omit<ScheduleItem, 'id'>>(emptyItem)
  const [randomSeed, setRandomSeed] = useState(0)
  const sorted = useMemo(() => [...state.schedule].sort((a, b) => a.time.localeCompare(b.time)), [state.schedule])
  const todayPlan = getPlanForDate(state.planDays, state.trainingFrequency, state.trainingCycleStartedAt, new Date(), state.trainingCycleAnchor)
  const currentSplit = todayPlan.plan

  const dayType: 'training' | 'rest' = todayPlan.isRestDay ? 'rest' : 'training'
  const activePlan = getActivePlan(state, dayType)
  const mode = state.dailyPlanMode ?? 'fixed'
  const mealSource = state.mealSource ?? 'plan'

  const result = useMemo(() => calculateEngine(nutritionState), [nutritionState])
  const libraries = useMemo(() => getEffectiveLibrariesForState(nutritionState), [nutritionState])
  const target = result.macro

  const planItems = useMemo(() => activePlan ? materializeItems(activePlan, mode, randomSeed) : [], [activePlan, mode, randomSeed])
  const planGrouped = useMemo(() => groupItemsBySlot(planItems), [planItems])
  const nonDietPlanGrouped = useMemo(() => groupItemsBySlot(planItems.filter((entry) => entry.item.kind === '补剂' || entry.item.kind === '训练')), [planItems])

  const autoMealGroups: SlotGroup[] = useMemo(() => {
    const meals = ['早餐', '午餐', '晚餐', '加餐'] as const
    return meals.map((meal) => ({
      slot: meal,
      rows: result.menu.filter((entry) => displayMealName(entry.meal) === meal).map((entry) => {
        const food = libraries.foods.find((item) => item.id === entry.foodId)
        return { displayName: food?.name ?? '食材资料缺失', amount: entry.amount, unit: entry.unit, note: '', isRandomized: false }
      })
    })).filter((group) => group.rows.length)
  }, [libraries.foods, result.menu])

  const planNutrition = useMemo(() => activePlan ? analyzePlanNutrition(activePlan) : null, [activePlan])
  const summary = mealSource === 'auto'
    ? { calories: Math.round(result.actual.calories), protein: result.actual.protein, fat: result.actual.fat, carbs: result.actual.carbs }
    : { calories: planNutrition?.totals.calories ?? 0, protein: planNutrition?.totals.protein ?? 0, fat: planNutrition?.totals.fat ?? 0, carbs: planNutrition?.totals.carbs ?? 0 }

  const lifeItems = useMemo(() => sorted.filter((item) => ['生活', '工作', '睡眠'].includes(item.category)), [sorted])

  const dailyRows = useMemo(() => planItems.map((entry) => buildScheduleRow(entry, dayType)), [planItems, dayType])
  const [dailyDone, setDailyDone] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    if (typeof window === 'undefined') return map
    for (const row of dailyRows) if (window.localStorage.getItem(`dailyplan-completed-${row.id}`) === '1') map[row.id] = true
    return map
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const map: Record<string, boolean> = {}
    for (const row of dailyRows) if (window.localStorage.getItem(`dailyplan-completed-${row.id}`) === '1') map[row.id] = true
    setDailyDone(map)
  }, [dailyRows])
  useEffect(() => { setRandomSeed(0) }, [mode, dayType])

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

  const toggleDailyDone = (rowId: string) => {
    if (typeof window === 'undefined') return
    const key = `dailyplan-completed-${rowId}`
    const next = window.localStorage.getItem(key) === '1' ? null : '1'
    if (next) window.localStorage.setItem(key, '1')
    else window.localStorage.removeItem(key)
    setDailyDone((current) => ({ ...current, [rowId]: next === '1' }))
  }

  const switchMode = (next: 'fixed' | 'random') => setState((current) => ({ ...current, dailyPlanMode: next, lastUpdatedAt: new Date().toISOString() }))
  const switchMealSource = (next: 'plan' | 'auto') => setState((current) => ({ ...current, mealSource: next, lastUpdatedAt: new Date().toISOString() }))
  const reshuffle = () => setRandomSeed((seed) => seed + 1)

  const deltaOf = (key: 'calories' | 'protein' | 'fat' | 'carbs') => Math.round(summary[key] - (key === 'calories' ? target.targetCalories : target[key]))

  const renderPlanGroup = (group: SlotGroup) => {
    return (
      <div className="daily-plan-slot" key={group.slot}>
        <div className="daily-plan-slot-head">
          <Sun size={14} aria-hidden="true" />
          <strong>{group.slot}</strong>
        </div>
        <ul>
          {group.rows.map((row) => {
            const planRow = buildScheduleRowForDisplay(row, dayType)
            const done = dailyDone[planRow.id] === true
            return (
              <li key={planRow.id} className={done ? 'is-completed' : ''}>
                <span className={`timeline-marker ${categoryClass[planRow.category]}`} aria-hidden="true" />
                <div className="daily-plan-row-body">
                  <div className="daily-plan-row-main">
                    <strong>{row.displayName}</strong>
                    <span>{row.amount}{row.unit}</span>
                    {row.isRandomized && <em className="random-tag">随机</em>}
                  </div>
                  {row.note && <p className="timeline-notes">{row.note}</p>}
                </div>
                <button className={done ? 'icon-button is-done' : 'icon-button'} aria-label={done ? `已完成${row.displayName}` : `标记${row.displayName}完成`} onClick={() => toggleDailyDone(planRow.id)}>
                  <Check size={16} />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <div className="view-stack">
      <section className="summary-strip" aria-label="今日摘要">
        <div><span>当前计划</span><strong>{todayPlan.isRestDay ? '休息日' : `${currentSplit?.name ?? '未设置'}日`}</strong></div>
        <div><span>已完成</span><strong>{sorted.filter((item) => item.completed).length}/{sorted.length}</strong></div>
        <div><span>睡眠目标</span><strong>8小时+</strong></div>
        <button className="button primary" onClick={() => { setDraft(emptyItem); setEditing('new') }}><Plus size={16} />添加生活安排</button>
      </section>

      <section className="timeline-section daily-plan-section">
        <div className="section-heading">
          <div>
            <h2>今日饮食</h2>
            <p>{mealSource === 'auto' ? '引擎按公式自动配餐，减少思考成本。' : activePlan ? `当前模板：${activePlan.name}。` : '还没有日计划模板，请到「计划」页导入或新建。'}</p>
          </div>
          <div className="daily-plan-tools">
            <div className="mode-switch" role="group" aria-label="饮食来源">
              <button className={mealSource === 'plan' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMealSource('plan')} aria-pressed={mealSource === 'plan'}>
                <ListChecks size={14} />我的计划
              </button>
              <button className={mealSource === 'auto' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMealSource('auto')} aria-pressed={mealSource === 'auto'}>
                <Utensils size={14} />自动配餐
              </button>
            </div>
            {mealSource === 'plan' && activePlan && (
              <>
                <div className="mode-switch" role="group" aria-label="菜单模式">
                  <button className={mode === 'fixed' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMode('fixed')} aria-pressed={mode === 'fixed'}><ListChecks size={14} />固定</button>
                  <button className={mode === 'random' ? 'mode-pill is-active' : 'mode-pill'} onClick={() => switchMode('random')} aria-pressed={mode === 'random'}><Shuffle size={14} />随机</button>
                </div>
                {mode === 'random' && <button className="button" onClick={reshuffle} aria-label="换一组随机"><Dices size={16} />换一组</button>}
              </>
            )}
          </div>
        </div>

        <div className="meal-nutrition-summary" aria-label="今日营养合计">
          <div><span>热量</span><strong>{summary.calories}<small> / {target.targetCalories} kcal</small></strong><em className={deltaOf('calories') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('calories') >= 0 ? '+' : ''}{deltaOf('calories')}</em></div>
          <div><span>蛋白质</span><strong>{summary.protein}<small> / {target.protein} g</small></strong><em className={deltaOf('protein') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('protein') >= 0 ? '+' : ''}{deltaOf('protein')}</em></div>
          <div><span>脂肪</span><strong>{summary.fat}<small> / {target.fat} g</small></strong><em className={deltaOf('fat') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('fat') >= 0 ? '+' : ''}{deltaOf('fat')}</em></div>
          <div><span>碳水</span><strong>{summary.carbs}<small> / {target.carbs} g</small></strong><em className={deltaOf('carbs') > 0 ? 'delta-over' : 'delta-under'}>{deltaOf('carbs') >= 0 ? '+' : ''}{deltaOf('carbs')}</em></div>
        </div>

        <div className="daily-plan-timeline">
          {mealSource === 'auto' ? (
            autoMealGroups.map((group) => renderPlanGroup(group))
          ) : activePlan ? (
            planGrouped.map((group) => {
              return (
                <div className="daily-plan-slot" key={group.slot}>
                  <div className="daily-plan-slot-head">
                    <Sun size={14} aria-hidden="true" />
                    <strong>{group.slot}</strong>
                    <span>{group.rows[0]?.item.time && group.rows[0].item.time !== '00:00' ? group.rows[0].item.time : ''}</span>
                  </div>
                  <ul>
                    {group.rows.map((row) => {
                      const planRow = buildScheduleRow(row, dayType)
                      const done = dailyDone[planRow.id] === true
                      return (
                        <li key={planRow.id} className={done ? 'is-completed' : ''}>
                          <span className={`timeline-marker ${dailyPlanCategoryClass[row.item.kind]}`} aria-hidden="true" />
                          <div className="daily-plan-row-body">
                            <div className="daily-plan-row-main">
                              <strong>{row.displayName}</strong>
                              <span>{row.item.amount}{row.item.unit}{row.item.kind === '全天' ? ' · 全天总量' : ''}</span>
                              {row.isRandomized && <em className="random-tag">随机</em>}
                            </div>
                            {row.item.note && <p className="timeline-notes">{row.item.note}</p>}
                          </div>
                          <button className={done ? 'icon-button is-done' : 'icon-button'} aria-label={done ? `已完成${row.displayName}` : `标记${row.displayName}完成`} onClick={() => toggleDailyDone(planRow.id)}>
                            <Check size={16} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          ) : (
            <p className="empty-inline">尚未配置日计划模板。打开「计划」页面，导入或新建一个训练日 / 休息日模板即可。</p>
          )}

          {mealSource === 'auto' && nonDietPlanGrouped.map((group) => (
            <div className="daily-plan-slot" key={group.slot}>
              <div className="daily-plan-slot-head"><Sun size={14} /><strong>{group.slot}</strong></div>
              <ul>
                {group.rows.map((row) => {
                  const planRow = buildScheduleRow(row, dayType)
                  const done = dailyDone[planRow.id] === true
                  return (
                    <li key={planRow.id} className={done ? 'is-completed' : ''}>
                      <span className={`timeline-marker ${dailyPlanCategoryClass[row.item.kind]}`} aria-hidden="true" />
                      <div className="daily-plan-row-body">
                        <div className="daily-plan-row-main"><strong>{row.displayName}</strong><span>{row.item.amount}{row.item.unit}</span></div>
                        {row.item.note && <p className="timeline-notes">{row.item.note}</p>}
                      </div>
                      <button className={done ? 'icon-button is-done' : 'icon-button'} onClick={() => toggleDailyDone(planRow.id)}><Check size={16} /></button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {lifeItems.length > 0 && (
            <div className="daily-plan-slot">
              <div className="daily-plan-slot-head"><Sun size={14} /><strong>生活 · 睡眠</strong></div>
              <ul>
                {lifeItems.map((item) => (
                  <li key={item.id} className={item.completed ? 'is-completed' : ''}>
                    <span className={`timeline-marker ${categoryClass[item.category]}`} aria-hidden="true" />
                    <div className="daily-plan-row-body">
                      <div className="daily-plan-row-main">
                        <strong>{item.title}</strong>
                        <span>{item.time}{item.durationMinutes ? ` · ${item.durationMinutes}分钟` : ''}</span>
                        {item.reminderMinutes > 0 && <span className="reminder"><Bell size={13} />提前{item.reminderMinutes}分钟</span>}
                      </div>
                      {item.notes && <p className="timeline-notes">{item.notes}</p>}
                    </div>
                    <div className="row-actions">
                      <button className="icon-button" aria-label={`编辑${item.title}`} onClick={() => startEdit(item)}><Edit3 size={15} /></button>
                      <button className={item.completed ? 'icon-button is-done' : 'icon-button'} aria-label={`完成${item.title}`} onClick={() => toggleDone(item.id)}><Check size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
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

function buildScheduleRowForDisplay(row: DietRow, dayType: 'training' | 'rest') {
  return { id: `auto-${dayType}-${row.displayName}-${row.amount}${row.unit}`, title: row.displayName, category: '饮食' as const }
}
