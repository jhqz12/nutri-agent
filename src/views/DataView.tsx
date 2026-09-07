import { useMemo } from 'react'
import { Database, FileSpreadsheet } from 'lucide-react'
import { calculateEngine } from '../lib/engine'
import { useNutritionState } from '../state/NutritionContext'
import { ImportDataView } from './ImportDataView'
import { AdminView } from './nutrition/AdminView'
import { FormulaLibraryView } from './FormulaLibraryView'

export function DataView() {
  const { state, setState } = useNutritionState()
  const result = useMemo(() => calculateEngine(state), [state])

  return <div className="view-stack">
    <section className="data-intro">
      <FileSpreadsheet size={20} />
      <div><h2>日常数据导入与备份</h2><p>先预览、再确认；错误文件不会写入一半。</p></div>
    </section>
    <FormulaLibraryView />
    <ImportDataView />
    <details className="advanced-panel">
      <summary><Database size={17} />专业六库编辑与版本历史</summary>
      <div className="advanced-panel-body"><AdminView state={state} setState={setState} result={result} profileReadOnly /></div>
    </details>
  </div>
}
