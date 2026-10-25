// Left pane: JHora shows the natal chart(s) here on every tab (CChartView; the same view fills
// the Chakras > Many Vargas sub-tab, src/ui/chakras/ManyVargas.tsx).
//
// Charts and layout (jhora.exe):
// * The tab switch (0x4eb050) sets the number of charts DAT_00579a6c: on "Chakras" / "Many
//   Vargas" 12 (packed) or 6 with DAT_00579a70 = 1, on every other tab 6 (packed chart mode,
//   DAT_008a4bd2 = ini MoreChartsOnBigDisplay, default on) or 2 with DAT_00579a70 = 0.
//   Command 33287 (0x43efd0) toggles MoreChartsOnBigDisplay.
// * FUN_004318f0 lays them out for DAT_00579a70 = 0: zoom z = min(0.4737 W, 0.32 H) / 360 for
//   6 charts (0.9474 W, 0.48 H for 2), margin m = round(10 z), side s = round(360 z) rounded
//   down to a multiple of 4; 6 charts in 2 columns x 3 rows (slot 2k left, 2k+1 right), 2
//   charts one above the other, m between them and around.
// * Slot i draws DisplayVarga[i] (DAT_00579a30[i], ini CurrentState DisplayVarga, the same
//   array as Many Vargas: D-1, D-9, D-30, D-3, D-10, D-60, ...). With UseTwoChartStyles
//   (DAT_0065b934, dialog 2036 "Multiple Chart Style Support", command 33114 0x404970) the
//   draw loop (0x43226d) gives slot i the varga DisplayVarga[i - (i & 1)] and FUN_00432360
//   draws odd slots in ChartStyle2 (DAT_00579a74), even ones in ChartStyle (DAT_0065b930):
//   each pair shows one varga in both styles.
//
// Per chart slot, as in JHora's chart menu 103: the varga, the body view ("Choose a view",
// 32803..33052, core/chartBodies.ts), the display mode (32801 Automatic: the chart on screen,
// e.g. a Tajaka chart; 32802 Natal chart only: DAT_0065b8a4[slot] = 1 draws doc+0x50, the
// natal chart) and "Copy chart > as text" (32985 current style / 32992 south-north-east,
// core/chartText.ts). "Optional bodies in standard view" (33053..33061, 33268, 33270) are
// global preferences (the Show*InCharts ini keys), as in JHora.
//
// Right-click commands (ChartMenu.tsx) handled here:
// * 33076 / 33160 "When will lagna / this planet change sign" (FUN_004427a0, worker job
//   chart.signChange).
// * 33187 / 33186 "Change birthtime to move lagna to the previous / next sign" (0x4414a0 /
//   0x4415b0, core/chartJobs.ts chart.moveLagna) change the natal birth time; JHora keeps every
//   moment on a stack (0x65b978[0x65c91c], at most 500, seeded with the chart's own moment when
//   it is opened); 33188 "Undo the latest change" (0x4416c0) goes back one entry, 33189 "Undo
//   all changes" (0x441790) to the first. The document is marked modified unless back at the
//   first entry. Here the stack is kept per open chart.
// * 32827 "Show ashtakavarga of this chart" (0x440fb0): a new CAshtakaVargaView window for the
//   slot's chart (DAT_00597fac) and varga (DAT_00597fb4 / DAT_00597fb8); here a dialog.
// * Bhava/Chalit chakra (core/bhavaChart.ts): 33330..33362 set BhavaChartVarga (DAT_008a4b8c)
//   and the slot's varga to 28 (handlers 0x43bb20..0x43c620), 33009 (menus 138/153, 0x43bab0)
//   only the slot's varga; 33353 opens dialog 2068 (BhavaChartDialog). Varga 28 has the short
//   name "D-1 (B)" (0x8a2800[28]) and 9 divisions (0x591ed4[28], used by 33076/33160).
// * 33294 "Show chart based on houses from this planet" (vtbl+0x130 0x441420) stores the body
//   (DAT_0065b8e4[slot]) and sets DAT_0065b920[slot]; 33293 (0x4413b0) clears it. The only
//   reader is the South Indian drawing (FUN_00442de0 0x444777), which adds the caption
//   "Bhava from %s" (name table DAT_008a4820) - the bodies stay in their signs.
// * 33287 Packed chart mode. Highlights are cleared when the menu is opened (OnContextMenu
//   0x439ab0, see ChartMenu.tsx).
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { ChartResult, ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import type { VargaName } from '../../core/vargas';
import { VARGA_INDEX, vargaColumnLabel } from '../../core/vargaOptions';
import type { Graha } from '../../core/positions';
import { highlightSigns, maranaKarakaSthana, pachakadiOfPlanet, pachakadiOfRasi, RELATION_CODE_NAMES, relationCodes } from '../../core/chartMenu';
import { GRAHAS } from '../../core/positions';
import { SIGN_NAMES } from '../../core/zodiac';
import { CHART_VIEWS, chartSigns, OPTIONAL_BODIES, type ChartPoint, type ChartView } from '../../core/chartBodies';
import { chartText, chartTextSne } from '../../core/chartText';
import { JHORA_VARGA_LONG_NAMES } from '../../core/chakras/mixedVargas';
import { BHAVA_LONG_NAME, BHAVA_VARGA_INDEX, bhavaShortName, bhavaSigns, needsCusps } from '../../core/bhavaChart';
import type { ChakraChart } from '../../core/chakras/common';
import type { BirthData } from '../../core/jhd';
import { DEFAULTS, type JhoraIni } from '../../settings/generated';
import { CHART_STYLES, ChartFigure, styleIndex, type ChartCaption, type ChartStyle } from '../ChartDiagram';
import { getState, setIni, setView, updateChart, useActiveDoc, useStore } from '../state/store';
import { AV_MODES, AV_MODE_LABELS } from './tabs';
import { BhavaChartDialog } from './BhavaChartDialog';
import { BODY_NAMES, ChartMenu, type MenuAction, type MenuKind, type MenuTarget } from './ChartMenu';

export const VARGA_TITLES: Record<VargaName, string> = {
  D1: 'Rasi', D2: 'Hora', D3: 'Drekkana', D4: 'Chaturthamsa', D5: 'Panchamsa', D6: 'Shashthamsa',
  D7: 'Saptamsa', D8: 'Ashtamsa', D9: 'Navamsa', D10: 'Dasamsa', D11: 'Rudramsa', D12: 'Dwadasamsa',
  D16: 'Shodasamsa', D20: 'Vimsamsa', D24: 'Siddhamsa', D27: 'Nakshatramsa', D30: 'Trimsamsa',
  D40: 'Khavedamsa', D45: 'Akshavedamsa', D60: 'Shashtyamsa', D81: 'Nava-navamsa',
  D108: 'Ashtottaramsa', D144: 'Dwadasa-dwadasamsa', D10xD9: 'D-9 of D-10', D0: 'Empty',
};
export const VARGA_NAMES = Object.keys(VARGA_TITLES) as VargaName[];
const dn = (v: VargaName) => v.replace('D', 'D-');
/** JHora's name of the natal chart (0x5743f4). */
export const NATAL_CHART_NAME = 'Natal Chart';

/** A slot's varga: a divisional chart or the Bhava/Chalit chakra (JHora varga index 28). */
export type SlotVarga = VargaName | 'Bhava';
/** DisplayVarga value (JHora varga index) -> slot varga. */
export const slotVargaOf = (display: number): SlotVarga => (display === BHAVA_VARGA_INDEX ? 'Bhava' : VARGA_INDEX[display] ?? 'D1');
/** Slot varga -> DisplayVarga value. */
export const displayIndexOf = (v: SlotVarga): number => (v === 'Bhava' ? BHAVA_VARGA_INDEX : Math.max(0, VARGA_INDEX.indexOf(v)));

/** One chart slot's settings (JHora keeps them per slot, reset when the view is created). */
export interface SlotSettings {
  view: ChartView;
  natalOnly: boolean;
  /** 33294: body index 0..9 of "Show chart based on houses from this planet", null = signs (33293) */
  housesFrom?: number | null;
}
export const DEFAULT_SLOT: SlotSettings = { view: 'standard', natalOnly: false, housesFrom: null };

/** The chart a slot draws, its bodies per sign and its captions. */
export interface SlotChart {
  /** varga of the signs (D-1 for the Bhava/Chalit chakra) */
  varga: VargaName;
  bhava: boolean;
  /** the varga's short name in menu labels (0x8a2800[v]: "D-9", "D-1 (B)") */
  short: string;
  signs: ChartPoint[][];
  lagna: number;
  caption: ChartCaption;
  /** sign of each graha in this chart (for the right-click commands, whatever the view shows) */
  grahaSign: (g: Graha) => number;
  /** "Copy chart as text" sources */
  chart: ChakraChart;
  ini: Partial<JhoraIni>;
  /** the chart's spec (worker commands); the caller fills it */
  spec?: ChartSpec | null;
  /** "Bhava from %s" (33294) */
  extraCaption?: string;
}

/** Centre captions of a slot: chart name, the long varga name, the short one for vargas other than D-1. */
export function slotCaption(varga: VargaName, ini: Partial<JhoraIni>, name: string): ChartCaption {
  const v = VARGA_INDEX.indexOf(varga);
  const long = v >= 0 ? JHORA_VARGA_LONG_NAMES[v] || VARGA_TITLES[varga] : VARGA_TITLES[varga];
  return { name, varga: long, short: v === 0 ? null : vargaColumnLabel(varga, ini) };
}

export interface SlotChartOptions {
  /** Bhava/Chalit signs from the worker (needed when needsCusps(ini)) */
  bhavaSigns?: (number | null)[] | null;
  /** 33294 body index */
  housesFrom?: number | null;
  spec?: ChartSpec | null;
}

export function slotChart(chart: ChakraChart, ini: Partial<JhoraIni>, varga: SlotVarga, view: ChartView, name: string, opts: SlotChartOptions = {}): SlotChart | null {
  const bhava = varga === 'Bhava';
  let override: (number | null)[] | undefined;
  if (bhava) {
    const all = { ...(chart.ini ?? {}), ...ini };
    override = opts.bhavaSigns ?? (needsCusps(all) ? undefined : bhavaSigns(chart, all));
    if (!override) return null;
  }
  const v: VargaName = bhava ? 'D1' : varga;
  const signs = chartSigns(chart, v, { view, ini, signs: override });
  const planets = chartSigns(chart, v, { ini, indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], signs: override });
  const where = (id: string) => planets.findIndex((l) => l.some((b) => b.id === id));
  const caption = bhava ? { name, varga: BHAVA_LONG_NAME, short: bhavaShortName({ ...(chart.ini ?? {}), ...ini }) } : slotCaption(v, ini, name);
  const hf = opts.housesFrom;
  return {
    varga: v, bhava, short: bhava ? 'D-1 (B)' : dn(v), signs, lagna: where('Lagna'), caption, grahaSign: (g) => where(g), chart, ini,
    spec: opts.spec ?? null, extraCaption: hf !== null && hf !== undefined ? `Bhava from ${BODY_NAMES[hf]}` : undefined,
  };
}

