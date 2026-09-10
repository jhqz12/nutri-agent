import { useMemo, useState } from 'react'
import { Check, Download, ExternalLink, LockKeyhole, Trash2, Upload } from 'lucide-react'
import { calculateMacro, getEffectiveLibrariesForState, isFormulaAvailable } from '../lib/engine'
import { downloadJson } from '../lib/importer'
import { useNutritionState } from '../state/NutritionContext'
import type { FormulaRecord } from '../nutritionTypes'

const formulaTemplate: FormulaRecord = {
  id: 'CUSTOM_FORMULA_01',
  name: '自定义体重系数公式',
  active: false,
  energyEquation: 'mifflin',
  macroMode: 'weightRatios',
  activityFactor: 1.55,
  advancedActivityFactor: 1.725,
  calorieDeficit: 400,
  maxCalorieDeficit: 500,
  proteinPerKg: 1.6,
  fatPerKg: 0.9,
  trainingCarbsPerKg: 2.5,
  restCarbsPerKg: 2,
  restCaloriesFactor: 0.88,
  restCarbsFactor: 0.85,
  sodiumLimitMg: 2000,
  requiresBodyFat: false,
  sourceName: '请填写论文、指南或机构名称',
  sourceUrl: 'https://',
  applicablePopulation: '请填写适用人群',
  limitations: '请填写限制条件',
  reviewStatus: '待用户核对来源',
  version: 'v1.0',
  userImported: true
}

const numericFields: Array<keyof FormulaRecord> = [
  'activityFactor', 'advancedActivityFactor', 'calorieDeficit', 'maxCalorieDeficit',
  'proteinPerKg', 'fatPerKg', 'trainingCarbsPerKg', 'restCarbsPerKg',
  'restCaloriesFactor', 'restCarbsFactor', 'sodiumLimitMg'
]

