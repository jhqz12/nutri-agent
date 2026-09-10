import { useMemo, useState } from 'react'
import { CalendarDays, Check, Copy, Edit3, Plus, Save, Sparkles, Trash2, X } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import { createId } from '../lib/ids'
import { dailyPlanCategoryClass, getActivePlan, materializeItems } from '../lib/dailyPlan'
import type { DailyPlanDayType, DailyPlanItem, DailyPlanItemKind, DailyPlanTemplate } from '../types'

const KIND_OPTIONS: DailyPlanItemKind[] = ['饮食', '补剂', '训练', '全天']
const DAYTYPE_OPTIONS: Array<{ value: DailyPlanDayType; label: string }> = [
  { value: 'training', label: '训练日' }, { value: 'rest', label: '休息日' }
]

const emptyDraft: Omit<DailyPlanItem, 'id'> = {
  time: '08:00', label: '早餐', kind: '饮食',
  foodName: '', amount: 0, unit: 'g', note: '', locked: false,
  foodId: null, supplementId: null
}

function buildTemplateFromItems(name: string, dayType: DailyPlanDayType, items: DailyPlanItem[], source: string, userImported: boolean): DailyPlanTemplate {
  return {
    id: createId('plan-daily'), name, dayType, active: true, items,
    updatedAt: new Date().toISOString(), source, userImported
  }
}

export function DailyPlanView() {
  const { state, setState } = useAppState()
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Omit<DailyPlanItem, 'id'>>(emptyDraft)
  const [planDraft, setPlanDraft] = useState<{ name: string; dayType: DailyPlanDayType; active: boolean } | null>(null)
  const [notice, setNotice] = useState('')

  const trainingPlan = useMemo(() => getActivePlan(state, 'training'), [state])
  const restPlan = useMemo(() => getActivePlan(state, 'rest'), [state])
  const allPlans = state.dailyPlans ?? []

  const editingPlan = editingPlanId ? allPlans.find((plan) => plan.id === editingPlanId) : null

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
        return { ...plan, items, updatedAt: new Date().toISOString() }
      }),
      lastUpdatedAt: new Date().toISOString()
    }))
    setEditingItemId(null)
    setDraft(emptyDraft)
    setNotice('已保存该时段项目。')
  }

  const removeItem = (planId: string, itemId: string) => {
    setState((current) => ({
      ...current,
      dailyPlans: (current.dailyPlans ?? []).map((plan) => plan.id !== planId ? plan : {
        ...plan, items: plan.items.filter((it) => it.id !== itemId), updatedAt: new Date().toISOString()
      }),
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
      const target = (current.dailyPlans ?? []).find((plan) => plan.id === planId)
      if (!target) return current
      return {
        ...current,
        dailyPlans: (current.dailyPlans ?? []).map((plan) => plan.dayType === target.dayType
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
      userImported: true
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
        return { ...plan, name: planDraft.name.trim() || plan.name, dayType: planDraft.dayType, updatedAt: new Date().toISOString() }
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
              <label className="full-field">备注<textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
              <label className="full-field"><input type="checkbox" checked={draft.locked} onChange={(e) => setDraft({ ...draft, locked: e.target.checked })} />锁定此项，不参与随机替换</label>
              <div className="dialog-actions">
                <button className="button" onClick={() => { setEditingItemId(null); setDraft(emptyDraft) }}><X size={15} />取消</button>
                <button className="button primary" onClick={() => saveItem(plan.id)}><Save size={15} />保存</button>
              </div>
            </div>
          )}
        </div>

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
