import { useEffect, useState } from 'react';
import { ALL_VARGAS } from '../../core/vargas';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { setIni, setView, useActiveDoc, useStore } from '../state/store';
import { AV_MODE_LABELS, AV_MODES, KEY_INFO_MODES, OTHER_STRENGTH_MODES, VIMSOPAKA_PANE_MODES } from './tabs';
import { NotPorted } from './NotPorted';
import { YOGA_MODES } from '../../core/yogas';
import { HOUSE_SYSTEMS, KP_MODES, SSS_HOUSE_SYSTEM } from '../../core/kpHouses';
import { AvasthaOptionsBar, AvLagnaBar, HouseReferenceSelect } from './StrengthOptions';
import { BODY_GROUPS } from '../../core/basics';
import { AMSA_RULER_VARGAS } from '../../core/amsaRulers';
import { VARGA_INDEX, vargaColumnLabel } from '../../core/vargaOptions';
import type { VargaName } from '../../core/vargas';
import { NATAL_CHART_NAME } from '../../core/chakras/mixedVargas';
import { AshtakavargaChart } from './AshtakavargaChart';

/** A sub-tab that is one fixed table (Houses, KP, ...); Amsa rulers has its own bar. */
export function TableSubView({ spec, table }: { spec: ChartSpec; table: string }) {
  const job = useJob(table === 'basics.amsaRulers' ? null : { kind: 'table' as const, chart: spec, table });
  if (table === 'basics.amsaRulers') return <AmsaRulersView spec={spec} />;
  return <div className="subview"><TableView job={job} /></div>;
}

/**
 * "Select the bodies to show" (dialog 130; Key Info 32821 and Amsa rulers 32930 edit the same
 * [BodiesToShow] BodyType* flags): which body groups the Key Info tables and Amsa rulers list.
 */
function SelectBodies() {
  const ini = useStore((s) => s.ini) as unknown as Record<string, unknown>;
  const [open, setOpen] = useState(false);
  return (
    <span className="select-bodies">
      <button onClick={() => setOpen(!open)} aria-expanded={open}>Select bodies…</button>
      {open && (
        <span role="group" aria-label="Select the bodies to show" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {BODY_GROUPS.map(([key, label]) => (
            <label key={key}>
              <input type="checkbox" checked={Number(ini[key] ?? 1) !== 0} onChange={(e) => setIni({ [key]: e.target.checked ? 1 : 0 } as never)} /> {label}
            </label>
          ))}
        </span>
      )}
    </span>
  );
}

/** A varga chooser over JHora's varga indices D-1..D-144 (its "choose divisional chart" dialogs). */
function VargaSelect({ label, value, onChange, ini }: { label: string; value: string; onChange: (v: string) => void; ini: ChartSpec['ini'] }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {VARGA_INDEX.map((v) => <option key={v} value={v}>{vargaColumnLabel(v, ini)}</option>)}
    </select>
  );
}

/**
 * Edit > "Copy basic calculations" (32982) / "Copy complete calculations" (32983): the text job,
 * then the clipboard (the first line is the chart's name, where JHora puts the file's path).
 */
function CopyCalculations({ spec }: { spec: ChartSpec }) {
  const doc = useActiveDoc();
  const [cmd, setCmd] = useState<number | null>(null);
  const job = useJob(cmd ? { kind: 'text' as const, chart: spec, cmd, params: { file: doc?.title ?? '' } } : null);
  useEffect(() => {
    if (cmd && job.data) { navigator.clipboard?.writeText(job.data); setCmd(null); }
  }, [cmd, job.data]);
  return (
    <span>
      <button onClick={() => setCmd(32982)} disabled={cmd !== null}>Copy basic calculations</button>{' '}
      <button onClick={() => setCmd(32983)} disabled={cmd !== null}>Copy complete calculations</button>
      {job.status === 'error' && <span className="error"> {job.error}</span>}
    </span>
  );
}

