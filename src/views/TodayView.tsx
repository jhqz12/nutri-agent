import { useEffect, useMemo, useState } from 'react'
import { Activity, Beef, CalendarSync, Check, Flame, History, ShieldCheck } from 'lucide-react'
import { calculateEngine, getEffectiveLibrariesForState } from '../lib/engine'
import { useNutritionState } from '../state/NutritionContext'
import { useAppState } from '../state/AppContext'
import { formatLocalDate, getPlanForDate } from '../lib/trainingPlans'
import { buildScheduleRow, getActivePlan, materializeItems, readCheckedRows } from '../lib/dailyPlan'
import { analyzePlanNutrition } from '../lib/planNutrition'
import { TimelineView } from './TimelineView'
import { TodayView as NutritionTodayView } from './nutrition/TodayView'

export function TodayView() {
  const { state: nutritionState, setState: setNutritionState } = useNutritionState()
  const { state: dashboardState, setState: setDashboardState } = useAppState()
  const todayPlan = useMemo(() => getPlanForDate(
    dashboardState.planDays,
    dashboardState.trainingFrequency,
    dashboardState.trainingCycleStartedAt,
    new Date(),
    dashboardState.trainingCycleAnchor
  ), [dashboardState.planDays, dashboardState.trainingCycleAnchor, dashboardState.trainingCycleStartedAt, dashboardState.trainingFrequency])
  const currentChoice = todayPlan.isRestDay ? 'rest' : todayPlan.plan?.id ?? 'rest'
  const [dayChoice, setDayChoice] = useState(currentChoice)
  const [anchorNotice, setAnchorNotice] = useState('')
  const [showAllMissing, setShowAllMissing] = useState(false)
  const result = useMemo(() => calculateEngine(nutritionState), [nutritionState])
  const libraries = useMemo(() => getEffectiveLibrariesForState(nutritionState), [nutritionState])
  const lockedCount = Object.keys(result.supplementLocks).length
  const targetSource = dashboardState.targetSource ?? 'plan'

  // 目标热量：plan 模式 = 我的计划自身营养合计；formula 模式 = 公式算出的目标
  const dayType: 'training' | 'rest' = todayPlan.isRestDay ? 'rest' : 'training'
  const activePlan = useMemo(() => getActivePlan(dashboardState, dayType), [dashboardState, dayType])
  const planNutrition = useMemo(() => activePlan ? analyzePlanNutrition(activePlan, libraries.foods, libraries.supplements) : null, [activePlan, libraries.foods, libraries.supplements])
  const targetCalories = targetSource === 'formula'
    ? result.macro.targetCalories
    : (planNutrition?.totals.calories ?? result.macro.targetCalories)
  const targetProtein = targetSource === 'formula' ? result.macro.protein : (planNutrition?.totals.protein ?? result.macro.protein)
  const targetLabel = targetSource === 'formula' ? result.macro.formulaName : (activePlan?.name ?? '我的计划')

  // 昨天缺失：昨天计划里没打卡完成的事项，今天反映出来提醒补做
  const yesterdayMissing = useMemo(() => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDate = formatLocalDate(yesterday)
    const plan = getPlanForDate(
      dashboardState.planDays,
      dashboardState.trainingFrequency,
      dashboardState.trainingCycleStartedAt,
      yesterday,
      dashboardState.trainingCycleAnchor
    )
    const dayType: 'training' | 'rest' = plan.isRestDay ? 'rest' : 'training'
    const active = getActivePlan(dashboardState, dayType)
    if (!active) return []
    const checked = readCheckedRows(yesterdayDate)
    return materializeItems(active, 'fixed', 0)
      .map((entry) => ({ entry, row: buildScheduleRow(entry, dayType) }))
      .filter(({ row }) => !checked.has(row.id))
      .map(({ entry, row }) => ({ id: row.id, title: `${entry.item.label}·${entry.displayName} ${entry.item.amount}${entry.item.unit}` }))
  }, [dashboardState])

  useEffect(() => setDayChoice(currentChoice), [currentChoice])

  const selectedPlan = dashboardState.planDays.find((plan) => plan.id === dayChoice) ?? null
  const choiceLabel = dayChoice === 'rest' ? '休息日' : `${selectedPlan?.name ?? '训练'}日`
  const currentLabel = todayPlan.isRestDay ? '休息日' : `${todayPlan.plan?.name ?? '训练'}日`

  const applyDayChoice = () => {
    const today = formatLocalDate()
    const anchorPlanId = dayChoice === 'rest'
      ? todayPlan.plan?.id ?? dashboardState.planDays[0]?.id ?? null
      : selectedPlan?.id ?? dashboardState.planDays[0]?.id ?? null
    const nextDate = new Date()
    nextDate.setDate(nextDate.getDate() + 1)
    const nextPlan = getPlanForDate(
      dashboardState.planDays,
      dashboardState.trainingFrequency,
      dashboardState.trainingCycleStartedAt,
      nextDate,
      { date: today, planId: anchorPlanId, isRestDay: dayChoice === 'rest' }
    )
    const nextLabel = nextPlan.isRestDay ? '休息日' : `${nextPlan.plan?.name ?? '训练'}日`
    setDashboardState((current) => ({
      ...current,
      trainingCycleAnchor: { date: today, planId: anchorPlanId, isRestDay: dayChoice === 'rest' },
      lastUpdatedAt: new Date().toISOString()
    }))
    setNutritionState((current) => ({ ...current, manual: { ...current.manual, dayType: null } }))
    setAnchorNotice(`今天已设为${choiceLabel}，明天继续${nextLabel}。热量、碳水、菜单与补剂建议已同步更新。`)
  }

  return <div className="view-stack today-workbench">
    <section className="today-dashboard" aria-label="今日身体与营养摘要">
      <div className="today-overview">
        <div><Flame size={18} /><span>目标热量</span><strong>{targetCalories}<small> kcal</small></strong><em>{targetLabel}</em></div>
        <div><Beef size={18} /><span>蛋白质</span><strong>{targetProtein}<small> g</small></strong><em>{targetSource === 'formula' ? '公式目标' : '计划目标'}</em></div>
        <div><Activity size={18} /><span>今日属性</span><strong>{currentLabel}</strong><em>{dashboardState.trainingCycleAnchor.date === formatLocalDate() ? '已按实际情况调整' : '按训练循环判定'}</em></div>
        <div><ShieldCheck size={18} /><span>补剂锁定</span><strong>{lockedCount}<small> 项</small></strong><em>{lockedCount ? '存在冲突' : '无硬冲突'}</em></div>
      </div>
      <div className="today-notice-list">{result.notices.slice(0, 2).map((notice) => <div className="notice" key={notice}><ShieldCheck size={17} /><span>{notice}</span></div>)}</div>
    </section>
    <section className="day-anchor-panel" aria-labelledby="day-anchor-title">
      <div className="section-heading"><div><h2 id="day-anchor-title">今天具体是什么日</h2><p>临时有事也可以改；确认后，后面的训练会从今天继续顺延。</p></div><CalendarSync size={18} /></div>
      <div className="day-anchor-actions">
        <div className="segmented-control day-type-control" aria-label="选择今日训练属性">
          {dashboardState.planDays.map((plan) => <button key={plan.id} className={dayChoice === plan.id ? 'is-selected' : ''} onClick={() => { setDayChoice(plan.id); setAnchorNotice('') }}>{plan.name}日</button>)}
          <button className={dayChoice === 'rest' ? 'is-selected' : ''} onClick={() => { setDayChoice('rest'); setAnchorNotice('') }}>休息日</button>
        </div>
        <button className="button primary" disabled={dayChoice === currentChoice} onClick={applyDayChoice}><Check size={16} />确认并顺延计划</button>
      </div>
      <p className={anchorNotice ? 'day-anchor-feedback is-visible' : 'day-anchor-feedback'} aria-live="polite">{anchorNotice || `当前为${currentLabel}。只有点击确认，后续循环才会改变。`}</p>
    </section>
    <section className="today-risk-brief today-panel">
      <div className="section-heading"><div><h2>昨天缺失</h2><p>昨天没打卡完成的事项，今天提醒你补上。</p></div><History size={18} /></div>
      {yesterdayMissing.slice(0, showAllMissing ? undefined : 3).map((item) => <div className="priority-row" key={item.id}><strong>昨天没做</strong><span>{item.title}</span></div>)}
      {!yesterdayMissing.length && <div className="priority-row ok"><strong>昨天全部完成</strong><span>没有遗漏的事项，继续保持。</span></div>}
      {yesterdayMissing.length > 3 && (
        <button className="button compact" onClick={() => setShowAllMissing((v) => !v)}>{showAllMissing ? '收起' : `展开全部 ${yesterdayMissing.length} 项`}</button>
      )}
    </section>
    <TimelineView />
    <details className="advanced-panel today-nutrition-details">
      <summary>展开今日精准配餐与补剂明细</summary>
      <NutritionTodayView state={nutritionState} result={result} target={targetSource === 'formula' ? null : { calories: targetCalories, protein: targetProtein, fat: planNutrition?.totals.fat ?? result.macro.fat, carbs: planNutrition?.totals.carbs ?? result.macro.carbs, label: activePlan?.name ?? '我的计划' }} />
    </details>
  </div>
}
