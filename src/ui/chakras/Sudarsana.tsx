// Sudarsana Chakra drawing in JHora's layout (CSudarsanaChakraView, FUN_00481670):
// three concentric rings - Lagna innermost, Moon middle, Sun outermost - each
// with 12 houses; house 1 is the 30-degree sector just above the 3 o'clock
// radius and the houses run anti-clockwise.
import { useMemo } from 'react';
import { SIGNS } from '../../core/zodiac';
import { sudarsanaChakra, type SudarsanaMode } from '../../core/chakras/sudarsana';
import { BodyStack, ChakraSvg, type ChakraViewProps } from './common';
import './sudarsana.css';

const S = 5;              // JHora's 120-unit square scaled to 600 px
const C = 60 * S;         // centre
const R = [32 * S, 46 * S, 60 * S]; // outer radius of the Lagna, Moon and Sun rings
const R0 = [0, 32 * S, 46 * S];     // inner radius
/** radius of the sign label and of the body stack in each ring */
const LABEL_R = [11 * S, 35 * S, 49 * S];
const BODY_R = [23 * S, 40.5 * S, 54.5 * S];
const PER_ROW = [2, 3, 4];

const polar = (r: number, deg: number): [number, number] => [C + r * Math.cos((deg * Math.PI) / 180), C - r * Math.sin((deg * Math.PI) / 180)];

export interface SudarsanaViewProps extends ChakraViewProps {
  /** body set: 0 Planets (default), 1 Trisphuta etc, 2 Upagrahas, 3 Special Lagnas, 4 Sahamas */
  mode?: SudarsanaMode;
  /** JHora varga index (default 0 = D-1) */
  vargaIndex?: number;
  /** place the transit chart's bodies on the natal rings (JHora does this when a transit chart is displayed) */
  showTransit?: boolean;
}

export function SudarsanaView({ chart, transit, mode = 0, vargaIndex = 0, showTransit = false }: SudarsanaViewProps) {
  const data = useMemo(
    () => sudarsanaChakra(chart, { mode, vargaIndex, transit: showTransit ? transit : null }),
    [chart, transit, mode, vargaIndex, showTransit],
  );
  return (
    <ChakraSvg w={600} h={640} title={`Sudarsana Chakra: ${data.title}`}>
      <g transform="translate(0 40)">
        <circle cx={C} cy={C} r={R[2]} className="sud-outer" />
        <circle cx={C} cy={C} r={R[1]} className="sud-middle" />
        <circle cx={C} cy={C} r={R[0]} className="sud-inner" />
        {[0, 30, 60, 90, 120, 150].map((a) => {
          const [x1, y1] = polar(R[2], a), [x2, y2] = polar(R[2], a + 180);
          return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} className="ck-line" />;
        })}
        {data.rings.map((ring, r) => ring.houses.map((h) => {
          const mid = 30 * (h.house - 1) + 15;
          const [lx, ly] = polar(LABEL_R[r], mid);
          const [bx, by] = polar(BODY_R[r], mid);
          return (
            <g key={`${r}-${h.house}`}>
              <text x={lx} y={ly + 4} textAnchor="middle" className="sud-sign">{SIGNS[h.sign]}</text>
              <BodyStack bodies={h.bodies} x={bx} y={by} perRow={PER_ROW[r]} dx={20} dy={13} />
            </g>
          );
        }))}
        <text x={C} y={C - R0[1] + 14} textAnchor="middle" className="ck-small">Lagna</text>
        <text x={C} y={C - R0[2] + 12} textAnchor="middle" className="ck-small">Moon</text>
        <text x={C} y={C - R[2] + 12} textAnchor="middle" className="ck-small">Sun</text>
      </g>
      <text x={4} y={18} className="ck-title">{data.title}</text>
    </ChakraSvg>
  );
}
