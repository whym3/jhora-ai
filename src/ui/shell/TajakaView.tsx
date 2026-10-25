// Tajaka tab (CTajakaFormView, dialog 2009): year / month / sub-period inputs,
// "Find Tajaka Chart" and "Find Tajaka Sunrise Chart" (the found chart then
// replaces the natal chart in every view), and the form's dasa links for that
// chart: Mudda (button 1008, Vimsottari with the natal seed) and Narayana dasa,
// both compressed into the Tajaka period as the Dasas tab shows them.
import { useEffect, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { TajakaSelection, TajakaVariant } from '../../core/tajaka/annual';
import type { BirthData } from '../../core/jhd';
import { useJob } from '../EngineProvider';
import { updateChart, useActiveDoc } from '../state/store';
import { DerivedDasaPane, type DasaTable } from './DasasView';
import { MixedChartButton } from './MixedChartDialog';

const DASA_LINKS: readonly (readonly [string, DasaTable, string])[] = [['Mudda dasa', 'dasas.nakshatra', 'Vimsottari'], ['Narayana dasa', 'dasas.rasi', 'Narayana']];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const SUBS: [keyof TajakaSelection, string][] = [['sixtyHour', '60-hour period'], ['fiveHour', '5-hour period'], ['twentyFiveMin', '25-minute period'], ['twoMin', '2-minute period']];

interface Request { selection: TajakaSelection; variant: TajakaVariant }

export function TajakaView({ natalSpec, docId }: { natalSpec: ChartSpec; docId: string }) {
  const doc = useActiveDoc();
  const [sel, setSel] = useState<TajakaSelection>(() => (doc?.derived?.params.selection as TajakaSelection | undefined) ?? { year: new Date().getFullYear() });
  const [request, setRequest] = useState<Request | null>(null);
  const found = useJob(request ? { kind: 'table' as const, chart: natalSpec, table: 'tajaka.find', params: { ...request } } : null);
  const active = doc?.derived?.kind === 'tajaka' ? doc.derived : null;

  // once found, switch every view to the Tajaka chart
  useEffect(() => {
    if (!request || !found.data?.text?.[0]) return;
    const { birth, label } = JSON.parse(found.data.text[0]) as { birth: BirthData; label: string };
    updateChart(docId, { derived: { kind: 'tajaka', label, birth, params: { ...request } } });
    setRequest(null);
  }, [found.data, request, docId]);

  // a sub-period only counts when the level above it is chosen
  const set = (k: keyof TajakaSelection, v: number | undefined) => {
    const next = { ...sel, [k]: v };
    const order: (keyof TajakaSelection)[] = ['month', 'sixtyHour', 'fiveHour', 'twentyFiveMin', 'twoMin'];
    for (let i = order.indexOf(k) + 1; i < order.length && !v; i++) delete next[order[i]];
    setSel(next);
  };
  const levelOn = (i: number) => (i === 0 ? !!sel.month : !!sel[SUBS[i - 1][0]]);

  return (
    <div className="subview tajaka-form">
      <div className="subview-bar">
        <label>Year <input type="number" value={sel.year} onChange={(e) => setSel({ ...sel, year: Number(e.target.value) })} style={{ width: '6em' }} /></label>
        <label>Month
          <select value={sel.month ?? 0} onChange={(e) => set('month', Number(e.target.value) || undefined)}>
            <option value={0}>None</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        {SUBS.map(([k, label], i) => (
          <label key={k}>{label}
            <select value={(sel[k] as number | undefined) ?? 0} disabled={!levelOn(i)} onChange={(e) => set(k, Number(e.target.value) || undefined)}>
              <option value={0}>None</option>
              {ORD.map((o, j) => <option key={o} value={j + 1}>{o}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="subview-bar">
        <button onClick={() => setRequest({ selection: sel, variant: 'exact' })}>Find Tajaka Chart</button>
        <button onClick={() => setRequest({ selection: sel, variant: 'sunrise' })}>Find Tajaka Sunrise Chart</button>
        {active && <button onClick={() => updateChart(docId, { derived: null })}>Back to Natal Chart</button>}
        {/* button 1012 (handler 0x4853e0, MixedChartDialog.tsx) */}
        <MixedChartButton label="Show Mixed Tajaka-Natal Chart!" natalSpec={natalSpec} outerSpec={doc?.derived ? { ...natalSpec, birth: doc.derived.birth } : null} outerName={doc?.derived?.label ?? ''} />
      </div>
      {found.status === 'loading' && <p className="status">Searching for the Tajaka chart…</p>}
      {found.status === 'error' && <p className="error">{found.error}</p>}
      {active && <DerivedDasaPane key={JSON.stringify(active.birth)} natalSpec={natalSpec} derived={active} choices={DASA_LINKS} />}
    </div>
  );
}
