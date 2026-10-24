// Sudarsana Chakra drawing in JHora's layout (CSudarsanaChakraView, FUN_00481670):
// three concentric rings - Lagna innermost, Moon middle, Sun outermost - each
// with 12 houses; house 1 is the 30-degree sector just above the 3 o'clock
// radius and the houses run anti-clockwise. Sign names and bodies sit at JHora's
// table positions (SUD_HOUSE_X/Y, SUD_SLOT_X/Y in src/core/chakras/sudarsana.ts).
import { useMemo } from 'react';
import { SIGNS } from '../../core/zodiac';
import { SUD_HOUSE_X, SUD_HOUSE_Y, SUD_SLOT_X, SUD_SLOT_Y, sudarsanaChakra, type SudarsanaMode } from '../../core/chakras/sudarsana';
import { bodyClass, ChakraSvg, type ChakraViewProps } from './common';
import './sudarsana.css';

const S = 5;              // JHora's 120-unit square scaled to 600 px
const C = 60 * S;         // centre
const R = [32 * S, 46 * S, 60 * S]; // outer radius of the Lagna, Moon and Sun rings
const U = 10 * S;         // JHora's slot unit W/12

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
          const c = 12 * r + h.house - 1, x0 = SUD_HOUSE_X[c] * S, y0 = SUD_HOUSE_Y[c] * S;
          const uw = data.mode === 4 ? (U * 3) / 2 : U;
          return (
            <g key={`${r}-${h.house}`}>
              <text x={x0 + 6 * S} y={y0 + 12} textAnchor="middle" className="sud-sign">{SIGNS[h.sign]}</text>
              {h.bodies.map((b, n) => {
                const i = 6 * c + (n % 6);
                return (
                  <text key={`${b.index}-${b.label}-${n}`} x={x0 + ((SUD_SLOT_X[i] + 2) * uw) / 16} y={y0 + ((SUD_SLOT_Y[i] + 1) * U) / 16 + 11}
                    className={bodyClass(b)}>
                    {b.retrograde ? `(${b.label})` : b.label}
                  </text>
                );
              })}
            </g>
          );
        }))}
      </g>
      <text x={4} y={18} className="ck-title">{data.title}</text>
    </ChakraSvg>
  );
}
