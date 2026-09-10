import { useMemo, useState } from 'react'
import { CalendarDays, Check, Copy, Edit3, GitCompareArrows, Plus, Save, Scale, Sparkles, Trash2, X } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import { useNutritionState } from '../state/NutritionContext'
import { createId } from '../lib/ids'
import { dailyPlanCategoryClass, getActivePlan, materializeItems } from '../lib/dailyPlan'
import { analyzePlanNutrition, compareMacro } from '../lib/planNutrition'
import { diffPlans } from '../lib/planDiff'
import { calculateEngine, getEffectiveLibrariesForState } from '../lib/engine'
import type { DailyPlanDayType, DailyPlanItem, DailyPlanItemKind, DailyPlanTemplate, MacroTotals } from '../types'

const KIND_OPTIONS: DailyPlanItemKind[] = ['饮食', '补剂', '训练', '全天']
const DAYTYPE_OPTIONS: Array<{ value: DailyPlanDayType; label: string }> = [
  { value: 'training', label: '训练日' }, { value: 'rest', label: '休息日' }
]

const emptyDraft: Omit<DailyPlanItem, 'id'> = {
  time: '08:00', label: '早餐', kind: '饮食',
  foodName: '', amount: 0, unit: 'g', note: '', locked: false,
  foodId: null, supplementId: null,
  protein: null, carbs: null, fat: null, calories: null
}

function buildTemplateFromItems(name: string, dayType: DailyPlanDayType, items: DailyPlanItem[], source: string, userImported: boolean): DailyPlanTemplate {
  return {
    id: createId('plan-daily'), name, dayType, active: true, items,
    updatedAt: new Date().toISOString(), source, userImported, history: []
  }
}

function targetAsMacro(target: { targetCalories: number; protein: number; fat: number; carbs: number }): MacroTotals {
  return { calories: target.targetCalories, protein: target.protein, fat: target.fat, carbs: target.carbs }
}

function suggestAdjustment(logs: Array<{ date: string; weightKg: number }>): string {
  if (logs.length < 2) return '记录至少 2 天体重后再给微调建议。'
  const last = logs[logs.length - 1]
  const lastDate = new Date(`${last.date}T00:00:00`).getTime()
  const fourteen = logs.filter((log) => (lastDate - new Date(`${log.date}T00:00:00`).getTime()) / 86400000 >= 13)
  if (!fourteen.length) return '数据还不足 14 天，先继续记录，我每天帮你对比。'
  const start = fourteen[fourteen.length - 1]
  const change = Math.round((last.weightKg - start.weightKg) * 10) / 10
  if (change <= -2) return `14天降 ${Math.abs(change)}kg：减脂偏快，可适当回补碳水、避免代谢过快下滑。`
  if (change <= -0.5) return `14天降 ${Math.abs(change)}kg：节奏正常，维持当前缺口继续观察。`
  if (change < 0.5) return '14天体重基本没动：建议每日碳水减 15～20g（或加一点有氧），一周后再看。'
  return `14天升 ${change}kg：建议降低碳水或脂肪，或复查全天热量是否超标。`
}

