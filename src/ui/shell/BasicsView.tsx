import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { setView, useStore } from '../state/store';
import { KEY_INFO_MODES } from './tabs';
import { NotPorted } from './NotPorted';

/** A sub-tab that is one fixed table (Houses, KP, ...). */
export function TableSubView({ spec, table }: { spec: ChartSpec; table: string }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table });
  return <div className="subview"><TableView job={job} /></div>;
}

export function KeyInfoView({ spec }: { spec: ChartSpec }) {
  const mode = useStore((s) => s.view.basicsMode);
  const entry = KEY_INFO_MODES.find((m) => m[1] === mode) ?? KEY_INFO_MODES[0];
  const table = entry[2];
  const job = useJob(table ? { kind: 'table' as const, chart: spec, table } : null);
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Key Info mode" value={mode} onChange={(e) => setView({ basicsMode: Number(e.target.value) })}>
          {KEY_INFO_MODES.map(([label, id, t]) => <option key={id} value={id}>{label}{t ? '' : ' (not yet)'}</option>)}
        </select>
      </div>
      {table ? <TableView job={job} /> : <NotPorted name={entry[0]} />}
    </div>
  );
}
