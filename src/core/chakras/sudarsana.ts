// Sudarsana Chakra sub-tab (CSudarsanaChakraView, OnDraw 0x481580 -> drawing
// routine FUN_00481670).
//
// * OnDraw picks two chart objects with FUN_004a1260(.., 0): the natal chart
//   (doc+0x50) and the document's current chart (doc+0x76d00 - the natal chart
//   itself unless a transit/Tajaka/... chart is being shown). Bodies come from
//   the natal chart only when DAT_008846d4 == 1 (default 0 -> current chart).
//   The three ring start signs come from the natal chart when the chart kind
//   (doc+0x76d04) is not 1/2/5 and DAT_0057c9a0 == 1 (default), so with a
//   transit chart displayed the rings stay natal and the bodies are transits.
// * Start signs: sign bytes chart+0x17d7+varga+p*0x1d for p = 0 (Lagna),
//   2 (Moon), 1 (Sun), varga = DAT_008848a8 (default 0 = D-1; command 33254
//   "Divisional chart to be used for planets" opens the varga picker
//   FUN_004d78d0 and stores the result there).
// * Geometry (120x120 logical units): outer ellipse 0..120 filled RGB(255,210,210),
//   middle ellipse 14..106 white, inner ellipse 28..92 RGB(210,255,210); six
//   diameters at 0/30/60/90/120/150 degrees. Ring r = 0 (Lagna) is innermost,
//   r = 1 (Moon) middle, r = 2 (Sun) outermost. House h of every ring sits in
//   the 30-degree sector from 30h to 30(h+1) degrees, counted ANTI-clockwise
//   from the 3 o'clock radius (label tables local_9a4[0x28..0x4b] x and
//   [4..0x27] y). Sign labels use the short sign names (Ar..Pi).
// * Text placement (logical box W x H, its top-left (x0, y0); table local_9a4):
//   house h (0..11) of ring r has its cell at (SUD_HOUSE_X[12r + h] * W/120,
//   SUD_HOUSE_Y[12r + h] * H/120) from (x0, y0). The sign name is centred
//   (DT_CENTER) in a W/10 x H/10 box there; the n-th body of the house
//   (n = count mod 6) is drawn left/top-aligned at
//   ((SUD_SLOT_X[i] + 2)/16 * W/12, (SUD_SLOT_Y[i] + 1)/16 * H/12) from the
//   cell, i = 6 (12r + h) + n (the x unit is 3/2 W/12 for sahamas). The title
//   is left-aligned in [x0, y0 - 44, x0 + W/3, y0 - 20] px.
// * Bodies: view+0x12c selects the set (constructor 0x481430 sets 0):
//     0 "Planets"        bodies 0..9 (As, Su..Ke)            - command 33091
//     1 "Trisphuta etc"  bodies 33..36                        - no handler here
//     2 "Upagrahas"      bodies 32, 31, 22..30                - command 33095
//     3 "Special Lagnas" bodies 0, 14, 15, 17, 18, 19, 20     - command 33096
//     4 "Sahamas (sahams)" 36 sahamas (chart+0x214f0)          - no handler here
//   Each body goes into house (sign - ringStart) mod 12 of each ring, up to 6
//   slots per house (count mod 6). Planet labels are "%s" or "(%s)" when the
//   retrograde byte (chart+0x108+0x30*b) is set, using the short names.
// * Title (top-left): "<set name> in <varga name>", e.g. "Planets in D-1".
// * No transit date control and no copy-to-clipboard command in this view.
import type { ChakraBody, ChakraChart } from './common';
import { bodiesByIndex, chakraBody, signOf } from './common';
import { vargaLongitude } from '../vargas';
import { vargaSpec } from '../vargaOptions';
import { JHORA_VARGAS, JHORA_VARGA_NAMES } from '../dasas/rasiCommon';
import { sahamas } from '../sahamas';
import { norm360 } from '../positions';

