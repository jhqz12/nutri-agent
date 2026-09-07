import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'
import { buildCoachSystemPrompt } from './coach-prompt.ts'

type Provider = 'deepseek' | 'openai'

interface StoredConfig {
  provider: Provider
  model: string
  encryptedApiKey: string
  updatedAt: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const bucketName = 'ai-coach-private'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  })
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

async function encryptionKey() {
  const secret = Deno.env.get('AI_CONFIG_ENCRYPTION_KEY_V2')
  if (!secret || secret.length < 32) throw new Error('服务端加密密钥尚未配置。')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptApiKey(apiKey: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    new TextEncoder().encode(apiKey)
  )
  return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(encrypted))}`
}

async function decryptApiKey(value: string) {
  const [ivValue, encryptedValue] = value.split('.')
  if (!ivValue || !encryptedValue) throw new Error('已保存的API密钥格式无效。')
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(ivValue) },
    await encryptionKey(),
    base64ToBytes(encryptedValue)
  )
  return new TextDecoder().decode(decrypted)
}

async function ensureBucket(serviceClient: ReturnType<typeof createClient>) {
  const { data } = await serviceClient.storage.getBucket(bucketName)
  if (data) return
  const { error } = await serviceClient.storage.createBucket(bucketName, { public: false, fileSizeLimit: 16384 })
  if (error && !/already exists/i.test(error.message)) throw error
}

function serviceErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() && error.message.trim() !== '{}') return error.message.trim()
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    for (const key of ['message', 'error', 'details', 'reason']) {
      const value = typeof record[key] === 'string' ? record[key].trim() : ''
      if (value && value !== '{}' && value !== '[object Object]') return value
    }
  }
  return fallback
}

async function loadConfig(serviceClient: ReturnType<typeof createClient>, userId: string): Promise<StoredConfig | null> {
  await ensureBucket(serviceClient)
  const storage = serviceClient.storage.from(bucketName)
  const { data: files, error: listError } = await storage.list(userId, { limit: 10, search: 'config.json' })
  if (listError) throw new Error(`读取AI配置目录失败：${serviceErrorMessage(listError, '云端存储暂时不可用。')}`)
  if (!files?.some((file) => file.name === 'config.json')) return null
  const { data, error } = await storage.download(`${userId}/config.json`)
  if (error) throw new Error(`读取已保存的AI配置失败：${serviceErrorMessage(error, '配置文件暂时无法读取。')}`)
  return JSON.parse(await data.text()) as StoredConfig
}

async function saveConfig(serviceClient: ReturnType<typeof createClient>, userId: string, config: StoredConfig) {
  await ensureBucket(serviceClient)
  const { error } = await serviceClient.storage.from(bucketName).upload(
    `${userId}/config.json`,
    new Blob([JSON.stringify(config)], { type: 'application/json' }),
    { upsert: true, contentType: 'application/json' }
  )
  if (error) throw new Error(`保存AI配置失败：${serviceErrorMessage(error, '云端存储暂时不可用。')}`)
}

function statusOf(config: StoredConfig | null) {
  return {
    configured: Boolean(config),
    provider: config?.provider ?? null,
    model: config?.model ?? '',
    updatedAt: config?.updatedAt ?? null
  }
}

function readProvider(value: unknown): Provider {
  if (value === 'deepseek' || value === 'openai') return value
  throw new Error('请选择DeepSeek或OpenAI。')
}

function readModel(value: unknown) {
  const model = typeof value === 'string' ? value.trim() : ''
  if (!/^[A-Za-z0-9._:-]{2,80}$/.test(model)) {
    throw new Error('模型名称只能包含字母、数字、点、横线、下划线或冒号。')
  }
  return model
}

async function callProvider(config: StoredConfig, apiKey: string, systemPrompt: string, userInput: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30000)
  const providerName = config.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'
  try {
    if (config.provider === 'deepseek') {
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userInput }],
          response_format: { type: 'json_object' },
          stream: false,
          max_tokens: 1800
        })
      })
      const responseText = await response.text()
      let payload: { error?: { message?: string } | string; choices?: Array<{ message?: { content?: string } }> } = {}
      try { payload = JSON.parse(responseText) } catch { /* 非JSON响应由状态码解释。 */ }
      if (!response.ok) {
        const apiMessage = typeof payload.error === 'string' ? payload.error.trim() : payload.error?.message?.trim() ?? ''
        if (response.status === 401) throw new Error('DeepSeek API密钥无效或已失效，请在DeepSeek平台重新生成后再试。')
        if (response.status === 402) throw new Error('DeepSeek账户余额不足，请充值后再试。')
        if (response.status === 404) throw new Error(`DeepSeek模型“${config.model}”不可用，请改为deepseek-v4-flash或deepseek-v4-pro。`)
        if (response.status === 429) throw new Error('DeepSeek请求过于频繁或额度受限，请稍后再试。')
        if (response.status >= 500) throw new Error('DeepSeek官方接口暂时不可用，请稍后再试。')
        throw new Error(apiMessage || `DeepSeek请求失败（${response.status}），请核对模型名称和账号权限。`)
      }
      return String(payload?.choices?.[0]?.message?.content ?? '')
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: config.model,
        instructions: systemPrompt,
        input: userInput,
        max_output_tokens: 1800
      })
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error?.message || `OpenAI请求失败（${response.status}）`)
    if (typeof payload.output_text === 'string') return payload.output_text
    const text = payload.output?.flatMap((item: { content?: Array<{ type?: string; text?: string }> }) => item.content ?? [])
      .find((item: { type?: string; text?: string }) => item.type === 'output_text')?.text
    return String(text ?? '')
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${providerName}接口30秒内没有响应，请检查网络或稍后重试。`)
    }
    if (error instanceof TypeError) throw new Error(`${providerName}接口网络连接失败，请稍后重试。`)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function hasRedFlag(context: Record<string, unknown>) {
  const serialized = JSON.stringify(context)
  return /"numbness":true|"electricShock":true|"weakness":true|"nextDayWorse":true|"pain":(?:[3-9]|10)/.test(serialized)
}