/**
 * The charts a slot can draw: the one on screen (a derived chart when the document shows one)
 * and the natal chart for "Natal chart only".
 */
export function useSlotSources(chart: ChartResult | null, spec: ChartSpec | null) {
  const doc = useActiveDoc();
  const derived = doc?.derived ?? null;
  const natalSpec = useMemo<ChartSpec | null>(() => (spec && doc && derived ? { ...spec, birth: doc.birth } : null), [spec, doc, derived]);
  const natal = useJob(natalSpec ? { kind: 'chart' as const, chart: natalSpec } : null);
  const ini = useMemo(() => spec?.ini ?? {}, [spec]);
  // the Bhava/Chalit chakra from house cusps of systems that need the ephemeris (core/chartJobs.ts)
  const cusps = needsCusps({ ...DEFAULTS, ...ini });
  const bhavaCur = useJob(cusps && spec ? { kind: 'table' as const, chart: spec, table: 'chart.bhavaSigns' } : null);
  const bhavaNat = useJob(cusps && natalSpec ? { kind: 'table' as const, chart: natalSpec, table: 'chart.bhavaSigns' } : null);
  const parse = (t: string[] | undefined) => (t?.[0] ? (JSON.parse(t[0]) as (number | null)[]) : null);
  const curSigns = useMemo(() => parse(bhavaCur.data?.text), [bhavaCur.data]);
  const natSigns = useMemo(() => parse(bhavaNat.data?.text), [bhavaNat.data]);
  const pick = useCallback((natalOnly: boolean): { chart: ChartResult | null; name: string; spec: ChartSpec | null; bhavaSigns: (number | null)[] | null } => {
    if (!derived) return { chart, name: NATAL_CHART_NAME, spec, bhavaSigns: curSigns };
    return natalOnly
      ? { chart: natal.data, name: NATAL_CHART_NAME, spec: natalSpec, bhavaSigns: natSigns }
      : { chart, name: derived.label, spec, bhavaSigns: curSigns };
  }, [chart, derived, natal.data, spec, natalSpec, curSigns, natSigns]);
  return { ini, pick, hasDerived: !!derived };
}