export function DailyPlanView() {
  const { state, setState } = useAppState()
  const { state: nutritionState } = useNutritionState()
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Omit<DailyPlanItem, 'id'>>(emptyDraft)
  const [planDraft, setPlanDraft] = useState<{ name: string; dayType: DailyPlanDayType; active: boolean } | null>(null)
  const [notice, setNotice] = useState('')
  const [diffPlanId, setDiffPlanId] = useState<string | null>(null)

  const result = useMemo(() => calculateEngine(nutritionState), [nutritionState])
  const libraries = useMemo(() => getEffectiveLibrariesForState(nutritionState), [nutritionState])
  const target = result.macro

  const trainingPlan = useMemo(() => getActivePlan(state, 'training'), [state])
  const restPlan = useMemo(() => getActivePlan(state, 'rest'), [state])
  const allPlans = state.dailyPlans ?? []

  const trainingNutrition = useMemo(() => trainingPlan ? analyzePlanNutrition(trainingPlan, libraries.foods, libraries.supplements) : null, [trainingPlan, libraries.foods, libraries.supplements])
  const restNutrition = useMemo(() => restPlan ? analyzePlanNutrition(restPlan, libraries.foods, libraries.supplements) : null, [restPlan, libraries.foods, libraries.supplements])

  const bodyTrend = useMemo(() => {
    const logs = [...state.bodyLogs].filter((log) => log.weightKg > 0).sort((a, b) => a.date.localeCompare(b.date))
    const last = logs[logs.length - 1]
    const prev = logs[logs.length - 2]
    const recent = logs.slice(-7)
    const morningAvg = recent.filter((log) => typeof log.morningState === 'number' && log.morningState > 0)
    const sleepAvg = recent.filter((log) => typeof log.sleepQuality === 'number' && log.sleepQuality > 0)
    return {
      lastWeight: last?.weightKg ?? null,
      dayChange: last && prev ? Math.round((last.weightKg - prev.weightKg) * 10) / 10 : null,
      morningAvg: morningAvg.length ? Math.round(morningAvg.reduce((sum, log) => sum + (log.morningState ?? 0), 0) / morningAvg.length * 10) / 10 : null,
      sleepAvg: sleepAvg.length ? Math.round(sleepAvg.reduce((sum, log) => sum + (log.sleepQuality ?? 0), 0) / sleepAvg.length * 10) / 10 : null,
      suggestion: suggestAdjustment(logs)
    }
  }, [state.bodyLogs])

  const withHistory = (plan: DailyPlanTemplate, nextItems: DailyPlanItem[], meta: Partial<DailyPlanTemplate> = {}) => {
    const snapshot = { versionId: createId('hist'), capturedAt: new Date().toISOString(), name: plan.name, items: plan.items.map((it) => ({ ...it })) }
    const history = [...(plan.history ?? []), snapshot].slice(-20)
    return { ...plan, ...meta, items: nextItems, history, updatedAt: new Date().toISOString() }
  }

  const startEditItem = (item: DailyPlanItem) => {
    const { id: _id, ...rest } = item
    setDraft(rest)
    setEditingItemId(item.id)
  }

  const saveItem = (planId: string) => {
    if (!draft.foodName.trim() || !Number.isFinite(draft.amount)) {
      setNotice('名称或份量不能为空。')
      return
    }
    setState((current) => ({
      ...current,
      dailyPlans: (current.dailyPlans ?? []).map((plan) => {
        if (plan.id !== planId) return plan
        const items = editingItemId
          ? plan.items.map((it) => it.id === editingItemId ? { ...draft, id: it.id } : it)
          : [...plan.items, { ...draft, id: createId('dpi') }]
        return withHistory(plan, items)
      }),
      lastUpdatedAt: new Date().toISOString()
    }))
    setEditingItemId(null)
    setDraft(emptyDraft)
    setNotice('已保存该时段项目，并留存了上一版用于对比。')
  }

  const removeItem = (planId: string, itemId: string) => {
    setState((current) => ({
      ...current,
      dailyPlans: (current.dailyPlans ?? []).map((plan) => plan.id !== planId ? plan : withHistory(plan, plan.items.filter((it) => it.id !== itemId))),
      lastUpdatedAt: new Date().toISOString()
    }))
    setNotice('已删除该时段项目。')
  }

  const toggleItemLocked = (planId: string, itemId: string) => {
    setState((current) => ({
      ...current,
      dailyPlans: (current.dailyPlans ?? []).map((plan) => plan.id !== planId ? plan : {
        ...plan, items: plan.items.map((it) => it.id === itemId ? { ...it, locked: !it.locked } : it), updatedAt: new Date().toISOString()
      }),
      lastUpdatedAt: new Date().toISOString()
    }))
  }

  const setActive = (planId: string) => {
    setState((current) => {
      const targetPlan = (current.dailyPlans ?? []).find((plan) => plan.id === planId)
      if (!targetPlan) return current
      return {
        ...current,
        dailyPlans: (current.dailyPlans ?? []).map((plan) => plan.dayType === targetPlan.dayType
          ? { ...plan, active: plan.id === planId, updatedAt: new Date().toISOString() }
          : plan),
        lastUpdatedAt: new Date().toISOString()
      }
    })
    setNotice('已设为当前生效的模板。')
  }

  const clonePlan = (planId: string) => {
    const source = allPlans.find((plan) => plan.id === planId)
    if (!source) return
    const cloned: DailyPlanTemplate = {
      ...source,
      id: createId('plan-daily'),
      name: `${source.name}·副本`,
      active: false,
      items: source.items.map((it) => ({ ...it, id: createId('dpi') })),
      updatedAt: new Date().toISOString(),
      userImported: true,
      history: []
    }
    setState((current) => ({ ...current, dailyPlans: [...(current.dailyPlans ?? []), cloned], lastUpdatedAt: new Date().toISOString() }))
    setNotice('已复制为新模板，可重命名后启用。')
  }

  const removePlan = (planId: string) => {
    setState((current) => ({
      ...current,
      dailyPlans: (current.dailyPlans ?? []).filter((plan) => plan.id !== planId),
      lastUpdatedAt: new Date().toISOString()
    }))
    setNotice('已删除模板。')
  }

  const startNewPlan = () => {
    setPlanDraft({ name: '新模板', dayType: 'training', active: true })
    setEditingPlanId(null)
  }

  const savePlanMeta = (planId: string) => {
    if (!planDraft) return
    setState((current) => ({
      ...current,
      dailyPlans: (current.dailyPlans ?? []).map((plan) => {
        if (plan.id !== planId) return plan
        return withHistory(plan, plan.items, { name: planDraft.name.trim() || plan.name, dayType: planDraft.dayType })
      }),
      lastUpdatedAt: new Date().toISOString()
    }))
    setPlanDraft(null)
    setNotice('已更新模板信息。')
  }

  const addEmptyPlan = () => {
    if (!planDraft) return
    const fresh = buildTemplateFromItems(planDraft.name.trim() || '新模板', planDraft.dayType, [], '手动新建', true)
    setState((current) => ({
      ...current,
      dailyPlans: (current.dailyPlans ?? []).map((plan) => plan.dayType === planDraft.dayType ? { ...plan, active: false } : plan).concat(fresh),
      lastUpdatedAt: new Date().toISOString()
    }))
    setPlanDraft(null)
    setNotice('已新建模板，记得至少添加一项时段项目。')
  }

  const renderNutrition = (plan: DailyPlanTemplate) => {
    const nutrition = analyzePlanNutrition(plan, libraries.foods, libraries.supplements)
    const delta = compareMacro(nutrition.totals, targetAsMacro(target))
    return (
      <details className="daily-plan-preview">
        <summary><Scale size={14} />营养分析（合计 / 每餐）</summary>
        <div className="plan-nutrition-block">
          <div className="meal-nutrition-summary">
            <div><span>热量</span><strong>{nutrition.totals.calories}<small> / {target.targetCalories}</small></strong><em className={delta.calories > 0 ? 'delta-over' : 'delta-under'}>{delta.calories >= 0 ? '+' : ''}{delta.calories}</em></div>
            <div><span>蛋白质</span><strong>{nutrition.totals.protein}<small> / {target.protein}</small></strong><em className={delta.protein > 0 ? 'delta-over' : 'delta-under'}>{delta.protein >= 0 ? '+' : ''}{delta.protein}</em></div>
            <div><span>脂肪</span><strong>{nutrition.totals.fat}<small> / {target.fat}</small></strong><em className={delta.fat > 0 ? 'delta-over' : 'delta-under'}>{delta.fat >= 0 ? '+' : ''}{delta.fat}</em></div>
            <div><span>碳水</span><strong>{nutrition.totals.carbs}<small> / {target.carbs}</small></strong><em className={delta.carbs > 0 ? 'delta-over' : 'delta-under'}>{delta.carbs >= 0 ? '+' : ''}{delta.carbs}</em></div>
          </div>
          {nutrition.unknownFoods.length > 0 && <p className="muted">未匹配到营养值的食物：{nutrition.unknownFoods.join('、')}（不计入合计）</p>}
          <div className="compact-table">
            {Object.entries(nutrition.bySlot).map(([slot, macro]) => (
              <div key={slot}><strong>{slot}</strong><span>{macro.calories}kcal</span><span>P{macro.protein} · F{macro.fat} · C{macro.carbs}</span></div>
            ))}
          </div>
        </div>
      </details>
    )
  }

  const renderDiff = (plan: DailyPlanTemplate) => {
    const history = plan.history ?? []
    if (!history.length) return null
    const lastHist = history[history.length - 1]
    const prevTemplate: DailyPlanTemplate = { id: 'prev', name: lastHist.name, dayType: plan.dayType, active: false, items: lastHist.items, updatedAt: lastHist.capturedAt }
    const diff = diffPlans(prevTemplate, plan)
    const open = diffPlanId === plan.id
    return (
      <details className="daily-plan-preview" open={open} onToggle={() => setDiffPlanId(open ? null : plan.id)}>
        <summary><GitCompareArrows size={14} />对比上一版（{new Date(lastHist.capturedAt).toLocaleString()}）</summary>
        <div className="plan-nutrition-block">
          <p className="muted">新增 {diff.added} · 删除 {diff.removed} · 变化 {diff.changed}</p>
          <div className="meal-nutrition-summary">
            <div><span>热量</span><strong>{diff.nextTotals.calories}<small> vs {diff.prevTotals.calories}</small></strong><em className={diff.totalsDelta.calories > 0 ? 'delta-over' : 'delta-under'}>{diff.totalsDelta.calories >= 0 ? '+' : ''}{diff.totalsDelta.calories}</em></div>
            <div><span>蛋白质</span><strong>{diff.nextTotals.protein}<small> vs {diff.prevTotals.protein}</small></strong><em className={diff.totalsDelta.protein > 0 ? 'delta-over' : 'delta-under'}>{diff.totalsDelta.protein >= 0 ? '+' : ''}{diff.totalsDelta.protein}</em></div>
            <div><span>脂肪</span><strong>{diff.nextTotals.fat}<small> vs {diff.prevTotals.fat}</small></strong><em className={diff.totalsDelta.fat > 0 ? 'delta-over' : 'delta-under'}>{diff.totalsDelta.fat >= 0 ? '+' : ''}{diff.totalsDelta.fat}</em></div>
            <div><span>碳水</span><strong>{diff.nextTotals.carbs}<small> vs {diff.prevTotals.carbs}</small></strong><em className={diff.totalsDelta.carbs > 0 ? 'delta-over' : 'delta-under'}>{diff.totalsDelta.carbs >= 0 ? '+' : ''}{diff.totalsDelta.carbs}</em></div>
          </div>
          {diff.items.length === 0 ? <p className="empty-inline">两版内容一致。</p> : (
            <div className="compact-table">
              {diff.items.map((item) => (
                <div key={item.key}><span className={`status status-${item.change === '删除' ? '不足' : item.change === '新增' ? '达标' : '超量'}`}>{item.change}</span><strong>{item.foodName}</strong><span>{item.prevAmount && item.nextAmount ? `${item.prevAmount} → ${item.nextAmount}` : item.prevAmount || item.nextAmount}</span></div>
              ))}
            </div>
          )}
        </div>
      </details>
    )
  }

  const renderPlan = (plan: DailyPlanTemplate) => {
    const isEditing = editingPlanId === plan.id
    return (
      <div className="daily-plan-card" key={plan.id}>
        <div className="daily-plan-card-head">
          <div>
            <div className="daily-plan-title">
              <strong>{plan.name}</strong>
              <span className="daily-plan-tag">{plan.dayType === 'training' ? '训练日' : '休息日'}</span>
              {plan.active && <span className="daily-plan-tag is-active">当前生效</span>}
              {plan.userImported && <span className="daily-plan-tag is-soft">导入</span>}
            </div>
            <p className="muted">{plan.source ? `来源：${plan.source} · ` : ''}更新于 {new Date(plan.updatedAt).toLocaleString()}</p>
          </div>
          <div className="daily-plan-card-actions">
            {!plan.active && <button className="button" onClick={() => setActive(plan.id)} aria-label={`启用${plan.name}`}><Check size={15} />设为当前</button>}
            <button className="button" onClick={() => { setEditingPlanId(isEditing ? null : plan.id); setPlanDraft({ name: plan.name, dayType: plan.dayType, active: plan.active }) }} aria-label={`编辑${plan.name}`}><Edit3 size={15} />编辑</button>
            <button className="button" onClick={() => clonePlan(plan.id)} aria-label={`复制${plan.name}`}><Copy size={15} />复制</button>
            <button className="button danger" onClick={() => { if (window.confirm(`确定删除「${plan.name}」？`)) removePlan(plan.id) }} aria-label={`删除${plan.name}`}><Trash2 size={15} /></button>
          </div>
        </div>

        {isEditing && planDraft && (
          <div className="daily-plan-meta-edit">
            <label>名称<input value={planDraft.name} onChange={(e) => setPlanDraft({ ...planDraft, name: e.target.value })} /></label>
            <label>类型<select value={planDraft.dayType} onChange={(e) => setPlanDraft({ ...planDraft, dayType: e.target.value as DailyPlanDayType })}>{DAYTYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
            <div className="dialog-actions">
              <button className="button" onClick={() => { setEditingPlanId(null); setPlanDraft(null) }}><X size={15} />取消</button>
              <button className="button primary" onClick={() => savePlanMeta(plan.id)}><Save size={15} />保存</button>
            </div>
          </div>
        )}

        <div className="daily-plan-items">
          {plan.items.length === 0 && <p className="empty-inline">还没有任何时段项目，下方「添加时段项目」开始配置。</p>}
          {plan.items.map((item) => {
            const isEditingItem = editingItemId === item.id
            return (
              <div className={isEditingItem ? 'daily-plan-item is-editing' : 'daily-plan-item'} key={item.id}>
                <span className={`timeline-marker ${dailyPlanCategoryClass[item.kind]}`} aria-hidden="true" />
                <div className="daily-plan-item-body">
                  <div className="daily-plan-item-main">
                    <strong>{item.foodName || '未命名项目'}</strong>
                    <span>{item.time || '—'} · {item.label} · {item.amount}{item.unit}{item.kind === '全天' ? ' · 全天总量' : ''}</span>
                    {item.note && <p className="muted">{item.note}</p>}
                  </div>
                  <div className="daily-plan-item-actions">
                    <button className={item.locked ? 'mode-pill is-active' : 'mode-pill'} onClick={() => toggleItemLocked(plan.id, item.id)}>{item.locked ? '🔒 锁定' : '🔓 参与随机'}</button>
                    <button className="icon-button" aria-label="编辑" onClick={() => startEditItem(item)}><Edit3 size={15} /></button>
                    <button className="icon-button" aria-label="删除" onClick={() => removeItem(plan.id, item.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
                {isEditingItem && (
                  <div className="daily-plan-item-edit">
                    <label>名称（可用 / 或「或」分隔多种候选，随机模式会替换）<input value={draft.foodName} onChange={(e) => setDraft({ ...draft, foodName: e.target.value })} /></label>
                    <label>时间<input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
                    <label>时段标签<input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="如 早餐 / 练前" /></label>
                    <label>类型<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DailyPlanItemKind })}>{KIND_OPTIONS.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
                    <label>份量<input type="number" min="0" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>
                    <label>单位<input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="g / ml / 片 / 颗" /></label>
                    <label>蛋白质(g)<input type="number" min="0" step="0.1" value={draft.protein ?? ''} onChange={(e) => setDraft({ ...draft, protein: e.target.value === '' ? null : Number(e.target.value) })} placeholder="精确值，留空则按食物名估算" /></label>
                    <label>碳水(g)<input type="number" min="0" step="0.1" value={draft.carbs ?? ''} onChange={(e) => setDraft({ ...draft, carbs: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                    <label>脂肪(g)<input type="number" min="0" step="0.1" value={draft.fat ?? ''} onChange={(e) => setDraft({ ...draft, fat: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                    <label>热量(kcal)<input type="number" min="0" value={draft.calories ?? ''} onChange={(e) => setDraft({ ...draft, calories: e.target.value === '' ? null : Number(e.target.value) })} placeholder="填了热量即按精确值计入合计" /></label>
                    <label className="full-field">备注<textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
                    <label className="full-field"><input type="checkbox" checked={draft.locked} onChange={(e) => setDraft({ ...draft, locked: e.target.checked })} />锁定此项，不参与随机替换</label>
                    <div className="dialog-actions">
                      <button className="button" onClick={() => { setEditingItemId(null); setDraft(emptyDraft) }}><X size={15} />取消</button>
                      <button className="button primary" onClick={() => saveItem(plan.id)}><Save size={15} />保存</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {editingItemId !== 'new' && (
            <div className="daily-plan-add-row">
              <button className="button" onClick={() => { setEditingItemId('new'); setDraft(emptyDraft) }}><Plus size={15} />添加时段项目</button>
            </div>
          )}
          {editingItemId === 'new' && (
            <div className="daily-plan-item-edit">
              <label>名称<input value={draft.foodName} onChange={(e) => setDraft({ ...draft, foodName: e.target.value })} /></label>
              <label>时间<input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label>
              <label>时段标签<input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} /></label>
              <label>类型<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DailyPlanItemKind })}>{KIND_OPTIONS.map((kind) => <option key={kind}>{kind}</option>)}</select></label>
              <label>份量<input type="number" min="0" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>
              <label>单位<input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} /></label>
              <label>蛋白质(g)<input type="number" min="0" step="0.1" value={draft.protein ?? ''} onChange={(e) => setDraft({ ...draft, protein: e.target.value === '' ? null : Number(e.target.value) })} placeholder="精确值，留空则按食物名估算" /></label>
              <label>碳水(g)<input type="number" min="0" step="0.1" value={draft.carbs ?? ''} onChange={(e) => setDraft({ ...draft, carbs: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label>脂肪(g)<input type="number" min="0" step="0.1" value={draft.fat ?? ''} onChange={(e) => setDraft({ ...draft, fat: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              <label>热量(kcal)<input type="number" min="0" value={draft.calories ?? ''} onChange={(e) => setDraft({ ...draft, calories: e.target.value === '' ? null : Number(e.target.value) })} placeholder="填了热量即按精确值计入合计" /></label>
              <label className="full-field">备注<textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
              <label className="full-field"><input type="checkbox" checked={draft.locked} onChange={(e) => setDraft({ ...draft, locked: e.target.checked })} />锁定此项，不参与随机替换</label>
              <div className="dialog-actions">
                <button className="button" onClick={() => { setEditingItemId(null); setDraft(emptyDraft) }}><X size={15} />取消</button>
                <button className="button primary" onClick={() => saveItem(plan.id)}><Save size={15} />保存</button>
              </div>
            </div>
          )}
        </div>

        {renderNutrition(plan)}
        {renderDiff(plan)}
        <details className="daily-plan-preview">
          <summary><Sparkles size={14} />预览（含「随机」一栏）</summary>
          <div className="compact-table">
            {materializeItems(plan, 'random', 42).map((row) => (
              <div key={row.item.id}><strong>{row.displayName}</strong><span>{row.item.label} · {row.item.amount}{row.item.unit}</span><span>{row.isRandomized ? '随机' : '原文'}</span></div>
            ))}
          </div>
        </details>
      </div>
    )
  }

  return (
    <div className="view-stack">
      <section className="data-actions">
        <button className="button" onClick={startNewPlan}><Plus size={16} />新建模板</button>
        <a className="button" href="#import-section" onClick={() => window.dispatchEvent(new CustomEvent('hengdong-jump-to-import'))}><CalendarDays size={16} />导入新计划</a>
      </section>

      <section className="daily-plan-card plan-analysis-panel">
        <div className="section-heading"><div><h2>独立分析</h2><p>用体重趋势对照能量公式，慢慢微调饮食结构。体重与状态在「趋势」页记录。</p></div><Scale size={18} /></div>
        <div className="plan-analysis-grid">
          <div className="analysis-stat">
            <span>最近体重</span>
            <strong>{bodyTrend.lastWeight ?? '—'}<small> kg</small></strong>
            {bodyTrend.dayChange !== null && <em className={bodyTrend.dayChange > 0 ? 'delta-over' : 'delta-under'}>{bodyTrend.dayChange >= 0 ? '+' : ''}{bodyTrend.dayChange} 较昨日</em>}
          </div>
          <div className="analysis-stat">
            <span>近7天早上状态</span>
            <strong>{bodyTrend.morningAvg ?? '—'}<small> /5</small></strong>
          </div>
          <div className="analysis-stat">
            <span>近7天入睡质量</span>
            <strong>{bodyTrend.sleepAvg ?? '—'}<small> /5</small></strong>
          </div>
          <div className="analysis-suggestion">
            <span>微调建议</span>
            <p>{bodyTrend.suggestion}</p>
          </div>
        </div>
        {(trainingNutrition || restNutrition) && (
          <div className="plan-analysis-targets">
            {trainingNutrition && (
              <div><strong>{trainingPlan?.name ?? '训练日'}食物合计</strong><span>{trainingNutrition.totals.calories} kcal</span><span>P{trainingNutrition.totals.protein} · F{trainingNutrition.totals.fat} · C{trainingNutrition.totals.carbs}</span><span className="muted">目标 {target.targetCalories} kcal</span></div>
            )}
            {restNutrition && (
              <div><strong>{restPlan?.name ?? '休息日'}食物合计</strong><span>{restNutrition.totals.calories} kcal</span><span>P{restNutrition.totals.protein} · F{restNutrition.totals.fat} · C{restNutrition.totals.carbs}</span><span className="muted">目标 {target.targetCalories} kcal</span></div>
            )}
          </div>
        )}
      </section>

      {planDraft && editingPlanId === null && (
        <section className="onboarding-dialog daily-plan-meta-edit">
          <h2>新建日计划模板</h2>
          <label>名称<input value={planDraft.name} onChange={(e) => setPlanDraft({ ...planDraft, name: e.target.value })} /></label>
          <label>类型<select value={planDraft.dayType} onChange={(e) => setPlanDraft({ ...planDraft, dayType: e.target.value as DailyPlanDayType })}>{DAYTYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>
          <div className="dialog-actions">
            <button className="button" onClick={() => setPlanDraft(null)}><X size={15} />取消</button>
            <button className="button primary" onClick={addEmptyPlan}><Plus size={15} />创建</button>
          </div>
        </section>
      )}

      {notice && <p className="notice success">{notice}</p>}

      <div className="daily-plan-grid">
        {trainingPlan && renderPlan(trainingPlan)}
        {restPlan && renderPlan(restPlan)}
        {allPlans.filter((p) => p.id !== trainingPlan?.id && p.id !== restPlan?.id).map((plan) => renderPlan(plan))}
        {allPlans.length === 0 && <p className="empty-inline">还没有日计划模板，请新建或导入。</p>}
      </div>
    </div>
  )
}