function parseReply(raw: string, context: Record<string, unknown>) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    parsed = { answer: cleaned, basis: '框架推断', riskLevel: '谨慎', suggestions: [] }
  }
  const planDays = Array.isArray(context.planDays) ? context.planDays as Array<Record<string, unknown>> : []
  const exerciseMap = new Map<string, { planId: string; exercise: Record<string, unknown> }>()
  for (const plan of planDays) {
    if (!Array.isArray(plan.exercises)) continue
    for (const exercise of plan.exercises as Array<Record<string, unknown>>) {
      if (typeof exercise.id === 'string' && typeof plan.id === 'string') {
        exerciseMap.set(exercise.id, { planId: plan.id, exercise })
      }
    }
  }
  const redFlag = hasRedFlag(context)
  const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const item = candidate as Record<string, unknown>
    const exerciseId = typeof item.exerciseId === 'string' ? item.exerciseId : ''
    const match = exerciseMap.get(exerciseId)
    if (!match) return []
    const inputChanges = item.changes && typeof item.changes === 'object'
      ? item.changes as Record<string, unknown>
      : {}
    const changes: Record<string, number> = {}
    const sets = Number(inputChanges.sets)
    const minReps = Number(inputChanges.minReps)
    const maxReps = Number(inputChanges.maxReps)
    const weightKg = Number(inputChanges.weightKg)
    if (Number.isInteger(sets) && sets >= 1 && sets <= 10) changes.sets = sets
    if (Number.isInteger(minReps) && minReps >= 1 && minReps <= 50) changes.minReps = minReps
    if (Number.isInteger(maxReps) && maxReps >= 1 && maxReps <= 50) changes.maxReps = maxReps
    if (changes.minReps && changes.maxReps && changes.maxReps < changes.minReps) return []
    const currentWeight = Number(match.exercise.weightKg)
    const maxAllowed = currentWeight > 0 ? currentWeight * 1.05 + 0.001 : 0
    if (
      Number.isFinite(weightKg) && weightKg >= 0 && weightKg <= maxAllowed &&
      !(redFlag && weightKg > currentWeight)
    ) changes.weightKg = weightKg
    if (!Object.keys(changes).length) return []
    return [{
      id: crypto.randomUUID(),
      planId: match.planId,
      exerciseId,
      exerciseName: String(match.exercise.name ?? item.exerciseName ?? '未命名动作'),
      reason: String(item.reason ?? '基于当前记录生成的计划草案。').slice(0, 300),
      changes
    }]
  })
  const allowedBasis = ['公开计划', '框架推断', '科学边界']
  const allowedRisk = ['正常', '谨慎', '停止并评估']
  return {
    answer: String(parsed.answer ?? (cleaned || '模型没有返回可显示的回答。')).slice(0, 12000),
    basis: allowedBasis.includes(String(parsed.basis)) ? parsed.basis : '框架推断',
    riskLevel: redFlag
      ? '停止并评估'
      : allowedRisk.includes(String(parsed.riskLevel)) ? parsed.riskLevel : '谨慎',
    suggestions: redFlag
      ? suggestions.filter((item) => !('weightKg' in item.changes))
      : suggestions
  }
}


