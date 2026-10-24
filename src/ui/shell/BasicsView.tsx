import { useState } from 'react';
import { ALL_VARGAS } from '../../core/vargas';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { setIni, setView, useStore } from '../state/store';
import { AV_MODE_LABELS, AV_MODES, KEY_INFO_MODES, OTHER_STRENGTH_MODES, VIMSOPAKA_PANE_MODES } from './tabs';
import { NotPorted } from './NotPorted';
import { YOGA_MODES } from '../../core/yogas';
import { HOUSE_SYSTEMS, KP_MODES } from '../../core/kpHouses';

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
  // JHora's Key Info text pane (copy command 32974): date, panchanga, horas, sunrise...
  const info = useJob({ kind: 'text' as const, chart: spec, cmd: 32974 });
  return (
    <div className="subview">
      {info.data && <pre className="key-info">{info.data}</pre>}
      {info.status === 'error' && <p className="error">{info.error}</p>}
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
  const [pane2, setPane2] = useState(VIMSOPAKA_PANE_MODES[0][1]);
  const vimsopakaJob = useJob({ kind: 'table' as const, chart: spec, table: pane2 });
  const [yogaMode, setYogaMode] = useState(YOGA_MODES[0][0]);
  const [yogaVarga, setYogaVarga] = useState('D1');
  const yogaJob = useJob({ kind: 'table' as const, chart: spec, table: 'strengths.yogas', params: { mode: yogaMode, varga: yogaVarga } });
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Strengths mode" value={mode} onChange={(e) => setView({ strengthsMode: Number(e.target.value) })}>
          {OTHER_STRENGTH_MODES.map(([label, id, t]) => <option key={id} value={id}>{label}{t ? '' : ' (not yet)'}</option>)}
        </select>
      </div>
      {table ? <TableView job={job} /> : <NotPorted name={entry[0]} />}
      <div className="subview-bar">
        <select aria-label="Second pane mode" value={pane2} onChange={(e) => setPane2(e.target.value)}>
          {VIMSOPAKA_PANE_MODES.map(([label, id]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <TableView job={vimsopakaJob} />
      <div className="subview-bar">
        <select aria-label="Yogas" value={yogaMode} onChange={(e) => setYogaMode(e.target.value)}>
          {YOGA_MODES.map(([label]) => <option key={label} value={label}>{label}</option>)}
        </select>
        <select aria-label="Yoga varga" value={yogaVarga} onChange={(e) => setYogaVarga(e.target.value)}>
          {Object.keys(ALL_VARGAS).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <TableView job={yogaJob} />
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

/** House system and lagna-in-middle choices of JHora's Houses menu (145); global settings, as in JHora. */
function HouseSystemBar() {
  const type = useStore((s) => Number(s.ini.HouseTypeWanted));
  const middle = useStore((s) => Number(s.ini.HouseCuspsInMiddle) !== 0);
  return (
    <>
      <select aria-label="House system" value={type} onChange={(e) => setIni({ HouseTypeWanted: Number(e.target.value) })}>
        {HOUSE_SYSTEMS.map(([label, id, value]) => <option key={id} value={value}>{label}</option>)}
      </select>
      <select aria-label="Lagna position in the first house" value={middle ? 1 : 0} onChange={(e) => setIni({ HouseCuspsInMiddle: Number(e.target.value) })}>
        <option value={1}>Ascendant is the middle of first house</option>
        <option value={0}>Ascendant is the start of first house</option>
      </select>
    </>
  );
}

/** Basics > Houses (menu 145): start, cusp and end of each house in the chosen house system. */
export function HousesView({ spec }: { spec: ChartSpec }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'basics.houses' });
  return (
    <div className="subview">
      <div className="subview-bar"><HouseSystemBar /></div>
      <TableView job={job} />
    </div>
  );
}

/** Basics > KP (menu 146): sub lords and the "planets occupying each planet's ..." lists; house rows follow the house system. */
export function KpView({ spec }: { spec: ChartSpec }) {
  const [mode, setMode] = useState<number>(KP_MODES[0][1]);
  const entry = KP_MODES.find((m) => m[1] === mode);
  const req = entry && entry[2] !== null
      ? { kind: 'table' as const, chart: spec, table: 'basics.kpOccupants', params: { level: entry[2] } }
      : { kind: 'table' as const, chart: spec, table: 'basics.kp' };
  const job = useJob(req);
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="KP mode" value={mode} onChange={(e) => setMode(Number(e.target.value))}>
          {KP_MODES.map(([label, id]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <HouseSystemBar />
      </div>
      <TableView job={job} />
    </div>
  );
}
