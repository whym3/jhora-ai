import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { parseJhd, writeJhd, type BirthData } from '../core/jhd';
import type { ChartResult, ChartSpec } from '../engine/protocol';
import { EngineProvider, useEngine, useJob } from './EngineProvider';
import { BirthForm } from './BirthForm';
import type { ChartStyle } from './ChartDiagram';
import { ChartPane } from './shell/ChartPane';
import { Preferences } from './Preferences';
import { MatchingView } from './shell/MatchingView';
import { TajakaView } from './shell/TajakaView';
import { DERIVED_VIEWS, type DerivedViewKey } from './shell/derivedViews';
import { TRANSIT_VIEWS } from './shell/TransitsView';
import { CHAKRA_VIEWS, type ChakraSubTab } from './chakras';
import { AshtakavargaView, HousesView, KeyInfoView, KpView, OtherStrengthsView, TableSubView } from './shell/BasicsView';
import { NakshatraDasasView, OtherDasasView, RasiDasasView } from './shell/DasasView';
import { NotPorted } from './shell/NotPorted';
import { BarGraphsView } from './shell/BarGraphsView';
import { SUB_TABS, TOP_TABS, type TopTab } from './shell/tabs';
import { closeChart, currentSubTab, openChart, setSubTab, setTopTab, setView, updateChart, useActiveDoc, useStore } from './state/store';
import { TabBar } from './widgets/TabBar';

// the AI panel (and its provider SDKs) loads on first use
const AiPanel = lazy(() => import('./AiPanel').then((m) => ({ default: m.AiPanel })));

const SAMPLES = ['Swami Vivekananda', 'Mahatma Gandhi', 'India', 'Ramana Maharshi', 'Prof. B. V. Raman', 'Author of this software'];

async function loadSample(name: string) {
  const t = await (await fetch(`${import.meta.env.BASE_URL}samples/${name}.jhd`)).text();
  const b = parseJhd(t);
  openChart(b, name);
}

import { newChart, setCurrentLocationAsDefault } from './state/store';
import { defaultLocationMessage } from '../core/newChart';
import { AyanamsaDialog } from './AyanamsaDialog';

function Toolbar() {
  const doc = useActiveDoc();
  const style = useStore((s) => s.view.chartStyle);
  const [prefs, setPrefs] = useState(false);
  // Preferences > Ayanamsa (32993, dialog 155)
  const [ayanamsa, setAyanamsa] = useState(false);
  // "Set Current Location as Default" (32934): JHora confirms with a message box
  const setDefaultLocation = () => {
    const patch = setCurrentLocationAsDefault();
    if (patch) window.alert(defaultLocationMessage(patch));
  };
  // toolbar button 33320 (FUN_004e8db0): matching against a nakshatra/pada or another open chart
  const [matching, setMatching] = useState(false);
  const [ai, setAi] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const ini = useStore((s) => s.ini);
  // the AI reads the chart on screen: a derived chart (Tajaka etc.) when one is shown
  const aiSpec = useMemo<ChartSpec | null>(() => (doc ? { birth: doc.derived?.birth ?? doc.birth, ini: { ...diffIni(ini), ...doc.ini } } : null), [doc, ini]);
  const aiTitle = doc ? (doc.derived ? `${doc.title} - ${doc.derived.label}` : doc.title) : '';
  const openFile = async (f: File) => openChart(parseJhd(await f.text()), f.name.replace(/\.jhd$/i, ''));
  const save = () => {
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([writeJhd(doc.birth)], { type: 'text/plain' }));
    Object.assign(document.createElement('a'), { href: url, download: `${doc.title}.jhd` }).click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="toolbar">
      <select aria-label="Sample charts" value="" onChange={(e) => e.target.value && loadSample(e.target.value)}>
        <option value="">Open sample…</option>
        {SAMPLES.map((s) => <option key={s}>{s}</option>)}
      </select>
      <button onClick={() => newChart()} title="File > New: now, at the default location">New chart</button>
      <label className="file">Open .jhd<input type="file" accept=".jhd" onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} /></label>
      <button onClick={save} disabled={!doc}>Save .jhd</button>
      <select aria-label="Chart style" value={style} onChange={(e) => setView({ chartStyle: e.target.value as ChartStyle })}>
        <option value="south">South Indian</option>
        <option value="north">North Indian</option>
      </select>
      <button onClick={() => setMatching(true)} disabled={!doc}>Horoscope Matching</button>
      <button onClick={setDefaultLocation} disabled={!doc}>Set location as default</button>
      <button onClick={() => setAyanamsa(true)}>Ayanamsa…</button>
      <button onClick={() => setPrefs(true)}>Preferences…</button>
      <button onClick={() => { setAi((v) => !v); setAiUsed(true); }} className={ai ? 'active' : undefined}>AI Astrologer</button>
      {aiUsed && <Suspense fallback={null}><AiPanel open={ai} onClose={() => setAi(false)} spec={aiSpec} title={aiTitle} /></Suspense>}
      {prefs && <Preferences onClose={() => setPrefs(false)} />}
      {ayanamsa && <AyanamsaDialog onClose={() => setAyanamsa(false)} />}
      {matching && doc && (
        <div className="modal-backdrop" onClick={() => setMatching(false)}>
          <div className="modal" role="dialog" aria-label="Horoscope Matching" onClick={(e) => e.stopPropagation()}>
            <div className="note-bar"><strong>Horoscope Matching for Marriage</strong><button onClick={() => setMatching(false)}>Close</button></div>
            <MatchingView spec={{ birth: doc.birth, ini: { ...diffIni(ini), ...doc.ini } }} />
          </div>
        </div>
      )}
    </div>
  );
}

