import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { useAppState } from '../state/AppContext'
import { useNutritionState } from '../state/NutritionContext'
import { downloadCsv, downloadJson, downloadWorkbook, numberValue, parseSpreadsheet, textValue } from '../lib/importer'
import { createId } from '../lib/ids'
import { calculateMacroCalories, kilocaloriesToKilojoules, kilojoulesToKilocalories } from '../lib/foodEnergy'
import { autoMapFoodColumns, foodImportFields, missingFoodImportFields, normalizeImportHeader, type FoodImportTarget } from '../lib/foodImportMapping'
import { defaultTendencyForCategory, getFoodCategory } from '../lib/foodUnits'
import { getEffectiveLibrariesForState } from '../lib/engine'
import { createOverride } from '../lib/overlay'
import type { FoodRecord, NutrientMap } from '../nutritionTypes'
import type { BodyLog, DailyPlanDayType, DailyPlanItem, DailyPlanItemKind, DailyPlanTemplate, ImportPreview, MealCategory, Recipe, WorkoutSession } from '../types'

type ImportType = 'food' | 'recipe' | 'body' | 'training' | 'dailyPlan'
type DuplicateMode = 'skip' | 'replace' | 'merge'

const requiredColumns: Record<Exclude<ImportType, 'food'>, string[]> = {
  recipe: ['名称', '餐别', '食材', '热量', '蛋白质', '脂肪', '碳水'],
  body: ['日期', '体重', '腰围', '睡眠', '步数', '精力'],
  training: ['日期', '训练日', '睡眠', '精力'],
  dailyPlan: ['计划名称', '类型', '时段标签', '名称', '份量']
}

const nutrientTargetMap: Partial<Record<FoodImportTarget, string>> = {
  sodium: 'sodium', potassium: 'potassium', calcium: 'calcium', magnesium: 'magnesium', iron: 'iron', zinc: 'zinc', selenium: 'selenium'
}

