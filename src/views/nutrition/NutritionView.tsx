import { Library, RotateCcw } from 'lucide-react'
import { getEffectiveLibrariesForState } from '../../lib/engine'
import type { AppState, DayType, EngineResult, MenuItem } from '../../nutritionTypes'
import { MealPlanEditor } from './MealPlanEditor'

export function NutritionView({ state, setState, result, onOpenLibrary }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; result: EngineResult; onOpenLibrary: () => void }) {
  const libraries = getEffectiveLibrariesForState(state)
  const formula = libraries.formulas.find((item) => item.id === result.macro.formulaId)
  const rows = [
    { name: '总热量', target: result.macro.targetCalories, actual: result.actual.calories, unit: 'kcal', note: 'BMR保底' },
    { name: '蛋白质', target: result.macro.protein, actual: result.actual.protein, unit: 'g', note: formula ? `当前体重×${formula.proteinPerKg}` : '按当前公式计算' },
    { name: '碳水', target: result.macro.carbs, actual: result.actual.carbs, unit: 'g', note: formula?.macroMode === 'weightRatios' ? `当前体重×${result.macro.isRestDay ? formula.restCarbsPerKg : formula.trainingCarbsPerKg}` : '由目标热量倒推' },
    { name: '脂肪', target: result.macro.fat, actual: result.actual.fat, unit: 'g', note: formula ? `当前体重×${formula.fatPerKg}` : '按当前公式计算' },
    { name: '膳食纤维', target: 25, actual: result.actual.fiber, unit: 'g', note: '目标25–30g' },
    { name: '饱和脂肪', target: Math.round(result.macro.fat / 3), actual: result.fattyAcids.saturated, unit: 'g', note: '不超过总脂肪1/3' }
  ]

  const updateSupplement = (supplementId: string, patch: { amount?: number; enabled?: boolean }) => setState((current) => ({
    ...current,
    supplementDoses: current.supplementDoses.some((dose) => dose.supplementId === supplementId)
      ? current.supplementDoses.map((dose) => dose.supplementId === supplementId ? { ...dose, ...patch } : dose)
      : [...current.supplementDoses, { supplementId, amount: patch.amount ?? 1, enabled: patch.enabled ?? true }]
  }))

  return <div className="view-stack">
    <section className="control-bar">
      <label>今日属性<select value={state.manual.dayType ?? ''} onChange={(event) => setState((current) => ({ ...current, manual: { ...current.manual, dayType: (event.target.value || null) as DayType | null } }))}><option value="">按计划自动判断</option><option value="推">推日</option><option value="拉">拉日</option><option value="腿">腿日</option><option value="休">休息日</option></select></label>
      <label>手动热量<input type="number" min={result.macro.bmr} placeholder="留空使用公式" value={state.manual.targetCalories ?? ''} onChange={(event) => setState((current) => ({ ...current, manual: { ...current.manual, targetCalories: event.target.value === '' ? null : Number(event.target.value) } }))} /></label>
      <button className="button" onClick={() => setState((current) => ({ ...current, manual: { ...current.manual, dayType: null, targetCalories: null } }))}><RotateCcw size={16} />恢复自动计算</button>
    </section>

    <section><div className="section-heading"><div><h2>表A · 热量与六大营养素</h2><p>BMR {result.macro.bmr} · TDEE {result.macro.tdee} · 实际菜单自动汇总</p></div></div><div className="table-wrap"><table><thead><tr><th>项目</th><th>目标</th><th>实际</th><th>达标率</th><th>备注</th></tr></thead><tbody>{rows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.target}{row.unit}</td><td>{row.actual}{row.unit}</td><td>{Math.round(row.actual / Math.max(row.target, 1) * 100)}%</td><td>{row.note}</td></tr>)}</tbody></table></div></section>

    <section><div className="section-heading"><div><h2>今日分餐菜单</h2><p>每餐显示合计热量和可编辑参考范围；所有营养计算只认克。</p></div><button className="button" onClick={onOpenLibrary}><Library size={16} />食材资料与换算</button></div><MealPlanEditor menu={result.menu} foods={libraries.foods} targetCalories={result.macro.targetCalories} energyRules={state.mealEnergyRules} onRuleChange={(rule) => setState((current) => ({ ...current, mealEnergyRules: current.mealEnergyRules.map((item) => item.meal === rule.meal ? rule : item) }))} onChange={(menu: MenuItem[]) => setState((current) => ({ ...current, menu }))} /></section>

    <section><div className="section-heading"><div><h2>今日补剂时序</h2><p>数量修改后立即进入微量总账；商品换品牌或含量请到补剂库修改。</p></div><button className="button" onClick={onOpenLibrary}><Library size={16} />补剂成分库</button></div><div className="supplement-plan-list">{libraries.supplements.map((supplement) => { const dose = state.supplementDoses.find((item) => item.supplementId === supplement.id); const lock = result.supplementLocks[supplement.id]; return <div className={lock ? 'supplement-plan-row is-locked' : 'supplement-plan-row'} key={supplement.id}><div><strong>{supplement.name}</strong><span>{supplement.timing}</span></div><label><span>数量</span><input type="number" min="0" step="0.5" value={(dose?.amount ?? 0) === 0 ? '' : dose?.amount ?? ''} placeholder="0" onChange={(event) => updateSupplement(supplement.id, { amount: event.target.value === '' ? 0 : Math.max(0, Number(event.target.value)) })} /></label><span>{supplement.servingUnit}</span><label className="switch-label"><input type="checkbox" disabled={Boolean(lock)} checked={(dose?.enabled ?? false) && !lock} onChange={(event) => updateSupplement(supplement.id, { enabled: event.target.checked })} />启用</label><small>{lock ?? (supplement.dataGaps.length ? `待补：${supplement.dataGaps.join('、')}` : '已计入总账')}</small></div> })}</div></section>
  </div>
}
