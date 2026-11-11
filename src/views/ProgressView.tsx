import { useEffect, useMemo, useState } from 'react'
import { Activity, Camera, ImagePlus, Plus, Save, Scale, Timer, TrendingDown, Utensils, X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppState } from '../state/AppContext'
import type { BodyLog } from '../types'
import { createId } from '../lib/ids'
import {
  calculateAppetite, calculateCheatMeals, calculateFeedbackCounts, calculateTrainingDuration,
  calculateWeightTrend, formatMinutes, formatSigned
} from '../lib/bodyMetrics'
import { compressImage, deletePhoto, loadPhoto, savePhoto } from '../lib/photoStore'

function movingAverage(values: BodyLog[], index: number): number {
  const slice = values.slice(Math.max(0, index - 6), index + 1)
  return Number((slice.reduce((sum, item) => sum + item.weightKg, 0) / slice.length).toFixed(2))
}

const emptyBodyLog: Omit<BodyLog, 'id'> = {
  date: new Date().toISOString().slice(0, 10), weightKg: 0, waistCm: 0, sleepHours: 7,
  steps: 5000, cyclingMinutes: 40, energy: 5, backDiscomfort: 5, numbnessEvents: 0,
  trainingVolume: 0, dietAdherence: 80, morningState: 3, sleepQuality: 3, mood: '',
  appetiteStability: 3, cheatMeal: false, cheatMealNote: '', fastingPhotoId: null
}

/** 表单里的数值字段。小数类给手机弹小数点键盘，其余给纯数字键盘。 */
const NUMERIC_FIELDS = [
  ['weightKg', '空腹体重 kg', 'decimal'],
  ['waistCm', '腰围 cm', 'decimal'],
  ['sleepHours', '睡眠小时', 'decimal'],
  ['steps', '步数', 'numeric'],
  ['cyclingMinutes', '骑行分钟', 'numeric'],
  ['morningState', '早上状态 1～5', 'numeric'],
  ['sleepQuality', '入睡质量 1～5', 'numeric'],
  ['energy', '精力 0～10', 'numeric'],
  ['backDiscomfort', '腰背不适 0～10', 'numeric'],
  ['numbnessEvents', '麻木事件次数', 'numeric'],
  ['trainingVolume', '训练总量 kg', 'numeric'],
  ['dietAdherence', '饮食完成率 %', 'numeric']
] as const

type NumericFieldKey = typeof NUMERIC_FIELDS[number][0]

const APPETITE_OPTIONS = [
  { value: 1, label: '1 很乱（暴食冲动强）' },
  { value: 2, label: '2 偏乱（容易想吃）' },
  { value: 3, label: '3 一般' },
  { value: 4, label: '4 比较稳' },
  { value: 5, label: '5 很稳（不饿不馋）' }
]

