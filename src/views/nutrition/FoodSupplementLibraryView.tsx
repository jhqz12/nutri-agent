import { useMemo, useState } from 'react'
import { CheckCircle2, Pencil, Plus, Search, X } from 'lucide-react'
import { getEffectiveLibrariesForState } from '../../lib/engine'
import { calculateMacroCalories, energyConversionNote, kilocaloriesToKilojoules, kilojoulesToKilocalories } from '../../lib/foodEnergy'
import { defaultTendencyForCategory, foodCategories, formatFoodAmount, getDefaultFoodGrams, getFoodCategory } from '../../lib/foodUnits'
import { createOverride } from '../../lib/overlay'
import type { FoodCategory, FoodRecord, MeasureUnit, NutrientMap, SupplementRecord } from '../../nutritionTypes'
import { useNutritionState } from '../../state/NutritionContext'

type LibraryTab = 'foods' | 'supplements'
type EditTarget = { type: LibraryTab; id: string | null } | null
type FoodEnergyMode = 'macro' | 'kcal' | 'kj'
type CategoryFilter = FoodCategory | '全部'

interface FoodDraft {
  name: string
  category: FoodCategory
  calories: string
  kilojoules: string
  energyMode: FoodEnergyMode
  protein: string
  fat: string
  carbs: string
  fiber: string
  proteinType: string
  unit: MeasureUnit
  defaultGrams: string
  tendency: string[]
  rules: string
  sourceName: string
  sourceUrl: string
  dataGaps: string
  micronutrients: Record<string, string>
}

const unitOptions: MeasureUnit[] = ['g', '个', '片', '袋', '杯', '瓶', '碗', '粒', '份']
const tendencyOptions = ['早餐', '午餐', '晚餐', '日间加餐', '坚果']
const commonNutrientOrder = ['sodium', 'potassium', 'calcium', 'magnesium', 'iron', 'zinc', 'selenium']
const nutrientLabels: Record<string, string> = { protein: '蛋白质g', fat: '脂肪g', carbs: '碳水g', creatine: '肌酸g', coq10: '辅酶Q10mg', cfu: '益生菌数量' }

function toNumber(value: string, nullable = true): number | null {
  if (value.trim() === '') return nullable ? null : 0
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) throw new Error('营养数值必须是0或正数。')
  return number
}

