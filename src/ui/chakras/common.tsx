// Shared pieces for the chakra drawings (src/ui/chakras/*.tsx).
import type { ReactNode } from 'react';
import type { ChakraBody, ChakraChart } from '../../core/chakras/common';
import './chakras.css';

/** Props every chakra view takes. */
export interface ChakraViewProps {
  /** natal chart (a core Chart, or the worker's ChartResult - bodies needing `longitudes` are then omitted) */
  chart: ChakraChart;
  /** transit chart for the chakras that show transits (the lead computes it; JHora's default is described per view) */
  transit?: ChakraChart | null;
}

export function ChakraSvg({ w, h, title, children }: { w: number; h: number; title: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chakra" role="img" aria-label={title}>
      {children}
    </svg>
  );
}

/** Label of a body as JHora draws it: short name, retrograde marked with "(R)"-style superscript. */
export function bodyClass(b: ChakraBody): string {
  return `ck-body${b.index === 0 ? ' ck-lagna' : ''}${b.transit ? ' ck-transit' : ''}`;
}

/** Bodies stacked in rows of `perRow`, centred at (x, y). */
export function BodyStack({ bodies, x, y, perRow = 3, dx = 22, dy = 13 }: { bodies: ChakraBody[]; x: number; y: number; perRow?: number; dx?: number; dy?: number }) {
  const rows = Math.ceil(bodies.length / perRow);
  return (
    <>
      {bodies.map((b, i) => {
        const r = Math.floor(i / perRow), inRow = Math.min(perRow, bodies.length - r * perRow), c = i % perRow;
        return (
          <text key={`${b.transit ? 't' : 'n'}${b.index}-${b.label}-${i}`} x={x + (c - (inRow - 1) / 2) * dx} y={y + (r - (rows - 1) / 2) * dy + 4}
            textAnchor="middle" className={bodyClass(b)}>
            {b.label}{b.retrograde ? <tspan className="retro">R</tspan> : null}
          </text>
        );
      })}
    </>
  );
}
