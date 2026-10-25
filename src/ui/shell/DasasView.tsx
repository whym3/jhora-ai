import { useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { OTHER_DASAS, RASI_DASAS } from '../../core/dasas/registry';
import { setIni, useActiveDoc, useStore, type DerivedChart } from '../state/store';
import { applyYearDefinition, dasaSlot, YEAR_DEFINITION_NAMES, YEAR_MENU } from '../../core/dasas/yearDefinition';

/** Nakshatra dasa systems in JHora's menu order. */
export const NAKSHATRA_DASA_SYSTEMS = [
  'Vimsottari', 'Ashtottari', 'Kalachakra', 'Yogini', 'Dwisaptati sama', 'Shattrimsa sama', 'Dwadasottari',
  'Chaturaseeti sama', 'Sataabdika', 'Shodasottari', 'Panchottari', 'Shashtihayani', 'Saptarshi nakshatra',
] as const;

const MAX_DEPTH = 6;

/**
 * Dasas > Nakshatra dasas. Like JHora's dasa pane, clicking a period divides it
 * into its sub-periods; "Up" returns to the parent level.
 */
export function NakshatraDasasView({ spec }: { spec: ChartSpec }) {
  return <DasaPane spec={spec} table="dasas.nakshatra" systems={NAKSHATRA_DASA_SYSTEMS} />;
}

/** Rasi dasa systems ported so far, in JHora's menu order. */
export const RASI_DASA_SYSTEMS = Object.keys(RASI_DASAS);

export function RasiDasasView({ spec }: { spec: ChartSpec }) {
  return <DasaPane spec={spec} table="dasas.rasi" systems={RASI_DASA_SYSTEMS} />;
}

/** Other (graha) dasa systems, in JHora's menu order. */
export const OTHER_DASA_SYSTEMS = Object.keys(OTHER_DASAS);

export function OtherDasasView({ spec }: { spec: ChartSpec }) {
  return <DasaPane spec={spec} table="dasas.other" systems={OTHER_DASA_SYSTEMS} />;
}

export type DasaTable = 'dasas.nakshatra' | 'dasas.rasi' | 'dasas.other';

/**
 * The job of one dasa on the chart shown. With a derived chart (Tajaka, Tithi Pravesha,
 * mundane, prasna, angular return, progression) the job runs on the natal chart with
 * params.derived (engine/jobs.ts derivedDasaJob), which compresses the dasas into the
 * chart's period of effect as JHora does; `spec` is the chart shown (derived birth).
 */
export function dasaJob(spec: ChartSpec, natalBirth: ChartSpec['birth'] | undefined, derived: DerivedChart | null | undefined,
  table: DasaTable, system: string, path: number[]) {
  if (!derived || !natalBirth) return { kind: 'table' as const, chart: spec, table, params: { system, path } };
  return {
    kind: 'table' as const, chart: { ...spec, birth: natalBirth }, table,
    params: { system, path, derived: { kind: derived.kind, label: derived.label, birth: derived.birth, params: derived.params } },
  };
}

function DasaPane({ spec, table, systems }: { spec: ChartSpec; table: DasaTable; systems: readonly string[] }) {
  const doc = useActiveDoc();
  const [system, setSystem] = useState<string>(systems[0]);
  const [path, setPath] = useState<number[]>([]);
  const job = useJob(dasaJob(spec, doc?.birth, doc?.derived, table, system, path));
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Dasa system" value={system} onChange={(e) => { setSystem(e.target.value); setPath([]); }}>
          {systems.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setPath((p) => p.slice(0, -1))} disabled={!path.length}>Up</button>
        {doc?.derived && <span className="status">{doc.derived.label}</span>}
        <YearDefinitionMenu slot={dasaSlot(table, system)} />
      </div>
      <TableView job={job} onRowClick={path.length < MAX_DEPTH - 1 && job.data?.drill !== false ? (i) => setPath((p) => [...p, i]) : undefined} />
    </div>
  );
}

/**
 * A dasa of the derived chart shown, embedded in a form tab (Tajaka dialog 2009 "Mudda" /
 * Narayana links, Tithi Pravesha dialog 2012 and angular return dialog 2061 dasa buttons):
 * the same job as the Dasas tab, with the system chosen by the form's buttons.
 */
export function DerivedDasaPane({ natalSpec, derived, choices }: {
  natalSpec: ChartSpec; derived: DerivedChart;
  /** [button label, table, system] */
  choices: readonly (readonly [string, DasaTable, string])[];
}) {
  const [pick, setPick] = useState(0);
  const [path, setPath] = useState<number[]>([]);
  const [, table, system] = choices[pick] ?? choices[0];
  const job = useJob(dasaJob({ ...natalSpec, birth: derived.birth }, natalSpec.birth, derived, table, system, path));
  return (
    <>
      <div className="subview-bar">
        {choices.map(([label], i) => (
          <button key={label} aria-pressed={i === pick} onClick={() => { setPick(i); setPath([]); }}>{label}</button>
        ))}
        <button onClick={() => setPath((p) => p.slice(0, -1))} disabled={!path.length}>Up</button>
      </div>
      <TableView job={job} onRowClick={path.length < MAX_DEPTH - 1 && job.data?.drill !== false ? (i) => setPath((p) => [...p, i]) : undefined} />
    </>
  );
}

/**
 * The dasa pane's "Definition of year in dasas" submenu (menu 108: 32882 / 33419 / 33418 /
 * 32885 / 32883 / 32886 / 32884) with FUN_00450290's dialog: user year length (dialog 143),
 * scope (this dasa / all dasas / this category) and the special years of Tajaka and TP charts.
 */
function YearDefinitionMenu({ slot }: { slot: number }) {
  const ini = useStore((s) => s.ini);
  const [open, setOpen] = useState(false);
  const [def, setDef] = useState(ini.YearDefinition[slot] ?? 3);
  const [days, setDays] = useState(ini.YearLength[slot] ?? 365.24219);
  const [scope, setScope] = useState<0 | 1 | 2>(0);
  if (!open) {
    return <button onClick={() => { setDef(ini.YearDefinition[slot] ?? 3); setDays(ini.YearLength[slot] ?? 365.24219); setOpen(true); }}
      title={YEAR_DEFINITION_NAMES[ini.YearDefinition[slot] ?? 3]}>Year…</button>;
  }
  return (
    <span className="year-definition">
      <select aria-label="Definition of year in dasas" value={def} onChange={(e) => setDef(Number(e.target.value))}>
        {YEAR_MENU.map((v) => <option key={v} value={v}>{YEAR_DEFINITION_NAMES[v]}</option>)}
      </select>
      {def === 2 && <label>Days <input type="number" step="any" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: '7em' }} /></label>}
      <select aria-label="Apply to" value={scope} onChange={(e) => setScope(Number(e.target.value) as 0 | 1 | 2)}>
        <option value={0}>This dasa only</option>
        <option value={1}>All dasas</option>
        <option value={2}>All dasas of this category</option>
      </select>
      <label><input type="checkbox" checked={!!ini.SpecialYearForTajaka} onChange={(e) => setIni({ SpecialYearForTajaka: e.target.checked ? 1 : 0 })} /> Sun-based year in Tajaka charts</label>
      <label><input type="checkbox" checked={!!ini.SpecialYearForTP} onChange={(e) => setIni({ SpecialYearForTP: e.target.checked ? 1 : 0 })} /> Tithi-based year in TP charts</label>
      <button onClick={() => { setIni(applyYearDefinition(ini, slot, def, days, scope)); setOpen(false); }}>OK</button>
      <button onClick={() => setOpen(false)}>Cancel</button>
    </span>
  );
}
