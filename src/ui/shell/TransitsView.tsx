// Transits tab: one component per JHora sub-tab (see src/core/transits/common.ts).
//   Basic Transit Results  CTransitFormView (dialog 2013) + CTransitView list (menu 143 modes)
//   Transit Calendar       CTranCalenFormView (dialog 2048) + CTransitCalenView (drawn; shown as a table)
//   Special Search         CTransitConjFormView (dialog 2024) + CTransitView of the found chart
//   Longitude Correlation  CTranResearchFormView (dialog 2069) + CTranResearchView list
// `spec` is the natal chart. Dates are natal-zone clock times except on the
// Longitude Correlation form, whose time zone JHora does apply.
import { useState, type ComponentType } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { TransitDate, NatalRef } from '../../core/transits/common';
import { NATAL_REFS, VARGA_LABEL } from '../../core/transits/common';
import { BASIC_MODES } from '../../core/transits/basic';
import { CALENDAR_ITEMS } from '../../core/transits/calendar';
import { NATAL_SEARCH_BODIES, SEARCH_VARGAS, type SpecialSearch } from '../../core/transits/search';
import { STEPS } from '../../core/transits/correlation';
import { SAHAMAS } from '../../core/sahamas';
import { SIGN_NAMES } from '../../core/zodiac';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BODIES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
/** Varga combos 1009/1012 of dialog 2048 (no D-81; index used as JHora's varga index, see calendar.ts). */
const CAL_VARGAS = ['Rasi (D-1)', 'Navamsa (D-9)', 'Hora (D-2)', 'Drekkana (D-3)', 'Chaturthamsa (D-4)', 'Panchamsa (D-5)', 'Shashthamsa (D-6)',
  'Saptamsa (D-7)', 'Ashtamsa (D-8)', 'Dasamsa (D-10)', 'Rudramsa (D-11)', 'Dwadasamsa (D-12)', 'Shodasamsa (D-16)', 'Vimsamsa (D-20)',
  'Siddhamsa (D-24)', 'Nakshatramsa (D-27)', 'Trimsamsa (D-30)', 'Khavedamsa (D-40)', 'Akshavedamsa (D-45)', 'Shashtyamsa (D-60)',
  'Ashtottaramsa (D-108)', 'Dwadasamsa-Dwadasamsa (D-144)'];

function now(): TransitDate {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600 };
}

function Select({ value, options, onChange, label }: { value: number; options: readonly string[]; onChange: (v: number) => void; label?: string }) {
  return <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value))}>{options.map((o, i) => <option key={`${o}-${i}`} value={i}>{o}</option>)}</select>;
}

/** Month combo 1003, day edit 100, year edit 101, h/m/s edits 1004/1005/1006. */
function DateFields({ value, onChange }: { value: TransitDate; onChange: (d: TransitDate) => void }) {
  const h = Math.floor(value.hour), mf = (value.hour - h) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  const setHms = (hh: number, mm: number, ss: number) => onChange({ ...value, hour: hh + mm / 60 + ss / 3600 });
  const n = (v: number, w = '4em') => ({ value: v, style: { width: w } });
  return (
    <>
      <label>Date <Select label="Month" value={value.month - 1} options={MONTHS} onChange={(i) => onChange({ ...value, month: i + 1 })} />
        <input type="number" aria-label="Day" {...n(value.day, '3.5em')} onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
        <input type="number" aria-label="Year" {...n(value.year, '5em')} onChange={(e) => onChange({ ...value, year: Number(e.target.value) })} /></label>
      <label>Time <input type="number" aria-label="Hours" {...n(h, '3.5em')} onChange={(e) => setHms(Number(e.target.value), m, s)} />:
        <input type="number" aria-label="Minutes" {...n(m, '3.5em')} onChange={(e) => setHms(h, Number(e.target.value), s)} />:
        <input type="number" aria-label="Seconds" {...n(s, '3.5em')} onChange={(e) => setHms(h, m, Number(e.target.value))} /></label>
    </>
  );
}

/** CTransitView: the mode select (menu 143) and its options, for a transit date (or the natal chart when null). */
function TransitList({ spec, date }: { spec: ChartSpec; date: TransitDate | null }) {
  const [mode, setMode] = useState(0);
  const [ref, setRef] = useState<NatalRef>('Moon');
  const [refVarga, setRefVarga] = useState(0);
  const [avN, setAvN] = useState(0);
  const [avT, setAvT] = useState(0);
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'transits.basic', params: { date: date ?? undefined, mode, ref, refVarga, avNatalVarga: avN, avTransitVarga: avT } });
  return (
    <>
      <div className="subview-bar">
        <Select label="Transit mode" value={mode} options={BASIC_MODES.map((m) => m[0])} onChange={setMode} />
        {mode === 0 && <>
          <label>Natal reference <Select value={NATAL_REFS.indexOf(ref)} options={['Moon', 'Lagna', 'Arudha lagna']} onChange={(i) => setRef(NATAL_REFS[i])} /></label>
          <label>in <Select value={refVarga} options={VARGA_LABEL} onChange={setRefVarga} /></label>
        </>}
        {mode === 2 && <>
          <label>Natal varga <Select value={avN} options={VARGA_LABEL} onChange={setAvN} /></label>
          <label>Transit varga <Select value={avT} options={VARGA_LABEL} onChange={setAvT} /></label>
        </>}
      </div>
      <TableView job={job} />
    </>
  );
}

