// Tithi Pravesha tab (CTPFormView, dialog 2012): year/month/day returns of the natal tithi
// (or nakshatra / yoga), or the return before/after a date. The found chart replaces the
// natal chart in every view (derived kind 'tithiPravesha'). The form's dasa buttons show
// Vimsottari, Tithi Ashtottari, Yoga Vimsottari and Narayana dasa of that chart, compressed
// into its period as the Dasas tab shows them (tithi years with SpecialYearForTP).
import { useEffect, useRef, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { BirthData } from '../../core/jhd';
import { PRAVESHA_BUTTON, PRAVESHA_TYPES, type PraveshaType, type TPDateSelection, type TPYearSelection } from '../../core/derived/tithiPravesha';
import { useJob } from '../EngineProvider';
import { updateChart, useActiveDoc } from '../state/store';
import { DerivedDasaPane, type DasaTable } from './DasasView';

/** The dasa buttons of dialog 2012 (plus Vimsottari, the Dasas tab default). */
const DASA_BUTTONS: readonly (readonly [string, DasaTable, string])[] = [
  ['Vimsottari dasa', 'dasas.nakshatra', 'Vimsottari'], ['Tithi Ashtottari dasa', 'dasas.other', 'Tithi Ashtottari'],
  ['Yoga Vimsottari dasa', 'dasas.other', 'Yoga Vimsottari'], ['Narayana dasa', 'dasas.rasi', 'Narayana'],
];

const ORD = ['None', ...Array.from({ length: 14 }, (_, i) => `${i + 1}${['st', 'nd', 'rd'][i] ?? 'th'}`)];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const KINDS = ['Annual chart', 'Monthly chart', 'Fortnightly chart', 'Daily chart'];

type Request = { mode: 'year'; selection: TPYearSelection } | { mode: 'date'; selection: TPDateSelection };

export function TithiPraveshaView({ natalSpec, docId }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const doc = useActiveDoc();
  const now = new Date();
  const [type, setType] = useState<PraveshaType>(0);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(0);
  const [daily, setDaily] = useState(false);
  const [day, setDay] = useState(1);
  const [d, setD] = useState({
    kind: 0 as TPDateSelection['kind'], before: false, year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
    h: now.getHours(), m: now.getMinutes(), s: 0, tz: natalSpec.birth.tzHours,
  });
  const [request, setRequest] = useState<Request | null>(null);
  const stale = useRef<unknown>(null);
  const found = useJob(request ? { kind: 'table' as const, chart: natalSpec, table: 'tithiPravesha.find', params: { ...request } } : null);
  const active = doc?.derived?.kind === 'tithiPravesha' ? doc.derived : null;

  useEffect(() => {
    if (!request || found.status !== 'done' || found.data === stale.current || !found.data?.text?.[0]) return;
    const { birth, label, periodDays } = JSON.parse(found.data.text[0]) as { birth: BirthData; label: string; periodDays: number };
    updateChart(docId, { derived: { kind: 'tithiPravesha', label, birth, params: { ...request, periodDays } } });
    setRequest(null);
  }, [found.data, found.status, request, docId]);

  const go = (r: Request) => { stale.current = found.data; setRequest(r); };
  const num = (set: (v: number) => void) => (e: { target: { value: string } }) => set(Number(e.target.value));

  return (
    <div className="subview tp-form">
      <div className="subview-bar">
        <label>Select which Pravesha chart you want
          <select value={type} onChange={(e) => setType(Number(e.target.value) as PraveshaType)}>
            {PRAVESHA_TYPES.map((t, i) => <option key={t} value={i}>{t}</option>)}
          </select>
        </label>
        {active && <button onClick={() => updateChart(docId, { derived: null })}>Back to Natal Chart</button>}
      </div>
      <fieldset>
        <legend>Use the data below</legend>
        <div className="subview-bar">
          <label>Year <input type="number" value={year} onChange={num(setYear)} style={{ width: '6em' }} /></label>
          <label>Month
            <select value={month} onChange={num(setMonth)}>{ORD.map((o, i) => <option key={o} value={i}>{o}</option>)}</select>
          </label>
          <label><input type="checkbox" checked={daily} disabled={!month} onChange={(e) => setDaily(e.target.checked)} /> Daily chart (1-30)</label>
          <input type="number" min={1} max={30} value={day} disabled={!daily || !month} onChange={num(setDay)} style={{ width: '4em' }} />
          <button onClick={() => go({ mode: 'year', selection: { type, year, month: month || undefined, day: daily && month ? day : undefined } })}>{PRAVESHA_BUTTON[type]}</button>
        </div>
      </fieldset>
      <fieldset>
        <legend>OR edit data and click</legend>
        <div className="subview-bar">
          <select value={d.kind} onChange={(e) => setD({ ...d, kind: Number(e.target.value) as TPDateSelection['kind'] })}>{KINDS.map((k, i) => <option key={k} value={i}>{k}</option>)}</select>
          <select value={d.before ? 0 : 1} onChange={(e) => setD({ ...d, before: e.target.value === '0' })}><option value={0}>before</option><option value={1}>after</option></select>
          <label>Date
            <select value={d.month} onChange={(e) => setD({ ...d, month: Number(e.target.value) })}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
            <input type="number" value={d.day} onChange={(e) => setD({ ...d, day: Number(e.target.value) })} style={{ width: '3.5em' }} />
            <input type="number" value={d.year} onChange={(e) => setD({ ...d, year: Number(e.target.value) })} style={{ width: '5em' }} />
          </label>
          <label>Time
            <input type="number" value={d.h} onChange={(e) => setD({ ...d, h: Number(e.target.value) })} style={{ width: '3.5em' }} />:
            <input type="number" value={d.m} onChange={(e) => setD({ ...d, m: Number(e.target.value) })} style={{ width: '3.5em' }} />:
            <input type="number" value={d.s} onChange={(e) => setD({ ...d, s: Number(e.target.value) })} style={{ width: '3.5em' }} />
          </label>
          <label>Time zone (hours, east +) <input type="number" step={0.25} value={d.tz} onChange={(e) => setD({ ...d, tz: Number(e.target.value) })} style={{ width: '4.5em' }} /></label>
          <button onClick={() => go({ mode: 'date', selection: { type, kind: d.kind, before: d.before, year: d.year, month: d.month, day: d.day, hour: d.h + d.m / 60 + d.s / 3600, tzHours: d.tz } })}>{PRAVESHA_BUTTON[type]}</button>
        </div>
      </fieldset>
      {found.status === 'loading' && <p className="status">Searching for the Pravesha chart…</p>}
      {found.status === 'error' && <p className="error">{found.error}</p>}
      {active && <DerivedDasaPane key={JSON.stringify(active.birth)} natalSpec={natalSpec} derived={active} choices={DASA_BUTTONS} />}
    </div>
  );
}