export function KeyInfoView({ spec }: { spec: ChartSpec }) {
  const mode = useStore((s) => s.view.basicsMode);
  const entry = KEY_INFO_MODES.find((m) => m[1] === mode) ?? KEY_INFO_MODES[0];
  const table = entry[2];
  // 33242 "Choose divisional chart for longitudes" (DAT_0065b184, reset per chart in JHora)
  const [lonVarga, setLonVarga] = useState('D1');
  // 33297 "Options for planetary aspect evaluation" (dialog 2066): aspecting planets / aspected positions
  const [aspecting, setAspecting] = useState('D1');
  const [aspected, setAspected] = useState('D1');
  const params: Record<string, unknown> = table === 'basics.longitudes' ? { varga: lonVarga }
    : table === 'aspects.evaluation' ? { aspectingVarga: aspecting, aspectedVarga: aspected } : {};
  const job = useJob(table ? { kind: 'table' as const, chart: spec, table, params } : null);
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
        {table === 'basics.longitudes' && <VargaSelect label="Divisional chart for longitudes" value={lonVarga} onChange={setLonVarga} ini={spec.ini} />}
        {table === 'aspects.evaluation' && (
          <span>
            Aspecting planets <VargaSelect label="Aspecting planets" value={aspecting} onChange={setAspecting} ini={spec.ini} />{' '}
            Aspected positions <VargaSelect label="Aspected positions" value={aspected} onChange={setAspected} ini={spec.ini} />
          </span>
        )}
        <SelectBodies />
        <CopyCalculations spec={spec} />
      </div>
      {table ? <TableView job={job} /> : <NotPorted name={entry[0]} />}
    </div>
  );
}

/** Basics > Amsa rulers (menu 141): the varga (32915-32929, 33064 = AmsaRulerVarga) and the bodies (32930). */
export function AmsaRulersView({ spec }: { spec: ChartSpec }) {
  const varga = useStore((s) => Number(s.ini.AmsaRulerVarga ?? 25));
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'basics.amsaRulers' });
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Amsa rulers varga" value={varga} onChange={(e) => setIni({ AmsaRulerVarga: Number(e.target.value) })}>
          {AMSA_RULER_VARGAS.map(([v, cmd, label]) => <option key={cmd} value={v}>{label}</option>)}
        </select>
        <SelectBodies />
      </div>
      <TableView job={job} />
    </div>
  );
}

export function OtherStrengthsView({ spec }: { spec: ChartSpec }) {
  const mode = useStore((s) => s.view.strengthsMode);
  const entry = OTHER_STRENGTH_MODES.find((m) => m[1] === mode) ?? OTHER_STRENGTH_MODES[0];
  const table = entry[2];
  const job = useJob(table ? { kind: 'table' as const, chart: spec, table } : null);
  const [pane2, setPane2] = useState(VIMSOPAKA_PANE_MODES[0][1]);
  // 33046: varga of the avastha table (StrengthOptions.tsx)
  const [avVarga, setAvVarga] = useState(0);
  const vimsopakaJob = useJob({ kind: 'table' as const, chart: spec, table: pane2, params: pane2 === 'strengths.basicAvasthas' ? { varga: avVarga } : {} });
  const [yogaMode, setYogaMode] = useState(YOGA_MODES[0][0]);
  const [yogaVarga, setYogaVarga] = useState('D1');
  // 33077 "List of supported yogas" toggles the pane between the yogas found and every yoga JHora knows
  const [yogaList, setYogaList] = useState(false);
  const yogaJob = useJob(yogaList
    ? { kind: 'table' as const, chart: spec, table: 'strengths.yogaList', params: { mode: yogaMode } }
    : { kind: 'table' as const, chart: spec, table: 'strengths.yogas', params: { mode: yogaMode, varga: yogaVarga } });
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
        {pane2 === 'strengths.basicAvasthas' && <AvasthaOptionsBar varga={avVarga} onVarga={setAvVarga} />}
      </div>
      <TableView job={vimsopakaJob} />
      <div className="subview-bar">
        <select aria-label="Yogas" value={yogaMode} onChange={(e) => setYogaMode(e.target.value)}>
          {YOGA_MODES.map(([label]) => <option key={label} value={label}>{label}</option>)}
        </select>
        <select aria-label="Yoga varga" value={yogaVarga} onChange={(e) => setYogaVarga(e.target.value)}>
          {Object.keys(ALL_VARGAS).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <label><input type="checkbox" checked={yogaList} onChange={(e) => setYogaList(e.target.checked)} /> List of supported yogas</label>
      </div>
      <TableView job={yogaJob} />
    </div>
  );
}

/**
 * Strengths > Ashtakavarga: JHora's AV modes for any divisional chart, drawn as JHora draws them
 * (AshtakavargaChart.tsx) or as tables. Menu 106: 32840 the varga (also resets the highlight
 * varga), 32841 the highlight varga, 32839 highlighting on/off, 32973/33097 lagna, 33117.
 */