function DocTabs() {
  const docs = useStore((s) => s.docs);
  const active = useStore((s) => s.activeDoc);
  if (!docs.length) return null;
  return (
    <div className="doctabs">
      {docs.map((d) => (
        <span key={d.id} className={d.id === active ? 'doctab active' : 'doctab'}>
          <button onClick={() => useStoreSet({ activeDoc: d.id })}>{d.title}</button>
          <button className="close" aria-label={`Close ${d.title}`} onClick={() => closeChart(d.id)}>×</button>
        </span>
      ))}
    </div>
  );
}
import { setState as useStoreSet } from './state/store';

const FIXED_TABLES: Record<string, string> = { 'Basics/Houses': 'basics.houses', 'Basics/Amsa rulers': 'basics.amsaRulers', 'Basics/KP': 'basics.kp' };

function SubView({ top, sub, spec, natalSpec, docId, chart }: { top: TopTab; sub: string | null; spec: ChartSpec; natalSpec: ChartSpec; docId: string; chart: ChartResult | null }) {
  if (top === 'Chakras' && sub && sub in CHAKRA_VIEWS) {
    const View = CHAKRA_VIEWS[sub as ChakraSubTab];
    return chart ? <div className="subview chakra-view"><View chart={chart} spec={spec} /></div> : <p className="status">Calculating…</p>;
  }
  if (top === 'Tajaka') return <TajakaView natalSpec={natalSpec} docId={docId} />;
  if (top === 'Transits' && sub && sub in TRANSIT_VIEWS) {
    const View = TRANSIT_VIEWS[sub as keyof typeof TRANSIT_VIEWS];
    return <View spec={natalSpec} />;
  }
  const derivedKey = (sub ? `${top}/${sub}` : top) as DerivedViewKey;
  if (derivedKey in DERIVED_VIEWS) {
    const View = DERIVED_VIEWS[derivedKey];
    return <View natalSpec={natalSpec} docId={docId} spec={spec} />;
  }
  if (top === 'Basics' && sub === 'Key Info') return <KeyInfoView spec={spec} />;
  if (top === 'Basics' && sub === 'Houses') return <HousesView spec={spec} />;
  if (top === 'Basics' && sub === 'KP') return <KpView spec={spec} />;
  if (top === 'Strengths' && sub === 'Ashtakavarga') return <AshtakavargaView spec={spec} />;
  if (top === 'Strengths' && sub === 'Other strengths') return <OtherStrengthsView spec={spec} />;
  if (top === 'Strengths' && sub === 'Bar graphs') return <BarGraphsView spec={spec} />;
  if (top === 'Dasas' && sub === 'Nakshatra dasas') return <NakshatraDasasView spec={spec} />;
  if (top === 'Dasas' && sub === 'Rasi dasas') return <RasiDasasView spec={spec} />;
  if (top === 'Dasas' && sub === 'Other dasas') return <OtherDasasView spec={spec} />;
  const table = FIXED_TABLES[`${top}/${sub}`];
  if (table) return <TableSubView spec={spec} table={table} />;
  return <NotPorted name={sub ? `${top} / ${sub}` : top} />;
}

