// Miscellany > Angular Return (CAngRetFormView, dialog 2061): two bodies, before/after,
// date, time and zone; "Find Angular Return Chart" replaces the natal chart by the
// chart where the angle between the bodies equals the natal angle. Its dasa buttons
// (1014 Vimsottari, 1017 Narayana, 1018 Tithi Ashtottari, 1023 Yoga Vimsottari) show
// those dasas compressed into the return's period (end - start, DAT_005922b0).
import { useEffect, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { BirthData } from '../../core/jhd';
import { ANGRET_BODIES, type AngularReturnInput } from '../../core/derived/angularReturn';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { updateChart, useActiveDoc } from '../state/store';
import { DerivedDasaPane, type DasaTable } from './DasasView';
import { MixedChartButton } from './MixedChartDialog';

const DASA_BUTTONS: readonly (readonly [string, DasaTable, string])[] = [
  ['Vimsottari dasa', 'dasas.nakshatra', 'Vimsottari'], ['Narayana dasa', 'dasas.rasi', 'Narayana'],
  ['Tithi Ashtottari dasa', 'dasas.other', 'Tithi Ashtottari'], ['Yoga Vimsottari dasa', 'dasas.other', 'Yoga Vimsottari'],
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function AngularReturnView({ natalSpec, docId }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const doc = useActiveDoc();
  const derived = doc?.derived?.kind === 'angularReturn' ? doc.derived : null;
  const active = derived ? (derived.params as unknown as AngularReturnInput) : null;
  const [form, setForm] = useState<AngularReturnInput>(() => {
    if (active) return active;
    const d = new Date();
    return { a: 1, b: 2, before: false, year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours() + d.getMinutes() / 60, tzHours: natalSpec.birth.tzHours };
  });
  const [request, setRequest] = useState<AngularReturnInput | null>(null);
  const found = useJob(request ? { kind: 'table' as const, chart: natalSpec, table: 'angularReturn.find', params: { ...request } } : null);
  const shown = useJob(active ? { kind: 'table' as const, chart: natalSpec, table: 'angularReturn.find', params: { ...active } } : null);

  useEffect(() => {
    if (!request || !found.data?.text?.[0]) return;
    const { birth, label, periodDays } = JSON.parse(found.data.text[0]) as { birth: BirthData; label: string; periodDays?: number };
    updateChart(docId, { derived: { kind: 'angularReturn', label, birth, params: { ...request, periodDays } } });
    setRequest(null);
  }, [found.data, request, docId]);

  const set = (patch: Partial<AngularReturnInput>) => setForm({ ...form, ...patch });
  const h = Math.floor(form.hour), m = Math.floor((form.hour - h) * 60 + 1e-9), s = Math.round(((form.hour - h) * 60 - m) * 60);
  const setTime = (hh: number, mm: number, ss: number) => set({ hour: hh + mm / 60 + ss / 3600 });
  const tz = Math.abs(form.tzHours), tzh = Math.floor(tz), tzm = Math.round((tz - tzh) * 60), east = form.tzHours >= 0;
  const setTz = (hh: number, mm: number, e: boolean) => set({ tzHours: (e ? 1 : -1) * (hh + mm / 60) });

  return (
    <div className="subview angular-return-form">
      <div className="subview-bar">
        <span>Find the angular return between</span>
        <select value={form.a} onChange={(e) => set({ a: Number(e.target.value) })}>
          {ANGRET_BODIES.map((v, i) => <option key={v} value={i}>{v}</option>)}
        </select>
        <span>and</span>
        <select value={form.b} onChange={(e) => set({ b: Number(e.target.value) })}>
          {ANGRET_BODIES.map((v, i) => <option key={v} value={i}>{v}</option>)}
        </select>
        <select value={form.before ? 0 : 1} onChange={(e) => set({ before: e.target.value === '0' })}>
          <option value={0}>before</option>
          <option value={1}>after</option>
        </select>
        <span>the following date and time.</span>
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
        <label>Time Zone
          <input type="number" min={0} max={14} value={tzh} onChange={(e) => setTz(Number(e.target.value), tzm, east)} style={{ width: '4em' }} />:
          <input type="number" min={0} max={59} value={tzm} onChange={(e) => setTz(tzh, Number(e.target.value), east)} style={{ width: '4em' }} />
          <select value={east ? 0 : 1} onChange={(e) => setTz(tzh, tzm, e.target.value === '0')}>
            <option value={0}>East of GMT</option>
            <option value={1}>West of GMT</option>
          </select>
        </label>
      </div>
      <div className="subview-bar">
        <button onClick={() => setRequest(form)}>Find Angular Return Chart</button>
        {active && <button onClick={() => updateChart(docId, { derived: null })}>Back to Natal Chart</button>}
        {/* dialog 2061 button 1019 (handler 0x4853e0, MixedChartDialog.tsx) */}
        <MixedChartButton label="Mixed TP-Natal Chart" natalSpec={natalSpec} outerSpec={doc?.derived ? { ...natalSpec, birth: doc.derived.birth } : null} outerName={doc?.derived?.label ?? ''} />
      </div>
      {found.status === 'loading' && <p className="status">Searching for the angular return…</p>}
      {found.status === 'error' && <p className="error">{found.error}</p>}
      {active && <TableView job={shown} />}
      {derived && <DerivedDasaPane key={JSON.stringify(derived.birth)} natalSpec={natalSpec} derived={derived} choices={DASA_BUTTONS} />}
    </div>
  );
}