/** One slot of a CChartView: the DisplayVarga entry it draws (`at`), that varga and its style. */
export interface SlotPlace { at: number; varga: SlotVarga; style: ChartStyle }

/**
 * The UseTwoChartStyles pairing of the draw loop (0x43226d) and FUN_00432360: slot i draws
 * DisplayVarga[i - (i & 1)] in ChartStyle2 when i is odd, else DisplayVarga[i] in ChartStyle.
 */
export function slotPlaces(ini: Partial<JhoraIni>, count: number, base: ChartStyle): SlotPlace[] {
  const display = ini.DisplayVarga ?? DEFAULTS.DisplayVarga;
  const two = (ini.UseTwoChartStyles ?? DEFAULTS.UseTwoChartStyles) !== 0;
  const style2 = CHART_STYLES[ini.ChartStyle2 ?? DEFAULTS.ChartStyle2]?.style ?? 'north';
  return Array.from({ length: count }, (_, i) => {
    const at = two ? i - (i & 1) : i;
    return { at, varga: slotVargaOf(display[at] ?? 0), style: two && i & 1 ? style2 : base };
  });
}

/** slotPlaces() for the preferences and chart style in the store. */
export function useSlotLayout(count: number): SlotPlace[] {
  const prefs = useStore((s) => s.ini);
  const base = useStore((s) => s.view.chartStyle);
  return useMemo(() => slotPlaces(prefs, count, base), [prefs, count, base]);
}