function optionalNumber(value: unknown, label: string): number | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  const number = Number(text)
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label}存在空值、非数字或负数。`)
  return number
}

const DAILY_PLAN_FIELDS: Array<{ id: keyof DailyPlanRow; label: string; required: boolean; aliases: string[] }> = [
  { id: 'planName', label: '计划名称', required: true, aliases: ['计划名称', 'plan', 'planname', '模板', '模板名称'] },
  { id: 'dayType', label: '类型', required: true, aliases: ['类型', '日型', 'daytype', '类别'] },
  { id: 'slot', label: '时段标签', required: true, aliases: ['时段标签', 'slot', 'label', '时段', '餐别'] },
  { id: 'time', label: '时间', required: false, aliases: ['时间', 'time', '时刻', '开始时间'] },
  { id: 'kind', label: '类别', required: false, aliases: ['类别', 'kind', '分类'] },
  { id: 'name', label: '名称', required: true, aliases: ['名称', 'name', '项目', '食物', '食材'] },
  { id: 'amount', label: '份量', required: true, aliases: ['份量', 'amount', '数量', '克数'] },
  { id: 'unit', label: '单位', required: false, aliases: ['单位', 'unit', '度量'] },
  { id: 'note', label: '备注', required: false, aliases: ['备注', 'note', '说明'] },
  { id: 'locked', label: '锁定', required: false, aliases: ['锁定', 'locked', '不参与随机'] }
]

interface DailyPlanRow {
  planName: string
  dayType: string
  slot: string
  time: string
  kind: string
  name: string
  amount: number
  unit: string
  note: string
  locked: string
}

function autoMapDailyPlanColumns(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const field of DAILY_PLAN_FIELDS) {
    const found = headers.find((header) => field.aliases.some((alias) => normalizeImportHeader(header) === normalizeImportHeader(alias)))
    if (found) map[field.id] = found
  }
  return map
}

function mapDailyPlanRow(row: Record<string, unknown>, mapping: Record<string, string>): DailyPlanRow {
  const pick = (key: keyof DailyPlanRow) => String(row[mapping[key] ?? ''] ?? '').trim()
  const amount = Number(pick('amount') || '0')
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`「${pick('name') || '未命名'}」的份量无效。`)
  return {
    planName: pick('planName'),
    dayType: pick('dayType'),
    slot: pick('slot') || '其他',
    time: pick('time') || '08:00',
    kind: pick('kind') || '饮食',
    name: pick('name'),
    amount,
    unit: pick('unit') || 'g',
    note: pick('note'),
    locked: pick('locked')
  }
}

function normalizeDayType(value: string): DailyPlanDayType {
  const v = value.trim()
  if (['rest', '休息', '休', '休息日'].includes(v)) return 'rest'
  return 'training'
}

function normalizeKind(value: string): DailyPlanItemKind {
  const v = value.trim()
  if (['补剂', '补充', 'supplement'].includes(v)) return '补剂'
  if (['训练', 'training'].includes(v)) return '训练'
  if (['全天', 'all-day', 'allday'].includes(v)) return '全天'
  return '饮食'
}

function groupDailyPlanRows(rows: DailyPlanRow[]): DailyPlanTemplate[] {
  const groups = new Map<string, DailyPlanTemplate>()
  for (const row of rows) {
    if (!row.planName || !row.name) continue
    const dayType = normalizeDayType(row.dayType)
    const key = `${row.planName}|${dayType}`
    if (!groups.has(key)) {
      groups.set(key, {
        id: createId('plan-daily'),
        name: row.planName,
        dayType,
        active: true,
        items: [],
        updatedAt: new Date().toISOString(),
        source: '文件导入',
        userImported: true
      })
    }
    const template = groups.get(key)!
    const locked = /^(1|true|是|锁定|yes)$/i.test(row.locked)
    const item: DailyPlanItem = {
      id: createId('dpi'),
      time: row.time,
      label: row.slot,
      kind: normalizeKind(row.kind),
      foodName: row.name,
      amount: row.amount,
      unit: row.unit,
      note: row.note,
      locked,
      foodId: null,
      supplementId: null
    }
    template.items.push(item)
  }
  return [...groups.values()]
}

function mappedValue(row: Record<string, unknown>, mapping: Record<string, string>, target: string): unknown {
  const source = mapping[target]
  return source ? row[source] : ''
}

function mergeFoodRecord(existing: FoodRecord, incoming: FoodRecord, mode: DuplicateMode): FoodRecord {
  if (mode === 'replace') return { ...incoming, id: existing.id, userAdded: existing.userAdded, addedAt: existing.addedAt }
  const nutrients = Object.fromEntries(Object.keys({ ...existing.micronutrients, ...incoming.micronutrients }).map((key) => [key, incoming.micronutrients[key] ?? existing.micronutrients[key] ?? null]))
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    protein: incoming.protein ?? existing.protein,
    fat: incoming.fat ?? existing.fat,
    carbs: incoming.carbs ?? existing.carbs,
    fiber: incoming.fiber ?? existing.fiber,
    micronutrients: nutrients,
    userAdded: existing.userAdded,
    addedAt: existing.addedAt
  }
}

export function ImportDataView() {
  const { state: dashboardState, setState: setDashboardState } = useAppState()
  const { state: nutritionState, setState: setNutritionState } = useNutritionState()
  const nutritionLibraries = useMemo(() => getEffectiveLibrariesForState(nutritionState), [nutritionState])
  const [type, setType] = useState<ImportType>('food')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [status, setStatus] = useState('')
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>('replace')

  const mappingFields = type === 'food'
    ? foodImportFields.map((field) => ({ id: field.id, label: field.label, required: Boolean(field.required) }))
    : type === 'dailyPlan'
      ? DAILY_PLAN_FIELDS.map((field) => ({ id: field.id, label: field.label, required: field.required }))
      : requiredColumns[type].map((column) => ({ id: column, label: column, required: true }))
  const missingFields = type === 'food'
    ? missingFoodImportFields(mapping as Partial<Record<FoodImportTarget, string>>)
    : type === 'dailyPlan'
      ? DAILY_PLAN_FIELDS.filter((field) => field.required && !mapping[field.id]).map((field) => field.label)
      : requiredColumns[type].filter((column) => !mapping[column])

  const onFile = async (file?: File) => {
    if (!file) return
    const parsed = await parseSpreadsheet(file)
    setPreview(parsed)
    if (type === 'food') setMapping(autoMapFoodColumns(parsed.headers))
    else if (type === 'dailyPlan') {
      setMapping(autoMapDailyPlanColumns(parsed.headers))
    }
    else {
      setMapping(Object.fromEntries(requiredColumns[type].map((column) => {
        const normalized = normalizeImportHeader(column)
        const source = parsed.headers.find((header) => normalizeImportHeader(header) === normalized) ?? ''
        return [column, source]
      })))
    }
    setStatus('')
  }

  const createFoodRecords = (rows: Record<string, unknown>[]): FoodRecord[] => rows.map((row) => {
    const name = textValue(mappedValue(row, mapping, 'name'))
    if (!name) throw new Error('食材名称不能为空。')
    const protein = optionalNumber(mappedValue(row, mapping, 'protein'), `${name}的蛋白质`)
    const fat = optionalNumber(mappedValue(row, mapping, 'fat'), `${name}的脂肪`)
    const carbs = optionalNumber(mappedValue(row, mapping, 'carbs'), `${name}的碳水`)
    const labeledCalories = optionalNumber(mappedValue(row, mapping, 'calories'), `${name}的热量`)
    const kilojoules = optionalNumber(mappedValue(row, mapping, 'kilojoules'), `${name}的千焦`)
    const calories = labeledCalories ?? (kilojoules === null ? calculateMacroCalories(protein ?? 0, fat ?? 0, carbs ?? 0) : kilojoulesToKilocalories(kilojoules))
    const micronutrients: NutrientMap = Object.fromEntries(nutritionLibraries.standards.filter((standard) => standard.id !== 'fiber').map((standard) => [standard.id, null]))
    for (const [target, nutrientId] of Object.entries(nutrientTargetMap)) micronutrients[nutrientId] = optionalNumber(mappedValue(row, mapping, target), `${name}的${target}`)
    const record: FoodRecord = {
      id: `UF-${crypto.randomUUID()}`,
      name,
      servingAmount: 100,
      servingUnit: 'g',
      calories,
      protein,
      proteinType: '混合',
      fat,
      carbs,
      fiber: optionalNumber(mappedValue(row, mapping, 'fiber'), `${name}的膳食纤维`),
      fattyAcids: { saturated: null, omega9: null, omega6: null, omega3: null },
      micronutrients,
      tendency: [],
      rules: ['文件导入；营养基准为每100克'],
      rawDescription: '文件导入；未提供单位时按每100克处理。',
      dataGaps: [],
      sourceName: textValue(mappedValue(row, mapping, 'source')) || '文件导入',
      userAdded: true,
      addedAt: new Date().toISOString()
    }
    record.category = getFoodCategory(record)
    record.tendency = defaultTendencyForCategory(record.category)
    record.dataGaps = [protein === null ? 'protein' : '', fat === null ? 'fat' : '', carbs === null ? 'carbs' : '', record.fiber === null ? 'fiber' : '', ...Object.entries(micronutrients).filter(([, value]) => value === null).map(([key]) => key)].filter(Boolean)
    return record
  })

  const commit = () => {
    if (!preview || preview.errors.length || !preview.rows.length || missingFields.length) return
    try {
      if (type === 'food') {
        const items = createFoodRecords(preview.rows)
        setNutritionState((current) => {
          const effective = getEffectiveLibrariesForState(current)
          let customFoods = [...current.customFoods]
          let overrides = [...current.overrides]
          for (const incoming of items) {
            const existing = effective.foods.find((food) => food.name.trim().toLowerCase() === incoming.name.trim().toLowerCase())
            if (!existing) { customFoods.push(incoming); continue }
            if (duplicateMode === 'skip') continue
            const next = mergeFoodRecord(existing, incoming, duplicateMode)
            const customIndex = customFoods.findIndex((food) => food.id === existing.id)
            if (customIndex >= 0) customFoods[customIndex] = next
            else {
              const { id: _id, ...patch } = next
              overrides = createOverride(overrides, 'foods', existing.id, patch, '文件自动识别导入食材')
            }
          }
          return { ...current, customFoods, overrides }
        })
      } else {
        const columns = requiredColumns[type]
        const rows = preview.rows.map((row) => ({ ...row, ...Object.fromEntries(columns.map((column) => [column, row[mapping[column]]])) }))
        if (type === 'recipe') {
          const items: Recipe[] = rows.map((row) => ({ id: createId('recipe'), name: textValue(row['名称']), category: textValue(row['餐别']) as MealCategory, ingredients: textValue(row['食材']), servingLabel: textValue(row['每份说明']) || '1份', calories: numberValue(row['热量']), protein: numberValue(row['蛋白质']), fat: numberValue(row['脂肪']), carbs: numberValue(row['碳水']), price: textValue(row['价格']) || '未知', source: textValue(row['来源']) || '文件导入' }))
          validateNumbers(items.flatMap((item) => [item.calories, item.protein, item.fat, item.carbs]))
          if (items.some((item) => !['早餐', '午餐', '晚餐', '日间加餐'].includes(item.category) || !item.name)) throw new Error('名称或餐别无效。')
          setDashboardState((current) => ({ ...current, recipes: mergeByName(current.recipes, items, duplicateMode) }))
        } else if (type === 'body') {
          const items: BodyLog[] = rows.map((row) => ({ id: createId('body'), date: normalizeDate(row['日期']), weightKg: numberValue(row['体重']), waistCm: numberValue(row['腰围']), sleepHours: numberValue(row['睡眠']), steps: numberValue(row['步数']), cyclingMinutes: numberValue(row['骑行分钟']) || 0, energy: numberValue(row['精力']), backDiscomfort: numberValue(row['腰背不适']) || 0, numbnessEvents: numberValue(row['麻木事件']) || 0, trainingVolume: numberValue(row['训练总量']) || 0, dietAdherence: numberValue(row['饮食完成率']) || 0 }))
          validateNumbers(items.flatMap((item) => [item.weightKg, item.waistCm, item.sleepHours, item.steps, item.energy]))
          setDashboardState((current) => ({ ...current, bodyLogs: mergeByDate(current.bodyLogs, items, duplicateMode) }))
        } else if (type === 'training') {
          const items: WorkoutSession[] = rows.map((row) => ({ id: createId('session'), date: normalizeDate(row['日期']), split: textValue(row['训练日']) as WorkoutSession['split'], sleepHours: numberValue(row['睡眠']), energy: numberValue(row['精力']), nextDayWorse: ['是', 'true', '1'].includes(textValue(row['次日加重']).toLowerCase()), logs: [] }))
          if (items.some((item) => !['推', '拉', '腿'].includes(item.split))) throw new Error('训练日只能填写推、拉、腿。')
          validateNumbers(items.flatMap((item) => [item.sleepHours, item.energy]))
          setDashboardState((current) => ({ ...current, sessions: [...current.sessions, ...items] }))
        } else {
          const planRows = preview.rows.map((row) => mapDailyPlanRow(row, mapping))
          if (planRows.some((row) => !row.planName || !row.name)) throw new Error('计划名称或项目名称不能为空。')
          const incoming = groupDailyPlanRows(planRows)
          if (!incoming.length) throw new Error('未能识别任何日计划行，请检查列名。')
          setDashboardState((current) => {
            const currentPlans = current.dailyPlans ?? []
            const next: DailyPlanTemplate[] = [...currentPlans]
            for (const plan of incoming) {
              const key = (entry: DailyPlanTemplate) => `${entry.name.trim().toLowerCase()}|${entry.dayType}`
              const index = next.findIndex((entry) => key(entry) === key(plan))
              if (index < 0) { next.push(plan); continue }
              if (duplicateMode === 'skip') continue
              if (duplicateMode === 'replace') next[index] = { ...plan, id: next[index].id, active: next[index].active, updatedAt: new Date().toISOString() }
              else {
                const existing = next[index]
                const byLabelTime = new Map<string, DailyPlanItem>()
                for (const it of existing.items) byLabelTime.set(`${it.time}|${it.label}|${it.foodName.toLowerCase()}`, it)
                const mergedItems: DailyPlanItem[] = [...existing.items]
                for (const it of plan.items) {
                  const key2 = `${it.time}|${it.label}|${it.foodName.toLowerCase()}`
                  const idx = mergedItems.findIndex((e) => `${e.time}|${e.label}|${e.foodName.toLowerCase()}` === key2)
                  if (idx >= 0) mergedItems[idx] = { ...mergedItems[idx], ...it, id: mergedItems[idx].id }
                  else mergedItems.push(it)
                }
                next[index] = { ...existing, items: mergedItems, source: plan.source, updatedAt: new Date().toISOString() }
              }
            }
            return { ...current, dailyPlans: next, lastUpdatedAt: new Date().toISOString() }
          })
        }
      }
      setStatus(`已自动导入${preview.rows.length}条数据；重复项处理：${({ skip: '跳过', replace: '覆盖', merge: '合并' })[duplicateMode]}。`)
      setPreview(null)
    } catch (error) {
      setPreview((current) => current ? { ...current, errors: [...current.errors, error instanceof Error ? error.message : '导入失败'] } : current)
    }
  }

  const downloadTemplate = () => downloadWorkbook('训练饮食看板导入模板.xlsx', {
    食物: [{ 食材: '白煮蛋', '能量(kJ)': 314, '热量(kcal)': 75, '蛋白质(g)': 6.5, '脂肪(g)': 5.2, '碳水(g)': 0.6, '膳食纤维(g)': 0, '钠(mg)': 62, '钾(mg)': 63, 来源: '包装或可靠来源' }],
    食谱: [{ 名称: '示例餐', 餐别: '晚餐', 食材: '食材和份量', 每份说明: '1份', 热量: 600, 蛋白质: 40, 脂肪: 20, 碳水: 60, 价格: '中', 来源: '手动录入' }],
    身体记录: [{ 日期: '2026-07-21', 体重: 70, 腰围: 80, 睡眠: 7, 步数: 5000, 骑行分钟: 40, 精力: 6, 腰背不适: 5, 麻木事件: 0, 训练总量: 0, 饮食完成率: 80 }],
    训练记录: [{ 日期: '2026-07-21', 训练日: '推', 睡眠: 7, 精力: 6, 次日加重: '否' }],
    日计划模板: [
      { 计划名称: '9月·训练日', 类型: '训练日', 时段标签: '全天', 时间: '07:00', 类别: '全天', 名称: '动物黄油', 份量: 5, 单位: 'g', 备注: '烹饪或直接食用', 锁定: '是' },
      { 计划名称: '9月·训练日', 类型: '训练日', 时段标签: '早餐', 时间: '08:00', 类别: '饮食', 名称: '燕麦', 份量: 70, 单位: 'g', 备注: '生重', 锁定: '否' },
      { 计划名称: '9月·休息日', 类型: '休息日', 时段标签: '练前', 时间: '15:10', 类别: '饮食', 名称: '柚子', 份量: 200, 单位: 'g', 备注: '训练前 20 分钟', 锁定: '否' }
    ]
  })

  const exportExcel = () => downloadWorkbook('训练饮食看板数据.xlsx', {
    食物: nutritionLibraries.foods.map((item) => ({ 食材: item.name, 分类: getFoodCategory(item), '热量(kcal)': item.calories, '能量(kJ)': kilocaloriesToKilojoules(item.calories), '蛋白质(g)': item.protein, '脂肪(g)': item.fat, '碳水(g)': item.carbs, '膳食纤维(g)': item.fiber, 来源: item.sourceName ?? '' })),
    食谱: dashboardState.recipes.map((item) => ({ 名称: item.name, 餐别: item.category, 食材: item.ingredients, 每份说明: item.servingLabel, 热量: item.calories, 蛋白质: item.protein, 脂肪: item.fat, 碳水: item.carbs, 价格: item.price, 来源: item.source })),
    身体记录: dashboardState.bodyLogs.map((item) => ({ 日期: item.date, 体重: item.weightKg, 腰围: item.waistCm, 睡眠: item.sleepHours, 步数: item.steps, 骑行分钟: item.cyclingMinutes, 精力: item.energy, 腰背不适: item.backDiscomfort, 麻木事件: item.numbnessEvents, 训练总量: item.trainingVolume, 饮食完成率: item.dietAdherence }))
  })

  const exportCurrentCsv = () => {
    const rows = type === 'food' ? nutritionLibraries.foods.map((item) => ({ 食材: item.name, 分类: getFoodCategory(item), '热量(kcal)': item.calories, '能量(kJ)': kilocaloriesToKilojoules(item.calories), '蛋白质(g)': item.protein, '脂肪(g)': item.fat, '碳水(g)': item.carbs, '膳食纤维(g)': item.fiber, 来源: item.sourceName ?? '' }))
      : type === 'recipe' ? dashboardState.recipes.map((item) => ({ 名称: item.name, 餐别: item.category, 食材: item.ingredients, 每份说明: item.servingLabel, 热量: item.calories, 蛋白质: item.protein, 脂肪: item.fat, 碳水: item.carbs, 价格: item.price, 来源: item.source }))
        : type === 'body' ? dashboardState.bodyLogs.map((item) => ({ 日期: item.date, 体重: item.weightKg, 腰围: item.waistCm, 睡眠: item.sleepHours, 步数: item.steps, 骑行分钟: item.cyclingMinutes, 精力: item.energy, 腰背不适: item.backDiscomfort, 麻木事件: item.numbnessEvents, 训练总量: item.trainingVolume, 饮食完成率: item.dietAdherence }))
          : dashboardState.sessions.map((item) => ({ 日期: item.date, 训练日: item.split, 睡眠: item.sleepHours, 精力: item.energy, 次日加重: item.nextDayWorse ? '是' : '否' }))
    downloadCsv(`${type}-data.csv`, rows)
  }

  const recognizedCount = Object.values(mapping).filter(Boolean).length

  return <div className="view-stack"><section className="data-actions"><button className="button" onClick={downloadTemplate}><Download size={16} />下载导入模板</button><button className="button" onClick={exportExcel}><FileSpreadsheet size={16} />导出Excel</button><button className="button" onClick={exportCurrentCsv}><Download size={16} />导出当前类别CSV</button><button className="button" onClick={() => downloadJson('训练饮食看板完整备份.json', dashboardState)}><Download size={16} />完整JSON备份</button></section><section className="import-section"><div className="section-heading"><div><h2>导入数据</h2><p>选择文件后自动识别表头；只有真正缺少必填数据时才需要手动映射。</p></div></div><div className="import-controls"><div className="import-options"><label>数据类型<select value={type} onChange={(event) => { setType(event.target.value as ImportType); setPreview(null); setStatus(''); setMapping({}) }}><option value="food">食物营养</option><option value="recipe">食谱</option><option value="body">身体记录</option><option value="training">历史训练</option></select></label><label>重复项处理<select value={duplicateMode} onChange={(event) => setDuplicateMode(event.target.value as DuplicateMode)}><option value="replace">覆盖原记录</option><option value="skip">跳过重复项</option><option value="merge">合并并保留原编号</option></select></label></div><label className="file-drop"><Upload size={22} /><strong>选择Excel或CSV</strong><span>{type === 'food' ? '单位列可省略，默认按每100克；支持kJ或kcal。' : `必填列：${requiredColumns[type].join('、')}`}</span><input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => onFile(event.target.files?.[0])} /></label></div>{status && <div className="notice success"><CheckCircle2 size={18} />{status}</div>}{preview && <div className="preview-section"><div className="mapping-explain"><strong>目标字段是什么？</strong><span>目标字段是系统保存的位置；来源列是你文件里的列。系统已自动识别{recognizedCount}项，通常无需再选。</span></div>{preview.errors.length > 0 && <div className="notice error"><AlertCircle size={18} /><div>{preview.errors.map((error) => <p key={error}>{error}</p>)}</div></div>}{missingFields.length > 0 ? <div className="notice error"><AlertCircle size={18} /><span>仍缺少：{missingFields.join('；')}。请在下方选择对应来源列。</span></div> : <div className="notice success"><CheckCircle2 size={18} /><span>必填数据已自动识别，可以直接确认导入。</span></div>}<div className="mapping-grid">{mappingFields.map((field) => <label key={field.id}>目标字段：{field.label}{!field.required && <small>（可选）</small>}<select value={mapping[field.id] || ''} onChange={(event) => setMapping((current) => ({ ...current, [field.id]: event.target.value }))}><option value="">{field.id === 'unit' ? '未提供时默认每100克' : '不导入这一项'}</option>{preview.headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="preview-header"><strong>预览前20行</strong><span>共读取{preview.rows.length}行</span></div><div className="table-scroll"><table><thead><tr>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 20).map((row, index) => <tr key={index}>{preview.headers.map((header) => <td key={header}>{String(row[header] ?? '')}</td>)}</tr>)}</tbody></table></div><div className="dialog-actions"><button className="button" onClick={() => setPreview(null)}>取消</button><button className="button primary" disabled={preview.errors.length > 0 || missingFields.length > 0} onClick={commit}><Upload size={16} />确认导入</button></div></div>}</section></div>
}

function validateNumbers(values: number[]) { if (values.some((value) => !Number.isFinite(value) || value < 0)) throw new Error('存在空值、非数字或负数营养数据。') }
function mergeByName<T extends { id: string; name: string }>(current: T[], incoming: T[], mode: DuplicateMode): T[] { return mergeRecords(current, incoming, (item) => item.name.trim().toLowerCase(), mode) }
function mergeByDate<T extends { id: string; date: string }>(current: T[], incoming: T[], mode: DuplicateMode): T[] { return mergeRecords(current, incoming, (item) => item.date, mode) }
function mergeRecords<T extends { id: string }>(current: T[], incoming: T[], key: (item: T) => string, mode: DuplicateMode): T[] { const next = [...current]; for (const item of incoming) { const index = next.findIndex((existing) => key(existing) === key(item)); if (index < 0) next.push(item); else if (mode === 'replace') next[index] = item; else if (mode === 'merge') next[index] = { ...next[index], ...item, id: next[index].id }; } return next }
function normalizeDate(value: unknown): string { if (value instanceof Date) return value.toISOString().slice(0, 10); const text = textValue(value); const date = new Date(text); if (Number.isNaN(date.getTime())) throw new Error(`日期格式无效：${text}`); return date.toISOString().slice(0, 10) }
