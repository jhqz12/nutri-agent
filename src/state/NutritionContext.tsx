import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { AppState as NutritionState } from '../nutritionTypes'
import { createInitialState, hasStoredNutritionState, loadState, saveState } from '../lib/nutritionStorage'
import { loadNutritionStateFromCloud, supabase, syncNutritionStateToCloud } from '../lib/supabase'
import { useAppState } from './AppContext'
import { getPlanForDate } from '../lib/trainingPlans'
import type { DayType } from '../nutritionTypes'

interface NutritionContextValue {
  state: NutritionState
  setState: React.Dispatch<React.SetStateAction<NutritionState>>
  restoreNutritionDefaults: () => void
}

const NutritionContext = createContext<NutritionContextValue | null>(null)

export function NutritionProvider({ children }: { children: ReactNode }) {
  const dashboard = useAppState().state
  const [state, setState] = useState<NutritionState>(() => loadState())
  const stateRef = useRef(state)
  const cloudReady = useRef(false)
  const authenticated = useRef(false)
  const hadLocalState = useRef(hasStoredNutritionState())

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    let active = true
    const hydrateFromCloud = async () => {
      if (!supabase) {
        cloudReady.current = true
        return
      }
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error
        authenticated.current = Boolean(data.session?.user)
        if (!authenticated.current) {
          cloudReady.current = true
          return
        }
        cloudReady.current = false
        const localState = stateRef.current
        const cloudState = await loadNutritionStateFromCloud()
        if (!active) return
        if (cloudState && (!hadLocalState.current || new Date(cloudState.updatedAt) > new Date(localState.updatedAt))) {
          stateRef.current = cloudState
          saveState(cloudState)
          setState(cloudState)
        } else {
          await syncNutritionStateToCloud({ ...localState, updatedAt: new Date().toISOString() })
        }
        cloudReady.current = true
      } catch {
        cloudReady.current = false
      }
    }
    void hydrateFromCloud()
    const { data } = supabase?.auth.onAuthStateChange((_event, session) => {
      authenticated.current = Boolean(session?.user)
      if (session?.user) window.setTimeout(() => void hydrateFromCloud(), 0)
      else cloudReady.current = false
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
    const todayPlan = getPlanForDate(
      dashboard.planDays,
      dashboard.trainingFrequency,
      dashboard.trainingCycleStartedAt,
      new Date(),
      dashboard.trainingCycleAnchor
    )
    const plannedDayType: DayType = todayPlan.isRestDay
      ? '休'
      : ['推', '拉', '腿'].includes(todayPlan.plan?.name ?? '')
        ? todayPlan.plan!.name as DayType
        : '推'
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        sex: dashboard.profile.sex === 'male' ? '男' : '女',
        age: dashboard.profile.age,
        heightCm: dashboard.profile.heightCm,
        weightKg: dashboard.profile.weightKg,
        bodyFatPercent: dashboard.profile.bodyFatPercent,
        trainingPattern: dashboard.trainingFrequency === '练一休一' ? '练1休1' : '练3休1',
        cycleStartDate: dashboard.trainingCycleAnchor.date,
        plannedDayType
      },
      bodyLogs: dashboard.bodyLogs.map((log) => ({
        id: log.id,
        date: log.date,
        weightKg: log.weightKg,
        waistCm: log.waistCm,
        systolic: log.systolic ?? null,
        diastolic: log.diastolic ?? null,
        trainingIntensity: Math.max(0, Math.min(10, log.energy)),
        calorieAdherence: log.dietAdherence
      }))
    }))
  }, [dashboard.bodyLogs, dashboard.planDays, dashboard.profile, dashboard.trainingCycleAnchor, dashboard.trainingCycleStartedAt, dashboard.trainingFrequency])

  useEffect(() => {
    const timestampedState = { ...state, updatedAt: new Date().toISOString() }
    saveState(timestampedState)
    const timer = window.setTimeout(() => {
      if (!cloudReady.current || !authenticated.current) return
      void syncNutritionStateToCloud(timestampedState).catch(() => {})
    }, 900)
    return () => window.clearTimeout(timer)
  }, [state])

  const value = useMemo<NutritionContextValue>(() => ({
    state,
    setState,
    restoreNutritionDefaults: () => setState(createInitialState())
  }), [state])

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>
}

export function useNutritionState(): NutritionContextValue {
  const value = useContext(NutritionContext)
  if (!value) throw new Error('useNutritionState必须在NutritionProvider中使用')
  return value
}