/** Write a slot's varga into DisplayVarga (the pair's first entry with two chart styles). */
export function setSlotVarga(at: number, v: SlotVarga) {
  const display = [...(getState().ini.DisplayVarga ?? DEFAULTS.DisplayVarga)];
  display[at] = displayIndexOf(v);
  setIni({ DisplayVarga: display });
}

/** What a right-click command left on one chart: highlights, coloured planets and/or a message. */
interface SlotMarks {
  signs: number[];
  bodyClasses?: Record<string, string>;
  caption?: string;
  rows?: [string, string][];
  lines?: string[];
  signChange?: { body: string; varga: VargaName };
}
const RELATION_TITLE = { permanent: 'Permanent', temporary: 'Temporary', compound: 'Compound' };

/** Result of "When will this planet / lagna change sign" (needs the ephemeris, so it runs in the worker). */
function SignChangeNote({ spec, body, varga }: { spec: ChartSpec; body: string; varga: VargaName }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'chart.signChange', params: { body, varga } });
  if (job.status === 'error') return <p className="error">{job.error}</p>;
  if (!job.data) return <p className="status">Searching…</p>;
  return <><strong>{job.data.caption}</strong><pre>{job.data.text?.join('\n')}</pre></>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>{title}</strong><button onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

/** "Aspect table with relationships" (JHora opens it as a separate window). */
function AspectTableDialog({ spec, varga, onClose }: { spec: ChartSpec; varga: VargaName; onClose: () => void }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'aspects.table', params: { varga } });
  return <Modal title="Aspect Table with Relationships" onClose={onClose}><TableView job={job} /></Modal>;
}

/** 32827 "Show ashtakavarga of this chart": the ashtakavarga view of the slot's chart and varga. */
function AshtakavargaDialog({ spec, varga, onClose }: { spec: ChartSpec; varga: VargaName; onClose: () => void }) {
  const [mode, setMode] = useState<string>(AV_MODES[0]);
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'strengths.ashtakavarga', params: { mode, varga } });
  return (
    <Modal title={`Ashtakavarga (${dn(varga)})`} onClose={onClose}>
      <div className="subview-bar">
        <select aria-label="Ashtakavarga mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          {AV_MODES.map((m) => <option key={m} value={m}>{AV_MODE_LABELS[m]}</option>)}
        </select>
      </div>
      <TableView job={job} />
    </Modal>
  );
}

/** 32969 "Planet longitudes" of the entry chart (CEntryBasicInfoView: Longitudes & Basic Info). */
function LongitudesDialog({ spec, onClose }: { spec: ChartSpec; onClose: () => void }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'basics.longitudes', params: {} });
  return <Modal title="Planet longitudes" onClose={onClose}><TableView job={job} /></Modal>;
}

// -- "Change birthtime to move lagna to" (33186..33189) ------------------------------------
/** The per-chart undo stacks (JHora: one global stack 0x65b978, seeded when a chart is opened). */
const lagnaStacks = new Map<string, BirthData[]>();
const sameBirth = (a: BirthData, b: BirthData) => JSON.stringify(a) === JSON.stringify(b);
function stackOf(docId: string, birth: BirthData): BirthData[] {
  let s = lagnaStacks.get(docId);
  if (!s) { s = [birth]; lagnaStacks.set(docId, s); }
  // birth data edited elsewhere: JHora pushes those moments too (0x403087)
  if (!sameBirth(s[s.length - 1], birth) && s.length < 500) s.push(birth);
  return s;
}
/** Entries that "Undo the latest change" can go back. */
export const lagnaUndoDepth = (docId: string, birth: BirthData) => stackOf(docId, birth).length - 1;

