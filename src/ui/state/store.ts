// Application state: open charts (JHora's MDI documents), preferences and view state.
import { useSyncExternalStore } from 'react';
import type { BirthData } from '../../core/jhd';
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
}

/** Derived chart kinds: one per form tab that replaces the natal chart (extend additively). */
export type DerivedKind = 'tajaka' | 'tithiPravesha' | 'angularReturn' | 'prasna' | 'progression' | 'mundane';

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

export interface State {
  docs: ChartDoc[];
  activeDoc: string | null;
  /** global preferences (jhora.ini) */
  ini: JhoraIni;
  view: ViewState;
}

const STORAGE_KEY = 'jhora-web.state.v1';

function initial(): State {
  const base: State = {
    docs: [],
    activeDoc: null,
    ini: structuredClone(DEFAULTS),
    view: { topTab: 'Basics', subTab: {}, leftVargas: ['D1', 'D9'], chartStyle: 'south', basicsMode: 32822, strengthsMode: 0 },
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      return { ...base, ...saved, ini: { ...base.ini, ...(saved.ini ?? {}) }, view: { ...base.view, ...(saved.view ?? {}) } };
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
export function openChart(birth: BirthData, title: string): ChartDoc {
  const doc: ChartDoc = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, title, birth, ini: {} };
  setState((s) => ({ docs: [...s.docs, doc], activeDoc: doc.id }));
  return doc;
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
export function setTopTab(topTab: TopTab) { setView({ topTab }); }
export function setSubTab(topTab: TopTab, sub: string) {
  setState((s) => ({ view: { ...s.view, topTab, subTab: { ...s.view.subTab, [topTab]: sub } } }));
}
export function currentSubTab(view: ViewState, topTab: TopTab): string | null {
  const subs = SUB_TABS[topTab];
  if (!subs) return null;
  return view.subTab[topTab] ?? subs[0];
}
export function setIni(patch: Partial<JhoraIni>) {
  setState((s) => ({ ini: { ...s.ini, ...patch } }));
}
export const useActiveDoc = () => useStore((s) => s.docs.find((d) => d.id === s.activeDoc) ?? null);
export { TOP_TABS };