type OptimizedMeal = '早餐' | '午餐' | '晚餐' | '日间加餐' | '坚果'

function parseMenuOptimization(raw: string, foods: Array<Record<string, unknown>>) {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    throw new Error('AI返回的菜单格式无法识别，请重新优化一次。')
  }
  const validFoodIds = new Set(foods.map((food) => String(food.id ?? '')).filter(Boolean))
  const allowedMeals = new Set<OptimizedMeal>(['早餐', '午餐', '晚餐', '日间加餐', '坚果'])
  const candidates = Array.isArray(parsed.menu) ? parsed.menu : []
  const merged = new Map<string, { foodId: string; meal: OptimizedMeal; amount: number; unit: 'g' }>()
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const item = candidate as Record<string, unknown>
    const foodId = String(item.foodId ?? '')
    const meal = String(item.meal ?? '') as OptimizedMeal
    const amount = Number(item.amount)
    if (!validFoodIds.has(foodId) || !allowedMeals.has(meal) || !Number.isFinite(amount) || amount <= 0 || amount > 2000) continue
    const key = `${meal}:${foodId}`
    const current = merged.get(key)
    const safeAmount = Math.round(amount * 10) / 10
    if (current) current.amount = Math.round((current.amount + safeAmount) * 10) / 10
    else merged.set(key, { foodId, meal, amount: safeAmount, unit: 'g' })
  }
  const menu = [...merged.values()]
  if (!menu.length) throw new Error('AI没有返回可用的食材克重，请重新优化或手动调整。')
  const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim().slice(0, 500)
    : '已根据当前目标和食材库生成一份可审核的菜单草案。'
  const changes = (Array.isArray(parsed.changes) ? parsed.changes : [])
    .map((item) => String(item).trim()).filter(Boolean).slice(0, 12)
  return { menu, summary, changes }
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: '仅支持POST请求。' }, 405)
  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization) return jsonResponse({ ok: false, error: '请先登录。' }, 401)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } }
    })
    const { data: auth, error: authError } = await userClient.auth.getUser()
    if (authError || !auth.user) return jsonResponse({ ok: false, error: '登录状态已失效，请重新登录。' }, 401)
    const serviceClient = createClient(supabaseUrl, serviceRoleKey)
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action ?? '')
    const existing = await loadConfig(serviceClient, auth.user.id)

    if (action === 'status') return jsonResponse({ ok: true, data: statusOf(existing) })
    if (action === 'save-config') {
      const provider = readProvider(body.provider)
      const model = readModel(body.model)
      const suppliedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
      if ((!existing || existing.provider !== provider) && suppliedKey.length < 12) {
        throw new Error('首次配置或切换服务商时必须填写新的API密钥。')
      }
      if (suppliedKey && suppliedKey.length > 400) throw new Error('API密钥长度异常。')
      const config: StoredConfig = {
        provider,
        model,
        encryptedApiKey: suppliedKey ? await encryptApiKey(suppliedKey) : existing?.encryptedApiKey ?? '',
        updatedAt: new Date().toISOString()
      }
      await saveConfig(serviceClient, auth.user.id, config)
      return jsonResponse({ ok: true, data: statusOf(config) })
    }

    if (!existing) throw new Error('请先在设置页配置AI服务商、模型和API密钥。')
    const apiKey = await decryptApiKey(existing.encryptedApiKey)
    if (action === 'test') {
      const result = await callProvider(
        existing,
        apiKey,
        '只用简体中文返回一个JSON对象：{"answer":"连接成功"}',
        '测试连接'
      )
      if (!result.trim()) throw new Error('模型连接成功，但没有返回内容。')
      return jsonResponse({
        ok: true,
        data: { message: `${existing.provider === 'deepseek' ? 'DeepSeek' : 'OpenAI'} · ${existing.model} 连接成功。` }
      })
    }


    if (action === 'optimize-menu') {
      const menu = Array.isArray(body.menu) ? body.menu.slice(0, 80) : []
      const foods = Array.isArray(body.foods) ? body.foods.slice(0, 300) as Array<Record<string, unknown>> : []
      if (!menu.length) throw new Error('当前没有可优化的菜单。')
      if (!foods.length) throw new Error('当前食材库为空，无法生成优化建议。')
      const requestPayload = {
        menu,
        foods,
        target: body.target && typeof body.target === 'object' ? body.target : {},
        mealRules: Array.isArray(body.mealRules) ? body.mealRules : []
      }
      if (JSON.stringify(requestPayload).length > 120000) throw new Error('菜单或食材数据过多，请精简后重试。')
      const raw = await callProvider(
        existing,
        apiKey,
        '你是饮食菜单优化助手。只使用用户提供的食材ID，只返回一个JSON对象，结构必须是：{"menu":[{"foodId":"原ID","meal":"早餐或午餐或晚餐或日间加餐或坚果","amount":36,"unit":"g"}],"summary":"一句总结","changes":["具体修改及理由"]}。所有份量以克为唯一计算单位。优先让总热量和蛋白质接近目标，并兼顾每餐热量范围；同餐同食材合并；每餐通常一种主食和一至两种蛋白质；鸡蛋自动建议最多4个；杯装酸奶优先使用完整杯克重；不要生成小于1克的食物；不要虚构食材或修改食材资料。只生成建议，不声称已应用。',
        JSON.stringify(requestPayload)
      )
      return jsonResponse({ ok: true, data: parseMenuOptimization(raw, foods) })
    }
    if (action === 'chat') {
      const question = typeof body.question === 'string' ? body.question.trim() : ''
      if (!question || question.length > 4000) throw new Error('问题不能为空，且不能超过4000字。')
      const context = body.context && typeof body.context === 'object'
        ? body.context as Record<string, unknown>
        : {}
      if (JSON.stringify(context).length > 120000) throw new Error('附带的训练数据过多，请减少历史记录后重试。')
      const history = Array.isArray(body.history)
        ? body.history.slice(-10).map((item) => ({
            role: item?.role === 'assistant' ? 'assistant' : 'user',
            content: String(item?.content ?? '').slice(0, 3000)
          }))
        : []
      const systemPrompt = buildCoachSystemPrompt(question, history.length > 0)
      const raw = await callProvider(
        existing,
        apiKey,
        systemPrompt,
        JSON.stringify({ question, context, recentConversation: history })
      )
      return jsonResponse({ ok: true, data: parseReply(raw, context) })
    }
    throw new Error('未知的AI教练操作。')
  } catch (error) {
    const message = error instanceof Error
      ? error.name === 'AbortError' ? '模型响应超时，请稍后重试。' : error.message
      : 'AI教练服务发生未知错误。'
    return jsonResponse({ ok: false, error: message })
  }
})

