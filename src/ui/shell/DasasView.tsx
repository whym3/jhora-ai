// The Dasas tab: JHora's CDasaView (FUN_0044a330) with its buttons (`<` `|` `>`, Quick Info,
// Options) and the commands of its context menu 108 (src/core/dasas/dasaJobs.ts has the jobs):
// Entry chart of this period (32892), Locate an event (33125, dialog 2041), Dasa-Transit
// Correlation (33269), Shift dasa dates (33196, dialog 2050), Definition of year in dasas, Dasa seed settings for Tajaka (33019), Use dasa
// sesham in compressed mundane dasas (33043), Use Tribhagi variation (32971), Copy to clipboard
// (only dates) (33236) and Sum of longitudes of planets upto this level (33389). JHora runs the
// period commands on the right-clicked period; here on the period chosen in "Period" (else the
// period whose sub-periods are shown).
import { useEffect, useRef, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { OTHER_DASAS, RASI_DASAS } from '../../core/dasas/registry';
import { setIni, useActiveDoc, useStore, type DerivedChart } from '../state/store';
import { applyYearDefinition, dasaSlot, YEAR_DEFINITION_NAMES, YEAR_MENU } from '../../core/dasas/yearDefinition';
import { canStepCycle, DASA_LEVEL, datesOnlyLines } from '../../core/dasas/format';
import { overridesKey, setCycle, setDasaSession, useDasaSession } from './dasaSession';
import { DasaOptionsDialog, hasDasaOptions, TajakaSeedDialog } from './DasaOptions';
import { EntryChartWindow } from './EntryChart';

/** Nakshatra dasa systems in JHora's menu order. */
export const NAKSHATRA_DASA_SYSTEMS = [
  'Vimsottari', 'Ashtottari', 'Kalachakra', 'Yogini', 'Dwisaptati sama', 'Shattrimsa sama', 'Dwadasottari',
  'Chaturaseeti sama', 'Sataabdika', 'Shodasottari', 'Panchottari', 'Shashtihayani', 'Saptarshi nakshatra',
] as const;

const MAX_DEPTH = 6;
const CRLF = String.fromCharCode(13, 10);

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
 * mundane, prasna, angular return, progression, period entry) the job runs on the natal chart
 * with params.derived (dasaJobs.ts paneDasa), which compresses the dasas into the chart's period
 * of effect as JHora does; `spec` is the chart shown (derived birth). `extra`: the pane's cycle,
 * Tribhagi, nakshatra dasa varga and temporary strengths (dasaJobs.ts), or a command's input.
 */
export function dasaJob(spec: ChartSpec, natalBirth: ChartSpec['birth'] | undefined, derived: DerivedChart | null | undefined,
  table: DasaTable | string, system: string, path: number[], extra: Record<string, unknown> = {}) {
  if (!derived || !natalBirth) return { kind: 'table' as const, chart: spec, table, params: { system, path, ...extra } };
  return {
    kind: 'table' as const, chart: { ...spec, birth: natalBirth }, table,
    params: { system, path, ...extra, derived: { kind: derived.kind, label: derived.label, birth: derived.birth, params: derived.params } },
  };
}

type Dialog = null | 'options' | 'tajakaSeed' | 'locate' | 'shift';
type Command = null | { job: string; extra?: Record<string, unknown> };

