// Miscellany > Panchanga (CPanchangaView): the pane shows the chart's day and the
// next one (with horas and Gouri panchanga choghadiyas); menu 150 copies the monthly
// panchanga (33085), the DP format (33420, from a start date for a number of days), the
// monthly ephemeris (33087) and the planetary movements (33088). JHora keeps its other
// "JD format" items 33086 / 33089 disabled. Works on the shown chart.
import { useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
type Mode = 'daily' | 'monthly' | 'dpFormat' | 'ephemeris' | 'movements';

export function PanchangaView({ spec }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const [mode, setMode] = useState<Mode>('daily');
  const [ym, setYm] = useState<{ year: number; month: number }>({ year: spec.birth.year, month: spec.birth.month });
  const [dp, setDp] = useState<{ day: number; days: number }>({ day: spec.birth.day, days: 20 });
  const params = mode === 'daily' ? {} : mode === 'dpFormat' ? { ...ym, ...dp } : ym;
  const job = useJob({ kind: 'table' as const, chart: spec, table: `panchanga.${mode}`, params });
  return (
    <div className="subview panchanga">
      <div className="subview-bar">
        <select aria-label="Panchanga mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="daily">Panchanga (this day and the next)</option>
          <option value="monthly">Monthly panchanga</option>
          <option value="dpFormat">Panchanga (DP format)</option>
          <option value="ephemeris">Monthly ephemeris (5:30 am)</option>
          <option value="movements">Monthly planetary movements</option>
        </select>
        {mode !== 'daily' && (
          <>
            <select aria-label="Month" value={ym.month} onChange={(e) => setYm({ ...ym, month: Number(e.target.value) })}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            {mode === 'dpFormat' && (
              <input aria-label="Date" type="number" min={1} max={31} value={dp.day} style={{ width: '4em' }} onChange={(e) => setDp({ ...dp, day: Number(e.target.value) })} />
            )}
            <input aria-label="Year" type="number" value={ym.year} style={{ width: '6em' }} onChange={(e) => setYm({ ...ym, year: Number(e.target.value) })} />
          </>
        )}
        {mode === 'dpFormat' && (
          <label>
            Number of days:{' '}
            <input aria-label="Number of days" type="number" min={1} max={400} value={dp.days} style={{ width: '5em' }} onChange={(e) => setDp({ ...dp, days: Number(e.target.value) })} />
          </label>
        )}
      </div>
      {mode === 'daily' && job.data?.text && <pre className="key-info">{job.data.text.join('\n')}</pre>}
      <TableView job={job} />
    </div>
  );
}
