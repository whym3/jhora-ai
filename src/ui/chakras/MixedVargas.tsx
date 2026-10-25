// Mixed 2-Vargas drawing (CMixedChartView, South Indian style FUN_0045d1e0):
// one 4x4 South Indian frame; the band outside the inner separator square
// (inset half a cell) carries the outer varga's bodies, the half of every sign
// box facing the centre carries the inner varga's. Centre: "Outer: ..." and
// "Inner: ..." captions with the varga names. Like JHora, no sign names.
//
// Charts (DAT_0065b8d4 / DAT_0065b8d8): the inner one is the natal chart (doc+0x50), the outer
// one the chart on screen (doc+0x76d00): with a derived chart shown (Tajaka, TP, progression,
// transit, ...) that chart is drawn outside, D-1 in both halves (OnInitialUpdate 0x45c6a0: outer
// varga D-9 only for a plain natal chart; the derived-chart setups 0x422040 / 0x470fd0 and the
// "Mixed ... Chart" buttons, handler 0x4853e0, do the same), captioned "Outer: <chart name>".
import { useMemo, useState } from 'react';
import type { ChakraChart } from '../../core/chakras/common';
import { useJob } from '../EngineProvider';
import { useActiveDoc } from '../state/store';
import type { ChartSpec } from '../../engine/protocol';
import type { ChakraBody } from '../../core/chakras/common';
import { mixedSlots, mixedVargas } from '../../core/chakras/mixedVargas';
import { bodyClass, ChakraSvg, OptionBar, VARGA_OPTIONS, type ChakraViewProps } from './common';
import './mixed.css';

const SIZE = 480, CELL = SIZE / 4, Q = CELL / 4;
// South Indian cell (col, row) per sign, Aries first (Pisces top-left)
const CELLS: [number, number][] = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]];
// quarter-cell offsets of the two half-size sub-boxes (FUN_0045d1e0 tables)
const INNER_X = [1, 1, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2], INNER_Y = [2, 2, 2, 1, 1, 0, 0, 0, 0, 1, 1, 2];
const OUTER_X = [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0], OUTER_Y = [0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0];

/** JHora's colour groups: special lagnas, upagrahas, AL, the other arudhas (the rest use bodyClass). */
const kindClass = (i: number) =>
  i >= 13 && i <= 20 ? ' mixed-special' : i >= 21 && i <= 32 ? ' mixed-upagraha' : i === 59 ? ' mixed-al' : i > 59 ? ' mixed-arudha' : '';

/** One sub-box's bodies at JHora's slots (mixedSlots), text top-left 2 px in. */
function SubBox({ bodies, x, y }: { bodies: ChakraBody[]; x: number; y: number }) {
  const slots = mixedSlots(bodies);
  return (
    <>
      {bodies.map((b, i) => (
        <text key={`${b.transit ? 't' : 'n'}${b.index}-${b.label}-${i}`} x={x + slots[i][0] * CELL + 2} y={y + slots[i][1] * CELL + 11} className={bodyClass(b) + kindClass(b.index)}>
          {b.retrograde ? `(${b.label})` : b.label}
        </text>
      ))}
    </>
  );
}

export interface MixedVargasViewProps extends ChakraViewProps {
  /** JHora varga index of the inner chart (default 0 = D-1) */
  inner?: number;
  /** JHora varga index of the outer chart (default 1 = D-9; 0 when `transit` is drawn outside) */
  outer?: number;
  /** draw the transit chart in the outer half (JHora's behaviour when a transit chart is displayed) */
  showTransit?: boolean;
  /** the outer chart's name (chart+0x1698: "Tajaka annual", "Transit", ...) for "Outer: %s" */
  outerName?: string;
}