function numberOrZero(value: string): number {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function mapToDraft(map: NutrientMap, keys: string[]) {
  return Object.fromEntries(keys.map((key) => [key, map[key] === null || map[key] === undefined ? '' : String(map[key])]))
}

export function FoodSupplementLibraryView() {
  const { state, setState } = useNutritionState()
  const libraries = useMemo(() => getEffectiveLibrariesForState(state), [state])
  const [tab, setTab] = useState<LibraryTab>('foods')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('全部')
  const [editTarget, setEditTarget] = useState<EditTarget>(null)
  const [message, setMessage] = useState('')

  const foodStandards = useMemo(() => libraries.standards
    .filter((item) => item.id !== 'fiber')
    .sort((left, right) => {
      const leftIndex = commonNutrientOrder.indexOf(left.id)
      const rightIndex = commonNutrientOrder.indexOf(right.id)
      if (leftIndex >= 0 || rightIndex >= 0) return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex)
      return 0
    }), [libraries.standards])
  const foodKeys = foodStandards.map((item) => item.id)
  const supplementKeys = [...libraries.standards.map((item) => item.id), 'protein', 'fat', 'carbs', 'creatine', 'coq10', 'cfu']
  const editingFood = editTarget?.type === 'foods' ? libraries.foods.find((item) => item.id === editTarget.id) : undefined
  const editingSupplement = editTarget?.type === 'supplements' ? libraries.supplements.find((item) => item.id === editTarget.id) : undefined

  const emptyFoodDraft = (category: FoodCategory): FoodDraft => ({
    name: '', category, calories: '', kilojoules: '', energyMode: 'macro', protein: '', fat: '', carbs: '', fiber: '', proteinType: '混合', unit: 'g', defaultGrams: '100',
    tendency: defaultTendencyForCategory(category), rules: '', sourceName: '用户手动添加', sourceUrl: '', dataGaps: '', micronutrients: mapToDraft({}, foodKeys)
  })
  const [foodDraft, setFoodDraft] = useState<FoodDraft>(() => emptyFoodDraft('其他'))
  const [supplementDraft, setSupplementDraft] = useState({ name: '', brand: '', unit: '粒' as MeasureUnit, servingAmount: '1', calories: '', timing: '', containsOil: false, compound: false, conflicts: '', dataGaps: '', sourceName: '', sourceUrl: '', nutrients: {} as Record<string, string> })

  const beginFoodEdit = (food?: FoodRecord, requestedCategory?: FoodCategory) => {
    const category = food ? getFoodCategory(food) : requestedCategory ?? '其他'
    const legacyFiber = typeof food?.micronutrients.fiber === 'number' ? food.micronutrients.fiber : null
    setFoodDraft(food ? {
      name: food.name,
      category,
      calories: String(food.calories),
      kilojoules: String(kilocaloriesToKilojoules(food.calories)),
      energyMode: 'kcal',
      protein: food.protein === null ? '' : String(food.protein),
      fat: food.fat === null ? '' : String(food.fat),
      carbs: food.carbs === null ? '' : String(food.carbs),
      fiber: food.fiber === null ? (legacyFiber === null ? '' : String(legacyFiber)) : String(food.fiber),
      proteinType: food.proteinType ?? '混合',
      unit: food.servingUnit,
      defaultGrams: String(getDefaultFoodGrams(food)),
      tendency: [...food.tendency],
      rules: food.rules.join(','),
      sourceName: food.sourceName ?? '用户原始库',
      sourceUrl: food.sourceUrl ?? '',
      dataGaps: food.dataGaps.filter((item) => item !== 'fiber').join(','),
      micronutrients: mapToDraft(food.micronutrients, foodKeys)
    } : emptyFoodDraft(category))
    setEditTarget({ type: 'foods', id: food?.id ?? null })
    setMessage('')
  }

  const beginSupplementEdit = (supplement?: SupplementRecord) => {
    setSupplementDraft(supplement ? {
      name: supplement.name, brand: supplement.brand ?? '', unit: supplement.servingUnit, servingAmount: String(supplement.servingAmount), calories: supplement.calories === null ? '' : String(supplement.calories), timing: supplement.timing, containsOil: supplement.containsOil, compound: supplement.compound, conflicts: supplement.conflicts.join(','), dataGaps: supplement.dataGaps.join(','), sourceName: supplement.sourceName ?? '商品包装标签', sourceUrl: supplement.sourceUrl ?? '', nutrients: mapToDraft(supplement.nutrients, supplementKeys)
    } : { name: '', brand: '', unit: '粒', servingAmount: '1', calories: '', timing: '', containsOil: false, compound: false, conflicts: '', dataGaps: '', sourceName: '商品包装标签', sourceUrl: '', nutrients: mapToDraft({}, supplementKeys) })
    setEditTarget({ type: 'supplements', id: supplement?.id ?? null })
    setMessage('')
  }

  const macroCalories = calculateMacroCalories(numberOrZero(foodDraft.protein), numberOrZero(foodDraft.fat), numberOrZero(foodDraft.carbs))

  const updateMacro = (key: 'protein' | 'fat' | 'carbs', value: string) => {
    setFoodDraft((current) => {
      const next = { ...current, [key]: value }
      if (current.energyMode !== 'macro') return next
      const calories = calculateMacroCalories(numberOrZero(next.protein), numberOrZero(next.fat), numberOrZero(next.carbs))
      return { ...next, calories: String(calories), kilojoules: String(kilocaloriesToKilojoules(calories)) }
    })
  }

  const useMacroEnergy = () => setFoodDraft((current) => ({ ...current, calories: String(macroCalories), kilojoules: String(kilocaloriesToKilojoules(macroCalories)), energyMode: 'macro' }))

  const saveFood = () => {
    try {
      if (!foodDraft.name.trim()) throw new Error('食材名称不能为空。')
      if (!foodDraft.tendency.length) throw new Error('至少选择一个倾向餐别。')
      const defaultGrams = toNumber(foodDraft.defaultGrams, false) ?? 0
      if (defaultGrams <= 0) throw new Error('常用克重必须大于0。')
      const calories = foodDraft.calories.trim() === '' ? macroCalories : toNumber(foodDraft.calories, false) ?? 0
      const micronutrients = Object.fromEntries(foodKeys.map((key) => [key, toNumber(foodDraft.micronutrients[key] ?? '')]))
      delete micronutrients.fiber
      const record: Omit<FoodRecord, 'id'> = {
        name: foodDraft.name.trim(),
        category: foodDraft.category,
        servingAmount: foodDraft.unit === 'g' ? defaultGrams : 1,
        servingUnit: foodDraft.unit,
        gramsPerUnit: foodDraft.unit === 'g' ? undefined : defaultGrams,
        calories,
        protein: toNumber(foodDraft.protein),
        proteinType: foodDraft.proteinType as FoodRecord['proteinType'],
        fat: toNumber(foodDraft.fat),
        carbs: toNumber(foodDraft.carbs),
        fiber: toNumber(foodDraft.fiber),
        fattyAcids: editingFood?.fattyAcids ?? { saturated: null, omega9: null, omega6: null, omega3: null },
        micronutrients,
        tendency: foodDraft.tendency,
        rules: foodDraft.rules.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
        rawDescription: `常用量${defaultGrams}克。`,
        dataGaps: foodDraft.dataGaps.split(/[,，]/).map((item) => item.trim()).filter((item) => item && item !== 'fiber'),
        sourceName: foodDraft.sourceName.trim(), sourceUrl: foodDraft.sourceUrl.trim(), userAdded: editingFood?.userAdded ?? true, addedAt: editingFood?.addedAt ?? new Date().toISOString()
      }
      if (editingFood) {
        setState((current) => ({ ...current, overrides: createOverride(current.overrides, 'foods', editingFood.id, record, '饮食页修改食材资料') }))
      } else {
        setState((current) => ({ ...current, customFoods: [...current.customFoods, { ...record, id: `UF-${crypto.randomUUID()}` }] }))
      }
      setMessage(`食材“${record.name}”已保存，菜单和总账已重新计算。`)
      setEditTarget(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : '食材保存失败。') }
  }

  const saveSupplement = () => {
    try {
      if (!supplementDraft.name.trim()) throw new Error('补剂名称不能为空。')
      const servingAmount = toNumber(supplementDraft.servingAmount, false) ?? 0
      if (servingAmount <= 0) throw new Error('每份数量必须大于0。')
      const nutrients = Object.fromEntries(supplementKeys.map((key) => [key, toNumber(supplementDraft.nutrients[key] ?? '')]))
      const record: Omit<SupplementRecord, 'id'> = {
        name: supplementDraft.name.trim(), brand: supplementDraft.brand.trim(), servingAmount, servingUnit: supplementDraft.unit, nutrients, calories: toNumber(supplementDraft.calories), containsOil: supplementDraft.containsOil, compound: supplementDraft.compound, timing: supplementDraft.timing.trim(), conflicts: supplementDraft.conflicts.split(/[,，]/).map((item) => item.trim()).filter(Boolean), dataGaps: supplementDraft.dataGaps.split(/[,，]/).map((item) => item.trim()).filter(Boolean), sourceName: supplementDraft.sourceName.trim(), sourceUrl: supplementDraft.sourceUrl.trim(), userAdded: editingSupplement?.userAdded ?? true, addedAt: editingSupplement?.addedAt ?? new Date().toISOString()
      }
      if (editingSupplement) setState((current) => ({ ...current, overrides: createOverride(current.overrides, 'supplements', editingSupplement.id, record, '饮食页修改补剂商品资料') }))
      else setState((current) => ({ ...current, customSupplements: [...current.customSupplements, { ...record, id: `US-${crypto.randomUUID()}` }] }))
      setMessage(`补剂“${record.name}”已保存，今日补剂与总账已重新计算。`)
      setEditTarget(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : '补剂保存失败。') }
  }

  const filteredFoods = libraries.foods.filter((food) => food.name.includes(search.trim()) && (categoryFilter === '全部' || getFoodCategory(food) === categoryFilter))
  const groupedFoods = foodCategories.map((category) => ({ category, foods: filteredFoods.filter((food) => getFoodCategory(food) === category) })).filter((group) => group.foods.length)
  const filteredSupplements = libraries.supplements.filter((supplement) => `${supplement.name}${supplement.brand ?? ''}`.includes(search.trim()))
  const addCategory = categoryFilter === '全部' ? '其他' : categoryFilter
  const enteredCalories = numberOrZero(foodDraft.calories)
  const energyDifference = Math.round((enteredCalories - macroCalories) * 10) / 10

  return <div className="view-stack">
    <section className="library-toolbar">
      <div className="segmented-control"><button className={tab === 'foods' ? 'is-selected' : ''} onClick={() => setTab('foods')}>食材库</button><button className={tab === 'supplements' ? 'is-selected' : ''} onClick={() => setTab('supplements')}>补剂库</button></div>
      <label className="library-search"><Search size={15} /><input value={search} placeholder="搜索名称" onChange={(event) => setSearch(event.target.value)} /></label>
      {tab === 'foods' && <label className="category-filter">分类<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}><option>全部</option>{foodCategories.map((category) => <option key={category}>{category}</option>)}</select></label>}
      <button className="button primary" onClick={() => tab === 'foods' ? beginFoodEdit(undefined, addCategory) : beginSupplementEdit()}><Plus size={16} />新增{tab === 'foods' ? `${categoryFilter === '全部' ? '' : categoryFilter}食材` : '补剂'}</button>
    </section>
    {message && <div className={message.includes('失败') || message.includes('不能为空') || message.includes('必须') ? 'notice error' : 'notice success'}><CheckCircle2 size={17} /><span>{message}</span></div>}

    {tab === 'foods' ? <section><div className="section-heading"><div><h2>食材详细资料</h2><p>按类别管理；营养统一为每100克，生活单位只作克重换算。</p></div></div>{groupedFoods.map((group) => <div className="food-category-group" key={group.category}><div className="food-category-heading"><strong>{group.category}</strong><span>{group.foods.length}项</span><button className="button compact" onClick={() => beginFoodEdit(undefined, group.category)}><Plus size={14} />新增</button></div><div className="library-record-list">{group.foods.map((food) => <article className="library-record" key={food.id}><div className="library-record-head"><div><strong>{food.name}</strong><span>{food.id}{food.userAdded ? ' · 用户新增' : ' · 原始只读'} · {getFoodCategory(food)}</span></div><button className="icon-button" aria-label={`编辑${food.name}`} onClick={() => beginFoodEdit(food)}><Pencil size={15} /></button></div><div className="library-macros"><span>{food.calories} kcal</span><span>蛋白 {food.protein ?? '缺数据'}g</span><span>脂肪 {food.fat ?? '缺数据'}g</span><span>碳水 {food.carbs ?? '缺数据'}g</span><span>膳食纤维 {food.fiber ?? '缺数据'}g</span></div><p>{formatFoodAmount(food, getDefaultFoodGrams(food))}</p><details><summary>查看微量元素与数据来源</summary><div className="nutrient-chip-list">{Object.entries(food.micronutrients).filter(([key, value]) => key !== 'fiber' && value !== null).map(([key, value]) => <span key={key}>{libraries.standards.find((item) => item.id === key)?.name ?? key} {value}</span>)}</div><small>来源：{food.sourceName || '用户原始资料'}{food.sourceUrl && <> · <a href={food.sourceUrl} target="_blank" rel="noreferrer">打开来源</a></>}<br />缺口：{food.dataGaps.filter((item) => item !== 'fiber').join('、') || '无已知缺口'}</small></details></article>)}</div></div>)}</section> : <section><div className="section-heading"><div><h2>补剂商品资料</h2><p>按每份包装标签记录；换品牌或含量时直接编辑，今日总账立即更新。</p></div></div><div className="library-record-list">{filteredSupplements.map((supplement) => <article className="library-record" key={supplement.id}><div className="library-record-head"><div><strong>{supplement.name}</strong><span>{supplement.brand || supplement.id}{supplement.userAdded ? ' · 用户新增' : ' · 原始只读'}</span></div><button className="icon-button" aria-label={`编辑${supplement.name}`} onClick={() => beginSupplementEdit(supplement)}><Pencil size={15} /></button></div><p>每份：{supplement.servingAmount}{supplement.servingUnit} · {supplement.timing || '未设置时间'}</p><div className="nutrient-chip-list">{Object.entries(supplement.nutrients).filter(([, value]) => value !== null).map(([key, value]) => <span key={key}>{libraries.standards.find((item) => item.id === key)?.name ?? nutrientLabels[key] ?? key} {value}</span>)}</div><small>缺口：{supplement.dataGaps.join('、') || '无已知缺口'}</small></article>)}</div></section>}

    {editTarget && <div className="dialog-backdrop"><div className="dialog wide"><div className="dialog-header"><div><h2>{editTarget.id ? '修改' : '新增'}{editTarget.type === 'foods' ? '食材' : '补剂'}</h2><p>{editTarget.id ? '原始值不会被改写，本次保存会生成新的覆盖版本。' : '新增记录进入用户扩展库，可随时继续修改。'}</p></div><button className="icon-button" aria-label="关闭编辑" onClick={() => setEditTarget(null)}><X size={18} /></button></div>
      {editTarget.type === 'foods' ? <>
        <div className="form-grid three-columns">
          <label>食材名称<input value={foodDraft.name} onChange={(event) => setFoodDraft({ ...foodDraft, name: event.target.value })} /></label>
          <label>食材类别<select value={foodDraft.category} onChange={(event) => { const category = event.target.value as FoodCategory; setFoodDraft((current) => ({ ...current, category, tendency: defaultTendencyForCategory(category) })) }}>{foodCategories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>蛋白质来源<select value={foodDraft.proteinType} onChange={(event) => setFoodDraft({ ...foodDraft, proteinType: event.target.value })}><option>动物</option><option>植物</option><option>混合</option></select></label>
          <label>蛋白质 g/100g<input type="number" min="0" value={foodDraft.protein} onChange={(event) => updateMacro('protein', event.target.value)} /></label>
          <label>脂肪 g/100g<input type="number" min="0" value={foodDraft.fat} onChange={(event) => updateMacro('fat', event.target.value)} /></label>
          <label>碳水 g/100g<input type="number" min="0" value={foodDraft.carbs} onChange={(event) => updateMacro('carbs', event.target.value)} /></label>
          <label>膳食纤维 g/100g<input type="number" min="0" value={foodDraft.fiber} onChange={(event) => setFoodDraft({ ...foodDraft, fiber: event.target.value })} /><small>只在这里填写，总账不会重复计算。</small></label>
        </div>
        <section className="food-energy-editor"><div><strong>能量校验</strong><span>先填蛋白质、脂肪和碳水，系统按4/9/4估算；包装标签可覆盖。</span></div><div className="energy-field-grid"><label>宏量估算<input value={`${macroCalories} kcal`} readOnly /></label><label>包装能量 kJ/100g<input type="number" min="0" value={foodDraft.kilojoules} onChange={(event) => { const value = event.target.value; setFoodDraft((current) => ({ ...current, kilojoules: value, calories: value === '' ? '' : String(kilojoulesToKilocalories(numberOrZero(value))), energyMode: 'kj' })) }} /></label><label>热量 kcal/100g<input type="number" min="0" value={foodDraft.calories} onChange={(event) => { const value = event.target.value; setFoodDraft((current) => ({ ...current, calories: value, kilojoules: value === '' ? '' : String(kilocaloriesToKilojoules(numberOrZero(value))), energyMode: 'kcal' })) }} /></label></div><div className="energy-conversion-line"><span>{energyConversionNote}；当前与宏量估算相差 {energyDifference > 0 ? '+' : ''}{energyDifference} kcal。</span><button className="button compact" onClick={useMacroEnergy}>采用宏量估算</button></div></section>
        <div className="form-grid three-columns"><label>生活单位<select value={foodDraft.unit} onChange={(event) => setFoodDraft({ ...foodDraft, unit: event.target.value as MeasureUnit })}>{unitOptions.filter((unit) => !['粒', '份'].includes(unit)).map((unit) => <option key={unit}>{unit}</option>)}</select></label><label>常用量/每单位克重<input type="number" min="1" value={foodDraft.defaultGrams} onChange={(event) => setFoodDraft({ ...foodDraft, defaultGrams: event.target.value })} /></label><fieldset className="meal-tendency-field"><legend>倾向餐别（可多选）</legend>{tendencyOptions.map((meal) => <label key={meal}><input type="checkbox" checked={foodDraft.tendency.includes(meal)} onChange={(event) => setFoodDraft((current) => ({ ...current, tendency: event.target.checked ? [...current.tendency, meal] : current.tendency.filter((item) => item !== meal) }))} />{meal}</label>)}</fieldset><label className="full-field">规则<input value={foodDraft.rules} onChange={(event) => setFoodDraft({ ...foodDraft, rules: event.target.value })} /></label><label>来源名称<input value={foodDraft.sourceName} onChange={(event) => setFoodDraft({ ...foodDraft, sourceName: event.target.value })} /></label><label className="full-field">来源网址<input value={foodDraft.sourceUrl} onChange={(event) => setFoodDraft({ ...foodDraft, sourceUrl: event.target.value })} /></label><label className="full-field">已知数据缺口<input value={foodDraft.dataGaps} onChange={(event) => setFoodDraft({ ...foodDraft, dataGaps: event.target.value })} /></label></div>
        <details className="nutrient-editor"><summary>逐项填写微量元素（每100克，钠钾等常用重点在前）</summary><div className="nutrient-input-grid">{foodStandards.map((standard) => <label key={standard.id}>{standard.name} {standard.unit}<input type="number" min="0" value={foodDraft.micronutrients[standard.id] ?? ''} onChange={(event) => setFoodDraft({ ...foodDraft, micronutrients: { ...foodDraft.micronutrients, [standard.id]: event.target.value } })} /></label>)}</div></details>
        <div className="dialog-actions"><button className="button" onClick={() => setEditTarget(null)}>取消</button><button className="button primary" onClick={saveFood}>保存并重算</button></div>
      </> : <>
        <div className="form-grid three-columns"><label>补剂名称<input value={supplementDraft.name} onChange={(event) => setSupplementDraft({ ...supplementDraft, name: event.target.value })} /></label><label>品牌/产品<input value={supplementDraft.brand} onChange={(event) => setSupplementDraft({ ...supplementDraft, brand: event.target.value })} /></label><label>每份单位<select value={supplementDraft.unit} onChange={(event) => setSupplementDraft({ ...supplementDraft, unit: event.target.value as MeasureUnit })}>{unitOptions.filter((unit) => ['粒', '片', '袋', '份'].includes(unit)).map((unit) => <option key={unit}>{unit}</option>)}</select></label><label>每份数量<input type="number" min="0.1" step="0.5" value={supplementDraft.servingAmount} onChange={(event) => setSupplementDraft({ ...supplementDraft, servingAmount: event.target.value })} /></label><label>每份热量 kcal<input type="number" min="0" value={supplementDraft.calories} onChange={(event) => setSupplementDraft({ ...supplementDraft, calories: event.target.value })} /></label><label>服用时段<input value={supplementDraft.timing} onChange={(event) => setSupplementDraft({ ...supplementDraft, timing: event.target.value })} /></label><label className="switch-label"><input type="checkbox" checked={supplementDraft.containsOil} onChange={(event) => setSupplementDraft({ ...supplementDraft, containsOil: event.target.checked })} />含油脂</label><label className="switch-label"><input type="checkbox" checked={supplementDraft.compound} onChange={(event) => setSupplementDraft({ ...supplementDraft, compound: event.target.checked })} />复方</label><label>冲突补剂ID<input value={supplementDraft.conflicts} onChange={(event) => setSupplementDraft({ ...supplementDraft, conflicts: event.target.value })} /></label><label>来源<input value={supplementDraft.sourceName} onChange={(event) => setSupplementDraft({ ...supplementDraft, sourceName: event.target.value })} /></label><label className="full-field">来源网址<input value={supplementDraft.sourceUrl} onChange={(event) => setSupplementDraft({ ...supplementDraft, sourceUrl: event.target.value })} /></label><label className="full-field">数据缺口<input value={supplementDraft.dataGaps} onChange={(event) => setSupplementDraft({ ...supplementDraft, dataGaps: event.target.value })} /></label></div>
        <details className="nutrient-editor"><summary>逐项填写每份成分</summary><div className="nutrient-input-grid">{supplementKeys.map((key) => <label key={key}>{libraries.standards.find((item) => item.id === key)?.name ?? nutrientLabels[key] ?? key}<input type="number" min="0" value={supplementDraft.nutrients[key] ?? ''} onChange={(event) => setSupplementDraft({ ...supplementDraft, nutrients: { ...supplementDraft.nutrients, [key]: event.target.value } })} /></label>)}</div></details><div className="dialog-actions"><button className="button" onClick={() => setEditTarget(null)}>取消</button><button className="button primary" onClick={saveSupplement}>保存并重算</button></div>
      </>}
    </div></div>}
  </div>
}
