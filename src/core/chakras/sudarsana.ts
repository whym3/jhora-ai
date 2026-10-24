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
import { ALL_VARGAS, vargaLongitude } from '../vargas';
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
  const spec = ALL_VARGAS[name];
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