/** Basic Transit Results: dialog 2013 ("Show Transit Calculations" 1001, "Back to Natal Chart" 1000) + CTransitView. */
export function BasicTransitView({ spec }: { spec: ChartSpec }) {
  const [form, setForm] = useState<TransitDate>(now);
  const [date, setDate] = useState<TransitDate | null>(null);
  return (
    <div className="subview transits-form">
      <div className="subview-bar">
        <DateFields value={form} onChange={setForm} />
        <button onClick={() => setDate({ ...form })}>Show Transit Calculations</button>
        {date && <button onClick={() => setDate(null)}>Back to Natal Chart</button>}
      </div>
      <p className="status">Time is taken in the natal time zone, as JHora does.</p>
      <TransitList spec={spec} date={date} />
    </div>
  );
}

/** Transit Calendar: dialog 2048 and the calendar it opens. */
export function TransitCalendarView({ spec }: { spec: ChartSpec }) {
  const [form, setForm] = useState({ start: now(), stepDays: 1, rows: 15, natalVarga: 0, transitVarga: 0, items: [true, true, true, true, true, true] });
  const [request, setRequest] = useState<typeof form | null>(null);
  const job = useJob(request ? { kind: 'table' as const, chart: spec, table: 'transits.calendar', params: { ...request } } : null);
  return (
    <div className="subview transits-form">
      <div className="subview-bar">
        <DateFields value={form.start} onChange={(start) => setForm({ ...form, start })} />
        <label>every <input type="number" step="any" value={form.stepDays} style={{ width: '4em' }} onChange={(e) => setForm({ ...form, stepDays: Number(e.target.value) })} /> days</label>
        <label>rows <input type="number" value={form.rows} min={0} max={100} style={{ width: '4em' }} onChange={(e) => setForm({ ...form, rows: Number(e.target.value) })} /></label>
      </div>
      <div className="subview-bar">
        <label>Natal chart <Select value={form.natalVarga} options={CAL_VARGAS} onChange={(natalVarga) => setForm({ ...form, natalVarga })} /></label>
        <label>Transit chart <Select value={form.transitVarga} options={CAL_VARGAS} onChange={(transitVarga) => setForm({ ...form, transitVarga })} /></label>
      </div>
      <div className="subview-bar">
        {CALENDAR_ITEMS.map((label, i) => (
          <label key={label}><input type="checkbox" checked={form.items[i]} onChange={(e) => setForm({ ...form, items: form.items.map((x, k) => (k === i ? e.target.checked : x)) })} /> {label}</label>
        ))}
        <button onClick={() => setRequest({ ...form, rows: Math.min(100, form.rows) })}>Show Transit Calendar</button>
      </div>
      {request && <TableView job={job} />}
    </div>
  );
}

/** Special Search: dialog 2024; the found moment becomes the transit chart of the list below. */
export function SpecialSearchView({ spec }: { spec: ChartSpec }) {
  const [f, setF] = useState({ planet: 5, deg: 0, min: 0, sec: 0, ahead: 0, radio: 1, body: 0, saham: 0, sign: 0, varga: 0, after: 0, date: now() });
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF({ ...f, [k]: v });
  const [request, setRequest] = useState<SpecialSearch | null>(null);
  const job = useJob(request ? { kind: 'table' as const, chart: spec, table: 'transits.search', params: { ...request } } : null);
  const found = job.status === 'done' && job.data?.text?.[0] ? (JSON.parse(job.data.text[0]) as { date: TransitDate }).date : null;
  const search = () => setRequest({
    planet: f.planet, deg: f.deg, min: f.min, sec: f.sec, ahead: !!f.ahead, after: !!f.after, date: f.date,
    ref: f.radio === 0 ? { kind: 'planet', body: NATAL_SEARCH_BODIES[f.body], varga: f.varga } : f.radio === 1 ? { kind: 'saham', index: f.saham } : { kind: 'sign', sign: f.sign },
  });
  const num = (k: 'deg' | 'min' | 'sec') => <input type="number" aria-label={k} value={f[k]} style={{ width: '4em' }} onChange={(e) => set(k)(Number(e.target.value))} />;
  return (
    <div className="subview transits-form">
      <div className="subview-bar">
        Find when <Select label="Transit planet" value={f.planet} options={BODIES} onChange={set('planet')} /> transited exactly
        {num('deg')} deg {num('min')} min {num('sec')} sec <Select value={f.ahead} options={['behind', 'ahead of']} onChange={set('ahead')} />
      </div>
      <div className="subview-bar">
        <label><input type="radio" checked={f.radio === 0} onChange={() => set('radio')(0)} /> Natal planet</label>
        <Select value={f.body} options={NATAL_SEARCH_BODIES} onChange={(v) => setF({ ...f, body: v, radio: 0 })} />
        <label>in <Select value={f.varga} options={SEARCH_VARGAS} onChange={set('varga')} /></label>
        <label><input type="radio" checked={f.radio === 1} onChange={() => set('radio')(1)} /> Natal Saham</label>
        <Select value={f.saham} options={SAHAMAS.map((s) => `${s.name} (${s.meaning})`)} onChange={(v) => setF({ ...f, saham: v, radio: 1 })} />
        <label><input type="radio" checked={f.radio === 2} onChange={() => set('radio')(2)} /> The beginning of</label>
        <Select value={f.sign} options={SIGN_NAMES} onChange={(v) => setF({ ...f, sign: v, radio: 2 })} />
      </div>
      <div className="subview-bar">
        <Select value={f.after} options={['before', 'after']} onChange={set('after')} /> the following date and time:
        <DateFields value={f.date} onChange={set('date')} />
        <button onClick={search}>Search for Transit</button>
        {request && <button onClick={() => setRequest(null)}>Back to Natal Chart</button>}
      </div>
      {request && <TableView job={job} />}
      {found && <TransitList spec={spec} date={found} />}
    </div>
  );
}

