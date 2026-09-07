import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Beef, CalendarSync, Check, Flame, ShieldCheck, Utensils } from 'lucide-react'
import { calculateEngine, getEffectiveLibrariesForState } from '../lib/engine'
import { calculateMealCalories } from '../lib/mealEnergy'
import { displayMealName } from '../lib/foodUnits'
import { useNutritionState } from '../state/NutritionContext'
import { useAppState } from '../state/AppContext'
import { formatLocalDate, getPlanForDate } from '../lib/trainingPlans'
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
  const result = useMemo(() => calculateEngine(nutritionState), [nutritionState])
  const libraries = useMemo(() => getEffectiveLibrariesForState(nutritionState), [nutritionState])
  const mealCalories = useMemo(() => calculateMealCalories(result.menu, libraries.foods), [libraries.foods, result.menu])
  const lockedCount = Object.keys(result.supplementLocks).length
  const groupedMenu = useMemo(() => {
    const meals = ['早餐', '午餐', '晚餐', '加餐'] as const
    return meals.map((meal) => ({
      meal,
      items: result.menu.filter((item) => displayMealName(item.meal) === meal).map((item) => ({
        ...item,
        name: libraries.foods.find((food) => food.id === item.foodId)?.name ?? '食材资料缺失'
      }))
    })).filter((group) => group.items.length)
  }, [libraries.foods, result.menu])
  const priorityIssues = result.ledger.filter((row) => row.status === '超量' || row.status === '不足').slice(0, 3)

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
        <div><Flame size={18} /><span>目标热量</span><strong>{result.macro.targetCalories}<small> kcal</small></strong><em>今日执行基准</em></div>
        <div><Beef size={18} /><span>蛋白质</span><strong>{result.macro.protein}<small> g</small></strong><em>保留肌肉</em></div>
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
    <section className="today-command-grid">
      <div className="today-menu-brief today-panel">
        <div className="section-heading"><div><h2>今天吃什么</h2><p>按现实单位执行，改分量后会重新计算。</p></div><Utensils size={18} /></div>
        <div className="meal-brief-list">{groupedMenu.map((group) => <div key={group.meal}><strong>{group.meal}<small>{mealCalories[group.meal]}kcal</small></strong><p>{group.items.map((item) => `${item.name} ${item.amount}${item.unit}`).join(' · ')}</p></div>)}</div>
      </div>
      <div className="today-risk-brief today-panel">
        <div className="section-heading"><div><h2>今天先处理</h2><p>只列出会影响执行的事项。</p></div><AlertTriangle size={18} /></div>
        {Object.entries(result.supplementLocks).map(([id, reason]) => <div className="priority-row danger" key={id}><strong>{id} 已锁定</strong><span>{reason}</span></div>)}
        {priorityIssues.map((issue) => <div className="priority-row" key={issue.id}><strong>{issue.name} · {issue.status}</strong><span>{issue.advice}</span></div>)}
        {!lockedCount && !priorityIssues.length && <div className="priority-row ok"><strong>当前无硬性冲突</strong><span>继续按今日餐单和补剂时序执行。</span></div>}
      </div>
    </section>
    <TimelineView />
    <details className="advanced-panel today-nutrition-details">
      <summary>展开今日精准配餐与补剂明细</summary>
      <NutritionTodayView state={nutritionState} result={result} />
    </details>
  </div>
}