/** Runs chart.moveLagna and applies the new natal birth (once). */
function LagnaMover({ req, onDone }: { req: { spec: ChartSpec; natal: BirthData; varga: VargaName; dir: 'prev' | 'next'; docId: string }; onDone: () => void }) {
  const job = useJob({ kind: 'table' as const, chart: req.spec, table: 'chart.moveLagna', params: { varga: req.varga, dir: req.dir, natal: req.natal } });
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !job.data?.text?.[0]) return;
    done.current = true;
    const { birth } = JSON.parse(job.data.text[0]) as { birth: BirthData };
    const s = stackOf(req.docId, req.natal);
    if (s.length < 500) s.push(birth);
    updateChart(req.docId, { birth });
    onDone();
  }, [job.data, req, onDone]);
  if (job.status === 'error') return <p className="error">{job.error}</p>;
  return null;
}

/** Extra context of the entry chart window (menu 138). */
export interface EntryContext { natalSpec: ChartSpec; periodDays: number; label: string }

export interface SlotControl {
  /** which right-click menu (103 for CChartView, 138 for the entry chart) */
  menu?: MenuKind;
  /** set slot i's varga (33330..33362, 33009) */
  setVarga?: (slot: number, v: SlotVarga) => void;
  /** 33293 / 33294 */
  setHousesFrom?: (slot: number, body: number | null) => void;
  /** menu 138: 32970 compressed Patyayini of the entry chart */
  onPatyayini?: (slot: number) => void;
}

/**
 * The chart right-click menu (ChartMenu) for a set of slots: returns the context-menu handler,
 * the per-slot marks and the elements to render (menu, dialogs, per-slot notes).
 */
