// Miscellany > Panchanga (CPanchangaView): the pane shows the chart's day and the
// next one (with horas and Gouri panchanga choghadiyas); menu 150 copies the monthly
// panchanga (33085; JHora keeps its "JD format" item 33086 disabled). Works on the shown chart.
import { useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
type Mode = 'daily' | 'monthly';

export function PanchangaView({ spec }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const [mode, setMode] = useState<Mode>('daily');
  const [ym, setYm] = useState<{ year: number; month: number }>({ year: spec.birth.year, month: spec.birth.month });
  const params = mode === 'daily' ? {} : ym;
  const job = useJob({ kind: 'table' as const, chart: spec, table: `panchanga.${mode}`, params });
  return (
    <div className="subview panchanga">
      <div className="subview-bar">
        <select aria-label="Panchanga mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="daily">Panchanga (this day and the next)</option>
          <option value="monthly">Monthly panchanga</option>
        </select>
        {mode !== 'daily' && (
          <>
            <select aria-label="Month" value={ym.month} onChange={(e) => setYm({ ...ym, month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input aria-label="Year" type="number" value={ym.year} style={{ width: '6em' }} onChange={(e) => setYm({ ...ym, year: Number(e.target.value) })} />
          </>
        )}
      </div>
      {mode === 'daily' && job.data?.text && <pre className="key-info">{job.data.text.join('\n')}</pre>}
      <TableView job={job} />
    </div>
  );
}
