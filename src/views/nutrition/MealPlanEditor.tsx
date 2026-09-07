import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { FoodRecord, MealEnergyRule, MealGroup, MenuItem } from '../../nutritionTypes'
import { displayMealName, foodAllowedInGroup, formatFoodAmount, getDefaultFoodGrams, getManualAmountWarning, mealForFood, mergeDuplicateMenuItems } from '../../lib/foodUnits'
import { calculateMealCalories, mealCalorieRange } from '../../lib/mealEnergy'

const groups: MealGroup[] = ['早餐', '午餐', '晚餐', '加餐']

function itemMacros(food: FoodRecord, grams: number) {
  const scale = grams / 100
  return `${Math.round(food.calories * scale)}kcal · 蛋白${((food.protein ?? 0) * scale).toFixed(1)}g · 碳水${((food.carbs ?? 0) * scale).toFixed(1)}g`
}

function RuleEditor({ rule, onSave, onCancel }: { rule: MealEnergyRule; onSave: (rule: MealEnergyRule) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState({ min: String(rule.minPercent), target: String(rule.targetPercent), max: String(rule.maxPercent) })
  const [error, setError] = useState('')
  const save = () => {
    const minPercent = Number(draft.min)
    const targetPercent = Number(draft.target)
    const maxPercent = Number(draft.max)
    if (![minPercent, targetPercent, maxPercent].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) { setError('比例必须是0～100之间的数字。'); return }
    if (minPercent > targetPercent || targetPercent > maxPercent) { setError('必须满足：下限≤目标≤上限。'); return }
    onSave({ meal: rule.meal, minPercent, targetPercent, maxPercent })
  }
  return <div className="meal-rule-editor"><label>下限%<input type="number" min="0" max="100" value={draft.min} onChange={(event) => setDraft({ ...draft, min: event.target.value })} /></label><label>目标%<input type="number" min="0" max="100" value={draft.target} onChange={(event) => setDraft({ ...draft, target: event.target.value })} /></label><label>上限%<input type="number" min="0" max="100" value={draft.max} onChange={(event) => setDraft({ ...draft, max: event.target.value })} /></label><button className="button compact" onClick={onCancel}>取消</button><button className="button compact primary" onClick={save}>保存范围</button>{error && <small className="field-error">{error}</small>}</div>
}

export function MealPlanEditor({ menu, foods, targetCalories, energyRules, onChange, onRuleChange }: {
  menu: MenuItem[]
  foods: FoodRecord[]
  targetCalories: number
  energyRules: MealEnergyRule[]
  onChange: (menu: MenuItem[]) => void
  onRuleChange?: (rule: MealEnergyRule) => void
}) {
  const [editingRule, setEditingRule] = useState<MealGroup | null>(null)
  const emit = (next: MenuItem[]) => onChange(mergeDuplicateMenuItems(next, foods))
  const updateAt = (index: number, next: MenuItem) => emit(menu.map((item, itemIndex) => itemIndex === index ? next : item))
  const removeAt = (index: number) => emit(menu.filter((_, itemIndex) => itemIndex !== index))
  const mealCalories = calculateMealCalories(menu, foods)

  return <div className="meal-group-list">
    {groups.map((group) => {
      const entries = menu.map((item, index) => ({ item, index })).filter(({ item }) => displayMealName(item.meal) === group)
      const pool = foods.filter((food) => foodAllowedInGroup(food, group))
      const rule = energyRules.find((item) => item.meal === group) ?? { meal: group, minPercent: 0, targetPercent: 0, maxPercent: 100 }
      const range = mealCalorieRange(targetCalories, rule)
      const calories = mealCalories[group]
      const status = calories < range.min ? '偏低' : calories > range.max ? '超出' : '范围内'
      return <section className="meal-group" key={group}>
        <div className="meal-group-header"><div><h3>{group}</h3><span>{entries.length}项 · 合计{calories}kcal · 参考{range.min}～{range.max}kcal</span><small className={`meal-energy-status is-${status}`}>{status}</small></div><div className="meal-group-actions">{onRuleChange && <button className="icon-button" aria-label={`编辑${group}热量范围`} onClick={() => setEditingRule(editingRule === group ? null : group)}><Pencil size={14} /></button>}<button className="button compact" onClick={() => {
          const selected = pool.find((food) => !entries.some(({ item }) => item.foodId === food.id)) ?? pool[0]
          if (!selected) return
          emit([...menu, { foodId: selected.id, meal: mealForFood(group, selected), amount: getDefaultFoodGrams(selected), unit: 'g' }])
        }}><Plus size={14} />添加食材</button></div></div>
        {editingRule === group && onRuleChange && <RuleEditor rule={rule} onCancel={() => setEditingRule(null)} onSave={(next) => { onRuleChange(next); setEditingRule(null) }} />}
        <div className="meal-food-list">
          {entries.map(({ item, index }) => {
            const food = foods.find((candidate) => candidate.id === item.foodId)
            if (!food) return null
            const options = pool.some((candidate) => candidate.id === food.id) ? pool : [food, ...pool]
            const amountWarning = getManualAmountWarning(food, item.amount)
            return <div className="meal-food-row" key={`${group}-${item.foodId}`}>
              <div className="meal-food-main"><select aria-label={`${group}食材`} value={item.foodId} onChange={(event) => {
                const selected = foods.find((candidate) => candidate.id === event.target.value)
                if (!selected) return
                updateAt(index, { foodId: selected.id, meal: mealForFood(group, selected), amount: getDefaultFoodGrams(selected), unit: 'g' })
              }}>{options.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name}</option>)}</select><small>{itemMacros(food, item.amount)}</small></div>
              <label className="gram-input"><span>克重</span><input type="number" min="0" step="1" value={item.amount === 0 ? '' : item.amount} placeholder="0" onChange={(event) => updateAt(index, { ...item, amount: event.target.value === '' ? 0 : Math.max(0, Number(event.target.value)), unit: 'g' })} /></label>
              <div className="serving-reference"><strong>{formatFoodAmount(food, item.amount)}</strong><small className={amountWarning ? 'field-warning' : undefined}>{amountWarning ?? (food.rules.join('；') || '无特殊规则')}</small></div>
              <button className="icon-button destructive" aria-label={`删除${group}${food.name}`} onClick={() => removeAt(index)}><Trash2 size={15} /></button>
            </div>
          })}
          {!entries.length && <div className="empty-inline">本餐尚未安排食材，可点击“添加食材”。</div>}
        </div>
      </section>
    })}
  </div>
}

