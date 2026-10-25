// Left pane: JHora shows the natal chart(s) here on every tab (CChartView; the same view fills
// the Chakras > Many Vargas sub-tab, src/ui/chakras/ManyVargas.tsx).
//
// Per chart slot, as in JHora's chart menu 103: the varga, the body view ("Choose a view",
// 32803..33052, core/chartBodies.ts), the display mode (32801 Automatic: the chart on screen,
// e.g. a Tajaka chart; 32802 Natal chart only: DAT_0065b8a4[slot] = 1 draws doc+0x50, the
// natal chart) and "Copy chart > as text" (32985 current style / 32992 south-north-east,
// core/chartText.ts). "Optional bodies in standard view" (33053..33061, 33268, 33270) are
// global preferences (the Show*InCharts ini keys), as in JHora.
import { useCallback, useMemo, useState, type MouseEvent } from 'react';
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
import type { ChakraChart } from '../../core/chakras/common';
import { DEFAULTS, type JhoraIni } from '../../settings/generated';
import { CHART_STYLES, ChartDiagram, styleIndex, type ChartCaption, type ChartStyle } from '../ChartDiagram';
import { setIni, setView, useActiveDoc, useStore } from '../state/store';
import { ChartMenu, type MenuAction, type MenuTarget } from './ChartMenu';

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

/** One chart slot's settings (JHora keeps them per slot, reset when the view is created). */
export interface SlotSettings { view: ChartView; natalOnly: boolean }
export const DEFAULT_SLOT: SlotSettings = { view: 'standard', natalOnly: false };

/** The chart a slot draws, its bodies per sign and its captions. */
export interface SlotChart {
  varga: VargaName;
  signs: ChartPoint[][];
  lagna: number;
  caption: ChartCaption;
  /** sign of each graha in this varga (for the right-click commands, whatever the view shows) */
  grahaSign: (g: Graha) => number;
  /** "Copy chart as text" sources */
  chart: ChakraChart;
  ini: Partial<JhoraIni>;
}

/** Centre captions of a slot: chart name, the long varga name, the short one for vargas other than D-1. */
export function slotCaption(varga: VargaName, ini: Partial<JhoraIni>, name: string): ChartCaption {
  const v = VARGA_INDEX.indexOf(varga);
  const long = v >= 0 ? JHORA_VARGA_LONG_NAMES[v] || VARGA_TITLES[varga] : VARGA_TITLES[varga];
  return { name, varga: long, short: v === 0 ? null : vargaColumnLabel(varga, ini) };
}

export function slotChart(chart: ChakraChart, ini: Partial<JhoraIni>, varga: VargaName, view: ChartView, name: string): SlotChart {
  const signs = chartSigns(chart, varga, { view, ini });
  const planets = chartSigns(chart, varga, { ini, indices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
  const where = (id: string) => planets.findIndex((l) => l.some((b) => b.id === id));
  return { varga, signs, lagna: where('Lagna'), caption: slotCaption(varga, ini, name), grahaSign: (g) => where(g), chart, ini };
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
  const pick = useCallback((natalOnly: boolean): { chart: ChartResult | null; name: string } => {
    if (!derived) return { chart, name: NATAL_CHART_NAME };
    return natalOnly ? { chart: natal.data, name: NATAL_CHART_NAME } : { chart, name: derived.label };
  }, [chart, derived, natal.data]);
  return { ini, pick, hasDerived: !!derived };
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

/** Result of "When will this planet change sign" (needs the ephemeris, so it runs in the worker). */
function SignChangeNote({ spec, body, varga }: { spec: ChartSpec; body: string; varga: VargaName }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'chart.signChange', params: { body, varga } });
  if (job.status === 'error') return <p className="error">{job.error}</p>;
  if (!job.data) return <p className="status">Searching…</p>;
  return <><strong>{job.data.caption}</strong><pre>{job.data.text?.join('\n')}</pre></>;
}

/** "Aspect table with relationships" (JHora opens it as a separate window). */
function AspectTableDialog({ spec, varga, onClose }: { spec: ChartSpec; varga: VargaName; onClose: () => void }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'aspects.table', params: { varga } });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Aspect Table with Relationships" onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>Aspect Table with Relationships</strong><button onClick={onClose}>Close</button></div>
        <TableView job={job} />
      </div>
    </div>
  );
}

/**
 * The chart right-click menu (ChartMenu) for a set of slots: returns the context-menu handler,
 * the per-slot marks and the elements to render (menu, dialogs, per-slot notes).
 */
