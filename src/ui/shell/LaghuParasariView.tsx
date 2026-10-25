// Miscellany > Laghu Parasari (CLaghuParasariView, context menu 159): sums of body
// longitudes (plus a lagna) read as ages, with the solar-return dates. Works on the shown chart;
// a derived chart with a period of effect (mundane, prasna, Tithi Pravesha) compresses the dates.
import { useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { useActiveDoc } from '../state/store';
import { LAGHU_DEFAULTS, LAGHU_LAGNAS, LAGHU_MODES, LAGHU_VARGAS, type LaghuOptions } from '../../core/derived/laghuParasari';

export function LaghuParasariView({ spec }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const [opt, setOpt] = useState<LaghuOptions>(LAGHU_DEFAULTS);
  const periodDays = Number(useActiveDoc()?.derived?.params.periodDays) || null;
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'laghuParasari.table', params: { ...opt, periodDays } });
  const set = (p: Partial<LaghuOptions>) => setOpt({ ...opt, ...p });
  return (
    <div className="subview laghu-parasari">
      <div className="subview-bar">
        <select aria-label="Planets" value={opt.mode} onChange={(e) => set({ mode: Number(e.target.value) })}>
          {LAGHU_MODES.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <label>Add lagna
          <select value={opt.lagna ?? -1} onChange={(e) => set({ lagna: Number(e.target.value) < 0 ? null : Number(e.target.value) })}>
            {LAGHU_LAGNAS.map(([l, b]) => <option key={l} value={b ?? -1}>{l}</option>)}
          </select>
        </label>
        <label>Varga
          <select value={opt.varga} onChange={(e) => set({ varga: Number(e.target.value) })}>
            {LAGHU_VARGAS.map(([s, n], i) => <option key={s} value={i}>{s} ({n})</option>)}
          </select>
        </label>
        <select aria-label="Method" value={opt.method} onChange={(e) => set({ method: e.target.value as LaghuOptions['method'] })}>
          <option value="longitude">Find longitudes in divisions</option>
          <option value="count">Count signs in divisions</option>
        </select>
        {periodDays && (
          <label><input type="checkbox" checked={!!opt.oneCycle} onChange={(e) => set({ oneCycle: e.target.checked })} /> Use only one cycle</label>
        )}
      </div>
      <TableView job={job} />
      {job.data?.notes?.map((n) => <p key={n} className="status" style={{ whiteSpace: 'pre-line' }}>{n}</p>)}
    </div>
  );
}
