import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, History, RotateCcw, Save, WandSparkles } from 'lucide-react'
import { rawLibraries, rawLibraryVersions } from '../../data'
import { calculateEngine } from '../../lib/engine'
import { createOverride, getEffectiveLibraries, rollbackOverride } from '../../lib/overlay'
import { createInitialState } from '../../lib/nutritionStorage'
import type { AppState, LibraryName, EngineResult } from '../../nutritionTypes'

const libraryOptions: Array<{ id: LibraryName; label: string }> = [
  { id: 'foods', label: '食材库' }, { id: 'supplements', label: '补剂库' }, { id: 'standards', label: '微量标准库' },
  { id: 'formulas', label: '公式库' }, { id: 'exercises', label: '动作库' }, { id: 'preferences', label: '倾向规则库' }
]

const keyMap: Record<string, string> = { '热量': 'calories', '蛋白质': 'protein', '蛋白': 'protein', '脂肪': 'fat', '碳水': 'carbs', '目标热量': 'targetCalories', '活动系数': 'activityFactor', '年龄': 'age', '体重': 'weightKg', '身高': 'heightCm' }

function listRecords(library: LibraryName) {
  return rawLibraries[library] as unknown as Array<{ id: string; name: string }>
}

function parseNumber(text: string): number | null {
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

export function AdminView({ state, setState, result, profileReadOnly = false }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; result: EngineResult; profileReadOnly?: boolean }) {
  const [library, setLibrary] = useState<LibraryName>('foods')
  const records = useMemo(() => listRecords(library), [library])
  const [recordId, setRecordId] = useState(records[0]?.id ?? '')
  const [patchText, setPatchText] = useState('{}')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [smartText, setSmartText] = useState('')
  const [profileDraft, setProfileDraft] = useState({ age: String(state.profile.age), weightKg: String(state.profile.weightKg), heightCm: String(state.profile.heightCm) })
  const effective = useMemo(() => getEffectiveLibraries(rawLibraries, state.overrides), [state.overrides])
  const rawRecord = (rawLibraries[library] as unknown as Array<Record<string, unknown>>).find((item) => item.id === recordId)
  const effectiveRecord = (effective[library] as unknown as Array<Record<string, unknown>>).find((item) => item.id === recordId)

  useEffect(() => {
    setRecordId(records[0]?.id ?? '')
    setPatchText('{}')
  }, [library])

  useEffect(() => {
    setProfileDraft({ age: String(state.profile.age), weightKg: String(state.profile.weightKg), heightCm: String(state.profile.heightCm) })
  }, [state.profile.age, state.profile.heightCm, state.profile.weightKg])

  const commitOverride = () => {
    try {
      const parsed = JSON.parse(patchText) as Record<string, unknown>
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('覆盖内容必须是JSON对象。')
      setState((current) => ({ ...current, overrides: createOverride(current.overrides, library, recordId, parsed, note) }))
      setMessage(`${libraryOptions.find((item) => item.id === library)?.label} ${recordId}已产生新覆盖版本，今日结果已重新计算。`)
      setPatchText('{}')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '覆盖保存失败。')
    }
  }

  const runSmartEdit = () => {
    const text = smartText.trim()
    if (!text) return
    const setting = text.match(/(?:年龄|体重|身高|活动系数|目标热量)\s*(?:改为|设为|调整为|=)\s*(\d+(?:\.\d+)?)/)
    if (setting) {
      const label = text.match(/年龄|体重|身高|活动系数|目标热量/)?.[0] ?? ''
      const key = keyMap[label]
      const value = parseNumber(setting[1])
      if (key && value !== null) {
        setState((current) => key === 'targetCalories'
          ? { ...current, manual: { ...current.manual, targetCalories: value } }
          : { ...current, profile: { ...current.profile, [key]: value } })
        setMessage(`已按智能编辑修改${label}为${value}；BMR、TDEE、目标和菜单已重新计算。`)
        setSmartText('')
        return
      }
    }
    const day = text.match(/今日(?:改为|设为|调整为)\s*(推|拉|腿|休)(?:日)?/)
    if (day) {
      setState((current) => ({ ...current, manual: { ...current.manual, dayType: day[1] as AppState['manual']['dayType'] } }))
      setMessage(`已将今日属性手动设为${day[1]}日，菜单与补剂重新计算。`)
      setSmartText('')
      return
    }
    const supplement = text.match(/(S\d{2}).*?(?:用量|数量|改为|设为)\s*(\d+(?:\.5)?)/i)
    if (supplement) {
      const amount = Number(supplement[2])
      setState((current) => ({ ...current, supplementDoses: current.supplementDoses.some((item) => item.supplementId === supplement[1]) ? current.supplementDoses.map((item) => item.supplementId === supplement[1] ? { ...item, amount, enabled: true } : item) : [...current.supplementDoses, { supplementId: supplement[1], amount, enabled: true }] }))
      setMessage(`已修改${supplement[1]}用量为${amount}，微量元素总账已重新计算。`)
      setSmartText('')
      return
    }
    const record = text.match(/(?:修改|把)\s*(F\d{2}|S\d{2})\s*(?:的)?([\u4e00-\u9fa5A-Za-z0-9+]+)\s*(?:改为|设为|=)\s*(\d+(?:\.\d+)?)/i)
    if (record) {
      const targetLibrary: LibraryName = record[1].startsWith('F') ? 'foods' : 'supplements'
      const field = keyMap[record[2]] ?? record[2]
      const patch = targetLibrary === 'foods' && ['zinc', 'magnesium', 'selenium', 'sodium'].includes(field) ? { micronutrients: { [field]: Number(record[3]) } } : { [field]: Number(record[3]) }
      setState((current) => ({ ...current, overrides: createOverride(current.overrides, targetLibrary, record[1], patch, `智能编辑：${text}`) }))
      setMessage(`已为${record[1]}写入覆盖值，版本历史已保存。`)
      setSmartText('')
      return
    }
    setMessage('没有识别这条指令。示例：体重改为103、今日改为休息日、修改F01热量改为150、S01用量2。')
  }

  const saveProfile = () => {
    const age = Number(profileDraft.age); const weightKg = Number(profileDraft.weightKg); const heightCm = Number(profileDraft.heightCm)
    if (![age, weightKg, heightCm].every((value) => Number.isFinite(value) && value > 0)) { setMessage('年龄、身高和体重必须是大于0的数字。'); return }
    setState((current) => ({ ...current, profile: { ...current.profile, age, weightKg, heightCm } }))
    setMessage(`档案已更新：年龄${age}岁、体重${weightKg}kg、身高${heightCm}cm；BMR ${calculateEngine({ ...state, profile: { ...state.profile, age, weightKg, heightCm } }).macro.bmr}。`)
  }

  const resetLocalData = () => {
    const confirmed = window.confirm('确定恢复初始本地数据吗？这会清空当前浏览器中的档案修改、覆盖历史、菜单和趋势记录，但不会改动六库原始值。')
    if (!confirmed) return
    setState(createInitialState())
    setMessage('已恢复初始本地数据：27岁、176cm、108kg，覆盖记录已清空。')
  }

  const history = [...state.overrides].reverse()
  return <div className="view-stack">
    <section className="admin-intro"><div><h2>后台编辑与版本控制</h2><p>原始库只读，所有修改写入覆盖层；保存后马上重算，历史可回滚。</p></div><div className="admin-actions"><span className="version-stamp"><History size={15} />覆盖记录 {state.overrides.length} 条</span><button className="button" onClick={resetLocalData}><RotateCcw size={16} />恢复初始数据</button></div></section>
    <section className="smart-editor"><div className="section-heading"><div><h2><WandSparkles size={18} />智能编辑（规则版）</h2><p>不调用外部AI，不猜营养值；只执行页面明确支持的修改指令。</p></div></div><div className="smart-row"><input value={smartText} placeholder="例如：体重改为103；修改F01热量改为150；S01用量2" onChange={(event) => setSmartText(event.target.value)} /><button className="button primary" onClick={runSmartEdit}>执行修改</button></div></section>
    {profileReadOnly ? <div className="notice"><CheckCircle2 size={18} /><span>个人档案统一在“设置”页修改，这里只管理六库覆盖值。</span></div> : <section><div className="section-heading"><div><h2>个人档案</h2><p>真实年龄已设为27岁，后台仍可修改。</p></div></div><div className="form-inline"><label>年龄<input type="number" min="1" value={profileDraft.age} onChange={(event) => setProfileDraft({ ...profileDraft, age: event.target.value })} /></label><label>身高cm<input type="number" min="1" value={profileDraft.heightCm} onChange={(event) => setProfileDraft({ ...profileDraft, heightCm: event.target.value })} /></label><label>体重kg<input type="number" min="1" step="0.1" value={profileDraft.weightKg} onChange={(event) => setProfileDraft({ ...profileDraft, weightKg: event.target.value })} /></label><button className="button" onClick={saveProfile}><Save size={16} />保存档案</button></div></section>}
    {message && <div className="notice"><CheckCircle2 size={18} /><span>{message}</span></div>}
    <section><div className="section-heading"><div><h2>六库覆盖编辑</h2><p>选择记录后修改JSON字段；原始值窗口永远只读。</p></div></div><div className="admin-grid"><div className="admin-controls"><label>数据库<select value={library} onChange={(event) => setLibrary(event.target.value as LibraryName)}>{libraryOptions.map((option) => <option value={option.id} key={option.id}>{option.label} · {rawLibraryVersions[option.id]}</option>)}</select></label><label>记录<select value={recordId} onChange={(event) => { setRecordId(event.target.value); setPatchText('{}') }}>{records.map((record) => <option value={record.id} key={record.id}>{record.id} · {record.name}</option>)}</select></label><label>修改备注<input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：按包装标签校正" /></label><label>覆盖JSON<textarea value={patchText} onChange={(event) => setPatchText(event.target.value)} /></label><button className="button primary" onClick={commitOverride}><Save size={16} />保存覆盖版本</button></div><div className="json-columns"><div><h3>原始值（只读）</h3><pre>{JSON.stringify(rawRecord, null, 2)}</pre></div><div><h3>当前生效值</h3><pre>{JSON.stringify(effectiveRecord, null, 2)}</pre></div></div></div></section>
    <section><div className="section-heading"><div><h2>覆盖历史与回滚</h2><p>回滚不会删除记录，只会让该版本停止生效。</p></div></div><div className="history-list">{history.length ? history.map((item) => <div className={item.revertedAt ? 'history-row reverted' : 'history-row'} key={item.id}><div><strong>{item.library} / {item.recordId} · v{item.version}</strong><small>{item.note} · {new Date(item.createdAt).toLocaleString('zh-CN')}{item.revertedAt ? ' · 已回滚' : ''}</small></div>{!item.revertedAt && <button className="icon-button" aria-label={`回滚${item.id}`} onClick={() => setState((current) => ({ ...current, overrides: rollbackOverride(current.overrides, item.id) }))}><RotateCcw size={16} /></button>}</div>) : <p className="muted">还没有覆盖记录。</p>}</div></section>
  </div>
}
