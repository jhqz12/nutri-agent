import type { MealCategory, Recipe } from '../types'

export type ParsedRecipe = Omit<Recipe, 'id'>

export interface ParsedRecipeText {
  recipes: ParsedRecipe[]
  warnings: string[]
}

const categories: MealCategory[] = ['早餐', '午餐', '晚餐', '日间加餐']
const categoryAliases: Record<string, MealCategory> = { 食堂: '午餐', 外食: '晚餐', 加餐: '日间加餐' }

function readNumber(line: string, label: string, unit = ''): number | null {
  const labeled = line.match(new RegExp(`(?:${label})\\s*[:：]?\\s*(\\d+(?:\\.\\d+)?)\\s*(?:${unit})?`, 'i'))
  if (labeled) return Number(labeled[1])
  if (!unit) return null
  const unitOnly = line.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unit})`, 'i'))
  return unitOnly ? Number(unitOnly[1]) : null
}

function readField(line: string, label: string, nextLabels: string): string {
  const match = line.match(new RegExp(`(?:${label})\\s*[:：]\\s*(.+?)(?=(?:[,，;；|｜]\\s*)?(?:${nextLabels})\\s*[:：]|$)`, 'i'))
  return match?.[1]?.trim().replace(/^[,，;；|｜\s]+|[,，;；|｜\s]+$/g, '') ?? ''
}

function readCategory(line: string): MealCategory {
  const labeled = line.match(/(?:餐别|类别)\s*[:：]?\s*(早餐|午餐|晚餐|日间加餐|食堂|外食|加餐)/)
  if (labeled) return categoryAliases[labeled[1]] ?? labeled[1] as MealCategory
  const direct = categories.find((category) => new RegExp(`(?:^|[,，;；|｜\\s])${category}(?:$|[,，;；|｜\\s])`).test(line))
  if (direct) return direct
  const alias = Object.keys(categoryAliases).find((category) => new RegExp(`(?:^|[,，;；|｜\\s])${category}(?:$|[,，;；|｜\\s])`).test(line))
  return alias ? categoryAliases[alias] : '晚餐'
}

function readName(line: string): string {
  const explicit = readField(line, '名称|食谱名称', '餐别|类别|食材|配料|每份|热量|能量|蛋白质?|脂肪|碳水(?:化合物)?|价格|来源')
  if (explicit) return explicit.slice(0, 50)
  return line
    .split(/(?:餐别|类别|食材|配料|每份|热量|能量|蛋白质?|脂肪|碳水(?:化合物)?|价格|来源)\s*[:：]/i)[0]
    .split(/[|｜,，;；]/)[0]
    .trim()
    .slice(0, 50)
}

export function parseRecipeText(text: string): ParsedRecipeText {
  const recipes: ParsedRecipe[] = []
  const warnings: string[] = []
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

  lines.forEach((originalLine, index) => {
    if (/^(https?:\/\/|#+\s|名称[|｜,，;；])|^(食谱|菜谱)\s*$/.test(originalLine)) return
    const line = originalLine.replace(/^[-*•]\s*/, '').replace(/^\d+[.、)]\s*/, '')
    const name = readName(line)
    const calories = readNumber(line, '热量|能量', 'kcal|千卡|大卡')
    const protein = readNumber(line, '蛋白质?|蛋白')
    const fat = readNumber(line, '脂肪')
    const carbs = readNumber(line, '碳水(?:化合物)?')
    const missing = [
      ['热量', calories],
      ['蛋白质', protein],
      ['脂肪', fat],
      ['碳水', carbs]
    ].filter(([, value]) => value === null).map(([label]) => label)

    if (name.length < 2) {
      warnings.push(`第${index + 1}行缺少食谱名称。`)
      return
    }
    if (missing.length) {
      warnings.push(`第${index + 1}行“${name}”缺少：${missing.join('、')}。`)
      return
    }
    if (![calories, protein, fat, carbs].every((value) => Number.isFinite(value) && value !== null && value >= 0) || calories === 0) {
      warnings.push(`第${index + 1}行“${name}”的营养数值无效。`)
      return
    }

    const ingredients = readField(line, '食材|配料', '每份|热量|能量|蛋白质?|脂肪|碳水(?:化合物)?|价格|来源|餐别|类别')
    const servingLabel = readField(line, '每份(?:说明)?', '热量|能量|蛋白质?|脂肪|碳水(?:化合物)?|价格|来源|餐别|类别')
    const price = readField(line, '价格(?:范围)?', '来源|餐别|类别')
    const source = readField(line, '来源', '餐别|类别')

    recipes.push({
      name,
      category: readCategory(line),
      ingredients: ingredients || '食材待补充',
      servingLabel: servingLabel || '1份',
      calories: calories as number,
      protein: protein as number,
      fat: fat as number,
      carbs: carbs as number,
      price: price || '未知',
      source: source || '文字识别导入'
    })
  })

  if (!recipes.length && text.trim() && !warnings.length) warnings.push('没有识别到食谱，请按“一行一个食谱”重新整理。')
  return { recipes, warnings }
}
