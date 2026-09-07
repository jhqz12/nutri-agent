import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppState } from '../types'
import { hasStoredState, loadState, resetState, saveState } from '../lib/storage'
import { loadStateFromCloud, supabase, syncStateToCloud } from '../lib/supabase'

interface AppContextValue {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  syncStatus: '本地已保存' | '云端已同步' | '云同步失败'
  restoreDefaults: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState())
  const [syncStatus, setSyncStatus] = useState<AppContextValue['syncStatus']>('本地已保存')
  const hydrated = useRef(false)
  const authenticated = useRef(false)
  const stateRef = useRef(state)
  const hadLocalState = useRef(hasStoredState())

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let active = true
    const hydrateFromCloud = async () => {
      if (!supabase) {
        hydrated.current = true
        return
      }
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        authenticated.current = Boolean(data.session?.user)
        if (!authenticated.current) {
          hydrated.current = true
          return
        }
        hydrated.current = false
        const localState = stateRef.current
        const cloudState = await loadStateFromCloud()
        if (!active) return
        if (cloudState && (!hadLocalState.current || new Date(cloudState.lastUpdatedAt) > new Date(localState.lastUpdatedAt))) {
          stateRef.current = cloudState
          saveState(cloudState)
          setState(cloudState)
        } else {
          await syncStateToCloud({ ...localState, lastUpdatedAt: new Date().toISOString() })
        }
        hydrated.current = true
        setSyncStatus('云端已同步')
      } catch {
        hydrated.current = true
        setSyncStatus('云同步失败')
      }
    }
    void hydrateFromCloud()
    const { data } = supabase?.auth.onAuthStateChange((_event, session) => {
      authenticated.current = Boolean(session?.user)
      if (session?.user) window.setTimeout(() => void hydrateFromCloud(), 0)
      else setSyncStatus('本地已保存')
    }) ?? { data: null }
    const onVisible = () => {
      if (document.visibilityState === 'visible') void hydrateFromCloud()
    }
    window.addEventListener('focus', hydrateFromCloud)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      data?.subscription.unsubscribe()
      window.removeEventListener('focus', hydrateFromCloud)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    const timestampedState = { ...state, lastUpdatedAt: new Date().toISOString() }
    saveState(timestampedState)
    setSyncStatus('本地已保存')
    const timer = window.setTimeout(() => {
      if (!hydrated.current || !authenticated.current) return
      syncStateToCloud(timestampedState).then((synced) => setSyncStatus(synced ? '云端已同步' : '本地已保存')).catch(() => setSyncStatus('云同步失败'))
    }, 900)
    return () => window.clearTimeout(timer)
  }, [state])

  const value = useMemo<AppContextValue>(() => ({
    state,
    setState,
    syncStatus,
    restoreDefaults: () => setState(resetState())
  }), [state, syncStatus])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) throw new Error('useAppState必须在AppProvider中使用')
  return value
}
