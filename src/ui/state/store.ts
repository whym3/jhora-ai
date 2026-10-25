// Application state: open charts (JHora's MDI documents), preferences and view state.
import { useSyncExternalStore } from 'react';
import type { BirthData } from '../../core/jhd';
import { defaultLocationFromChart, newChartBirth } from '../../core/newChart';
import type { VargaName } from '../../core/vargas';
import { DEFAULTS, type JhoraIni } from '../../settings/generated';
import type { ChartStyle } from '../ChartDiagram';
import { TOP_TABS, SUB_TABS, type TopTab } from '../shell/tabs';

export interface ChartDoc {
  id: string;
  title: string;
  birth: BirthData;
  /** per-chart setting overrides (JHora keeps a few options per chart) */
  ini: Partial<JhoraIni>;
  /**
   * A chart derived from this one (Tajaka annual chart etc.) that JHora shows in
   * every view until "Back to Natal Chart".
   */
  derived?: DerivedChart | null;
  /**
   * Edit > "Change timezone" (33200): the zone (east-positive hours) every view shows the
   * chart in, or null for the birth zone. Not saved in the .jhd (src/core/displayTz.ts).
   */
  displayTz?: number | null;
  /** saved or opened from a file: JHora's chart notes need a file name (32988) */
  saved?: boolean;
}

/** Derived chart kinds: one per form tab that replaces the natal chart (extend additively). */
export type DerivedKind = 'tajaka' | 'tithiPravesha' | 'angularReturn' | 'prasna' | 'progression' | 'mundane' | 'entry';

export interface DerivedChart {
  kind: DerivedKind;
  label: string;
  birth: BirthData;
  /** the form input that produced it (Tajaka: TajakaSelection and variant) */
  params: Record<string, unknown>;
}

export interface ViewState {
  topTab: TopTab;
  subTab: Partial<Record<TopTab, string>>;
  /** the two charts shown in the left pane */
  leftVargas: [VargaName, VargaName];
  chartStyle: ChartStyle;
  /** menu-105 command id selecting the Key Info table mode */
  basicsMode: number;
  /** Strengths > Other strengths mode index (CStrengthsView modes 0..10) */
  strengthsMode: number;
}

/** One entry of View > Navigate Backward/Forward (33104/33105): a selected view. */
export interface NavEntry { topTab: TopTab; sub: string | null }

export interface State {
  docs: ChartDoc[];
  activeDoc: string | null;
  /** global preferences (jhora.ini) */
  ini: JhoraIni;
  view: ViewState;
  /** visited views (JHora's DAT_00897dd4[100], cursor DAT_00591c48, last DAT_00591c4c) */
  nav: { stack: NavEntry[]; pos: number };
}

const STORAGE_KEY = 'jhora-web.state.v1';

function initial(): State {
  const base: State = {
    docs: [],
    activeDoc: null,
    ini: structuredClone(DEFAULTS),
    view: { topTab: 'Basics', subTab: {}, leftVargas: ['D1', 'D9'], chartStyle: 'south', basicsMode: 32822, strengthsMode: 0 },
    nav: { stack: [], pos: -1 },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      return { ...base, ...saved, ini: { ...base.ini, ...(saved.ini ?? {}) }, view: { ...base.view, ...(saved.view ?? {}) }, nav: base.nav };
    }
  } catch { /* no storage */ }
  return base;
}

let state: State = initial();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function getState() { return state; }
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  emit();
}
export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => select(state), () => select(state));
}