export function useSlotMenu(slots: (SlotChart | null)[], spec: ChartSpec | null) {
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [marks, setMarks] = useState<Record<number, SlotMarks>>({});
  const closeMenu = useCallback(() => setMenu(null), []);
  const [aspectTable, setAspectTable] = useState<VargaName | null>(null);

  const onAction = (a: MenuAction) => {
    const slot = menu ? slots[menu.slot] : null;
    if (!menu || !slot) return;
    if (a.kind === 'aspectTable') { setAspectTable(slot.varga); return; }
    const signOfBody = slot.grahaSign;
    const planet = menu.body && (GRAHAS as readonly string[]).includes(menu.body) ? (menu.body as Graha) : null;
    let m: SlotMarks = { signs: [] };
    if (a.kind === 'highlight') m = { signs: highlightSigns(a.what, signOfBody, planet, menu.sign) };
    else if (a.kind === 'relations' && planet) {
      const codes = relationCodes(a.what, planet, signOfBody);
      m = {
        signs: [],
        bodyClasses: Object.fromEntries(GRAHAS.map((g, k) => [g, `relbox${codes[k]}`])),
        caption: `${RELATION_TITLE[a.what]} relationships of ${planet} (${dn(slot.varga)})`,
        rows: GRAHAS.filter((g) => g !== planet).map((g) => [g, RELATION_CODE_NAMES[codes[GRAHAS.indexOf(g)]]]),
      };
    } else if (a.kind === 'pachakadiRasi') {
      m = { signs: [menu.sign], caption: `${SIGN_NAMES[menu.sign]}: Pachakadi Relationships`, lines: pachakadiOfRasi(menu.sign, signOfBody) };
    } else if (a.kind === 'pachakadiPlanet' && planet) {
      m = { signs: [], caption: `${planet}: Pachakadi Relationships`, lines: pachakadiOfPlanet(planet, menu.sign, signOfBody) };
    } else if (a.kind === 'mks') {
      m = { signs: [], caption: 'Planets in Marana Karaka Sthana', lines: maranaKarakaSthana(slot.lagna, signOfBody, dn(slot.varga)) };
    } else if (a.kind === 'signChange' && menu.body) {
      m = { signs: [], signChange: { body: menu.body, varga: slot.varga } };
    }
    setMarks((x) => ({ ...x, [menu.slot]: m }));
  };
  const onMenu = (i: number) => (e: MouseEvent, sign: number, body: string | null) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, slot: i, sign, body });
  };
  const overlay = (
    <>
      {menu && <ChartMenu target={menu} onAction={onAction} onClose={closeMenu} />}
      {aspectTable && spec && <AspectTableDialog spec={spec} varga={aspectTable} onClose={() => setAspectTable(null)} />}
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
      {marks[i].signChange && spec && <SignChangeNote spec={spec} body={marks[i].signChange!.body} varga={marks[i].signChange!.varga} />}
    </div>
  );
  return { onMenu, marks, overlay, note };
}

async function toClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/**
 * A slot's controls: varga, view, display mode and the text copies. `varga` / `onVarga` are
 * omitted where the varga is chosen elsewhere.
 */
export function SlotBar({ label, slot, settings, onSettings, varga, onVarga, style, hasDerived }: {
  label: string; slot: SlotChart | null; settings: SlotSettings; onSettings: (s: SlotSettings) => void;
  varga?: VargaName; onVarga?: (v: VargaName) => void; style: ChartStyle; hasDerived: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (sne: boolean) => {
    if (!slot) return;
    const text = sne ? chartTextSne(slot.chart, slot.varga, slot.ini) : chartText(slot.chart, slot.varga, styleIndex(style), slot.ini);
    setCopied((await toClipboard(text)) ? 'Copied' : 'Clipboard not available');
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="slot-bar">
      {varga && onVarga && (
        <select aria-label={`${label} varga`} value={varga} onChange={(e) => onVarga(e.target.value as VargaName)}>
          {VARGA_NAMES.map((v) => <option key={v} value={v}>{dn(v)} {VARGA_TITLES[v]}</option>)}
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
      <button onClick={() => copy(false)} disabled={!slot} title="Copy chart as text to clipboard (current chart style)">Copy text</button>
      <button onClick={() => copy(true)} disabled={!slot} title="Copy chart as text to clipboard (south-north-east styles)">Copy S/N/E</button>
      {copied && <span className="copied">{copied}</span>}
    </div>
  );
}

/** ChartStyle (South / South mirrored / North / East / East with frame) of every chart diagram. */
export function StyleSelect() {
  const style = useStore((s) => s.view.chartStyle);
  return (
    <select aria-label="Chart diagram style" value={style} onChange={(e) => setView({ chartStyle: e.target.value as ChartStyle })}>
      {CHART_STYLES.map((c) => <option key={c.style} value={c.style}>{c.label}</option>)}
    </select>
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

export function ChartPane({ chart, spec }: { chart: ChartResult | null; spec: ChartSpec | null }) {
  const { leftVargas, chartStyle } = useStore((s) => s.view);
  const { ini, pick, hasDerived } = useSlotSources(chart, spec);
  const [settings, setSettings] = useState<SlotSettings[]>([DEFAULT_SLOT, DEFAULT_SLOT]);
  const slots = useMemo(() => leftVargas.map((v, i) => {
    const s = settings[i] ?? DEFAULT_SLOT;
    const src = pick(s.natalOnly);
    return src.chart ? slotChart(src.chart, ini, v, s.view, src.name) : null;
  }), [leftVargas, settings, pick, ini]);
  const { onMenu, marks, overlay, note } = useSlotMenu(slots, spec);

  return (
    <div className="chart-pane">
      {overlay}
      <div className="slot-bar"><StyleSelect /><OptionalBodies /></div>
      {slots.map((c, i) => (
        <div key={i} className="chart-slot">
          {c && <ChartDiagram style={chartStyle} signs={c.signs} lagnaSign={c.lagna} caption={c.caption}
            highlights={marks[i]?.signs} bodyClasses={marks[i]?.bodyClasses} onMenu={onMenu(i)} />}
          {note(i)}
          <SlotBar label={`Chart ${i + 1}`} slot={c} settings={settings[i] ?? DEFAULT_SLOT} style={chartStyle} hasDerived={hasDerived}
            onSettings={(s) => setSettings((x) => x.map((y, j) => (j === i ? s : y)))}
            varga={leftVargas[i]} onVarga={(v) => setView({ leftVargas: leftVargas.map((x, j) => (j === i ? v : x)) as [VargaName, VargaName] })} />
        </div>
      ))}
    </div>
  );
}
