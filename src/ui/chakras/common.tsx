// Shared pieces for the chakra drawings (src/ui/chakras/*.tsx), including the compact option
// controls standing in for the chakras' context menus (menu 152 of the star chakras: body set
// 33091..33096, "Base planet and division" 33255, "Divisional chart to be used for planets"
// 33254, "Fully customize base nakshatra" 33126; Kota 33127; Sarvatobhadra 33244..33253).
import type { ReactNode } from 'react';
import type { ChakraBody, ChakraChart } from '../../core/chakras/common';
import { JHORA_BODIES, NAK28 } from '../../core/chakras/common';
import { VARGA_INDEX, VARGA_PARTS } from '../../core/vargaOptions';
import { JHORA_VARGA_LONG_NAMES } from '../../core/chakras/mixedVargas';
import { SIGN_NAMES } from '../../core/zodiac';
import type { ChartSpec } from '../../engine/protocol';
import './chakras.css';

/** Props every chakra view takes. */
export interface ChakraViewProps {
  /** natal chart (a core Chart, or the worker's ChartResult - bodies needing `longitudes` are then omitted) */
  chart: ChakraChart;
  /** transit chart for the chakras that show transits (the lead computes it; JHora's default is described per view) */
  transit?: ChakraChart | null;
  /** the chart spec on screen (views that run worker jobs or need the natal chart, e.g. Many Vargas) */
  spec?: ChartSpec | null;
}

/** One option control: a labelled select. */
export interface OptionField<T extends string | number = string | number> {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}

/** A row of option selects above a chakra (rendered as HTML, outside the SVG). */
export function OptionBar({ fields, children }: { fields: OptionField[]; children?: ReactNode }) {
  return (
    <div className="ck-options">
      {fields.map((f) => (
        <label key={f.label}>
          <span>{f.label}</span>
          <select aria-label={f.label} value={String(f.value)}
            onChange={(e) => {
              const hit = f.options.find(([v]) => String(v) === e.target.value);
              if (hit) f.onChange(hit[0]);
            }}>
            {f.options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
          </select>
        </label>
      ))}
      {children}
    </div>
  );
}

/** JHora varga indices 0..22 ("D-9 Navamsa"), for the varga pickers. */
export const VARGA_OPTIONS: [number, string][] = VARGA_INDEX.map((_, i) => [i, `D-${VARGA_PARTS[i]} ${JHORA_VARGA_LONG_NAMES[i]}`]);
/** Base bodies of "Base planet and division": Lagna, Sun..Ketu. */
export const BASE_BODY_OPTIONS: [number, string][] = JHORA_BODIES.slice(0, 10).map(([name], i) => [i, name]);
/** "Fully customize base nakshatra": -1 = JHora's default base. */
export const BASE_STAR_OPTIONS: [number, string][] = [[-1, 'Default'], ...NAK28.map((n, i): [number, string] => [i, n])];
export const BASE_SIGN_OPTIONS: [number, string][] = [[-1, 'Default'], ...SIGN_NAMES.map((n, i): [number, string] => [i, n])];
/** Menu 152 body sets in menu order (commands 33091, 33094, 33092, 33095, 33096, 33093). */
export const BODY_SET_LABELS = ['Planets', 'Yogini and Mrityu', 'Trisphuta etc', 'Upagrahas', 'Special Lagnas', 'Sahamas'] as const;

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
