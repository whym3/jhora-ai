// Miscellany > Progressions (CProgFormView, dialog 2014): varga, nakshatra dasa,
// seed body and progression date; four buttons each replace the natal chart by a
// progressed chart (BirthData.override) until "Back to Natal Chart".
import { useEffect, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { BirthData } from '../../core/jhd';
import { PROG_BODIES, PROG_DASAS, PROG_VARGA_LABELS, type ProgressionInput, type ProgressionKind } from '../../core/derived/progression';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { updateChart, useActiveDoc } from '../state/store';
import { MixedChartButton } from './MixedChartDialog';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BUTTONS: [ProgressionKind, string][] = [
  ['solar', 'Solar Progression (1 sign per year in chosen varga)'],
  ['nakshatra', 'Nakshatra Dasa Progression (based on chosen varga)'],
  ['bhrigu', 'Bhrigu Pada Progression (based on chosen varga)'],
  ['scd', 'Sudarsana Chakra Dasa Progression'],
];

type Form = Omit<ProgressionInput, 'kind'>;

function today(): Form {
  const d = new Date();
  return { varga: 0, body: 2, dasa: 0, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours() + d.getMinutes() / 60 };
}

export function ProgressionsView({ natalSpec, docId }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const doc = useActiveDoc();
  const active = doc?.derived?.kind === 'progression' ? (doc.derived.params as unknown as ProgressionInput) : null;
  const [form, setForm] = useState<Form>(() => active ?? today());
  const [request, setRequest] = useState<ProgressionInput | null>(null);
  const found = useJob(request ? { kind: 'table' as const, chart: natalSpec, table: 'progression.find', params: { ...request } } : null);
  const shown = useJob(active ? { kind: 'table' as const, chart: natalSpec, table: 'progression.find', params: { ...active } } : null);

  useEffect(() => {
    if (!request || !found.data?.text?.[0]) return;
    const { birth, label } = JSON.parse(found.data.text[0]) as { birth: BirthData; label: string };
    updateChart(docId, { derived: { kind: 'progression', label, birth, params: { ...request } } });
    setRequest(null);
  }, [found.data, request, docId]);

  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const h = Math.floor(form.hour), m = Math.floor((form.hour - h) * 60 + 1e-9), s = Math.round(((form.hour - h) * 60 - m) * 60);
  const setTime = (hh: number, mm: number, ss: number) => set({ hour: hh + mm / 60 + ss / 3600 });

  return (
    <div className="subview progressions-form">
      <div className="subview-bar">
        <label>Varga
          <select value={form.varga} onChange={(e) => set({ varga: Number(e.target.value) })}>
            {PROG_VARGA_LABELS.map((v, i) => <option key={v} value={i}>{v}</option>)}
          </select>
        </label>
        <label>Nakshatra dasa
          <select value={form.dasa ?? 0} onChange={(e) => set({ dasa: Number(e.target.value) })}>
            {PROG_DASAS.map(([v], i) => <option key={v} value={i}>{v}</option>)}
          </select>
        </label>
        <label>Dasa seed
          <select value={form.body ?? 2} onChange={(e) => set({ body: Number(e.target.value) })}>
            {PROG_BODIES.map((v, i) => <option key={v} value={i}>{v}</option>)}
          </select>
        </label>
      </div>
      <div className="subview-bar">
        <label>Date
          <select value={form.month} onChange={(e) => set({ month: Number(e.target.value) })}>
            {MONTHS.map((v, i) => <option key={v} value={i + 1}>{v}</option>)}
          </select>
          <input type="number" min={1} max={31} value={form.day} onChange={(e) => set({ day: Number(e.target.value) })} style={{ width: '4em' }} />
          <input type="number" value={form.year} onChange={(e) => set({ year: Number(e.target.value) })} style={{ width: '6em' }} />
        </label>
        <label>Time
          <input type="number" min={0} max={23} value={h} onChange={(e) => setTime(Number(e.target.value), m, s)} style={{ width: '4em' }} />:
          <input type="number" min={0} max={59} value={m} onChange={(e) => setTime(h, Number(e.target.value), s)} style={{ width: '4em' }} />:
          <input type="number" min={0} max={59} value={s} onChange={(e) => setTime(h, m, Number(e.target.value))} style={{ width: '4em' }} />
        </label>
        <span className="status">(natal time zone)</span>
      </div>
      <div className="subview-bar">
        {BUTTONS.map(([kind, label]) => <button key={kind} onClick={() => setRequest({ ...form, kind })}>{label}</button>)}
        {active && <button onClick={() => updateChart(docId, { derived: null })}>Back to Natal Chart</button>}
        {/* button 1002 (handler 0x4853e0, MixedChartDialog.tsx) */}
        <MixedChartButton label="Show a BIG Mixed Progressed-Natal Chart!" natalSpec={natalSpec}
          outerSpec={doc?.derived ? { ...natalSpec, birth: doc.derived.birth } : null} outerName={doc?.derived?.label ?? ''} />
      </div>
      {found.status === 'loading' && <p className="status">Computing the progression…</p>}
      {found.status === 'error' && <p className="error">{found.error}</p>}
      {active && <TableView job={shown} />}
    </div>
  );
}
