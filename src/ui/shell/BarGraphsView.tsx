// Strengths > Bar graphs (CStrengthGraphView): one small bar graph per strength quantity,
// on JHora's fixed scales (src/core/strengthGraphs.ts), with the numbers as a table below.
import { useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { BAR_GRAPH_SETS, type BarGraph } from '../../core/strengthGraphs';
import { ALL_VARGAS } from '../../core/vargas';

const W = 300, H = 170, L = 34, R = 8, T = 8, B = 30;

function Graph({ g }: { g: BarGraph }) {
  const lo = g.negative ? -g.max : 0;
  const y = (v: number) => T + ((g.max - Math.max(lo, Math.min(g.max, v))) / (g.max - lo)) * (H - T - B);
  const step = (W - L - R) / g.labels.length;
  const bw = Math.max(4, Math.min(18, step - 6));
  const fmt = (v: number) => (g.integer ? String(v) : v.toFixed(2));
  const ticks = g.negative ? [lo, 0, g.max] : [0, g.max / 2, g.max];
  return (
    <figure className="bar-graph">
      <figcaption>{g.title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={g.title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 ? 'bg-axis' : 'bg-grid'} />
            <text x={L - 4} y={y(t) + 3} textAnchor="end" className="bg-tick">{t}</text>
          </g>
        ))}
        {g.labels.map((label, i) => {
          const v = g.values[i];
          const x = L + i * step + (step - bw) / 2;
          const top = y(Math.max(v, 0)), bottom = y(Math.min(v, 0));
          return (
            <g key={label} className="bg-bar">
              <rect x={L + i * step} y={T} width={step} height={H - T - B} className="bg-hit"><title>{`${label}: ${fmt(v)}`}</title></rect>
              <rect x={x} y={top} width={bw} height={Math.max(0, bottom - top)} rx={Math.min(4, bw / 2)} className="bg-fill" pointerEvents="none" />
              <text x={L + i * step + step / 2} y={H - B + 13} textAnchor="middle" className="bg-label">{label.slice(0, 3)}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export function BarGraphsView({ spec }: { spec: ChartSpec }) {
  const [set, setSet] = useState(0);
  const [varga, setVarga] = useState('D1');
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'strengths.barGraphs', params: { set, varga } });
  const graphs: BarGraph[] = job.data?.text?.[0] ? JSON.parse(job.data.text[0]) : [];
  return (
    <div className="subview">
      <div className="subview-bar">
        <select aria-label="Graphs" value={set} onChange={(e) => setSet(Number(e.target.value))}>
          {BAR_GRAPH_SETS.map((s, i) => <option key={s} value={i}>{s}</option>)}
        </select>
        {(set === 0 || set === 1) && (
          <label>Ashtakavarga chart
            <select value={varga} onChange={(e) => setVarga(e.target.value)}>
              {Object.keys(ALL_VARGAS).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="bar-graphs">{graphs.map((g) => <Graph key={g.title} g={g} />)}</div>
      <TableView job={job} />
    </div>
  );
}
