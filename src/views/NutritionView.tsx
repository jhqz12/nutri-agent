import { useMemo, useState } from 'react'
import { Beef, Dices, Droplets, Flame, Library, ListChecks, Microscope, Wheat } from 'lucide-react'
import { calculateEngine } from '../lib/engine'
import { useNutritionState } from '../state/NutritionContext'
import { RecipePlannerView } from './RecipePlannerView'
import { NutritionView as NutritionTotalsView } from './nutrition/NutritionView'
import { MicronutrientView } from './nutrition/MicronutrientView'
import { FoodSupplementLibraryView } from './nutrition/FoodSupplementLibraryView'

type NutritionMode = 'recipes' | 'precision' | 'micro' | 'library'

export function NutritionView() {
  const [mode, setMode] = useState<NutritionMode>('precision')
  const { state, setState } = useNutritionState()
  const result = useMemo(() => calculateEngine(state), [state])
  const abnormalCount = result.ledger.filter((row) => row.status !== '达标').length
  const saltEquivalentGrams = (state.profile.sodiumLimitMg * 2.5 / 1000).toFixed(1)

  return <div className="view-stack">
    <section className="workspace-tabs" aria-label="饮食功能切换">
      <button className={mode === 'precision' ? 'is-selected' : ''} onClick={() => setMode('precision')}><ListChecks size={17} />今日配餐</button>
      <button className={mode === 'recipes' ? 'is-selected' : ''} onClick={() => setMode('recipes')}><Dices size={17} />食谱灵感</button>
      <button className={mode === 'micro' ? 'is-selected' : ''} onClick={() => setMode('micro')}><Microscope size={17} />微量总账</button>
      <button className={mode === 'library' ? 'is-selected' : ''} onClick={() => setMode('library')}><Library size={17} />食材与补剂</button>
    </section>
    <section className="nutrition-status-bar" aria-label="今日饮食计算状态">
      <div><Flame size={17} /><span>总热量</span><strong>{result.macro.targetCalories}<small> kcal</small></strong><small>已安排 {result.actual.calories} kcal</small></div>
      <div><Beef size={17} /><span>蛋白质</span><strong>{result.macro.protein}<small> g</small></strong><small>已安排 {result.actual.protein}g</small></div>
      <div><Droplets size={17} /><span>脂肪</span><strong>{result.macro.fat}<small> g</small></strong><small>已安排 {result.actual.fat}g</small></div>
      <div><Wheat size={17} /><span>碳水</span><strong>{result.macro.carbs}<small> g</small></strong><small>已安排 {result.actual.carbs}g</small></div>
    </section>
    <div className="nutrition-sodium-line">每日钠硬上限 {state.profile.sodiumLimitMg}mg，约等于食盐 {saltEquivalentGrams}g。</div>
    {abnormalCount > 0 && <div className="nutrition-alert-line">微量总账有 {abnormalCount} 项需要查看，包含不足、超量或数据缺口。</div>}
    {mode === 'recipes' && <RecipePlannerView onOpenLibrary={() => setMode('library')} />}
    {mode === 'precision' && <NutritionTotalsView state={state} setState={setState} result={result} onOpenLibrary={() => setMode('library')} />}
    {mode === 'micro' && <MicronutrientView state={state} setState={setState} result={result} onOpenLibrary={() => setMode('library')} />}
    {mode === 'library' && <FoodSupplementLibraryView />}
  </div>
}