function parseFormula(text: string): FormulaRecord {
  const parsed = JSON.parse(text) as FormulaRecord | FormulaRecord[]
  const record = Array.isArray(parsed) ? parsed[0] : parsed
  if (!record || typeof record !== 'object') throw new Error('公式模板必须是JSON对象或只含一个公式的数组。')
  if (!/^CUSTOM_[A-Z0-9_-]+$/i.test(String(record.id ?? ''))) throw new Error('自定义公式ID必须以CUSTOM_开头，只能包含字母、数字、横线和下划线。')
  if (!String(record.name ?? '').trim()) throw new Error('公式名称不能为空。')
  if (!['mifflin', 'revisedHarrisBenedict', 'cunningham'].includes(record.energyEquation)) throw new Error('不支持这个能量公式类型。')
  if (!['weightRatios', 'remainingCalories'].includes(record.macroMode)) throw new Error('宏量模式只能是weightRatios或remainingCalories。')
  for (const key of numericFields) {
    const value = Number(record[key])
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${String(key)}必须是大于0的数字。`)
  }
  if (record.activityFactor < 1 || record.activityFactor > 2.5) throw new Error('活动系数必须在1～2.5之间。')
  if ([record.proteinPerKg, record.fatPerKg, record.trainingCarbsPerKg, record.restCarbsPerKg].some((value) => value > 6)) throw new Error('宏量系数不能大于6g/kg，请检查单位。')
  if (!String(record.sourceName ?? '').trim() || !/^https?:\/\//i.test(String(record.sourceUrl ?? ''))) throw new Error('必须填写来源名称和完整的http/https来源网址。')
  return { ...record, active: false, userImported: true }
}

function previewFormula(state: ReturnType<typeof useNutritionState>['state'], formula: FormulaRecord, rest: boolean) {
  if (!isFormulaAvailable(state, formula)) return null
  return calculateMacro({ ...state, manual: { ...state.manual, formulaId: formula.id, dayType: rest ? '休' : '推', targetCalories: null } }, formula)
}

export function FormulaLibraryView() {
  const { state, setState } = useNutritionState()
  const libraries = useMemo(() => getEffectiveLibrariesForState(state), [state])
  const [importText, setImportText] = useState('')
  const [preview, setPreview] = useState<FormulaRecord | null>(null)
  const [message, setMessage] = useState('')

  const inspectFormula = (text: string) => {
    setImportText(text)
    try { setPreview(parseFormula(text)); setMessage('模板校验通过，请核对预览后确认导入。') }
    catch (error) { setPreview(null); setMessage(error instanceof Error ? error.message : '公式识别失败。') }
  }

  const importFormula = () => {
    if (!preview) return
    if (libraries.formulas.some((item) => item.id === preview.id)) { setMessage('公式ID已经存在，请修改模板中的ID。'); return }
    setState((current) => ({ ...current, customFormulas: [...current.customFormulas, preview] }))
    setMessage(`已导入“${preview.name}”，现在可以在公式列表中启用。`)
    setPreview(null)
    setImportText('')
  }

  return <section className="formula-library-panel">
    <div className="section-heading"><div><h2>公式库与导入</h2><p>原始公式只读；导入前用当前档案预览总热量、蛋白质、脂肪和碳水。</p></div><button className="button" onClick={() => downloadJson('营养公式导入模板.json', formulaTemplate)}><Download size={16} />下载公式模板</button></div>
    <div className="formula-card-list">{libraries.formulas.map((formula) => {
      const training = previewFormula(state, formula, false)
      const rest = previewFormula(state, formula, true)
      const selected = state.manual.formulaId === formula.id
      return <article className={selected ? 'formula-card is-selected' : 'formula-card'} key={formula.id}>
        <div className="formula-card-head"><div><span>{formula.id} · {formula.version}</span><strong>{formula.name}</strong></div>{selected && <span className="selected-formula"><Check size={13} />当前</span>}</div>
        {training && rest ? <div className="formula-results"><div><span>训练日热量</span><strong>{training.targetCalories}<small> kcal</small></strong></div><div><span>蛋白质</span><strong>{training.protein}<small> g</small></strong></div><div><span>脂肪</span><strong>{training.fat}<small> g</small></strong></div><div><span>碳水</span><strong>{training.carbs}<small> / 休{rest.carbs}g</small></strong></div></div> : <div className="formula-locked"><LockKeyhole size={16} />需要先在设置中填写可靠体脂率，才能计算和启用。</div>}
        <div className="formula-evidence"><span>依据</span><strong>{formula.sourceName}</strong><em>{formula.reviewStatus ?? '待核对来源'}</em></div><p>适用：{formula.applicablePopulation}</p><small>限制：{formula.limitations}</small>
        <div className="formula-card-actions"><a className="button compact" href={formula.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />查看来源</a><button className="button compact primary" disabled={!training || selected} onClick={() => setState((current) => ({ ...current, manual: { ...current.manual, formulaId: formula.id } }))}>设为当前</button>{formula.userImported && <button className="icon-button destructive" aria-label={`删除${formula.name}`} onClick={() => { if (window.confirm(`确定删除“${formula.name}”吗？`)) setState((current) => ({ ...current, customFormulas: current.customFormulas.filter((item) => item.id !== formula.id), manual: { ...current.manual, formulaId: current.manual.formulaId === formula.id ? 'FORMULA_01' : current.manual.formulaId } })) }}><Trash2 size={15} /></button>}</div>
      </article>
    })}</div>
    <details className="formula-import-panel"><summary>导入一个新公式</summary><div className="formula-import-body"><label className="file-input-label"><Upload size={16} />选择JSON公式文件<input type="file" accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (file) inspectFormula(await file.text()) }} /></label><textarea value={importText} placeholder="也可以把公式模板JSON直接粘贴到这里" onChange={(event) => inspectFormula(event.target.value)} />{message && <p className={preview ? 'field-success' : 'field-error'}>{message}</p>}{preview && <div className="formula-import-preview"><strong>{preview.name}</strong><span>{preview.energyEquation} · {preview.macroMode}</span><button className="button primary" onClick={importFormula}><Upload size={15} />确认导入</button></div>}</div></details>
  </section>
}
