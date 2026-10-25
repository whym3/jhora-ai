// Chakras > Many Vargas: JHora's CChartView filling the window (the same view as the chart pane).
//
// jhora.exe: the tab switch (0x4eb050) sets the number of charts DAT_00579a6c to 12 on the
// "Many Vargas" tab and 6 elsewhere when packed chart mode is on (DAT_008a4bd2: ini
// MoreChartsOnBigDisplay, DAT_00592359, and a screen wider than 1280 px, FUN_004dbc50), else
// 6 and 2; command 33287 (0x43efd0) toggles MoreChartsOnBigDisplay and asks for a restart.
// Slot i draws varga DAT_00579a30[i] = DisplayVarga[i] (default D-1, D-9, D-30, D-3, D-10, D-60,
// D-7, D-12, D-20, D-24, D-16, D-2). Layout (FUN_004318f0): side s = min(0.2411 W, 0.32 H) for 12
// charts in 4 columns x 3 rows, touching; 6 charts: min(0.4737 W, 0.48 H), 3 columns x 2 rows
// with the margin between them; margin round(s/36). Every chart is drawn by FUN_00432360 in
// the slot's style with the slot's body view (ChartDiagram, core/chartBodies.ts).
import { useMemo, useState } from 'react';
import type { ChartResult, ChartSpec } from '../../engine/protocol';
import type { VargaName } from '../../core/vargas';
import { VARGA_INDEX } from '../../core/vargaOptions';
import type { JhoraIni } from '../../settings/generated';
import { DEFAULTS } from '../../settings/generated';
import { captionBand, ChartFigure } from '../ChartDiagram';
import {
  DEFAULT_SLOT, NATAL_CHART_NAME, OptionalBodies, SlotBar, StyleSelect, slotChart, useSlotMenu, useSlotSources, type SlotSettings,
} from '../shell/ChartPane';
import { setIni, useStore } from '../state/store';
import type { ChakraViewProps } from './common';

const S = 360, M = 10;

export interface ManyVargasProps extends ChakraViewProps {
  /** the chart spec on screen (for the right-click commands that run in the worker and "Natal chart only") */
  spec?: ChartSpec | null;
}

type Pick = (natalOnly: boolean) => { chart: ChartResult | ChakraViewProps['chart'] | null; name: string };

/** Number of charts and columns (packed: 12 in 4 x 3, else 6 in 3 x 2). */
export function manyVargasLayout(ini: Partial<JhoraIni>) {
  const packed = (ini.MoreChartsOnBigDisplay ?? DEFAULTS.MoreChartsOnBigDisplay) !== 0;
  return packed ? { count: 12, cols: 4, gap: 0 } : { count: 6, cols: 3, gap: M };
}

function Grid({ pick, hasDerived, ini, spec }: { pick: Pick; hasDerived: boolean; ini: Partial<JhoraIni>; spec: ChartSpec | null }) {
  const prefs = useStore((s) => s.ini);
  const style = useStore((s) => s.view.chartStyle);
  const { count, cols, gap } = manyVargasLayout(prefs);
  const display = prefs.DisplayVarga ?? DEFAULTS.DisplayVarga;
  const vargas = useMemo(() => Array.from({ length: count }, (_, i) => VARGA_INDEX[display[i] ?? 0] ?? 'D1'), [count, display]);
  const [settings, setSettings] = useState<SlotSettings[]>(() => Array.from({ length: 12 }, () => DEFAULT_SLOT));
  const [selected, setSelected] = useState(0);
  const slots = useMemo(() => vargas.map((v, i) => {
    const src = pick(settings[i].natalOnly);
    return src.chart ? slotChart(src.chart, ini, v, settings[i].view, src.name) : null;
  }), [vargas, settings, pick, ini]);
  const { onMenu, marks, overlay, note } = useSlotMenu(slots, spec);
  const rowH = S + captionBand(style), rows = Math.ceil(count / cols);
  const W = 2 * M + cols * S + (cols - 1) * gap, H = 2 * M + rows * rowH + (rows - 1) * gap;
  const sel = Math.min(selected, count - 1);
  const setVarga = (i: number, v: VargaName) => {
    const next = [...display];
    next[i] = VARGA_INDEX.indexOf(v);
    setIni({ DisplayVarga: next });
  };
  return (
    <div className="many-vargas-view">
      {overlay}
      <div className="slot-bar">
        <strong>Chart {sel + 1}</strong>
        <SlotBar label={`Chart ${sel + 1}`} slot={slots[sel]} settings={settings[sel]} style={style} hasDerived={hasDerived}
          onSettings={(s) => setSettings((x) => x.map((y, j) => (j === sel ? s : y)))}
          varga={vargas[sel]} onVarga={(v) => setVarga(sel, v)} />
        <StyleSelect />
        <OptionalBodies />
        <label title="Packed chart mode (more charts): MoreChartsOnBigDisplay">
          <input type="checkbox" checked={count === 12} onChange={(e) => setIni({ MoreChartsOnBigDisplay: e.target.checked ? 1 : 0 })} /> Packed chart mode
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="many-vargas" role="img" aria-label="Many Vargas">
        {slots.map((c, i) => c && (
          <ChartFigure key={i} x={M + (i % cols) * (S + gap)} y={M + Math.floor(i / cols) * (rowH + gap)} size={S}
            style={style} signs={c.signs} lagnaSign={c.lagna} caption={c.caption}
            highlights={marks[i]?.signs} bodyClasses={marks[i]?.bodyClasses}
            onMenu={(e, sign, body) => { setSelected(i); onMenu(i)(e, sign, body); }}
            onSelect={() => setSelected(i)} />
        ))}
        {/* the selected slot (JHora: the last chart clicked, view+0x8ad0), drawn above its neighbours */}
        <rect x={M + (sel % cols) * (S + gap) - 2} y={M + Math.floor(sel / cols) * (rowH + gap) - 2} width={S + 4} height={rowH + 4} className="cb-selbox" />
      </svg>
      {slots.map((_, i) => note(i) && <div key={i}><strong>Chart {i + 1}</strong>{note(i)}</div>)}
    </div>
  );
}

function WithSources({ chart, spec }: { chart: ChartResult; spec: ChartSpec }) {
  const { ini, pick, hasDerived } = useSlotSources(chart, spec);
  return <Grid pick={pick} hasDerived={hasDerived} ini={ini} spec={spec} />;
}

export function ManyVargasView({ chart, spec }: ManyVargasProps) {
  const pick = useMemo<Pick>(() => () => ({ chart, name: NATAL_CHART_NAME }), [chart]);
  if (spec) return <WithSources chart={chart as ChartResult} spec={spec} />;
  return <Grid pick={pick} hasDerived={false} ini={chart.ini ?? {}} spec={null} />;
}