export function MixedVargasView(props: MixedVargasViewProps) {
  // Chakras > Mixed 2-Vargas with a derived chart on screen: natal inside, that chart outside
  const doc = useActiveDoc();
  const derived = !props.showTransit && props.spec && doc?.derived ? doc.derived : null;
  if (!derived || !props.spec || !doc) return <MixedVargasChart {...props} />;
  return <WithNatal {...props} natalSpec={{ ...props.spec, birth: doc.birth }} outerName={derived.label} />;
}

function WithNatal(props: MixedVargasViewProps & { natalSpec: ChartSpec; outerName: string }) {
  const natal = useJob({ kind: 'chart' as const, chart: props.natalSpec });
  if (!natal.data) return <p className="status">Calculating…</p>;
  return <MixedVargasChart {...props} chart={natal.data as ChakraChart} transit={props.chart} showTransit />;
}

function MixedVargasChart({ chart, transit, inner: inner0, outer: outer0, showTransit = false, outerName }: MixedVargasViewProps) {
  // the two vargas: DAT_00579a60 / DAT_00579a64 (DisplayVarga[12], [13]), chosen from the chart menu
  const [inner, setInner] = useState(inner0);
  const [outer, setOuter] = useState(outer0);
  const data = useMemo(
    () => mixedVargas(chart, { inner, outer, outerChart: showTransit ? transit : null, outerName: showTransit ? outerName : undefined }),
    [chart, transit, inner, outer, showTransit, outerName],
  );
  const half = CELL / 2;
  return (
    <div>
    <OptionBar fields={[
      { label: 'Inner', value: data.innerVarga, options: VARGA_OPTIONS, onChange: (v) => setInner(v as number) },
      { label: 'Outer', value: data.outerVarga, options: VARGA_OPTIONS, onChange: (v) => setOuter(v as number) },
    ]} />
    <ChakraSvg w={SIZE} h={SIZE} title={`Mixed chart: ${data.innerCaption[1]} inside, ${data.outerCaption[1]} outside`}>
      <rect x={0} y={0} width={SIZE} height={SIZE} className="mixed-band" />
      <rect x={half} y={half} width={SIZE - CELL} height={SIZE - CELL} className="mixed-innerbg" />
      {CELLS.map(([c, r], s) => <rect key={s} x={c * CELL} y={r * CELL} width={CELL} height={CELL} className="mixed-grid" />)}
      <rect x={CELL} y={CELL} width={2 * CELL} height={2 * CELL} className="mixed-grid" />
      <rect x={half} y={half} width={SIZE - CELL} height={SIZE - CELL} className="mixed-sep" />
      {data.signs.map((sg) => {
        const [c, r] = CELLS[sg.sign];
        const x0 = c * CELL, y0 = r * CELL;
        return (
          <g key={sg.sign} className="mixed-small">
            {sg.sign === data.lagnaSign && <line x1={x0} y1={y0 + 12} x2={x0 + 12} y2={y0} className="lagna-mark" />}
            <SubBox bodies={sg.inner} x={x0 + INNER_X[sg.sign] * Q} y={y0 + INNER_Y[sg.sign] * Q} />
            <SubBox bodies={sg.outer} x={x0 + OUTER_X[sg.sign] * Q} y={y0 + OUTER_Y[sg.sign] * Q} />
          </g>
        );
      })}
      {/* JHora centres each caption line in a CELL/4-high box from the top and from the middle of the centre square */}
      <text x={SIZE / 2} y={(CELL * 9) / 8 + 4} textAnchor="middle" className="mixed-caption">{data.outerCaption[0]}</text>
      <text x={SIZE / 2} y={(CELL * 11) / 8 + 6} textAnchor="middle" className="mixed-varga">{data.outerCaption[1]}</text>
      <text x={SIZE / 2} y={(CELL * 17) / 8 + 4} textAnchor="middle" className="mixed-caption">{data.innerCaption[0]}</text>
      <text x={SIZE / 2} y={(CELL * 19) / 8 + 6} textAnchor="middle" className="mixed-varga">{data.innerCaption[1]}</text>
    </ChakraSvg>
    </div>
  );
}
