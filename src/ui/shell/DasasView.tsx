import { useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { OTHER_DASAS, RASI_DASAS } from '../../core/dasas/registry';

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

function DasaPane({ spec, table, systems }: { spec: ChartSpec; table: string; systems: readonly string[] }) {
  const [system, setSystem] = useState<string>(systems[0]);
  const [path, setPath] = useState<number[]>([]);
  const job = useJob({ kind: 'table' as const, chart: spec, table, params: { system, path } });
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Dasa system" value={system} onChange={(e) => { setSystem(e.target.value); setPath([]); }}>
          {systems.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setPath((p) => p.slice(0, -1))} disabled={!path.length}>Up</button>
      </div>
      <TableView job={job} onRowClick={path.length < MAX_DEPTH - 1 && job.data?.drill !== false ? (i) => setPath((p) => [...p, i]) : undefined} />
    </div>
  );
}
