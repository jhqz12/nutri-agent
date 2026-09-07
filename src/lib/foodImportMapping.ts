export type FoodImportTarget = 'name' | 'unit' | 'calories' | 'kilojoules' | 'protein' | 'fat' | 'carbs' | 'fiber' | 'sodium' | 'potassium' | 'calcium' | 'magnesium' | 'iron' | 'zinc' | 'selenium' | 'source'

export interface FoodImportField {
  id: FoodImportTarget
  label: string
  aliases: string[]
  required?: boolean
}

export const foodImportFields: FoodImportField[] = [
  { id: 'name', label: '食材名称', aliases: ['名称', '食材', '食物', '食品名称'], required: true },
  { id: 'unit', label: '计量单位', aliases: ['单位', '计量单位', '基准单位'] },
  { id: 'calories', label: '热量(kcal)', aliases: ['热量', '热量kcal', '能量kcal', '千卡', '大卡'] },
  { id: 'kilojoules', label: '能量(kJ)', aliases: ['能量kj', '热量kj', '千焦', '能量千焦'] },
  { id: 'protein', label: '蛋白质(g)', aliases: ['蛋白质', '蛋白质g', '蛋白', '蛋白g'] },
  { id: 'fat', label: '脂肪(g)', aliases: ['脂肪', '脂肪g', '总脂肪', '总脂肪g'] },
  { id: 'carbs', label: '碳水化合物(g)', aliases: ['碳水', '碳水g', '碳水化合物', '碳水化合物g'] },
  { id: 'fiber', label: '膳食纤维(g)', aliases: ['纤维', '纤维g', '膳食纤维', '膳食纤维g'] },
  { id: 'sodium', label: '钠(mg)', aliases: ['钠', '钠mg'] },
  { id: 'potassium', label: '钾(mg)', aliases: ['钾', '钾mg'] },
  { id: 'calcium', label: '钙(mg)', aliases: ['钙', '钙mg'] },
  { id: 'magnesium', label: '镁(mg)', aliases: ['镁', '镁mg'] },
  { id: 'iron', label: '铁(mg)', aliases: ['铁', '铁mg'] },
  { id: 'zinc', label: '锌(mg)', aliases: ['锌', '锌mg'] },
  { id: 'selenium', label: '硒(μg)', aliases: ['硒', '硒μg', '硒ug', '硒微克'] },
  { id: 'source', label: '数据来源', aliases: ['来源', '数据来源', '出处'] }
]

export function normalizeImportHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-（）()【】\[\]\/]/g, '').replace(/微克/g, 'μg').replace(/千焦/g, 'kj')
}

export function autoMapFoodColumns(headers: string[]): Record<FoodImportTarget, string> {
  const normalizedHeaders = headers.map((header) => ({ header, normalized: normalizeImportHeader(header) }))
  return Object.fromEntries(foodImportFields.map((field) => {
    const aliases = field.aliases.map(normalizeImportHeader)
    const exact = normalizedHeaders.find((entry) => aliases.includes(entry.normalized))
    const partial = exact ?? normalizedHeaders.find((entry) => aliases.some((alias) => entry.normalized.startsWith(alias)))
    return [field.id, partial?.header ?? '']
  })) as Record<FoodImportTarget, string>
}

export function missingFoodImportFields(mapping: Partial<Record<FoodImportTarget, string>>): string[] {
  const missing: string[] = []
  if (!mapping.name) missing.push('食材名称')
  const hasLabeledEnergy = Boolean(mapping.calories || mapping.kilojoules)
  const hasMacroEnergy = Boolean(mapping.protein && mapping.fat && mapping.carbs)
  if (!hasLabeledEnergy && !hasMacroEnergy) missing.push('热量(kcal)、能量(kJ)，或完整的蛋白质+脂肪+碳水')
  return missing
}