export const SUDARSANA_MODES = ['Planets', 'Trisphuta etc', 'Upagrahas', 'Special Lagnas', 'Sahamas (sahams)'] as const;
export type SudarsanaMode = 0 | 1 | 2 | 3 | 4;

/** Body indices per mode (order as JHora iterates them). Mode 4 (sahamas) has none. */
export const SUDARSANA_MODE_BODIES: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [33, 34, 35, 36],
  [32, 31, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  [0, 14, 15, 17, 18, 19, 20],
  [],
];

export const SUDARSANA_RINGS = ['Lagna', 'Moon', 'Sun'] as const;

/** Cell of house h of ring r (index 12r + h), in 1/120ths of the box (local_9a4[0x28..], [4..]). */
export const SUD_HOUSE_X = [
  64, 62, 57, 52, 47, 45, 45, 47, 52, 57, 62, 64, 87, 79, 64, 46, 30, 21, 21, 30, 46, 64, 79, 87,
  100, 89, 65, 42, 20, 8, 8, 20, 42, 65, 89, 100,
];
export const SUD_HOUSE_Y = [
  55, 50, 47, 47, 50, 55, 60, 65, 68, 68, 65, 60, 49, 34, 24, 24, 34, 49, 67, 81, 91, 91, 81, 67,
  45, 24, 10, 10, 24, 45, 71, 91, 105, 105, 91, 71,
];
/** Body slot n of house cell c (index 6c + n), in 1/16ths of W/12 (x, plus 2) and H/12 (y, plus 1) (local_9a4[0x5e..], [0x136..]). */
export const SUD_SLOT_X = [
  16, 16, 23, 23, 30, 30, 14, 10, 20, 16, 26, 21, 11, 5, 5, 13, 5, 16, 4, -2, -5, 4, -8, 3,
  -2, 2, -8, -4, -14, -11, -4, -4, -11, -11, -18, -18, -4, -4, -11, -11, -18, -18, -2, 2, -8, -4, -14, -11,
  4, -2, -5, 4, -8, 3, 11, 5, 5, 13, 5, 16, 14, 10, 20, 16, 26, 21, 16, 16, 23, 23, 30, 30,
  12, 19, 10, 10, 17, 17, 10, 17, 14, 2, 21, 9, 6, 13, 14, -2, -2, 7, 6, 13, 14, -2, -2, 7,
  0, 7, -10, -2, -3, 5, 0, -7, 0, 2, -7, -6, 0, -7, 0, 2, -7, -6, 0, 7, -10, -2, -3, 5,
  6, 13, 14, -2, -2, 7, 6, 13, 14, -2, -2, 7, 10, 17, 14, 2, 21, 9, 12, 19, 10, 10, 17, 17,
  12, 19, 10, 10, 17, 17, 10, 17, 14, 0, 21, 7, 6, 13, 14, 0, -2, 7, 6, 13, 14, 0, -2, 7,
  0, 7, -10, 0, -3, 7, 0, -7, 0, 2, -7, -6, 0, -7, 0, 2, -7, -6, 0, 7, -10, 0, -3, 7,
  6, 13, 14, 0, -2, 7, 6, 13, 14, 0, -2, 7, 10, 17, 14, 0, 21, 7, 12, 19, 10, 10, 17, 17,
];
export const SUD_SLOT_Y = [
  -2, -8, -2, -8, -2, -8, -6, -12, -10, -18, -14, -24, -10, -10, -16, -16, -22, -22, -10, -10, -16, -16, -22, -22,
  -4, -10, -8, -16, -12, -22, -2, -8, -2, -8, -2, -8, 0, 6, 0, 6, 0, 6, 2, 8, 6, 14, 10, 20,
  8, 8, 14, 14, 20, 20, 8, 8, 14, 14, 20, 20, 4, 10, 8, 16, 12, 22, 0, 6, 0, 6, 0, 6,
  0, 0, 6, -6, 6, -6, -8, -8, -2, -14, -2, -14, -8, -8, -2, -14, -8, -14, -8, -8, -2, -14, -8, -14,
  -8, -8, -2, -14, -2, -14, 0, 0, 6, -6, 6, -6, -2, -2, -8, 4, -8, 4, 6, 6, 0, 12, 0, 12,
  6, 6, 0, 12, 6, 12, 6, 6, 0, 12, 6, 12, 6, 6, 0, 12, 0, 12, -2, -2, -8, 4, -8, 4,
  0, 0, 6, -6, 6, -6, -8, -8, -2, -14, -2, -14, -8, -8, -2, -14, -8, -14, -8, -8, -2, -14, -8, -14,
  -8, -8, -2, -14, -2, -14, 0, 0, 6, -6, 6, -6, -2, -2, -8, 4, -8, 4, 6, 6, 0, 12, 0, 12,
  6, 6, 0, 12, 6, 12, 6, 6, 0, 12, 6, 12, 6, 6, 0, 12, 0, 12, -2, -2, -8, 4, -8, 4,
];

