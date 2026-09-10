import { useMemo, useState } from 'react'
import { Activity, Plus, Save, Scale, X } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAppState } from '../state/AppContext'
import type { BodyLog } from '../types'
import { createId } from '../lib/ids'

function movingAverage(values: BodyLog[], index: number): number {
  const slice = values.slice(Math.max(0, index - 6), index + 1)
  return Number((slice.reduce((sum, item) => sum + item.weightKg, 0) / slice.length).toFixed(2))
}

const emptyBodyLog: Omit<BodyLog, 'id'> = { date: new Date().toISOString().slice(0,10), weightKg: 0, waistCm: 0, sleepHours: 7, steps: 5000, cyclingMinutes: 40, energy: 5, backDiscomfort: 5, numbnessEvents: 0, trainingVolume: 0, dietAdherence: 80 }

export function ProgressView() {
  const { state, setState } = useAppState()
  const [range, setRange] = useState<'7' | '30' | 'all'>('30')
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState(emptyBodyLog)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const chartData = useMemo(() => {
    const sorted = [...state.bodyLogs].sort((a,b) => a.date.localeCompare(b.date))
    const selected = range === 'all' ? sorted : sorted.slice(-Number(range))
    return selected.map((item, index) => ({ ...item, averageWeight: movingAverage(selected, index), label: item.date.slice(5) }))
  }, [state.bodyLogs, range])

  const addLog = () => {
    if (draft.weightKg <= 0 || draft.sleepHours < 0 || draft.energy < 0 || draft.energy > 10) return
    setState((current) => ({ ...current, bodyLogs: [...current.bodyLogs.filter((item) => item.date !== draft.date), { ...draft, id: createId('body') }] }))
    setShowForm(false)
  }

  const latest = chartData[chartData.length - 1]
  const first = chartData[0]
  const selected = chartData.find((item) => item.date === selectedDate)

  return <div className="view-stack">
    <section className="progress-toolbar"><div className="segmented-control"><button className={range === '7' ? 'is-selected' : ''} onClick={() => setRange('7')}>7天</button><button className={range === '30' ? 'is-selected' : ''} onClick={() => setRange('30')}>30天</button><button className={range === 'all' ? 'is-selected' : ''} onClick={() => setRange('all')}>全部</button></div><button className="button primary" onClick={() => setShowForm(true)}><Plus size={16} />添加今日记录</button></section>
    <section className="summary-strip progress-summary"><div><span>当前体重</span><strong>{latest?.weightKg ?? '-'} kg</strong></div><div><span>区间变化</span><strong>{latest && first ? `${(latest.weightKg - first.weightKg).toFixed(1)} kg` : '-'}</strong></div><div><span>腰围</span><strong>{latest?.waistCm ?? '-'} cm</strong></div><div><span>最近睡眠</span><strong>{latest?.sleepHours ?? '-'} h</strong></div></section>
    <ChartSection title="体重趋势" subtitle="实线为每日体重，虚线为7日移动平均。点击数据点可查看当天详情。"><ResponsiveContainer width="100%" height={270}><LineChart data={chartData} margin={{ top: 10, right: 18, bottom: 0, left: 4 }} onClick={(chartState: any) => { const date = chartState?.activePayload?.[0]?.payload?.date; if (date) setSelectedDate(date) }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis domain={['dataMin - 1', 'dataMax + 1']} width={64} unit="kg" /><Tooltip /><Line type="monotone" dataKey="weightKg" name="体重" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, cursor: 'pointer' }} /><Line type="monotone" dataKey="averageWeight" name="7日均重" stroke="var(--series-2)" strokeWidth={2} strokeDasharray="6 4" dot={false} /></LineChart></ResponsiveContainer>{selected && <div className="selected-day"><strong>{selected.date}</strong><span>体重 {selected.weightKg}kg</span><span>腰围 {selected.waistCm}cm</span><span>睡眠 {selected.sleepHours}小时</span><span>精力 {selected.energy}/10</span><span>腰背不适 {selected.backDiscomfort}/10</span><span>麻木 {selected.numbnessEvents}次</span></div>}</ChartSection>
    <div className="chart-grid"><ChartSection title="睡眠与精力" subtitle="同一天分开看睡眠小时和主观精力。"><ResponsiveContainer width="100%" height={230}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis domain={[0,10]} /><Tooltip /><Line type="monotone" dataKey="sleepHours" name="睡眠小时" stroke="var(--series-3)" strokeWidth={2} /><Line type="monotone" dataKey="energy" name="精力" stroke="var(--series-4)" strokeWidth={2} /></LineChart></ResponsiveContainer></ChartSection><ChartSection title="腰背不适与麻木事件" subtitle="麻木事件出现时应回看当天动作记录。"><ResponsiveContainer width="100%" height={230}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" /><YAxis domain={[0,10]} /><Tooltip /><Line type="monotone" dataKey="backDiscomfort" name="腰背不适" stroke="var(--series-5)" strokeWidth={2} /><Line type="stepAfter" dataKey="numbnessEvents" name="麻木事件" stroke="var(--danger)" strokeWidth={2} /></LineChart></ResponsiveContainer></ChartSection></div>
    {showForm && <div className="dialog-backdrop"><section className="dialog wide" role="dialog" aria-modal="true"><div className="dialog-header"><h2>添加身体记录</h2><button className="icon-button" onClick={() => setShowForm(false)} aria-label="关闭"><X size={18} /></button></div><div className="form-grid three-columns">{([['date','日期','date'],['weightKg','体重kg','number'],['waistCm','腰围cm','number'],['sleepHours','睡眠小时','number'],['steps','步数','number'],['cyclingMinutes','骑行分钟','number'],['energy','精力0～10','number'],['backDiscomfort','腰背不适0～10','number'],['numbnessEvents','麻木事件次数','number'],['trainingVolume','训练总量kg','number'],['dietAdherence','饮食完成率%','number']] as const).map(([key,label,type]) => <label key={key}>{label}<input type={type} step={key === 'weightKg' || key === 'waistCm' || key === 'sleepHours' ? '0.1' : '1'} value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} /></label>)}</div><div className="dialog-actions"><button className="button" onClick={() => setShowForm(false)}><X size={16} />取消</button><button className="button primary" onClick={addLog}><Save size={16} />保存</button></div></section></div>}
  </div>
}

function ChartSection({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="chart-section"><div className="section-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><Activity size={18} /></div><div className="chart-wrap" role="img" aria-label={`${title}折线图`}>{children}</div></section>
}
