import type {
  AiProvider, BodyLog, CoachBasis, CoachPlanSuggestion, CoachRiskLevel,
  PlanDay, Profile, WorkoutSession
} from '../types'
import { supabase } from './supabase'

export interface AiConnectionStatus {
  configured: boolean
  provider: AiProvider | null
  model: string
  updatedAt: string | null
}

export interface AiConnectionDraft {
  provider: AiProvider
  model: string
  apiKey?: string
}

export interface CoachContextPayload {
  profile?: Pick<Profile, 'age' | 'sex' | 'heightCm' | 'weightKg' | 'targetWeightKg'>
  planDays?: PlanDay[]
  sessions?: WorkoutSession[]
  bodyLogs?: BodyLog[]
}

export interface CoachReply {
  answer: string
  basis: CoachBasis
  riskLevel: CoachRiskLevel
  suggestions: CoachPlanSuggestion[]
}

interface FunctionResult<T> {
  ok: boolean
  data?: T
  error?: string
}

const aiRequestTimeoutMs = 40_000

export function getReadableAiMessage(value: unknown, fallback: string): string {
  const direct = typeof value === 'string' ? value.trim() : ''
  if (direct && direct !== '{}' && direct !== '[object Object]') return direct
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['message', 'error', 'msg', 'details', 'reason']) {
      const nested = typeof record[key] === 'string' ? record[key].trim() : ''
      if (nested && nested !== '{}' && nested !== '[object Object]') return nested
    }
  }
  return fallback
}

export async function getAiFunctionErrorMessage(error: unknown): Promise<string> {
  const candidate = error && typeof error === 'object'
    ? error as { message?: unknown; context?: { status?: number; clone?: () => { status?: number; json?: () => Promise<unknown> } } }
    : null
  const response = candidate?.context?.clone?.()
  const status = Number(response?.status ?? candidate?.context?.status ?? 0)
  let responseMessage = ''
  try {
    const payload = await response?.json?.() as { error?: unknown; message?: unknown; msg?: unknown } | undefined
    const value = payload?.error ?? payload?.message ?? payload?.msg
    if (typeof value === 'string') responseMessage = value.trim()
  } catch {
    // 网关响应不一定是JSON，继续使用状态码给出可执行提示。
  }
  if (status === 401 || /invalid jwt|jwt expired|unauthorized/i.test(responseMessage)) {
    return '云端登录令牌未通过验证，请刷新页面；仍失败时请重新进行邮箱登录。'
  }
  if (status === 404) return 'AI云函数尚未正确发布，请稍后重试。'
  if (status >= 500) return 'AI云函数暂时不可用，请稍后重试。'
  if (responseMessage) return getReadableAiMessage(responseMessage, 'AI教练后端连接失败，请重新读取状态后再试。')
  return getReadableAiMessage(candidate?.message, 'AI教练后端连接失败，请重新读取状态后再试。')
}

async function invokeCoach<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('当前站点尚未配置Supabase，暂时不能使用AI教练。')
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) throw new Error('请先在设置页完成邮箱登录，再配置AI教练。')
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), aiRequestTimeoutMs)
  try {
    const { data, error } = await supabase.functions.invoke<FunctionResult<T>>('ai-coach', {
      body,
      signal: controller.signal
    })
    if (controller.signal.aborted) throw new Error('AI连接等待超过40秒，请检查网络后重试。')
    if (error) throw new Error(await getAiFunctionErrorMessage(error))
    if (!data?.ok || data.data === undefined) {
      throw new Error(getReadableAiMessage(data?.error, 'AI教练返回了无法识别的结果。'))
    }
    return data.data
  } catch (error) {
    if (controller.signal.aborted) throw new Error('AI连接等待超过40秒，请检查网络后重试。')
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

export function getAiConnectionStatus(): Promise<AiConnectionStatus> {
  return invokeCoach<AiConnectionStatus>({ action: 'status' })
}

export function saveAiConnection(draft: AiConnectionDraft): Promise<AiConnectionStatus> {
  return invokeCoach<AiConnectionStatus>({ action: 'save-config', ...draft })
}

export function testAiConnection(): Promise<{ message: string }> {
  return invokeCoach<{ message: string }>({ action: 'test' })
}

export function askAiCoach(input: {
  question: string
  context: CoachContextPayload
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<CoachReply> {
  return invokeCoach<CoachReply>({ action: 'chat', ...input })
}

export interface MenuOptimizationInput {
  menu: Array<{ foodId: string; meal: string; amount: number; unit: string }>
  foods: Array<{ id: string; name: string; category?: string; gramsPerUnit?: number; calories: number; protein: number | null; fat: number | null; carbs: number | null; fiber: number | null }>
  target: { calories: number; protein: number; fat: number; carbs: number }
  mealRules: Array<{ meal: string; minPercent: number; targetPercent: number; maxPercent: number }>
}

export interface MenuOptimizationResult {
  menu: Array<{ foodId: string; meal: '早餐' | '午餐' | '晚餐' | '日间加餐' | '坚果'; amount: number; unit: 'g' }>
  summary: string
  changes: string[]
}

export function optimizeMenuWithAi(input: MenuOptimizationInput): Promise<MenuOptimizationResult> {
  return invokeCoach<MenuOptimizationResult>({ action: 'optimize-menu', ...input })
}

