// Miscellany > Prasna (Horary) (CPrasnaFormView, dialog 2033): a number fixes the Prasna
// Lagna (108 navamsas, 249 KP subs or 1800 nadis). The chart (the natal moment, i.e. the
// time of the question) becomes derived kind 'prasna'; with "Just replace lagna" its lagna
// is the Prasna Lagna, otherwise PLag is listed separately. Optional dasa compression.
import { useEffect, useRef, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { BirthData } from '../../core/jhd';
import { PRASNA_LIMIT, type PrasnaMode } from '../../core/derived/prasna';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { updateChart, useActiveDoc, useStore } from '../state/store';

const MODES: [PrasnaMode, string, string][] = [
  ['108', 'Prasna-108 Mode', 'Enter a number between 1 and 108 (inclusive). This will fix the rasi and navamsa of Prasna Lagna (PLag).'],
  ['249', 'Prasna-249 Mode (KP)', 'Enter a number between 1 and 249 (inclusive). This will fix the rasi, nakshatra and sub of Prasna Lagna (PLag).'],
  ['nadi', 'Nadi Prasna Mode', 'Enter a number between 1 and 1800 (inclusive). This will fix the rasi and nadi of Prasna Lagna (PLag).'],
];

export function PrasnaView({ natalSpec, docId }: { natalSpec: ChartSpec; docId: string; spec: ChartSpec }) {
  const doc = useActiveDoc();
  const iniReplace = useStore((s) => s.ini.ReplaceLagnaInPrasna) !== 0;
  const [nums, setNums] = useState<Record<PrasnaMode, number>>({ '108': 1, '249': 1, nadi: 1 });
  const [replace, setReplace] = useState(iniReplace);
  const [compress, setCompress] = useState(false);
  const [years, setYears] = useState(1);
  const [days, setDays] = useState(0);
  const [request, setRequest] = useState<Record<string, unknown> | null>(null);
  const stale = useRef<unknown>(null);
  const found = useJob(request ? { kind: 'table' as const, chart: natalSpec, table: 'prasna.find', params: request } : null);
  const active = doc?.derived?.kind === 'prasna' ? doc.derived : null;
  const [path, setPath] = useState<number[]>([]);
  const dasa = useJob(active && active.params.periodDays
    ? { kind: 'table' as const, chart: natalSpec, table: 'prasna.dasa', params: { birth: active.birth, label: active.label, periodDays: active.params.periodDays, path } }
    : null);
  const info = useJob(active ? { kind: 'table' as const, chart: natalSpec, table: 'prasna.find', params: active.params } : null);

  useEffect(() => {
    if (!request || found.status !== 'done' || found.data === stale.current || !found.data?.text?.[0]) return;
    const { birth, label, periodDays } = JSON.parse(found.data.text[0]) as { birth: BirthData; label: string; periodDays: number };
    updateChart(docId, { derived: { kind: 'prasna', label, birth, params: { ...request, periodDays } } });
    setRequest(null);
    setPath([]);
  }, [found.data, found.status, request, docId]);

  const go = (mode: PrasnaMode) => {
    stale.current = found.data;
    setRequest({ mode, n: nums[mode], replace, compress: compress ? { years, days } : null });
  };

  return (
    <div className="subview prasna-form">
      {active && <div className="subview-bar"><button onClick={() => updateChart(docId, { derived: null })}>Back to Natal Chart</button></div>}
      {MODES.map(([mode, button, help], i) => (
        <div className="subview-bar" key={mode}>
          <input type="number" min={1} max={PRASNA_LIMIT[mode]} value={nums[mode]} onChange={(e) => setNums({ ...nums, [mode]: Number(e.target.value) })} style={{ width: '5em' }} />
          <button onClick={() => go(mode)}>{button}</button>
          <span className="hint">({i + 1}) {help}</span>
        </div>
      ))}
      <fieldset>
        <legend>Which Lagna</legend>
        <label><input type="radio" checked={replace} onChange={() => setReplace(true)} /> Just replace lagna with Prasna Lagna derived from the number chosen.</label>
        <label><input type="radio" checked={!replace} onChange={() => setReplace(false)} /> Leave lagna as it is and show Prasna Lagna (PLag) as a separate body</label>
      </fieldset>
      <fieldset>
        <legend>Dasa Compression</legend>
        <label><input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} /> Compress dasas of the prasna chart to the following duration</label>
        <label>Years (of 365.24219 days) <input type="number" value={years} disabled={!compress} onChange={(e) => setYears(Number(e.target.value))} style={{ width: '5em' }} /></label>
        <label>Plus days <input type="number" value={days} disabled={!compress} onChange={(e) => setDays(Number(e.target.value))} style={{ width: '5em' }} /></label>
      </fieldset>
      {found.status === 'error' && <p className="error">{found.error}</p>}
      {active && <TableView job={info} />}
      {active && !!active.params.periodDays && (
        <>
          <div className="subview-bar">
            <strong>Vimsottari dasa (compressed)</strong>
            <button onClick={() => setPath((p) => p.slice(0, -1))} disabled={!path.length}>Up</button>
          </div>
          <TableView job={dasa} onRowClick={path.length < 5 ? (j) => setPath((p) => [...p, j]) : undefined} />
        </>
      )}
    </div>
  );
}
