// Mixed 2-Vargas drawing (CMixedChartView, South Indian style FUN_0045d1e0):
// one 4x4 South Indian frame; the band outside the inner separator square
// (inset half a cell) carries the outer varga's bodies, the half of every sign
// box facing the centre carries the inner varga's. Centre: "Outer: ..." and
// "Inner: ..." captions with the varga names.
import { useMemo } from 'react';
import { SIGNS } from '../../core/zodiac';
import { mixedVargas } from '../../core/chakras/mixedVargas';
import { BodyStack, ChakraSvg, type ChakraViewProps } from './common';
import './mixed.css';

const SIZE = 480, CELL = SIZE / 4, Q = CELL / 4;
// South Indian cell (col, row) per sign, Aries first (Pisces top-left)
const CELLS: [number, number][] = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]];
// quarter-cell offsets of the two half-size sub-boxes (FUN_0045d1e0 tables)
const INNER_X = [1, 1, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2], INNER_Y = [2, 2, 2, 1, 1, 0, 0, 0, 0, 1, 1, 2];
const OUTER_X = [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0], OUTER_Y = [0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0];

export interface MixedVargasViewProps extends ChakraViewProps {
  /** JHora varga index of the inner chart (default 0 = D-1) */
  inner?: number;
  /** JHora varga index of the outer chart (default 1 = D-9; 0 when `transit` is drawn outside) */
  outer?: number;
  /** draw the transit chart in the outer half (JHora's behaviour when a transit chart is displayed) */
  showTransit?: boolean;
}

export function MixedVargasView({ chart, transit, inner, outer, showTransit = false }: MixedVargasViewProps) {
  const data = useMemo(
    () => mixedVargas(chart, { inner, outer, outerChart: showTransit ? transit : null }),
    [chart, transit, inner, outer, showTransit],
  );
  const half = CELL / 2;
  return (
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
            <text x={x0 + CELL - 3} y={y0 + CELL - 3} textAnchor="end" className="ck-small">{SIGNS[sg.sign]}</text>
            {sg.sign === data.lagnaSign && <line x1={x0} y1={y0 + 12} x2={x0 + 12} y2={y0} className="lagna-mark" />}
            <BodyStack bodies={sg.inner} x={x0 + INNER_X[sg.sign] * Q + half / 2} y={y0 + INNER_Y[sg.sign] * Q + half / 2} perRow={3} dx={18} dy={11} />
            <BodyStack bodies={sg.outer} x={x0 + OUTER_X[sg.sign] * Q + half / 2} y={y0 + OUTER_Y[sg.sign] * Q + half / 2} perRow={3} dx={18} dy={11} />
          </g>
        );
      })}
      <text x={SIZE / 2} y={CELL + 34} textAnchor="middle" className="mixed-caption">{data.outerCaption[0]}</text>
      <text x={SIZE / 2} y={CELL + 56} textAnchor="middle" className="mixed-varga">{data.outerCaption[1]}</text>
      <text x={SIZE / 2} y={2 * CELL + 38} textAnchor="middle" className="mixed-caption">{data.innerCaption[0]}</text>
      <text x={SIZE / 2} y={2 * CELL + 60} textAnchor="middle" className="mixed-varga">{data.innerCaption[1]}</text>
    </ChakraSvg>
  );
}
