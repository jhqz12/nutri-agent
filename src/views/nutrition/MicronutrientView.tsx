import { AlertCircle, CheckCircle2, Library, Plus, ShieldAlert, Star } from 'lucide-react'
import { getEffectiveLibrariesForState } from '../../lib/engine'
import { isNutFood } from '../../lib/foodUnits'
import type { AppState, EngineResult, MenuItem, NutrientLedgerRow } from '../../nutritionTypes'

const statusOrder: NutrientLedgerRow['status'][] = ['超量', '不足', '数据缺口', '达标']

function suggestionMeal(food: ReturnType<typeof getEffectiveLibrariesForState>['foods'][number]): MenuItem['meal'] {
  if (isNutFood(food)) return '坚果'
  if (food.tendency.includes('日间加餐')) return '日间加餐'
  if (food.tendency.includes('早餐')) return '早餐'
  if (food.tendency.includes('午餐')) return '午餐'
  return '晚餐'
}

function StatusIcon({ status }: { status: NutrientLedgerRow['status'] }) {
  if (status === '达标') return <CheckCircle2 size={14} />
  if (status === '超量') return <ShieldAlert size={14} />
  return <AlertCircle size={14} />
}

export function MicronutrientView({ state, setState, result, onOpenLibrary }: {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  result: EngineResult
  onOpenLibrary: () => void
}) {
  const libraries = getEffectiveLibrariesForState(state)
  const abnormalCount = result.ledger.filter((row) => row.status !== '达标').length

  const toggleFocus = (nutrientId: string) => setState((current) => ({
    ...current,
    focusNutrientIds: current.focusNutrientIds.includes(nutrientId)
      ? current.focusNutrientIds.filter((id) => id !== nutrientId)
      : [...current.focusNutrientIds, nutrientId]
  }))

  const addSuggestion = (foodId: string, grams: number) => {
    const food = libraries.foods.find((item) => item.id === foodId)
    if (!food) return
    const meal = suggestionMeal(food)
    setState((current) => {
      const index = current.menu.findIndex((item) => item.foodId === foodId && item.meal === meal)
      if (index < 0) return { ...current, menu: [...current.menu, { foodId, meal, amount: grams, unit: 'g' }] }
      return {
        ...current,
        menu: current.menu.map((item, itemIndex) => itemIndex === index
          ? { ...item, amount: Math.max(0, item.amount) + grams, unit: 'g' }
          : item)
      }
    })
  }

  return <div className="view-stack">
    <section className="micro-summary"><div><span>需要处理</span><strong>{abnormalCount}</strong><small>不足、超量或缺数据</small></div><div><span>ω6:ω3</span><strong>{result.fattyAcids.ratio ?? '待补数值'}</strong><small>目标≤4:1</small></div><div><span>饱和脂肪</span><strong>{result.fattyAcids.saturated}g</strong><small>目标≤总脂肪1/3</small></div></section>
    <div className="nutrient-explain"><div><strong>先看重点，再处理异常</strong><span>重点项来自你的健康目标和手动关注；同一分组内按超量、不足、缺数据、达标排列。</span></div><button className="button" onClick={onOpenLibrary}><Library size={16} />补录食材与补剂数据</button></div>

    {(['重点', '一般'] as const).map((priority) => {
      const rows = result.ledger.filter((row) => row.priority === priority)
      return <section className={`nutrient-priority-section priority-${priority}`} key={priority}>
        <div className="section-heading"><div><h2>{priority === '重点' ? '重点关注' : '一般关注'}</h2><p>{priority === '重点' ? '优先处理与你当前身体状况和补剂风险关系更大的项目。' : '作为完整营养检查保留，不要求每天逐项追求满格。'}</p></div><span className="section-count">{rows.length}项</span></div>
        <div className="nutrient-status-list">
          {statusOrder.map((status) => {
            const statusRows = rows.filter((row) => row.status === status)
            if (!statusRows.length) return null
            return <div className={`nutrient-status-group status-group-${status}`} key={status}>
              <div className="nutrient-status-heading"><span className={`status status-${status}`}><StatusIcon status={status} />{status}</span><small>{statusRows.length}项</small></div>
              <div className="nutrient-row-list">{statusRows.map((row) => <article className="nutrient-row" key={row.id}>
                <div className="nutrient-row-head"><div><strong>{row.name}</strong><span>合计 {row.total}{row.unit} · 目标 {row.target}{row.unit}{row.ul !== null ? ` · 上限 ${row.ul}${row.unit}` : ''}</span></div><button className={row.priority === '重点' ? 'icon-button nutrient-focus is-active' : 'icon-button nutrient-focus'} title={row.priority === '重点' ? '移出重点关注' : '设为重点关注'} aria-label={row.priority === '重点' ? `将${row.name}移出重点` : `将${row.name}设为重点`} onClick={() => toggleFocus(row.id)}><Star size={15} fill={row.priority === '重点' ? 'currentColor' : 'none'} /></button></div>
                <div className="nutrient-sources"><span>食物 {row.food}{row.unit}</span><span>补剂 {row.supplement}{row.unit}</span></div>
                <p>{row.advice}</p>
                {row.foodSuggestions.length > 0 && <div className="food-suggestion-list"><strong>可直接食补</strong>{row.foodSuggestions.map((suggestion) => <button className="food-suggestion" key={suggestion.foodId} onClick={() => addSuggestion(suggestion.foodId, suggestion.grams)}><span>{suggestion.foodName} {suggestion.grams}克</span><small>约补 {suggestion.nutrientAmount}{row.unit}</small><Plus size={14} /></button>)}</div>}
                {row.status === '数据缺口' && <button className="text-button" onClick={onOpenLibrary}>去补录可靠数值</button>}
              </article>)}</div>
            </div>
          })}
        </div>
      </section>
    })}
  </div>
}