// -- actions -------------------------------------------------------------------
export function openChart(birth: BirthData, title: string, saved = true): ChartDoc {
  const doc: ChartDoc = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, birth, ini: {}, saved };
  setState((s) => ({ docs: [...s.docs, doc], activeDoc: doc.id }));
  return doc;
}
/** File > New (57600): a chart for now at the default location (src/core/newChart.ts). */
export function newChart(now: Date = new Date()): ChartDoc {
  return openChart(newChartBirth(state.ini, now), 'Untitled', false);
}
/** "Set Current Location as Default" (32934): the active chart's place becomes the ini default; returns the keys written. */
export function setCurrentLocationAsDefault(): Partial<JhoraIni> | null {
  const doc = state.docs.find((d) => d.id === state.activeDoc);
  if (!doc) return null;
  const patch = defaultLocationFromChart(doc.birth);
  setIni(patch);
  return patch;
}
export function updateChart(id: string, patch: Partial<ChartDoc>) {
  setState((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
}
export function closeChart(id: string) {
  setState((s) => {
    const docs = s.docs.filter((d) => d.id !== id);
    return { docs, activeDoc: s.activeDoc === id ? (docs[docs.length - 1]?.id ?? null) : s.activeDoc };
  });
}
export function setView(patch: Partial<ViewState>) {
  setState((s) => ({ view: { ...s.view, ...patch } }));
}
export function setTopTab(topTab: TopTab) {
  recordNav({ topTab, sub: currentSubTab(state.view, topTab) });
  setView({ topTab });
}
export function setSubTab(topTab: TopTab, sub: string) {
  recordNav({ topTab, sub });
  setState((s) => ({ view: { ...s.view, topTab, subTab: { ...s.view.subTab, [topTab]: sub } } }));
}

// -- View > Navigate Backward / Forward ----------------------------------------
// jhora.exe: selecting a view (FUN_004ed190, unless it is navigating: DAT_00897f68)
// first seeds the history with the current view when it is empty (cursor < 0), then
// FUN_004eb890 stores the new one at ++cursor (at most 100 entries; when full the oldest
// is dropped) and makes it the last entry, which discards the forward entries.
// Back (FUN_004e74c0): if cursor > 0, --cursor and select that view; Forward
// (FUN_004e7500): if cursor < last, ++cursor and select it.
const NAV_MAX = 100;
const sameView = (a: NavEntry, b: NavEntry) => a.topTab === b.topTab && a.sub === b.sub;

function recordNav(to: NavEntry) {
  const here: NavEntry = { topTab: state.view.topTab, sub: currentSubTab(state.view, state.view.topTab) };
  if (sameView(here, to)) return;
  let { stack, pos } = state.nav;
  if (pos < 0) { stack = [here]; pos = 0; }
  stack = [...stack.slice(0, pos + 1), to];
  if (stack.length > NAV_MAX) stack = stack.slice(stack.length - NAV_MAX);
  state = { ...state, nav: { stack, pos: stack.length - 1 } };
}

function goTo(e: NavEntry) {
  setState((s) => ({ view: { ...s.view, topTab: e.topTab, subTab: e.sub === null ? s.view.subTab : { ...s.view.subTab, [e.topTab]: e.sub } } }));
}
export const canNavigateBack = (s: State) => s.nav.pos > 0;
export const canNavigateForward = (s: State) => s.nav.pos >= 0 && s.nav.pos < s.nav.stack.length - 1;
/** View > Navigate Backward (33104, Alt+Left). */
export function navigateBack() {
  if (!canNavigateBack(state)) return;
  const pos = state.nav.pos - 1;
  state = { ...state, nav: { ...state.nav, pos } };
  goTo(state.nav.stack[pos]);
}
/** View > Navigate Forward (33105, Alt+Right). */
export function navigateForward() {
  if (!canNavigateForward(state)) return;
  const pos = state.nav.pos + 1;
  state = { ...state, nav: { ...state.nav, pos } };
  goTo(state.nav.stack[pos]);
}
export function currentSubTab(view: ViewState, topTab: TopTab): string | null {
  const subs = SUB_TABS[topTab];
  if (!subs) return null;
  return view.subTab[topTab] ?? subs[0];
}
export function setIni(patch: Partial<JhoraIni>) {
  setState((s) => ({ ini: { ...s.ini, ...patch } }));
}

// -- Edit > Chart notes (32988) ------------------------------------------------
// jhora.exe (FUN_004e6a70) keeps a chart's notes in a separate text file: the chart's
// path without ".jhd" (or ".dat") plus ".txt", created empty when missing and opened in
// Notepad; a chart that was never saved gets "You can enter notes only after saving the
// file. First save it." Here the notes live in their own browser storage, keyed by the
// chart's file name the same way (and can be saved as that .txt file).
const NOTES_KEY = 'jhora-web.notes.v1';
function readNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}') as Record<string, string>; } catch { return {}; }
}
/** The notes file name of a chart titled `title` ("<name>.txt"). */
export const notesFileName = (title: string) => `${title.replace(/\.(jhd|dat)$/i, '')}.txt`;
export function getChartNotes(title: string): string {
  return readNotes()[notesFileName(title)] ?? '';
}
export function setChartNotes(title: string, text: string) {
  const all = readNotes();
  if (text) all[notesFileName(title)] = text; else delete all[notesFileName(title)];
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

export const useActiveDoc = () => useStore((s) => s.docs.find((d) => d.id === s.activeDoc) ?? null);
export { TOP_TABS };
