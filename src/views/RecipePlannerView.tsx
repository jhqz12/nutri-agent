import { useMemo, useState } from 'react'
import { CheckCircle2, Dices, Library, Save, Sparkles, X } from 'lucide-react'
import { calculateEngine, calculateMenuTotals, getEffectiveLibrariesForState } from '../lib/engine'
import { createMenuIdea } from '../lib/mealPlanner'
import { mergeDuplicateMenuItems } from '../lib/foodUnits'
import { optimizeMenuWithAi, type MenuOptimizationResult } from '../lib/aiCoach'
import { useNutritionState } from '../state/NutritionContext'
import type { MealEnergyRule, MenuItem } from '../nutritionTypes'
import { MealPlanEditor } from './nutrition/MealPlanEditor'

export function RecipePlannerView({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  const { state, setState } = useNutritionState()
  const [aiOptimization, setAiOptimization] = useState<MenuOptimizationResult | null>(null)
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [aiMessage, setAiMessage] = useState('')
  const result = useMemo(() => calculateEngine(state), [state])
  const libraries = useMemo(() => getEffectiveLibrariesForState(state), [state])
  const preview = state.recipeDraft ?? []
  const totals = useMemo(() => calculateMenuTotals(preview, libraries.foods), [preview, libraries.foods])
  const optimizationTotals = useMemo(() => aiOptimization ? calculateMenuTotals(aiOptimization.menu, libraries.foods) : null, [aiOptimization, libraries.foods])
  const calorieGap = Math.round(totals.calories - result.macro.targetCalories)
  const applied = Boolean(state.recipeAppliedAt && preview.length)

  const generate = () => {
    const seed = createMenuIdea(libraries.foods, result.menu)
    const generated = mergeDuplicateMenuItems(calculateEngine({ ...state, menu: seed }).menu, libraries.foods)
    setAiOptimization(null)
    setAiMessage('')
    setState((current) => ({ ...current, recipeDraft: generated, recipeAppliedAt: null }))
  }

  const updatePreview = (menu: MenuItem[]) => {
    setAiOptimization(null)
    setState((current) => ({ ...current, recipeDraft: mergeDuplicateMenuItems(menu, libraries.foods), recipeAppliedAt: null }))
  }

  const optimize = async () => {
    if (!preview.length || aiState === 'loading') return
    setAiState('loading')
    setAiMessage('')
    setAiOptimization(null)
    try {
      const suggestion = await optimizeMenuWithAi({
        menu: preview,
        foods: libraries.foods.map((food) => ({
          id: food.id, name: food.name, category: food.category, gramsPerUnit: food.gramsPerUnit,
          calories: food.calories, protein: food.protein, fat: food.fat, carbs: food.carbs, fiber: food.fiber
        })),
        target: { calories: result.macro.targetCalories, protein: result.macro.protein, fat: result.macro.fat, carbs: result.macro.carbs },
        mealRules: state.mealEnergyRules
      })
      setAiOptimization(suggestion)
      setAiState('idle')
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : 'AI菜单优化失败，请稍后重试。')
      setAiState('error')
    }
  }

  const applyAiOptimization = () => {
    if (!aiOptimization) return
    const optimizedMenu = aiOptimization.menu
    setAiOptimization(null)
    setAiMessage('AI优化草案已放入菜单，请继续检查；点击底部“应用为今日菜单”后才会正式生效。')
    setAiState('idle')
    setState((current) => ({ ...current, recipeDraft: mergeDuplicateMenuItems(optimizedMenu, libraries.foods), recipeAppliedAt: null }))
  }

  const updateRule = (rule: MealEnergyRule) => setState((current) => ({ ...current, mealEnergyRules: current.mealEnergyRules.map((item) => item.meal === rule.meal ? rule : item) }))

  return <div className="view-stack">
    <section className="nutrition-toolbar">
      <button className="button" onClick={onOpenLibrary}><Library size={16} />先看食材库</button>
      <span className="library-source-note">生成范围：当前有效食材库 {libraries.foods.length} 项</span>
      <button className="button" disabled={!preview.length || aiState === 'loading'} onClick={optimize}><Sparkles size={17} />{aiState === 'loading' ? 'AI正在优化…' : 'AI优化菜单'}</button>
      <button className="button primary" onClick={generate}><Dices size={17} />{preview.length ? '重新生成菜单' : '生成今天吃什么'}</button>
    </section>

    {!preview.length ? <section className="empty-state"><Dices size={28} /><strong>还没有今日灵感菜单</strong><p>生成器只使用当前食材库；同餐同食材会合并，主食和肉类数量会受控。</p><button className="button primary" onClick={generate}><Dices size={16} />立即生成</button></section> : <>
      <section className="idea-summary"><div><span>热量</span><strong>{Math.round(totals.calories)} / {result.macro.targetCalories} kcal</strong></div><div><span>蛋白质</span><strong>{totals.protein.toFixed(1)} / {result.macro.protein}g</strong></div><div><span>脂肪</span><strong>{totals.fat.toFixed(1)} / {result.macro.fat}g</strong></div><div><span>碳水</span><strong>{totals.carbs.toFixed(1)} / {result.macro.carbs}g</strong></div></section>
      {aiMessage && <div className={aiState === 'error' ? 'notice error' : 'notice success'}><Sparkles size={17} /><span>{aiMessage}</span></div>}
      {aiOptimization && optimizationTotals && <section className="notice ai-menu-suggestion"><Sparkles size={18} /><div><strong>AI优化草案</strong><p>{aiOptimization.summary}</p><p>优化后预计：{Math.round(optimizationTotals.calories)} kcal · 蛋白质 {optimizationTotals.protein.toFixed(1)}g · 脂肪 {optimizationTotals.fat.toFixed(1)}g · 碳水 {optimizationTotals.carbs.toFixed(1)}g</p>{aiOptimization.changes.length > 0 && <ul>{aiOptimization.changes.map((change) => <li key={change}>{change}</li>)}</ul>}<div className="dialog-actions"><button className="button compact" onClick={() => setAiOptimization(null)}><X size={15} />放弃草案</button><button className="button compact primary" onClick={applyAiOptimization}><CheckCircle2 size={15} />采用这份优化草案</button></div></div></section>}
      {applied ? <div className="notice success"><CheckCircle2 size={17} /><span>已应用为今日菜单并固定保存。继续修改后需要重新应用。</span></div> : <div className={Math.abs(calorieGap) <= result.macro.targetCalories * 0.08 ? 'notice success' : 'notice'}><CheckCircle2 size={17} /><span>{Math.abs(calorieGap) <= result.macro.targetCalories * 0.08 ? '热量已进入目标误差范围，可继续按口味微调。' : `当前热量相差${Math.abs(calorieGap)}kcal，这是最接近方案，请调整克重或重新生成。`}</span></div>}
      <MealPlanEditor menu={preview} foods={libraries.foods} targetCalories={result.macro.targetCalories} energyRules={state.mealEnergyRules} onRuleChange={updateRule} onChange={updatePreview} />
      <div className={applied ? 'sticky-apply-bar is-applied' : 'sticky-apply-bar'}><span>{applied ? `应用时间：${new Date(state.recipeAppliedAt!).toLocaleString('zh-CN')}` : '确认后会替换“今日配餐”，所有热量和微量总账立即重算。'}</span><button className="button primary" disabled={applied} onClick={() => setState((current) => ({ ...current, menu: preview, recipeDraft: preview, recipeAppliedAt: new Date().toISOString() }))}><Save size={16} />{applied ? '已应用到今日菜单' : '应用为今日菜单'}</button></div>
    </>}
  </div>
}
