import { useState } from 'react';
import { ALL_VARGAS } from '../../core/vargas';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { setView, useStore } from '../state/store';
import { AV_MODE_LABELS, AV_MODES, KEY_INFO_MODES, OTHER_STRENGTH_MODES } from './tabs';
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

export function OtherStrengthsView({ spec }: { spec: ChartSpec }) {
  const mode = useStore((s) => s.view.strengthsMode);
  const entry = OTHER_STRENGTH_MODES.find((m) => m[1] === mode) ?? OTHER_STRENGTH_MODES[0];
  const table = entry[2];
  const job = useJob(table ? { kind: 'table' as const, chart: spec, table } : null);
  const vimsopakaJob = useJob({ kind: 'table' as const, chart: spec, table: 'strengths.vimsopaka' });
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Strengths mode" value={mode} onChange={(e) => setView({ strengthsMode: Number(e.target.value) })}>
          {OTHER_STRENGTH_MODES.map(([label, id, t]) => <option key={id} value={id}>{label}{t ? '' : ' (not yet)'}</option>)}
        </select>
      </div>
      {table ? <TableView job={job} /> : <NotPorted name={entry[0]} />}
      <TableView job={vimsopakaJob} />
    </div>
  );
}

/** Strengths > Ashtakavarga: JHora's AV modes for any divisional chart, shown as tables. */
export function AshtakavargaView({ spec }: { spec: ChartSpec }) {
  const [mode, setMode] = useState<string>(AV_MODES[0]);
  const [varga, setVarga] = useState<string>('D1');
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'strengths.ashtakavarga', params: { mode, varga } });
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Ashtakavarga mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          {AV_MODES.map((m) => <option key={m} value={m}>{AV_MODE_LABELS[m]}</option>)}
        </select>
        <select aria-label="Divisional chart" value={varga} onChange={(e) => setVarga(e.target.value)}>
          {Object.keys(ALL_VARGAS).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <TableView job={job} />
    </div>
  );
}
