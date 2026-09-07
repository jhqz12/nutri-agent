import type { ImportPreview } from '../types'
import readExcelFile from 'read-excel-file/browser'
import writeExcelFile from 'write-excel-file/browser'

export async function parseSpreadsheet(file: File): Promise<ImportPreview> {
  if (file.size > 10 * 1024 * 1024) return { headers: [], rows: [], errors: ['文件超过10MB限制。'] }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return { headers: [], rows: [], errors: ['仅支持Excel或CSV文件。'] }
  try {
    const rawRows = file.name.toLowerCase().endsWith('.csv')
      ? parseCsv(await file.text())
      : await parseExcel(file)
    if (!rawRows.length) return { headers: [], rows: [], errors: ['工作表没有可导入的数据。'] }
    const headers = rawRows[0].map((value) => String(value ?? '').trim())
    const rows = rawRows.slice(1).filter((row) => row.some((value) => String(value ?? '').trim() !== '')).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])))
    if (!rows.length) return { headers: [], rows: [], errors: ['工作表没有可导入的数据。'] }
    const duplicated = headers.filter((header, index) => headers.indexOf(header) !== index)
    const errors = duplicated.length ? [`发现重复列：${duplicated.join('、')}`] : []
    return { headers, rows: rows.slice(0, 5000), errors }
  } catch (error) {
    return { headers: [], rows: [], errors: [`文件解析失败：${error instanceof Error ? error.message : '未知错误'}`] }
  }
}

export async function downloadWorkbook(filename: string, sheets: Record<string, Record<string, unknown>[]>): Promise<void> {
  const workbookSheets = Object.entries(sheets).map(([name, rows]) => {
    const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
    const data = [headers, ...rows.map((row) => headers.map((header) => normalizeCell(row[header])))]
    return { data, sheet: name.slice(0, 31), stickyRowsCount: 1 }
  })
  await writeExcelFile(workbookSheets).toFile(filename)
}

export function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const escape = (value: unknown) => {
    const text = String(value ?? '')
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const content = '\uFEFF' + [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\r\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function textValue(value: unknown): string {
  return String(value ?? '').trim()
}

async function parseExcel(file: File): Promise<unknown[][]> {
  const sheets = await readExcelFile(file)
  return (sheets[0]?.data ?? []) as unknown[][]
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const input = text.replace(/^\uFEFF/, '')
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"' && quoted && input[index + 1] === '"') {
      cell += '"'
      index += 1
    } else if (character === '"') {
      quoted = !quoted
    } else if (character === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      row.push(cell)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += character
    }
  }
  row.push(cell)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

function normalizeCell(value: unknown): string | number | boolean | Date | null {
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (value === null || value === undefined) return null
  return JSON.stringify(value)
}
