// Mundane tab (CMundaneFormView, dialog 2010): swearing-in, transit, stationary,
// conjunction and eclipse charts, lunar and solar charts, lifecycle charts. The
// found chart replaces the natal chart in every view (derived kind 'mundane'),
// and its Vimsottari dasa is compressed into the chart's period of effect.
import { useEffect, useRef, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { BirthData } from '../../core/jhd';
import { ASPECTS, ECLIPSE_TYPES, MUNDANE_BODIES, TRANSIT_DIVISIONS } from '../../core/derived/mundane';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { updateChart, useActiveDoc } from '../state/store';

type Params = Record<string, unknown> & { mode: string };
const STATIONARY = MUNDANE_BODIES.slice(3);

function Select({ value, options, onChange }: { value: number; options: readonly string[]; onChange: (v: number) => void }) {
  return <select value={value} onChange={(e) => onChange(Number(e.target.value))}>{options.map((o, i) => <option key={o} value={i}>{o}</option>)}</select>;
}

export function MundaneView({ natalSpec, docId, spec }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const doc = useActiveDoc();
  const [f, setF] = useState({
    years: 4, days: 0, tBody: 1, division: 0, tAfter: 1, sBody: 0, sAfter: 1, c1: 1, c2: 2, aspect: 0, cAfter: 1,
    eNext: 1, eType: 0, eMax: 0, lyNext: 1, lmNext: 1, fnNext: 1, ldNext: 1, syNext: 1, smNext: 1, arNext: 1, cycle: 1,
  });
  const set = (k: keyof typeof f) => (v: number) => setF({ ...f, [k]: v });
  const [request, setRequest] = useState<Params | null>(null);
  const current = doc?.derived ? spec.birth : undefined;
  const found = useJob(request ? { kind: 'table' as const, chart: natalSpec, table: 'mundane.find', params: { ...request, current } } : null);
  const active = doc?.derived?.kind === 'mundane' ? doc.derived : null;
  const [path, setPath] = useState<number[]>([]);
  const stale = useRef<unknown>(null);
  const dasa = useJob(active && active.params.periodDays
    ? { kind: 'table' as const, chart: natalSpec, table: 'mundane.dasa', params: { birth: active.birth, label: active.label, periodDays: active.params.periodDays, path } }
    : null);

  useEffect(() => {
    // ignore the previous result still held while the new search starts
    if (!request || found.status !== 'done' || found.data === stale.current || !found.data?.text?.[0]) return;
    const { birth, label, periodDays } = JSON.parse(found.data.text[0]) as { birth: BirthData; label: string; periodDays: number };
    updateChart(docId, { derived: { kind: 'mundane', label, birth, params: { ...request, periodDays } } });
    setRequest(null);
    setPath([]);
  }, [found.data, found.status, request, docId]);

  const go = (p: Params) => { stale.current = found.data; setRequest(p); };
  const PN = ['Previous', 'Next'], BA = ['Before', 'After'];
  const lunarSolar: [string, string, keyof typeof f][] = [
    ['Lunar New Year', 'lunarYear', 'lyNext'], ['Lunar New Month', 'lunarMonth', 'lmNext'], ['Fortnight Chart', 'fortnight', 'fnNext'],
    ['New Lunar Day', 'lunarDay', 'ldNext'], ['Solar New Year', 'solarYear', 'syNext'], ['Solar New Month', 'solarMonth', 'smNext'],
    ['Ardra Pravesha', 'ardra', 'arNext'],
  ];

  return (
    <div className="subview mundane-form">
      <div className="subview-bar">
        <button onClick={() => go({ mode: 'swearingIn', years: f.years, days: f.days })}>Swearing-in Chart Mode</button>
        <label>Years (of 365.24219 days) <input type="number" value={f.years} onChange={(e) => set('years')(Number(e.target.value))} style={{ width: '5em' }} /></label>
        <label>Plus days <input type="number" value={f.days} onChange={(e) => set('days')(Number(e.target.value))} style={{ width: '5em' }} /></label>
      </div>
      <div className="subview-bar">
        <button onClick={() => go({ mode: 'transit', body: f.tBody, division: f.division, after: !!f.tAfter })}>Planetary Transit Mode</button>
        <Select value={f.tBody} options={MUNDANE_BODIES} onChange={set('tBody')} />
        <Select value={f.division} options={TRANSIT_DIVISIONS} onChange={set('division')} />
        <Select value={f.tAfter} options={BA} onChange={set('tAfter')} />
      </div>
      <div className="subview-bar">
        <button onClick={() => go({ mode: 'stationary', body: f.sBody, after: !!f.sAfter })}>Stationary Transit Mode</button>
        <Select value={f.sBody} options={STATIONARY} onChange={set('sBody')} />
        <Select value={f.sAfter} options={BA} onChange={set('sAfter')} />
      </div>
      <div className="subview-bar">
        <button onClick={() => go({ mode: 'conjunction', body1: f.c1, body2: f.c2, aspect: f.aspect, after: !!f.cAfter })}>Conjunction/Opposition Mode</button>
        <Select value={f.c1} options={MUNDANE_BODIES} onChange={set('c1')} />
        <Select value={f.c2} options={MUNDANE_BODIES} onChange={set('c2')} />
        <Select value={f.aspect} options={ASPECTS.map((a) => a[0])} onChange={set('aspect')} />
        <Select value={f.cAfter} options={BA} onChange={set('cAfter')} />
      </div>
      <div className="subview-bar">
        <button onClick={() => go({ mode: 'eclipse', next: !!f.eNext, type: f.eType, maximum: !!f.eMax })}>Eclipse Mode</button>
        <Select value={f.eNext} options={PN} onChange={set('eNext')} />
        <Select value={f.eType} options={ECLIPSE_TYPES} onChange={set('eType')} />
        <span>eclipse. Make a chart at</span>
        <Select value={f.eMax} options={['Start', 'Maximum']} onChange={set('eMax')} />
      </div>
      <div className="subview-bar">
        {lunarSolar.map(([label, mode, k]) => (
          <span key={mode} className="combo-button">
            <button onClick={() => go({ mode, next: !!f[k] })}>{label}</button>
            <Select value={f[k]} options={PN} onChange={set(k)} />
          </span>
        ))}
      </div>
      <div className="subview-bar">
        <button onClick={() => go({ mode: 'lifecycle', n: f.cycle })}>Lifecycle chart</button>
        <label>n <input type="number" min={1} max={10} value={f.cycle} onChange={(e) => set('cycle')(Number(e.target.value))} style={{ width: '4em' }} /></label>
        {doc?.derived && <button onClick={() => updateChart(docId, { derived: null })}>Back to Natal Chart</button>}
      </div>
      {found.status === 'loading' && <p className="status">Searching…</p>}
      {found.status === 'error' && <p className="error">{found.error}</p>}
      {found.data && found.data.rows.length > 1 && <TableView job={found} />}
      {active && (
        <>
          <div className="subview-bar">
            <strong>{active.label}</strong>
            {!!active.params.periodDays && <button onClick={() => setPath((p) => p.slice(0, -1))} disabled={!path.length}>Up</button>}
          </div>
          {!!active.params.periodDays && <TableView job={dasa} onRowClick={path.length < 5 ? (i) => setPath((p) => [...p, i]) : undefined} />}
        </>
      )}
    </div>
  );
}
