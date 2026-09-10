import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react'
import { getEffectiveLibrariesForState } from '../../lib/engine'
import { calculateMealCalories } from '../../lib/mealEnergy'
import { displayMealName } from '../../lib/foodUnits'
import type { AppState, EngineResult, MealGroup } from '../../nutritionTypes'

export function TodayView({ state, result, target }: { state: AppState; result: EngineResult; target?: { calories: number; protein: number; fat: number; carbs: number; label: string } | null }) {
  const libraries = getEffectiveLibrariesForState(state)
  const mealCalories = calculateMealCalories(result.menu, libraries.foods)
  const grouped: Array<{ meal: MealGroup; items: typeof result.menu }> = (['早餐', '午餐', '晚餐', '加餐'] as MealGroup[]).map((meal) => ({ meal, items: result.menu.filter((item) => displayMealName(item.meal) === meal) }))
  const abnormal = result.ledger.filter((item) => item.status !== '达标').slice(0, 6)
  const activeSupplements = state.supplementDoses.filter((dose) => dose.enabled).map((dose) => ({ dose, item: libraries.supplements.find((item) => item.id === dose.supplementId) })).filter((entry) => entry.item)
  const macroTarget = target ?? { calories: result.macro.targetCalories, protein: result.macro.protein, fat: result.macro.fat, carbs: result.macro.carbs, label: result.macro.usedManualCalories ? '手动覆盖' : '公式计算' }

  return <div className="view-stack">
    <section className="summary-strip">
      <div><span>目标热量</span><strong>{macroTarget.calories}<small> kcal</small></strong><em>{macroTarget.label}</em></div>
      <div><span>实际菜单</span><strong>{result.actual.calories}<small> kcal</small></strong><em>含已知补剂热量</em></div>
      <div><span>蛋白质</span><strong>{macroTarget.protein}<small> g</small></strong><em>实际 {result.actual.protein}g</em></div>
      <div><span>脂肪</span><strong>{macroTarget.fat}<small> g</small></strong><em>实际 {result.actual.fat}g</em></div>
      <div><span>碳水</span><strong>{macroTarget.carbs}<small> g</small></strong><em>实际 {result.actual.carbs}g</em></div>
    </section>

    {result.notices.map((notice) => <div className={notice.includes('禁止') ? 'notice danger' : 'notice'} key={notice}>{notice.includes('禁止') ? <ShieldAlert size={18} /> : <CheckCircle2 size={18} />}<span>{notice}</span></div>)}

    <section><div className="section-heading"><div><h2>今日现实菜单</h2><p>同餐同食材已合并；每餐显示合计热量。</p></div></div><div className="meal-bands">{grouped.map(({ meal, items }) => <div className="meal-band" key={meal}><strong>{meal}<small>{mealCalories[meal]}kcal</small></strong><div>{items.length ? items.map((entry) => { const food = libraries.foods.find((item) => item.id === entry.foodId); return <span key={`${entry.meal}-${entry.foodId}`}>{food?.name ?? '食材资料缺失'} {entry.amount}{entry.unit}</span> }) : <span className="muted">无</span>}</div></div>)}</div></section>

    <div className="two-columns">
      <section><div className="section-heading"><div><h2>微量异常</h2><p>仅显示需处理或数据不完整的项目。</p></div></div><div className="compact-list">{abnormal.map((item) => <div key={item.id}><span className={`status status-${item.status}`}>{item.status}</span><strong>{item.name}</strong><small>{item.total}{item.unit} / 目标{item.target}{item.unit}</small></div>)}</div></section>
      <section><div className="section-heading"><div><h2>补剂时序</h2><p>锁定项不会参与总账。</p></div></div><div className="compact-list">{activeSupplements.map(({ dose, item }) => <div key={dose.supplementId} className={result.supplementLocks[dose.supplementId] ? 'locked' : ''}><Clock3 size={15} /><strong>{item?.name} {dose.amount}{item?.servingUnit}</strong><small>{result.supplementLocks[dose.supplementId] ?? item?.timing}</small></div>)}</div></section>
    </div>

    <footer className="version-stamp"><AlertTriangle size={14} /><span>{result.versionStamp}</span></footer>
  </div>
}