export function useSlotMenu(slots: (SlotChart | null)[], spec: ChartSpec | null, ctl: SlotControl = {}) {
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [marks, setMarks] = useState<Record<number, SlotMarks>>({});
  const closeMenu = useCallback(() => setMenu(null), []);
  const [aspectTable, setAspectTable] = useState<{ spec: ChartSpec; varga: VargaName } | null>(null);
  const [av, setAv] = useState<{ spec: ChartSpec; varga: VargaName } | null>(null);
  const [longitudes, setLongitudes] = useState<ChartSpec | null>(null);
  const [bhavaDialog, setBhavaDialog] = useState(false);
  const [move, setMove] = useState<{ spec: ChartSpec; natal: BirthData; varga: VargaName; dir: 'prev' | 'next'; docId: string } | null>(null);
  const doc = useActiveDoc();
  const packed = useStore((s) => (s.ini.MoreChartsOnBigDisplay ?? DEFAULTS.MoreChartsOnBigDisplay) !== 0);
  const moveDone = useCallback(() => setMove(null), []);

  const onAction = (a: MenuAction) => {
    const slot = menu ? slots[menu.slot] : null;
    if (!menu || !slot) return;
    const slotSpec = slot.spec ?? spec;
    // the varga the timing commands use: 0x591ed4[v] divisions (9 for varga 28)
    const timing: VargaName = slot.bhava ? 'D9' : slot.varga;
    switch (a.kind) {
      case 'aspectTable': if (slotSpec) setAspectTable({ spec: slotSpec, varga: slot.varga }); return;
      case 'ashtakavarga': if (slotSpec) setAv({ spec: slotSpec, varga: slot.varga }); return;
      case 'longitudes': if (slotSpec) setLongitudes(slotSpec); return;
      case 'patyayini': ctl.onPatyayini?.(menu.slot); return;
      case 'bhavaOptions': setBhavaDialog(true); return;
      case 'bhava':
        if (a.base !== null) setIni({ BhavaChartVarga: a.base });
        ctl.setVarga?.(menu.slot, 'Bhava');
        return;
      case 'signsChart': ctl.setHousesFrom?.(menu.slot, null); return;
      case 'housesFrom': {
        const b = menu.body ? BODY_NAMES.indexOf(menu.body) : -1;
        if (b >= 0) ctl.setHousesFrom?.(menu.slot, b);
        return;
      }
      case 'packed': setIni({ MoreChartsOnBigDisplay: packed ? 0 : 1 }); return;
      case 'moveLagna':
        if (slotSpec && doc) setMove({ spec: slotSpec, natal: doc.birth, varga: timing, dir: a.dir, docId: doc.id });
        return;
      case 'undoLagna': {
        if (!doc) return;
        const s = stackOf(doc.id, doc.birth);
        if (s.length < 2) return;
        if (a.all) s.splice(1); else s.pop();
        updateChart(doc.id, { birth: s[s.length - 1] });
        return;
      }
    }
    const signOfBody = slot.grahaSign;
    const planet = menu.body && (GRAHAS as readonly string[]).includes(menu.body) ? (menu.body as Graha) : null;
    let m: SlotMarks = { signs: [] };
    if (a.kind === 'highlight') m = { signs: highlightSigns(a.what, signOfBody, planet, menu.sign) };
    else if (a.kind === 'relations' && planet) {
      const codes = relationCodes(a.what, planet, signOfBody);
      m = {
        signs: [],
        bodyClasses: Object.fromEntries(GRAHAS.map((g, k) => [g, `relbox${codes[k]}`])),
        caption: `${RELATION_TITLE[a.what]} relationships of ${planet} (${slot.short})`,
        rows: GRAHAS.filter((g) => g !== planet).map((g) => [g, RELATION_CODE_NAMES[codes[GRAHAS.indexOf(g)]]]),
      };
    } else if (a.kind === 'pachakadiRasi') {
      m = { signs: [menu.sign], caption: `${SIGN_NAMES[menu.sign]}: Pachakadi Relationships`, lines: pachakadiOfRasi(menu.sign, signOfBody) };
    } else if (a.kind === 'pachakadiPlanet' && planet) {
      m = { signs: [], caption: `${planet}: Pachakadi Relationships`, lines: pachakadiOfPlanet(planet, menu.sign, signOfBody) };
    } else if (a.kind === 'mks') {
      m = { signs: [], caption: 'Planets in Marana Karaka Sthana', lines: maranaKarakaSthana(slot.lagna, signOfBody, slot.short) };
    } else if (a.kind === 'signChange' && planet) {
      m = { signs: [], signChange: { body: planet, varga: timing } };
    } else if (a.kind === 'lagnaChange') {
      m = { signs: [], signChange: { body: 'Lagna', varga: timing } };
    }
    // a new highlight replaces the previous ones (FUN_00440570 at the start of each command)
    setMarks({ [menu.slot]: m });
  };
  const onMenu = (i: number) => (e: MouseEvent, sign: number, body: string | null) => {
    e.preventDefault();
    // CChartView::OnContextMenu (0x439ab0) clears all highlights and relationship colours first
    setMarks({});
    const slot = slots[i];
    setMenu({
      x: e.clientX, y: e.clientY, slot: i, sign, body, varga: slot?.short, packed,
      undo: doc ? lagnaUndoDepth(doc.id, doc.birth) : 0,
    });
  };
  const overlay = (
    <>
      {menu && <ChartMenu target={menu} onAction={onAction} onClose={closeMenu} menu={ctl.menu} />}
      {aspectTable && <AspectTableDialog spec={aspectTable.spec} varga={aspectTable.varga} onClose={() => setAspectTable(null)} />}
      {av && <AshtakavargaDialog spec={av.spec} varga={av.varga} onClose={() => setAv(null)} />}
      {longitudes && <LongitudesDialog spec={longitudes} onClose={() => setLongitudes(null)} />}
      {bhavaDialog && <BhavaChartDialog onClose={() => setBhavaDialog(false)} />}
      {move && <LagnaMover req={move} onDone={moveDone} />}
    </>
  );
  const note = (i: number) => (marks[i]?.caption || marks[i]?.signChange) && (
    <div className="chart-note">
      <div className="note-bar">
        <strong>{marks[i].caption}</strong>
        <button onClick={() => setMarks((x) => ({ ...x, [i]: { signs: [] } }))}>Close</button>
      </div>
      {marks[i].rows && <table><tbody>{marks[i].rows!.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table>}
      {marks[i].lines && <pre>{marks[i].lines!.join('\n')}</pre>}
      {marks[i].signChange && (slots[i]?.spec ?? spec) && <SignChangeNote spec={(slots[i]?.spec ?? spec)!} body={marks[i].signChange!.body} varga={marks[i].signChange!.varga} />}
    </div>
  );
  return { onMenu, marks, overlay, note };
}

async function toClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

const SLOT_VARGAS: SlotVarga[] = [...VARGA_NAMES, 'Bhava'];
const slotVargaLabel = (v: SlotVarga) => (v === 'Bhava' ? `${BHAVA_LONG_NAME} chakra` : `${dn(v)} ${VARGA_TITLES[v]}`);

/**
 * A slot's controls: varga, view, display mode and the text copies. `varga` / `onVarga` are
 * omitted where the varga is chosen elsewhere.
 */
export function SlotBar({ label, slot, settings, onSettings, varga, onVarga, style, hasDerived }: {
  label: string; slot: SlotChart | null; settings: SlotSettings; onSettings: (s: SlotSettings) => void;
  varga?: SlotVarga; onVarga?: (v: SlotVarga) => void; style: ChartStyle; hasDerived: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (sne: boolean) => {
    if (!slot) return;
    const text = sne ? chartTextSne(slot.chart, slot.varga, slot.ini) : chartText(slot.chart, slot.varga, styleIndex(style), slot.ini);
    setCopied((await toClipboard(text)) ? 'Copied' : 'Clipboard not available');
    setTimeout(() => setCopied(null), 1500);
  };
  // the text copies are not ported for the Bhava/Chalit chakra
  const noCopy = !slot || slot.bhava;
  return (
    <div className="slot-bar">
      {varga && onVarga && (
        <select aria-label={`${label} varga`} value={varga} onChange={(e) => onVarga(e.target.value as SlotVarga)}>
          {SLOT_VARGAS.map((v) => <option key={v} value={v}>{slotVargaLabel(v)}</option>)}
        </select>
      )}
      <select aria-label={`${label} view`} value={settings.view} onChange={(e) => onSettings({ ...settings, view: e.target.value as ChartView })}>
        {CHART_VIEWS.map((v) => <option key={v.view} value={v.view}>{v.label}</option>)}
      </select>
      {hasDerived && (
        <select aria-label={`${label} display mode`} value={settings.natalOnly ? 'natal' : 'auto'} onChange={(e) => onSettings({ ...settings, natalOnly: e.target.value === 'natal' })}>
          <option value="auto">Automatic (Natal, Tajaka etc)</option>
          <option value="natal">Natal chart only</option>
        </select>
      )}
      <button onClick={() => copy(false)} disabled={noCopy} title="Copy chart as text to clipboard (current chart style)">Copy text</button>
      <button onClick={() => copy(true)} disabled={noCopy} title="Copy chart as text to clipboard (south-north-east styles)">Copy S/N/E</button>
      {copied && <span className="copied">{copied}</span>}
    </div>
  );
}

/** Set the chart style (DisplayPreferences ChartStyle, DAT_0065b930) of every chart diagram. */
export function setChartStyle(style: ChartStyle) {
  setView({ chartStyle: style });
  setIni({ ChartStyle: styleIndex(style) });
}

/** ChartStyle (South / South mirrored / North / East / East with frame) of every chart diagram. */
export function StyleSelect() {
  const style = useStore((s) => s.view.chartStyle);
  return (
    <select aria-label="Chart diagram style" value={style} onChange={(e) => setChartStyle(e.target.value as ChartStyle)}>
      {CHART_STYLES.map((c) => <option key={c.style} value={c.style}>{c.label}</option>)}
    </select>
  );
}

/** Dialog 2036 "Multiple Chart Style Support" (Preferences > Related to Display > "Use of 2 chart styles", 33114). */
export function TwoStylesDialog({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const base = useStore((s) => s.view.chartStyle);
  const [two, setTwo] = useState((ini.UseTwoChartStyles ?? DEFAULTS.UseTwoChartStyles) !== 0);
  const [first, setFirst] = useState(styleIndex(base));
  const [second, setSecond] = useState(ini.ChartStyle2 ?? DEFAULTS.ChartStyle2);
  const ok = () => {
    setChartStyle(CHART_STYLES[first].style);
    setIni({ ChartStyle2: second, UseTwoChartStyles: two ? 1 : 0 });
    onClose();
  };
  const pickStyle = (value: number, set: (n: number) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => set(Number(e.target.value))}>
      {CHART_STYLES.map((c, i) => <option key={c.style} value={i}>{c.label}</option>)}
    </select>
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Multiple Chart Style Support" onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>Multiple Chart Style Support</strong></div>
        <p><label><input type="checkbox" checked={two} onChange={(e) => setTwo(e.target.checked)} /> Use two chart styles</label></p>
        <p>Choose the chart style of the first chart: {pickStyle(first, setFirst, 'First chart style')}</p>
        <p>Choose the chart style of the second chart: {pickStyle(second, setSecond, 'Second chart style')}</p>
        <div className="note-bar"><span /><span><button onClick={ok}>OK</button> <button onClick={onClose}>Cancel</button></span></div>
      </div>
    </div>
  );
}

/** Button opening dialog 2036. */
export function TwoStylesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title="Use of 2 chart styles (33114)">2 styles…</button>
      {open && <TwoStylesDialog onClose={() => setOpen(false)} />}
    </>
  );
}

