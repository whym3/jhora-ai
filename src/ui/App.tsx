import { useEffect, useMemo } from 'react';
import { parseJhd, writeJhd, type BirthData } from '../core/jhd';
import type { ChartSpec } from '../engine/protocol';
import { EngineProvider, useEngine, useJob } from './EngineProvider';
import { BirthForm } from './BirthForm';
import type { ChartStyle } from './ChartDiagram';
import { ChartPane } from './shell/ChartPane';
import { KeyInfoView, TableSubView } from './shell/BasicsView';
import { NotPorted } from './shell/NotPorted';
import { SUB_TABS, TOP_TABS, type TopTab } from './shell/tabs';
import { closeChart, currentSubTab, openChart, setSubTab, setTopTab, setView, updateChart, useActiveDoc, useStore } from './state/store';
import { TabBar } from './widgets/TabBar';

const SAMPLES = ['Swami Vivekananda', 'Mahatma Gandhi', 'India', 'Ramana Maharshi', 'Prof. B. V. Raman', 'Author of this software'];

async function loadSample(name: string) {
  const t = await (await fetch(`${import.meta.env.BASE_URL}samples/${name}.jhd`)).text();
  const b = parseJhd(t);
  openChart(b, name);
}

function Toolbar() {
  const doc = useActiveDoc();
  const style = useStore((s) => s.view.chartStyle);
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
      <label className="file">Open .jhd<input type="file" accept=".jhd" onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} /></label>
      <button onClick={save} disabled={!doc}>Save .jhd</button>
      <select aria-label="Chart style" value={style} onChange={(e) => setView({ chartStyle: e.target.value as ChartStyle })}>
        <option value="south">South Indian</option>
        <option value="north">North Indian</option>
      </select>
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

const FIXED_TABLES: Record<string, string> = { 'Basics/Houses': 'basics.houses', 'Basics/KP': 'basics.kp' };

function SubView({ top, sub, spec }: { top: TopTab; sub: string | null; spec: ChartSpec }) {
  if (top === 'Basics' && sub === 'Key Info') return <KeyInfoView spec={spec} />;
  const table = FIXED_TABLES[`${top}/${sub}`];
  if (table) return <TableSubView spec={spec} table={table} />;
  return <NotPorted name={sub ? `${top} / ${sub}` : top} />;
}

function Workspace() {
  const doc = useActiveDoc();
  const ini = useStore((s) => s.ini);
  const view = useStore((s) => s.view);
  const { ready, error } = useEngine();
  const spec = useMemo<ChartSpec | null>(() => (doc ? { birth: doc.birth, ini: { ...diffIni(ini), ...doc.ini } } : null), [doc, ini]);
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
      <TabBar level="top" tabs={TOP_TABS} active={view.topTab} onSelect={(t) => setTopTab(t as TopTab)} />
      <div className="workspace">
        <ChartPane chart={chart.data} />
        <div className="right-pane">
          {SUB_TABS[view.topTab] && (
            <TabBar level="sub" tabs={SUB_TABS[view.topTab]!} active={sub!} onSelect={(s) => setSubTab(view.topTab, s)} />
          )}
          {spec && <SubView top={view.topTab} sub={sub} spec={spec} />}
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