/** Longitude Correlation: dialog 2069 + CTranResearchView. */
export function LongitudeCorrelationView({ spec }: { spec: ChartSpec }) {
  const [f, setF] = useState({ date: now(), tz: spec.birth.tzHours, mode: 0, minPercent: 80, orbAspect: 4, orbQuadrant: 4, orbTrine: 4, step: 2 });
  const [request, setRequest] = useState<typeof f>(f);
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'transits.correlation', params: { ...request } });
  const show = (next = f) => { setF(next); setRequest(next); };
  const move = (dir: 1 | -1) => show({ ...f, date: stepDate(f.date, f.step, dir) });
  const n = (k: 'minPercent' | 'orbAspect' | 'orbQuadrant' | 'orbTrine') => <input type="number" step="any" value={f[k]} style={{ width: '4em' }} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />;
  const radios = [
    ["Quantify aspects based on Parasara's teachings and show aspects greater than this percentage", n('minPercent')],
    ['Consider conjunction, full, three-quarter and half aspects within an orb of (deg)', n('orbAspect')],
    ['Consider perfect quadrants from natal points within an orb of (deg)', n('orbQuadrant')],
    ['Consider perfect trines and 7th from natal points within an orb of (deg)', n('orbTrine')],
  ] as const;
  return (
    <div className="subview transits-form">
      <div className="subview-bar">
        <DateFields value={f.date} onChange={(date) => setF({ ...f, date })} />
        <label>Time zone <input type="number" step="any" value={Math.abs(f.tz)} style={{ width: '4em' }} onChange={(e) => setF({ ...f, tz: Math.sign(f.tz || 1) * Number(e.target.value) })} /></label>
        <Select value={f.tz < 0 ? 1 : 0} options={['East of GMT', 'West of GMT']} onChange={(i) => setF({ ...f, tz: (i ? -1 : 1) * Math.abs(f.tz) })} />
      </div>
      {radios.map(([label, input], i) => (
        <div className="subview-bar" key={label}><label><input type="radio" checked={f.mode === i} onChange={() => setF({ ...f, mode: i })} /> {label}</label> {input}</div>
      ))}
      <div className="subview-bar">
        <button onClick={() => show()}>Show Natal Points Aspected in Transit</button>
        <button onClick={() => move(-1)}>&lt;&lt;</button>
        <Select value={f.step} options={STEPS} onChange={(step) => setF({ ...f, step })} />
        <button onClick={() => move(1)}>&gt;&gt;</button>
      </div>
      <TableView job={job} />
    </div>
  );
}

/** Combo 1080 stepping (0x486670 / 0x486940): calendar steps for Year / 3 Months / Month, day counts otherwise. */
function stepDate(d: TransitDate, step: number, dir: 1 | -1): TransitDate {
  if (step === 0) return { ...d, year: d.year + dir };
  if (step <= 2) {
    const m0 = d.month - 1 + dir * (step === 1 ? 3 : 1);
    return { ...d, year: d.year + Math.floor(m0 / 12), month: ((m0 % 12) + 12) % 12 + 1 };
  }
  const t = Date.UTC(d.year, d.month - 1, d.day) + d.hour * 3600e3 + dir * [0, 0, 0, 10, 5, 1, 1 / 24][step] * 86400e3;
  const x = new Date(t);
  return { year: x.getUTCFullYear(), month: x.getUTCMonth() + 1, day: x.getUTCDate(), hour: x.getUTCHours() + x.getUTCMinutes() / 60 + x.getUTCSeconds() / 3600 };
}

export const TRANSIT_VIEWS: Record<string, ComponentType<{ spec: ChartSpec }>> = {
  'Basic Transit Results': BasicTransitView,
  'Transit Calendar': TransitCalendarView,
  'Special Search': SpecialSearchView,
  'Longitude Correlation': LongitudeCorrelationView,
};