export interface SudarsanaHouse { house: number; sign: number; bodies: ChakraBody[] }
export interface SudarsanaRing { ref: (typeof SUDARSANA_RINGS)[number]; startSign: number; houses: SudarsanaHouse[] }
export interface SudarsanaChakraData {
  title: string;
  mode: SudarsanaMode;
  vargaIndex: number;
  /** inner to outer: Lagna, Moon, Sun */
  rings: SudarsanaRing[];
}

export interface SudarsanaOptions {
  mode?: SudarsanaMode;
  /** JHora varga index (0 D-1, 1 D-9, 2 D-2, ...; see JHORA_VARGAS) */
  vargaIndex?: number;
  /** chart whose bodies are placed (JHora: the document's displayed chart, e.g. a transit chart); rings stay natal */
  transit?: ChakraChart | null;
}

function placed(src: ChakraChart, mode: SudarsanaMode, transit: boolean): ChakraBody[] {
  if (mode === 4) {
    if (!src.day) return [];
    return sahamas(src.positions, src.day.isDay).map((s) => ({
      index: -1, label: s.name.replace(/ Sahama$/, ''), lon: norm360(s.lon), retrograde: false, transit,
    }));
  }
  const bodies = bodiesByIndex(src, SUDARSANA_MODE_BODIES[mode], transit);
  // only grahas carry JHora's "(Ma)" retrograde form; others never do
  return bodies.map((b) => (b.index >= 1 && b.index <= 7 ? b : { ...b, retrograde: false }));
}

export function sudarsanaChakra(chart: ChakraChart, opts: SudarsanaOptions = {}): SudarsanaChakraData {
  const mode = opts.mode ?? 0;
  const vargaIndex = opts.vargaIndex ?? 0;
  const name = JHORA_VARGAS[vargaIndex];
  if (!name) throw new Error(`varga index ${vargaIndex} not supported`);
  const spec = vargaSpec(name, chart.ini);
  const vsign = (lon: number) => signOf(vargaLongitude(lon, spec));
  const starts = [0, 2, 1].map((i) => vsign(chakraBody(chart, i)!.lon));
  const src = opts.transit ?? chart;
  const bodies = placed(src, mode, !!opts.transit);
  const rings = SUDARSANA_RINGS.map((ref, r) => {
    const houses: SudarsanaHouse[] = Array.from({ length: 12 }, (_, h) => ({ house: h + 1, sign: (starts[r] + h) % 12, bodies: [] }));
    for (const b of bodies) houses[(vsign(b.lon) - starts[r] + 12) % 12].bodies.push(b);
    return { ref, startSign: starts[r], houses };
  });
  return { title: `${SUDARSANA_MODES[mode]} in ${JHORA_VARGA_NAMES[vargaIndex]}`, mode, vargaIndex, rings };
}