export function AshtakavargaView({ spec, natalSpec }: { spec: ChartSpec; natalSpec?: ChartSpec }) {
  const [mode, setMode] = useState<string>(AV_MODES[0]);
  const [varga, setVarga] = useState<string>('D1');
  const [hlVarga, setHlVarga] = useState<string>('D1');
  const [highlight, setHighlight] = useState(true);
  const [asTable, setAsTable] = useState(false);
  const [lagnaShift, setLagnaShift] = useState(0);
  const [useNatal, setUseNatal] = useState(false);
  const doc = useActiveDoc();
  const derived = !!natalSpec && natalSpec.birth !== spec.birth;
  const chart = derived && useNatal ? natalSpec! : spec;
  const chartName = derived && !useNatal ? doc?.derived?.label ?? NATAL_CHART_NAME : NATAL_CHART_NAME;
  const job = useJob(asTable ? { kind: 'table' as const, chart, table: 'strengths.ashtakavarga', params: { mode, varga, lagnaShift } } : null);
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Ashtakavarga mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          {AV_MODES.map((m) => <option key={m} value={m}>{AV_MODE_LABELS[m]}</option>)}
        </select>
        <select aria-label="Divisional chart" value={varga} onChange={(e) => { setVarga(e.target.value); setHlVarga(e.target.value); setLagnaShift(0); }}>
          {Object.keys(ALL_VARGAS).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <AvLagnaBar shift={lagnaShift} onShift={setLagnaShift} natal={useNatal} onNatal={setUseNatal} derived={derived} />
        {!asTable && (
          <>
            <label><input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> Highlight the rasi containing planet</label>
            <select aria-label="Highlight rasis occupied in this divisional chart" value={hlVarga} disabled={!highlight} onChange={(e) => setHlVarga(e.target.value)}>
              {Object.keys(ALL_VARGAS).map((v) => <option key={v} value={v}>{`Positions in ${v}`}</option>)}
            </select>
          </>
        )}
        <label><input type="checkbox" checked={asTable} onChange={(e) => setAsTable(e.target.checked)} /> As a table</label>
      </div>
      {asTable
        ? <TableView job={job} />
        : <AshtakavargaChart spec={chart} varga={varga as VargaName} mode={mode} chartName={chartName} lagnaShift={lagnaShift} highlight={highlight} highlightVarga={hlVarga as VargaName} />}
    </div>
  );
}

/** House system and lagna-in-middle choices of JHora's Houses menu (145); global settings, as in JHora. */
function HouseSystemBar() {
  const type = useStore((s) => Number(s.ini.HouseTypeWanted));
  const middle = useStore((s) => Number(s.ini.HouseCuspsInMiddle) !== 0);
  // the SSS house system (33388, HouseTypeWanted 11) is offered only with Siddhanta = 1 (FUN_00454dc0)
  const sss = useStore((s) => Number(s.ini.Siddhanta) === 1);
  const systems = sss ? [...HOUSE_SYSTEMS, SSS_HOUSE_SYSTEM] : HOUSE_SYSTEMS;
  return (
    <>
      <select aria-label="House system" value={type} onChange={(e) => setIni({ HouseTypeWanted: Number(e.target.value) })}>
        {systems.map(([label, id, value]) => <option key={id} value={value}>{label}</option>)}
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
  const [ref, setRef] = useState(0);
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'basics.houses', params: { ref } });
  return (
    <div className="subview">
      <div className="subview-bar"><HouseSystemBar /><HouseReferenceSelect value={ref} onChange={setRef} /></div>
      <TableView job={job} />
    </div>
  );
}

/** Basics > KP (menu 146): sub lords and the "planets occupying each planet's ..." lists; house rows follow the house system. */
export function KpView({ spec }: { spec: ChartSpec }) {
  const [mode, setMode] = useState<number>(KP_MODES[0][1]);
  const [ref, setRef] = useState(0);
  const entry = KP_MODES.find((m) => m[1] === mode);
  const req = entry && entry[2] !== null
      ? { kind: 'table' as const, chart: spec, table: 'basics.kpOccupants', params: { level: entry[2], ref } }
      : { kind: 'table' as const, chart: spec, table: 'basics.kp', params: { ref } };
  const job = useJob(req);
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="KP mode" value={mode} onChange={(e) => setMode(Number(e.target.value))}>
          {KP_MODES.map(([label, id]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <HouseSystemBar />
        <HouseReferenceSelect value={ref} onChange={setRef} />
      </div>
      <TableView job={job} />
    </div>
  );
}