export function ProgressView() {
  const { state, setState } = useAppState()
  const [range, setRange] = useState<'7' | '30' | 'all'>('30')
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(emptyBodyLog)
  // 数值输入框的「原始文本」缓存：draft 里存的是数字，但直接把数字回填到输入框会导致
  // 1) 默认值 0 删不掉（显示成 0，继续输入变成 05、072）
  // 2) 小数点被吞掉（想输 72.5，输到 "72." 时会被 Number() 抹成 72，最后变成 725）
  // 因此输入过程中以 text 为准显示，draft 只负责保存解析后的数字。
  const [text, setText] = useState<Record<string, string | undefined>>({})
  const [photoDraft, setPhotoDraft] = useState<string | null>(null)
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({})
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const chartData = useMemo(() => {
    const sorted = [...state.bodyLogs].sort((a, b) => a.date.localeCompare(b.date))
    const selected = range === 'all' ? sorted : sorted.slice(-Number(range))
    return selected.map((item, index) => ({ ...item, averageWeight: movingAverage(selected, index), label: item.date.slice(5) }))
  }, [state.bodyLogs, range])

  // 自动计算：全部从已有记录推导，不让用户重复填。
  const weightTrend = useMemo(() => calculateWeightTrend(state.bodyLogs), [state.bodyLogs])
  const trainingStats = useMemo(() => calculateTrainingDuration(state.sessions, 7), [state.sessions])
  const cheatMealStats = useMemo(() => calculateCheatMeals(state.bodyLogs, 7), [state.bodyLogs])
  const appetiteStats = useMemo(() => calculateAppetite(state.bodyLogs, 7), [state.bodyLogs])
  const feedbackCounts = useMemo(() => calculateFeedbackCounts(state.sessions, 7), [state.sessions])

  const photoLogs = useMemo(
    () => [...state.bodyLogs]
      .filter((log) => log.fastingPhotoId && photoMap[log.fastingPhotoId])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8),
    [state.bodyLogs, photoMap]
  )

  // 图片存在 IndexedDB，进页面时把最近的照片读进内存。
  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      const next: Record<string, string> = {}
      for (const log of state.bodyLogs) {
        if (!log.fastingPhotoId) continue
        try {
          const dataUrl = await loadPhoto(log.fastingPhotoId)
          if (dataUrl) next[log.fastingPhotoId] = dataUrl
        } catch {
          // 图片库不可用（例如隐私模式）时只是不显示照片，不影响其他数据
        }
      }
      if (!cancelled) setPhotoMap(next)
    }
    void loadAll()
    return () => { cancelled = true }
  }, [state.bodyLogs])

  const openForm = () => {
    setText({})
    setPhotoDraft(null)
    setFormError('')
    setShowForm(true)
  }

  const addLog = async () => {
    if (draft.weightKg <= 0) {
      setFormError('请先填写空腹体重（kg）。')
      return
    }
    if (draft.sleepHours < 0 || draft.energy < 0 || draft.energy > 10) {
      setFormError('请检查睡眠小时和精力（0～10）。')
      return
    }

    const existing = state.bodyLogs.find((item) => item.date === draft.date)
    let photoId = draft.fastingPhotoId ?? null
    let photoWarning = ''

    if (photoDraft) {
      const nextPhotoId = createId('photo')
      try {
        await savePhoto(nextPhotoId, photoDraft)
        if (photoId && photoId !== nextPhotoId) void deletePhoto(photoId)
        photoId = nextPhotoId
      } catch {
        photoWarning = '照片没能保存（浏览器本地图片库不可用），其余记录已保存。'
      }
    } else if (existing?.fastingPhotoId) {
      photoId = existing.fastingPhotoId
    }

    setState((current) => ({
      ...current,
      bodyLogs: [
        ...current.bodyLogs.filter((item) => item.date !== draft.date),
        { ...draft, fastingPhotoId: photoId, id: existing?.id ?? createId('body') }
      ]
    }))
    setShowForm(false)
    setNotice(photoWarning)
  }

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return
    setFormError('')
    try {
      setPhotoDraft(await compressImage(file))
    } catch {
      setFormError('这张照片读不出来，换一张 JPG／PNG 试试。')
    }
  }

  const renderNumberField = (key: NumericFieldKey, label: string, mode: 'decimal' | 'numeric') => {
    const current = Number(draft[key])
    const shown = text[key] ?? (current === 0 ? '' : String(current))
    return <label key={key}>{label}<input
      type="text"
      inputMode={mode}
      value={shown}
      onChange={(event) => {
        const raw = event.target.value
        setText({ ...text, [key]: raw })
        const parsed = raw === '' ? 0 : Number(raw)
        setDraft({ ...draft, [key]: Number.isNaN(parsed) ? 0 : parsed })
      }}
    /></label>
  }

  const latest = chartData[chartData.length - 1]
  const selected = chartData.find((item) => item.date === selectedDate)

  return <div className="view-stack">
    <section className="progress-toolbar">
      <div className="segmented-control">
        <button className={range === '7' ? 'is-selected' : ''} onClick={() => setRange('7')}>7天</button>
        <button className={range === '30' ? 'is-selected' : ''} onClick={() => setRange('30')}>30天</button>
        <button className={range === 'all' ? 'is-selected' : ''} onClick={() => setRange('all')}>全部</button>
      </div>
      <button className="button primary" onClick={openForm}><Plus size={16} />记录今天</button>
    </section>

    {notice && <div className="notice">{notice}</div>}

    <section className="summary-strip progress-summary">
      <div><span>当前空腹体重</span><strong>{weightTrend.latestWeight ?? latest?.weightKg ?? '-'} kg</strong></div>
      <div><span>常态体重</span><strong>{weightTrend.normalWeight ?? '-'} kg</strong></div>
      <div><span>周环比</span><strong className={weightTrend.weekChange !== null && weightTrend.weekChange < 0 ? 'trend-down' : ''}>{formatSigned(weightTrend.weekChange)}</strong></div>
      <div><span>腰围</span><strong>{latest?.waistCm ?? '-'} cm</strong></div>
    </section>

    <section className="health-snapshot">
      <div className="section-heading"><div><h2>近 7 天状态</h2><p>这些数字都从你的记录里自动算出来，不用另外填。</p></div></div>
      <div className="snapshot-grid">
        <article>
          <div className="snapshot-label"><Timer size={15} />训练</div>
          <strong>{trainingStats.sessionCount} 次</strong>
          <span>合计 {trainingStats.totalMinutes ? formatMinutes(trainingStats.totalMinutes) : '—'} · 平均 {trainingStats.averageMinutes ? formatMinutes(trainingStats.averageMinutes) : '—'}</span>
        </article>
        <article>
          <div className="snapshot-label"><Utensils size={15} />放纵餐</div>
          <strong>{cheatMealStats.count} 次</strong>
          <span>{cheatMealStats.daysSinceLast === null ? '还没记录过' : cheatMealStats.daysSinceLast === 0 ? '今天刚吃过' : `距上次 ${cheatMealStats.daysSinceLast} 天`}</span>
        </article>
        <article>
          <div className="snapshot-label"><TrendingDown size={15} />食欲稳定</div>
          <strong>{appetiteStats.average === null ? '—' : `${appetiteStats.average} / 5`}</strong>
          <span>{appetiteStats.average === null ? '记录后自动统计' : appetiteStats.unstableDays > 0 ? `有 ${appetiteStats.unstableDays} 天偏乱（≤2分）` : '近 7 天都比较稳'}</span>
        </article>
        <article>
          <div className="snapshot-label"><Activity size={15} />身体反馈</div>
          <strong>{feedbackCounts.length ? feedbackCounts[0].tag : '—'}</strong>
          <span>{feedbackCounts.length ? feedbackCounts.slice(0, 3).map((item) => `${item.tag}${item.count}`).join(' · ') : '训练记录里勾选后自动汇总'}</span>
        </article>
      </div>
    </section>

    {photoLogs.length > 0 && <section className="photo-section">
      <div className="section-heading"><div><h2>空腹状态照片</h2><p>只存在这台设备的浏览器里，不会上传。</p></div></div>
      <div className="photo-strip">
        {photoLogs.map((log) => <button key={log.id} className="photo-thumb" onClick={() => setViewingPhoto(photoMap[log.fastingPhotoId!])}>
          <img src={photoMap[log.fastingPhotoId!]} alt={`${log.date} 空腹状态`} loading="lazy" />
          <span>{log.date.slice(5)}</span>
        </button>)}
      </div>
    </section>}

    <ChartSection title="体重趋势" subtitle="实线为每日空腹体重，虚线为常态体重（7次移动平均）。点击数据点可查看当天详情。">
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={chartData} margin={{ top: 10, right: 18, bottom: 0, left: 4 }} onClick={(chartState: any) => { const date = chartState?.activePayload?.[0]?.payload?.date; if (date) setSelectedDate(date) }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" />
          <YAxis domain={['dataMin - 1', 'dataMax + 1']} width={64} unit="kg" />
          <Tooltip />
          <Line type="monotone" dataKey="weightKg" name="空腹体重" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }} />
          <Line type="monotone" dataKey="averageWeight" name="常态体重" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 4" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      {selected && <div className="selected-day">
        <strong>{selected.date}</strong>
        <span>空腹体重 {selected.weightKg}kg</span>
        <span>腰围 {selected.waistCm}cm</span>
        <span>睡眠 {selected.sleepHours}小时</span>
        <span>精力 {selected.energy}/10</span>
        <span>食欲 {selected.appetiteStability ?? 3}/5</span>
        <span>腰背不适 {selected.backDiscomfort}/10</span>
        <span>麻木 {selected.numbnessEvents}次</span>
        {selected.cheatMeal && <span>放纵餐{selected.cheatMealNote ? `：${selected.cheatMealNote}` : ''}</span>}
      </div>}
    </ChartSection>

    <div className="chart-grid">
      <ChartSection title="睡眠与精力" subtitle="同一天分开看睡眠小时和主观精力。">
        <ResponsiveContainer width="100%" height={230}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis domain={[0, 10]} /><Tooltip /><Line type="monotone" dataKey="sleepHours" name="睡眠小时" stroke="var(--series-3)" strokeWidth={2} /><Line type="monotone" dataKey="energy" name="精力" stroke="var(--series-4)" strokeWidth={2} /></LineChart></ResponsiveContainer>
      </ChartSection>
      <ChartSection title="腰背不适与麻木事件" subtitle="麻木事件出现时应回看当天动作记录。">
        <ResponsiveContainer width="100%" height={230}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis domain={[0, 10]} /><Tooltip /><Line type="monotone" dataKey="backDiscomfort" name="腰背不适" stroke="var(--series-5)" strokeWidth={2} /><Line type="stepAfter" dataKey="numbnessEvents" name="麻木事件" stroke="var(--danger)" strokeWidth={2} /></LineChart></ResponsiveContainer>
      </ChartSection>
    </div>

    {viewingPhoto && <div className="dialog-backdrop" onClick={() => setViewingPhoto(null)}>
      <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="空腹状态照片">
        <img src={viewingPhoto} alt="空腹状态" />
        <button className="icon-button" onClick={() => setViewingPhoto(null)} aria-label="关闭"><X size={18} /></button>
      </div>
    </div>}

    {showForm && <div className="dialog-backdrop">
      <section className="dialog wide" role="dialog" aria-modal="true">
        <div className="dialog-header">
          <div><h2>记录今天</h2><p>空腹体重是必填项；其余留空按 0 计，不影响自动计算。</p></div>
          <button className="icon-button" onClick={() => setShowForm(false)} aria-label="关闭"><X size={18} /></button>
        </div>

        <div className="form-section-title"><Scale size={15} />基础</div>
        <div className="form-grid three-columns">
          <label>日期<input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
          {NUMERIC_FIELDS.slice(0, 5).map(([key, label, mode]) => renderNumberField(key, label, mode))}
        </div>

        <div className="form-section-title"><Activity size={15} />身体状态</div>
        <div className="form-grid three-columns">
          {NUMERIC_FIELDS.slice(5).map(([key, label, mode]) => renderNumberField(key, label, mode))}
          <label>食欲稳定情况
            <select value={draft.appetiteStability ?? 3} onChange={(event) => setDraft({ ...draft, appetiteStability: Number(event.target.value) })}>
              {APPETITE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="switch-label form-switch">
            <input type="checkbox" checked={draft.cheatMeal === true} onChange={(event) => setDraft({ ...draft, cheatMeal: event.target.checked })} />
            今天有放纵餐
          </label>
          <label>放纵餐说明<input value={draft.cheatMealNote ?? ''} placeholder="例如：晚上聚餐吃了火锅" onChange={(event) => setDraft({ ...draft, cheatMealNote: event.target.value })} /></label>
        </div>

        <div className="form-section-title"><Camera size={15} />空腹状态照片</div>
        <div className="form-grid">
          <label className="file-input-label"><ImagePlus size={16} />选择照片（自动压缩，仅存本机）<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handlePhotoFile(event.target.files?.[0])} /></label>
          {photoDraft && <div className="photo-preview">
            <img src={photoDraft} alt="待保存的空腹照片" />
            <button className="button compact" onClick={() => setPhotoDraft(null)}>移除</button>
          </div>}
          <label className="full-field">状态备注<textarea value={draft.mood ?? ''} onChange={(event) => setDraft({ ...draft, mood: event.target.value })} placeholder="如：早上精神不错、入睡偏晚、做组时后两组明显没力…" /></label>
        </div>

        {formError && <p className="field-error">{formError}</p>}
        <div className="dialog-actions">
          <button className="button" onClick={() => setShowForm(false)}><X size={16} />取消</button>
          <button className="button primary" onClick={() => void addLog()}><Save size={16} />保存</button>
        </div>
      </section>
    </div>}
  </div>
}

function ChartSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="chart-section"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><Activity size={18} /></div><div className="chart-wrap" role="img" aria-label={`${title}折线图`}>{children}</div></section>
}
