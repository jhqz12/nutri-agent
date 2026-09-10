import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChartNoAxesCombined, Check, Database, Dumbbell, Palette, Settings, Utensils, X, type LucideIcon } from 'lucide-react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { TabId } from './types'
import { useAppState } from './state/AppContext'
import { TodayView } from './views/TodayView'
import { TrainingView } from './views/TrainingView'
import { NutritionView } from './views/NutritionView'
import { ProgressView } from './views/ProgressView'
import { DataView } from './views/DataView'
import { SettingsView } from './views/SettingsView'
import { Onboarding } from './views/Onboarding'

const navigation: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'today', label: '今日', icon: CalendarDays },
  { id: 'training', label: '训练', icon: Dumbbell },
  { id: 'nutrition', label: '饮食', icon: Utensils },
  { id: 'progress', label: '趋势', icon: ChartNoAxesCombined },
  { id: 'data', label: '数据', icon: Database },
  { id: 'settings', label: '设置', icon: Settings }
]

type ThemeId = 'forest' | 'lake' | 'sage' | 'violet' | 'blackGold'

const themes: Array<{ id: ThemeId; label: string; description: string; color: string }> = [
  { id: 'forest', label: '林雾薄荷', description: '安静清新，适合长期使用', color: '#5d9b87' },
  { id: 'lake', label: '海盐湖蓝', description: '清爽明亮，适合白天查看', color: '#5d94a5' },
  { id: 'sage', label: '晨光鼠尾草', description: '自然柔和，降低视觉刺激', color: '#879665' },
  { id: 'violet', label: '雾紫晚樱', description: '克制沉静，适合专注记录', color: '#8879a7' },
  { id: 'blackGold', label: '玄夜黑金', description: '沉稳低亮，适合夜间护眼查看', color: '#c7a65c' }
]

function readSavedTheme(): ThemeId {
  try {
    const saved = window.localStorage.getItem('hengdong-theme-v2')
    return themes.some((item) => item.id === saved) ? saved as ThemeId : 'forest'
  } catch {
    return 'forest'
  }
}

const pageTitles: Record<TabId, { title: string; subtitle: string }> = {
  today: { title: '今日安排', subtitle: '按身体状态完成今天，不为打卡牺牲动作质量。' },
  training: { title: '训练计划', subtitle: '记录每一组，下一次是否加重由清楚的规则判断。' },
  nutrition: { title: '饮食规划', subtitle: '在现实可买到的食物里，尽量接近全天目标。' },
  progress: { title: '身体趋势', subtitle: '看趋势，不被某一天的体重或体感带着走。' },
  data: { title: '数据管理', subtitle: '常用导入在前，专业六库与版本历史按需展开。' },
  settings: { title: '个人设置', subtitle: '目标可以调整，健康风险不会被自动忽略。' }
}

export function App() {
  const [tab, setTab] = useState<TabId>('today')
  const [theme, setTheme] = useState<ThemeId>(readSavedTheme)
  const [themeOpen, setThemeOpen] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const { state, syncStatus } = useAppState()
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    try { return window.localStorage.getItem('hengdong-onboarding-done') === '1' } catch { return false }
  })
  const profileEmpty = state.profile.age <= 0 || state.profile.heightCm <= 0 || state.profile.weightKg <= 0
  const showOnboarding = !onboardingDone && profileEmpty
  const finishOnboarding = () => {
    try { window.localStorage.setItem('hengdong-onboarding-done', '1') } catch { /* 忽略存储失败 */ }
    setOnboardingDone(true)
  }
  const heading = pageTitles[tab]
  const activeTheme = themes.find((item) => item.id === theme) ?? themes[0]

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme === 'blackGold' ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'blackGold' ? '#11110f' : '#2f6f5c')
    try {
      window.localStorage.setItem('hengdong-theme-v2', theme)
    } catch {
      // 浏览器禁止本地存储时，主题仍在当前页面生效。
    }
  }, [theme])

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.fromTo('.main-content > .view-stack > *',
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.36, stagger: 0.035, ease: 'power2.out' }
    )
  }, { scope: shellRef, dependencies: [tab], revertOnUpdate: true })

  return (
    <div className="app-shell" ref={shellRef} data-theme={theme}>
      <a className="skip-link" href="#main-content">跳转到主要内容</a>
      <aside className="sidebar" aria-label="主导航">
        <div className="brand-mark" aria-label="训练与饮食看板">
          <span className="brand-symbol">衡</span>
          <span className="brand-copy"><strong>衡动</strong><small>训练 · 饮食 · 恢复</small></span>
        </div>
        <nav className="nav-list">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? 'nav-item is-active' : 'nav-item'} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon size={18} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sync-status"><span className="status-dot" />{syncStatus}</div>
          <button className="theme-trigger sidebar-theme-trigger" onClick={() => setThemeOpen((open) => !open)} aria-expanded={themeOpen} aria-controls="theme-panel">
            <Palette size={16} aria-hidden="true" /><span>主题</span><span className="theme-current-dot" style={{ background: activeTheme.color }} />
          </button>
        </div>
      </aside>

      <main id="main-content" className="main-content" tabIndex={-1}>
        <header className="page-header">
          <div><h1>{heading.title}</h1><p>{heading.subtitle}</p></div>
          <div className="page-header-tools">
            <span className="date-label">{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date())}</span>
            <button className="theme-trigger header-theme-trigger" title="切换主题" onClick={() => setThemeOpen((open) => !open)} aria-expanded={themeOpen} aria-controls="theme-panel">
              <Palette size={16} aria-hidden="true" /><span>{activeTheme.label}</span>
            </button>
          </div>
        </header>
        {themeOpen && <section className="theme-panel" id="theme-panel" aria-label="主题风格选择">
          <div className="theme-panel-heading"><div><strong>选择工作台颜色</strong><p>只改变外观，不会修改训练、饮食或身体数据。</p></div><button className="icon-button" onClick={() => setThemeOpen(false)} aria-label="关闭主题选择"><X size={16} /></button></div>
          <div className="theme-options">{themes.map((item) => <button key={item.id} className={theme === item.id ? 'theme-option is-selected' : 'theme-option'} onClick={() => { setTheme(item.id); setThemeOpen(false) }}><span className="theme-swatch" style={{ background: item.color }} /><span><strong>{item.label}</strong><small>{item.description}</small></span>{theme === item.id && <Check size={16} aria-hidden="true" />}</button>)}</div>
        </section>}
        {tab === 'today' && <TodayView />}
        {tab === 'training' && <TrainingView />}
        {tab === 'nutrition' && <NutritionView />}
        {tab === 'progress' && <ProgressView />}
        {tab === 'data' && <DataView />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <nav className="mobile-nav" aria-label="移动端主导航">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)} aria-label={label}>
            <Icon size={19} aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
      </nav>

      {showOnboarding && <Onboarding onFinish={finishOnboarding} />}
    </div>
  )
}
