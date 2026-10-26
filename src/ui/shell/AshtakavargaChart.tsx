// JHora's drawn ashtakavarga (CAshtakaVargaView OnDraw 0x422820, see src/core/ashtakavargaChart.ts):
// the BAV/SoAV boxes, the PAV box, the sodhya pinda and nakshatra tables, in JHora's pixel layout.
import { useMemo } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { VargaName } from '../../core/vargas';
import { avDrawing, type AvChartData, type AvDrawing, type AvText } from '../../core/ashtakavargaChart';
import { useJob } from '../EngineProvider';
import { useStore } from '../state/store';
import './ashtakavarga.css';

/** JHora's chart font is 18 px high (0x8a17e8); its em is about 15 px. */
const EM = 15;

function AvLabel({ t }: { t: AvText }) {
  const size = EM * t.scale;
  const cls = `av-${t.role}${t.bold ? ' av-bold' : ''}${t.narrow ? ' av-narrow' : ''}`;
  const lines = t.text.split('\n');
  if (t.align === 'center') {
    return <text x={t.x + t.w / 2} y={t.y + t.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={size} className={cls}>{t.text}</text>;
  }
  // DT_TOP | DT_LEFT: the first baseline one ascent below the rect's top, lines 1.2 em apart
  return (
    <text x={t.x} y={t.y + size * 0.95} fontSize={size} className={cls}>
      {lines.length === 1 ? t.text : lines.map((l, i) => <tspan key={i} x={t.x} dy={i ? size * 1.2 : 0}>{l}</tspan>)}
    </text>
  );
}

/** One drawing as SVG (viewBox in JHora pixels). */
export function AvChartSvg({ drawing, title }: { drawing: AvDrawing; title: string }) {
  return (
    <svg viewBox={`0 0 ${drawing.width} ${drawing.height}`} className="av-chart" role="img" aria-label={title} style={{ maxWidth: drawing.width }}>
      {drawing.rects.map((r, i) => <rect key={`r${i}`} x={r.x} y={r.y} width={r.w} height={r.h} className={`av-${r.role}`} />)}
      {drawing.lines.map((l, i) => <line key={`l${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="av-grid" />)}
      {drawing.texts.map((t, i) => <AvLabel key={`t${i}`} t={t} />)}
    </svg>
  );
}

export interface AshtakavargaChartProps {
  /** the chart (natal or derived) the AV is computed from */
  spec: ChartSpec;
  varga: VargaName;
  /** one of AV_MODES (src/ui/shell/tabs.ts) */
  mode: string;
  /** chart+0x1698: "Natal Chart" or the derived chart's name */
  chartName: string;
  /** 32973: signs the lagna is moved on */
  lagnaShift?: number;
  /** 32839 "Highlight the rasi containing planet" (default on) */
  highlight?: boolean;
  /** 32841 "Highlight rasis occupied in this divisional chart" (default the varga) */
  highlightVarga?: VargaName;
}

/** The Ashtakavarga view as JHora draws it, for a chart spec (worker job strengths.ashtakavargaChart). */
export function AshtakavargaChart({ spec, varga, mode, chartName, lagnaShift = 0, highlight = true, highlightVarga }: AshtakavargaChartProps) {
  const style = useStore((s) => s.view.chartStyle);
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'strengths.ashtakavargaChart', params: { varga, highlightVarga: highlightVarga ?? varga, lagnaShift } });
  const data = useMemo(() => (job.data?.text?.[0] ? (JSON.parse(job.data.text[0]) as AvChartData) : null), [job.data]);
  const drawing = useMemo(() => (data ? avDrawing(data, mode, { chartName, highlight, mirrored: style === 'southMirror' }) : null), [data, mode, chartName, highlight, style]);
  if (job.status === 'error') return <p className="error">{job.error}</p>;
  if (!drawing) return <p className="status">Calculating…</p>;
  return <AvChartSvg drawing={drawing} title={`Ashtakavarga: ${mode}`} />;
}
