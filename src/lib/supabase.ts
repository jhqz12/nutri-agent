import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AppState } from '../types'
import type { AppState as NutritionState } from '../nutritionTypes'
import { migrateNutritionState } from './nutritionStorage'
import { migrateState } from './storage'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function getAuthRedirectUrl() {
  return 'https://jhqz12.github.io/nutri-agent-auth/'
}

export async function sendMagicLink(email: string): Promise<string> {
  if (!supabase) return '尚未配置Supabase，当前使用本地模式。'
  const normalizedEmail = normalizeEmail(email)
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('请输入正确的邮箱地址。')
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: true, emailRedirectTo: getAuthRedirectUrl() }
  })
  if (error) throw error
  return '登录邮件已发送。请在当前设备的常用浏览器打开最新邮件，登录页会进入最新版并读取同一账号的云端数据。'
}

export async function syncStateToCloud(state: AppState): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  if (!data.user) return false
  const { error } = await supabase.from('dashboard_state').upsert({
    user_id: data.user.id,
    state,
    updated_at: new Date().toISOString()
  })
  if (error) throw error
  return true
}

export async function loadStateFromCloud(): Promise<AppState | null> {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase.from('dashboard_state').select('state').eq('user_id', auth.user.id).maybeSingle()
  if (error) throw error
  return data?.state ? migrateState(data.state as Partial<AppState>) : null
}

export async function syncNutritionStateToCloud(state: NutritionState): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  if (!data.user) return false
  const { error } = await supabase.from('nutrition_state').upsert({
    user_id: data.user.id,
    state,
    updated_at: new Date().toISOString()
  })
  if (error) throw error
  return true
}

export async function loadNutritionStateFromCloud(): Promise<NutritionState | null> {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase.from('nutrition_state').select('state').eq('user_id', auth.user.id).maybeSingle()
  if (error) throw error
  return data?.state ? migrateNutritionState(data.state as Partial<NutritionState>) : null
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const decoded = window.atob(base64)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
  return bytes.buffer
}

export async function registerPushSubscription(): Promise<string> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return '当前浏览器不支持后台推送，将使用站内提醒。'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return '通知权限未开启，将使用站内提醒。'
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!publicKey || !supabase) return '通知权限已开启；配置云端推送密钥后可接收后台提醒。'
  const { data } = await supabase.auth.getUser()
  if (!data.user) return '请先完成邮箱登录，再启用跨设备后台提醒。'
  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(publicKey)
  })
  const { error } = await supabase.from('notification_subscriptions').upsert({
    user_id: data.user.id,
    endpoint: subscription.endpoint,
    subscription: subscription.toJSON(),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,endpoint' })
  if (error) throw error
  return '后台提醒已启用。'
}