function Workspace() {
  const doc = useActiveDoc();
  const ini = useStore((s) => s.ini);
  const view = useStore((s) => s.view);
  const { ready, error } = useEngine();
  const natalSpec = useMemo<ChartSpec | null>(() => (doc ? { birth: doc.birth, ini: { ...diffIni(ini), ...doc.ini } } : null), [doc, ini]);
  // a derived chart (Tajaka etc.) replaces the natal one in every view, as in JHora
  const spec = useMemo<ChartSpec | null>(() => (natalSpec && doc?.derived ? { ...natalSpec, birth: doc.derived.birth } : natalSpec), [natalSpec, doc?.derived]);
  const chart = useJob(spec ? { kind: 'chart' as const, chart: spec } : null);
  const sub = currentSubTab(view, view.topTab);

  if (error) return <p className="error">{error}</p>;
  if (!doc) return <p className="status">{ready ? 'Open a chart to begin.' : 'Loading ephemeris…'}</p>;
  return (
    <>
      <details className="panel birth" open={!chart.data}>
        <summary>Birth data — {doc.title}, {doc.birth.year}-{doc.birth.month}-{doc.birth.day} {doc.birth.city}</summary>
        <BirthForm key={doc.id + JSON.stringify(doc.birth)} initial={doc.birth} onSubmit={(b: BirthData) => updateChart(doc.id, { birth: b })} />
      </details>
      {doc.derived && (
        <div className="derived-bar">
          <span>Showing the {doc.derived.label} chart ({doc.derived.birth.year}-{doc.derived.birth.month}-{doc.derived.birth.day})</span>
          <button onClick={() => updateChart(doc.id, { derived: null })}>Back to Natal Chart</button>
        </div>
      )}
      <TabBar level="top" tabs={TOP_TABS} active={view.topTab} onSelect={(t) => setTopTab(t as TopTab)} />
      <div className="workspace">
        <ChartPane chart={chart.data} spec={spec} />
        <div className="right-pane">
          {SUB_TABS[view.topTab] && (
            <TabBar level="sub" tabs={SUB_TABS[view.topTab]!} active={sub!} onSelect={(s) => setSubTab(view.topTab, s)} />
          )}
          {spec && natalSpec && <SubView top={view.topTab} sub={sub} spec={spec} natalSpec={natalSpec} docId={doc.id} chart={chart.data} />}
        </div>
      </div>
    </>
  );
}

import { DEFAULTS, type JhoraIni } from '../settings/generated';
/** Only the keys that differ from JHora's defaults, so cache keys stay small. */
function diffIni(ini: JhoraIni): Partial<JhoraIni> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(ini) as (keyof JhoraIni)[]) {
    if (JSON.stringify(ini[k]) !== JSON.stringify(DEFAULTS[k])) out[k] = ini[k];
  }
  return out as Partial<JhoraIni>;
}

export function App() {
  const docs = useStore((s) => s.docs);
  useEffect(() => { if (!docs.length) loadSample(SAMPLES[0]); }, [docs.length]);
  return (
    <EngineProvider>
      <div className="app">
        <header>
          <h1>Jagannatha Hora <span>web</span></h1>
          <Toolbar />
        </header>
        <DocTabs />
        <Workspace />
      </div>
    </EngineProvider>
  );
}