function DasaPane({ spec, table, systems }: { spec: ChartSpec; table: DasaTable; systems: readonly string[] }) {
  const doc = useActiveDoc();
  const ini = useStore((s) => s.ini);
  const session = useDasaSession();
  const [system, setSystem] = useState<string>(systems[0]);
  const [path, setPath] = useState<number[]>([]);
  const [row, setRow] = useState<number | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [command, setCommand] = useState<Command>(null);
  const [message, setMessage] = useState<string[] | null>(null);
  const [transit, setTransit] = useState<Command>(null);
  // 32892 opens a separate entry-chart window (CEntryChartView) on the period's chart, as JHora does
  const [entry, setEntry] = useState<{ birth: DerivedChart['birth']; label: string; periodDays: number } | null>(null);
  const slot = dasaSlot(table, system);
  const shown = doc?.derived?.birth ?? doc?.birth ?? spec.birth;
  let ov = session.overrides[overridesKey(shown, slot)];
  // Sthira dasa reads Narayana dasa's D-1 start (0x40860f): slot 25's "Start dasas from" when its chart is D-1
  const narStart = session.overrides[overridesKey(shown, 25)]?.start;
  if (slot === 41 && narStart !== undefined && !(ini.NarayanaDasaChart ?? 0)) ov = { ...ov, narayanaStart: narStart };
  const shift = session.shifts[overridesKey(shown, slot)] ?? 0;
  const extra: Record<string, unknown> = {
    cycle: session.cycles[slot] ?? 0,
    ...(table === 'dasas.nakshatra' && session.tribhagi ? { tribhagi: true } : {}),
    ...(session.nakVarga ? { nakVarga: session.nakVarga } : {}),
    ...(ov && Object.keys(ov).length ? { overrides: ov } : {}),
    ...(shift ? { shift } : {}),
    ...(slot === 25 && session.narayanaKind ? { narayanaKind: session.narayanaKind } : {}),
    ...(slot === 38 && session.shoolaFromHouse ? { shoolaFromHouse: session.shoolaFromHouse } : {}),
    ...(slot === 68 && session.rbvVarga ? { rbvVarga: session.rbvVarga } : {}),
    ...(slot === 69 && Object.keys(session.tithiSeed).length ? { tithiSeed: session.tithiSeed } : {}),
  };
  const job = useJob(dasaJob(spec, doc?.birth, doc?.derived, table, system, path, extra));
  const cmdJob = useJob(command ? dasaJob(spec, doc?.birth, doc?.derived, command.job, system, path, { ...extra, table, index: row ?? undefined, ...command.extra }) : null);
  const transitJob = useJob(transit ? dasaJob(spec, doc?.birth, doc?.derived, transit.job, system, path, { ...extra, table, index: row ?? undefined }) : null);

  // a new list clears the chosen period (Locate an event chooses the located one)
  const pendingRow = useRef<number | null>(null);
  useEffect(() => { setRow(pendingRow.current); pendingRow.current = null; }, [system, path]);
  // a command's result: Quick Info / Sum of longitudes as a message, Locate moves the pane, Entry chart is shown
  // (the job's state still holds the previous command's result until it reports 'loading')
  const started = useRef(false);
  useEffect(() => {
    if (!command) return;
    if (cmdJob.status === 'loading') { started.current = true; return; }
    if (!started.current || cmdJob.status === 'idle') return;
    started.current = false;
    if (cmdJob.status === 'error') { setMessage([cmdJob.error ?? 'error']); setCommand(null); return; }
    const t = cmdJob.data!;
    if (command.job === 'dasas.locate') {
      const r = JSON.parse(t.text![0]) as { cycle: number; path: number[]; index: number };
      setCycle(slot, r.cycle);
      pendingRow.current = r.index;
      setPath(r.path);
      setMessage(t.rows.map((x) => `${x[0]}: ${x[1]}  ${x[2]} - ${x[3]}`));
    } else if (command.job === 'dasas.entry') {
      setEntry(JSON.parse(t.text![0]) as { birth: DerivedChart['birth']; label: string; periodDays: number });
    } else {
      setMessage(t.text ?? t.rows.map((x) => x.join(' ')));
    }
    setCommand(null);
  }, [command, cmdJob.status, cmdJob.data, cmdJob.error, slot, doc]);

  const run = (job: string, ex?: Record<string, unknown>) => { setMessage(null); setCommand({ job, extra: ex }); };
  const copyDates = () => {
    const text = job.data?.text;
    if (text) navigator.clipboard?.writeText(datesOnlyLines(text).join(CRLF));
    else setMessage(['Copy (only dates) is available for the maha dasas and the antardasas of one maha dasa.']);
  };
  const rows = job.data?.rows ?? [];
  const category = table === 'dasas.nakshatra' ? 0 : table === 'dasas.rasi' ? 1 : 2;
  const cycle = session.cycles[slot] ?? 0;
  const periodChosen = path.length > 0 || row !== null;
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Dasa system" value={system} onChange={(e) => { setSystem(e.target.value); setPath([]); }}>
          {systems.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setPath((p) => p.slice(0, -1))} disabled={!path.length}>Up</button>
        <span className="dasa-cycle">
          <button title="Previous dasa cycle" disabled={!canStepCycle(rows, -1)} onClick={() => setCycle(slot, cycle - 1)}>&lt;</button>
          <button title="The dasa cycle that starts at birth" onClick={() => setCycle(slot, 0)}>|</button>
          <button title="Next dasa cycle" disabled={!canStepCycle(rows, 1)} onClick={() => setCycle(slot, cycle + 1)}>&gt;</button>
          {cycle !== 0 && <span className="status"> cycle {cycle > 0 ? `+${cycle}` : cycle}</span>}
        </span>
        <button onClick={() => run('dasas.quickInfo')}>Quick Info</button>
        <button onClick={() => setDialog('options')} disabled={!hasDasaOptions(slot)}>Options</button>
        {doc?.derived && <span className="status">{doc.derived.label}</span>}
        <YearDefinitionMenu slot={slot} />
      </div>
      <div className="subview-bar">
        <label>Period <select aria-label="Period" value={row ?? ''} onChange={(e) => setRow(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">{path.length ? '(the period above)' : '(none)'}</option>
          {rows.map((r, i) => <option key={i} value={i}>{r[0]}: {r[1]}</option>)}
        </select></label>
        <button onClick={() => run('dasas.entry')} disabled={!periodChosen}>Entry chart of this period</button>
        <button onClick={() => setDialog('locate')}>Locate an event</button>
        <button onClick={() => setDialog('shift')}>Shift dasa dates…</button>
        <button onClick={() => setTransit({ job: 'dasas.transit' })} disabled={!periodChosen}>Dasa-Transit Correlation</button>
        <button onClick={() => run('dasas.sumLongitudes')} disabled={!periodChosen}>Sum of longitudes</button>
        <button onClick={copyDates} disabled={!job.data}>Copy (only dates)</button>
        {table === 'dasas.nakshatra' && (
          <label><input type="checkbox" checked={session.tribhagi} onChange={(e) => setDasaSession({ tribhagi: e.target.checked })} /> Use Tribhagi variation</label>
        )}
        <button onClick={() => setDialog('tajakaSeed')}>Dasa seed settings for Tajaka…</button>
        <label><input type="checkbox" checked={!!ini.DasaSeshamInMundaneCharts} onChange={(e) => setIni({ DasaSeshamInMundaneCharts: e.target.checked ? 1 : 0 })} /> Use dasa sesham in compressed mundane dasas</label>
      </div>
      {entry && <EntryChartWindow natalSpec={{ ...spec, birth: doc?.birth ?? spec.birth }} birth={entry.birth} label={entry.label} periodDays={entry.periodDays} onClose={() => setEntry(null)} />}
      {dialog === 'options' && <DasaOptionsDialog slot={slot} birth={shown} onClose={() => setDialog(null)} />}
      {dialog === 'tajakaSeed' && <TajakaSeedDialog slot={slot} category={category} onClose={() => setDialog(null)} />}
      {dialog === 'locate' && <LocateDialog tz={shown.tzHours} onCancel={() => setDialog(null)}
        onOk={(at) => { setDialog(null); run('dasas.locate', { at }); }} />}
      {dialog === 'shift' && <ShiftDialog days={shift} onCancel={() => setDialog(null)}
        onOk={(days) => { setDialog(null); setDasaSession((s) => ({ shifts: { ...s.shifts, [overridesKey(shown, slot)]: days } })); }} />}
      {command && <p className="status">Calculating…</p>}
      {message && (
        <div className="dasa-message" role="status">
          {message.map((m, i) => <p key={i}>{m}</p>)}
          <button onClick={() => setMessage(null)}>OK</button>
        </div>
      )}
      <TableView job={job} onRowClick={path.length < MAX_DEPTH - 1 && job.data?.drill !== false ? (i) => setPath((p) => [...p, i]) : undefined} />
      {transit && (
        <>
          <div className="subview-bar"><strong>Dasa-Transit Correlation</strong>
            <button disabled={!transitJob.data?.text} onClick={() => navigator.clipboard?.writeText((transitJob.data?.text ?? []).join(CRLF) + CRLF)}>Copy</button>
            <button onClick={() => setTransit(null)}>Close</button></div>
          <TableView job={transitJob} />
        </>
      )}
    </div>
  );
}

/** Dialog 2041 "Locate an event": date, time, time zone and the level to go down to. */
function LocateDialog({ tz, onOk, onCancel }: { tz: number; onOk: (at: Record<string, number>) => void; onCancel: () => void }) {
  const now = new Date();
  const [date, setDate] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
  const [time, setTime] = useState('12:00:00');
  const [zone, setZone] = useState(tz);
  const [level, setLevel] = useState(2);
  const ok = () => {
    const [y, m, d] = date.split('-').map(Number);
    const [h, mi, s] = time.split(':').map(Number);
    onOk({ year: y, month: m, day: d, hour: h + (mi || 0) / 60 + (s || 0) / 3600, tz: zone, level });
  };
  return (
    <div className="dasa-options" role="dialog" aria-label="Locate an event">
      <strong>Locate an event</strong>
      <label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Time <input type="time" step={1} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      <label>Time Zone (hours east) <input type="number" step="any" value={zone} onChange={(e) => setZone(Number(e.target.value))} style={{ width: '6em' }} /></label>
      <label>Identify the periods and sub-periods running at the above time by going upto the following level <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
        {DASA_LEVEL.map((l, i) => <option key={l} value={i}>{l}</option>)}
      </select></label>
      <div><button onClick={ok}>OK</button> <button onClick={onCancel}>Cancel</button></div>
    </div>
  );
}

/**
 * Dialog 2050 "Enter the dasa shift amount" (33196 "Shift dasa dates", FUN_00450e00): combo 1003
 * No shift / Add / Subtract and Days / Hours / Minutes, for the dasa shown (dasaJobs.ts shiftedClock).
 */
function ShiftDialog({ days, onOk, onCancel }: { days: number; onOk: (days: number) => void; onCancel: () => void }) {
  const a = Math.abs(days);
  const [mode, setMode] = useState(days > 0 ? 1 : days < 0 ? 2 : 0);
  const [d, setD] = useState(Math.trunc(a));
  const [h, setH] = useState(Math.trunc((a % 1) * 24));
  const [m, setM] = useState(Math.round((((a % 1) * 24) % 1) * 60) % 60);
  const ok = () => {
    const v = d + (h + m / 60) / 24;
    onOk(mode === 1 ? v : mode === 2 ? -v : 0);
  };
  return (
    <div className="dasa-options" role="dialog" aria-label="Enter the dasa shift amount">
      <strong>Enter the dasa shift amount</strong>
      <p className="status">Errors in birthdata, ayanamsa and other uncertainties can cause errors in the dasa dates. You can shift the dasa dates to get the dates right.
        This is a lot easier than individualizing birthtime errors, ayanamsa errors and other errors and rectifying all.</p>
      <p>Please enter the dasa shift amount for this dasa.</p>
      <select aria-label="Shift" value={mode} onChange={(e) => setMode(Number(e.target.value))}>
        <option value={0}>No shift</option><option value={1}>Add</option><option value={2}>Subtract</option>
      </select>
      <label><input type="number" min={0} value={d} onChange={(e) => setD(Math.max(0, Math.trunc(Number(e.target.value))))} style={{ width: '6em' }} /> Days</label>
      <label><input type="number" min={0} value={h} onChange={(e) => setH(Math.max(0, Math.trunc(Number(e.target.value))))} style={{ width: '4em' }} /> Hours</label>
      <label><input type="number" min={0} value={m} onChange={(e) => setM(Math.max(0, Math.trunc(Number(e.target.value))))} style={{ width: '4em' }} /> Minutes</label>
      <div><button onClick={ok}>OK</button> <button onClick={onCancel}>Cancel</button></div>
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