/** "Optional bodies in standard view": the global Show*InCharts flags. */
export function OptionalBodies() {
  const ini = useStore((s) => s.ini);
  return (
    <details>
      <summary>Bodies</summary>
      <div>
        {OPTIONAL_BODIES.map((o) => (
          <label key={o.cmd}>
            <input type="checkbox" checked={((ini[o.key] ?? DEFAULTS[o.key]) as number) !== 0}
              onChange={(e) => setIni({ [o.key]: e.target.checked ? 1 : 0 } as Partial<JhoraIni>)} /> {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

const S = 360, M = 10;

/** FUN_004318f0 for the chart pane (DAT_00579a70 = 0): 6 charts in 2 x 3, 2 charts in 1 x 2. */
export function paneLayout(count: number) {
  const cols = count >= 6 ? 2 : 1, rows = Math.ceil(count / cols);
  return {
    cols, rows, width: cols * S + (cols + 1) * M, height: rows * S + (rows + 1) * M,
    at: (i: number): [number, number] => [M + (i % cols) * (S + M), M + Math.floor(i / cols) * (S + M)],
  };
}

export function ChartPane({ chart, spec }: { chart: ChartResult | null; spec: ChartSpec | null }) {
  const packed = useStore((s) => (s.ini.MoreChartsOnBigDisplay ?? DEFAULTS.MoreChartsOnBigDisplay) !== 0);
  const count = packed ? 6 : 2;
  const layout = useSlotLayout(count);
  const { ini, pick, hasDerived } = useSlotSources(chart, spec);
  const [settings, setSettings] = useState<SlotSettings[]>(() => Array.from({ length: 6 }, () => DEFAULT_SLOT));
  const [selected, setSelected] = useState(0);
  const slots = useMemo(() => layout.map(({ varga }, i) => {
    const s = settings[i] ?? DEFAULT_SLOT;
    const src = pick(s.natalOnly);
    return src.chart ? slotChart(src.chart, ini, varga, s.view, src.name, { bhavaSigns: src.bhavaSigns, housesFrom: s.housesFrom, spec: src.spec }) : null;
  }), [layout, settings, pick, ini]);
  const update = (i: number, patch: Partial<SlotSettings>) => setSettings((x) => x.map((y, j) => (j === i ? { ...y, ...patch } : y)));
  const { onMenu, marks, overlay, note } = useSlotMenu(slots, spec, {
    setVarga: (i, v) => setSlotVarga(layout[i].at, v),
    setHousesFrom: (i, b) => update(i, { housesFrom: b }),
  });
  const g = paneLayout(count);
  const sel = Math.min(selected, count - 1);

  return (
    <div className="chart-pane">
      {overlay}
      <div className="slot-bar"><StyleSelect /><TwoStylesButton /><OptionalBodies />
        <label title="Packed chart mode (more charts): MoreChartsOnBigDisplay (33287)">
          <input type="checkbox" checked={packed} onChange={(e) => setIni({ MoreChartsOnBigDisplay: e.target.checked ? 1 : 0 })} /> Packed
        </label>
      </div>
      <SlotBar label={`Chart ${sel + 1}`} slot={slots[sel]} settings={settings[sel] ?? DEFAULT_SLOT} style={layout[sel].style} hasDerived={hasDerived}
        onSettings={(s) => update(sel, s)} varga={layout[sel].varga} onVarga={(v) => setSlotVarga(layout[sel].at, v)} />
      <svg viewBox={`0 0 ${g.width} ${g.height}`} className="chart chart-pane-grid" role="img" aria-label="Charts" style={{ maxWidth: count === 6 ? 760 : 460 }}>
        {slots.map((c, i) => {
          const [x, y] = g.at(i);
          return c && (
            <ChartFigure key={i} x={x} y={y} size={S} style={layout[i].style} signs={c.signs} lagnaSign={c.lagna} caption={c.caption}
              highlights={marks[i]?.signs} bodyClasses={marks[i]?.bodyClasses} extraCaption={c.extraCaption}
              onMenu={(e, sign, body) => { setSelected(i); onMenu(i)(e, sign, body); }} onSelect={() => setSelected(i)} />
          );
        })}
        {count > 1 && <rect x={g.at(sel)[0] - 3} y={g.at(sel)[1] - 3} width={S + 6} height={S + 6} className="cb-selbox" />}
      </svg>
      {slots.map((_, i) => note(i) && <div key={i}><strong>Chart {i + 1}</strong>{note(i)}</div>)}
    </div>
  );
}
