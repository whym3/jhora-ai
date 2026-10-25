// Kalachakra (Chakras > Kalachakra), CKalaChakraView: the 28-star wheel with
// the eight dikpalas. Unrelated to the Kalachakra dasa (src/core/dasas/kalachakra.ts)
// apart from the name.
//
// jhora.exe:
// * OnDraw FUN_00455260:
//   - planets chart = FUN_004a1260(chart, DAT_008846e8) - varga 0 (D-1) by
//     default, "Divisional chart to be used for planets" (33254, FUN_004577d0)
//     changes it - taken from the natal chart (doc+0x50) when DAT_008846d4 == 1,
//     else from doc+0x76d00, the chart the document shows (natal unless a
//     transit chart is being viewed); DAT_008846d4 is 0 by default.
//   - base star: byte chart+0x1705+b of the NATAL chart (static 0x57c9a0 = 1)
//     for body b = static 0x57c9a4 = 1 (Sun); the static flag 0x57c9a9 = 1
//     keeps it (0 would take the next star). For Tajaka-like charts (doc+0x76d04
//     in {1,2,5}) body DAT_008846dc (0 = lagna) with flag 0x57c9a8 = 1.
//     "Base planet and division" (33255, FUN_004578b0) sets DAT_008846e1 and
//     the body DAT_008846f0 / varga DAT_008846ec (read from doc+0x76d00);
//     "Fully customize base nakshatra" (33126, FUN_00457650) sets DAT_008846e0
//     and the star DAT_008846e4. The constructor (FUN_00455110) clears both
//     flags and sets the body mode view+0x12c = 0 (Planets).
// * Draw FUN_004553c0 (logical box W x H below a 24 px title strip):
//   - circle at 24/72..48/72 of the box, 8 spokes from the circle to the
//     edges: diagonals (20,20)-(55,55), (89,89)-(124,124), (124,20)-(89,55),
//     (20,124)-(55,89) and axes (0,72)-(48,72), (96,72)-(144,72),
//     (72,0)-(72,48), (72,96)-(72,144) in 1/144ths.
//   - star k (k = 0..27, star = (base + k) mod 28) in a cell of W/12 x H/12
//     whose top-left is KC_STAR_X[k], KC_STAR_Y[k] in 1/72ths (tables
//     local_258[0x27..] / [0xb..]); name centred (DT_CENTER).
//   - dikpala labels (0x57ca68.. 0x57c9ac): EAST at the top, then clockwise
//     SE, S (right), SW, W (bottom), NW, N (left), NE; boxes of W*16/72 x 24 px
//     at KC_DIKPALA (x, y in 1/72ths, raised 24 px when `above`).
//   - mode title ("Planets:", "Yogini && Mrityu:", "Trisphuta etc:",
//     "Upagrahas:", "Special Lagnas:", "Sahamas (sahams):") top-left.
//   - bodies of the mode in the cell of their star; the n-th body of a cell at
//     ((xs[n%8] + 2)/16, (ys[n%8] + 1)/16) of a cell with xs = 0,0,0,0,8,8,8,8,
//     ys = 4,8,12,16,4,8,12,16; text "%s" or "(%s)" if retrograde.
//     Mode 0 Planets: bodies 1..9 (Sun..Ketu, no lagna).
//     Mode 1 Yogini & Mrityu: chart+0x2752c ("Yogini (vara)"), +0x27534
//       ("Mrityu"), +0x27530 ("") mod 28 used directly as the slot k (not
//       relative to the base; common.ts yoginiMrityu), at (xs[n]/16,
//       (ys[n] + 2)/16) of the cell.
//     Mode 2 Trisphuta: bodies 33..36. Mode 3 Upagrahas: 32, 31, 22..30.
//     Mode 4 Special lagnas: 14, 15, 17, 18, 19, 20. Mode 5 Sahamas: the 36
//       sahamas (names table 0x8a2088), cells widened to 1.5 W/12.
import { type ChakraBody, type ChakraChart, bodiesByIndex, chakraBody, NAK28, nakshatra28Of, vargaChart, yoginiMrityu } from './common';
import { sahamas } from '../sahamas';

export const KC_STAR_X = [33, 33, 33, 36, 44, 50, 56, 65, 57, 49, 40, 44, 50, 56, 33, 33, 33, 30, 22, 16, 10, 1, 9, 17, 26, 22, 16, 10];
export const KC_STAR_Y = [1, 9, 17, 26, 22, 16, 10, 36, 36, 36, 36, 44, 50, 56, 65, 57, 49, 42, 44, 50, 56, 36, 36, 36, 30, 22, 16, 10];
/** Compass direction of the spoke each slot k lies on (East is drawn at the top). */
export const KC_STAR_DIR = [
  'E', 'E', 'E', 'E', 'SE', 'SE', 'SE', 'S', 'S', 'S', 'S', 'SW', 'SW', 'SW',
  'W', 'W', 'W', 'W', 'NW', 'NW', 'NW', 'N', 'N', 'N', 'N', 'NE', 'NE', 'NE',
] as const;

export interface KcDikpala { text: string; x: number; y: number; align: 'left' | 'center' | 'right'; above: boolean }
export const KC_DIKPALA: KcDikpala[] = [
  { text: 'EAST: Indra (power)', x: 28, y: 0, align: 'center', above: true },
  { text: 'SE: Agni (prosperity)', x: 54, y: 8, align: 'center', above: true },
  { text: 'S: Yama (death)', x: 56, y: 36, align: 'right', above: true },
  { text: 'SW: Nirriti (curses of gods)', x: 54, y: 64, align: 'center', above: false },
  { text: 'W: Varuna (suffering/foreign things)', x: 28, y: 72, align: 'center', above: false },
  { text: 'NW: Vayu (wandering)', x: 2, y: 64, align: 'center', above: false },
  { text: 'N: Kubera (money)', x: 0, y: 36, align: 'left', above: true },
  { text: 'NE: Isana (blessings of gods)', x: 2, y: 8, align: 'center', above: true },
];

export const KC_SLOT_X = [0, 0, 0, 0, 8, 8, 8, 8];
export const KC_SLOT_Y = [4, 8, 12, 16, 4, 8, 12, 16];

export type KalachakraMode = 'planets' | 'yogini' | 'trisphuta' | 'upagrahas' | 'specialLagnas' | 'sahamas';
export const KC_MODE_TITLES: Record<KalachakraMode, string> = {
  planets: 'Planets:', yogini: 'Yogini & Mrityu:', trisphuta: 'Trisphuta etc:', upagrahas: 'Upagrahas:',
  specialLagnas: 'Special Lagnas:', sahamas: 'Sahamas (sahams):',
};
const MODE_BODIES: Partial<Record<KalachakraMode, number[]>> = {
  planets: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  trisphuta: [33, 34, 35, 36],
  upagrahas: [32, 31, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  specialLagnas: [14, 15, 17, 18, 19, 20],
};

export interface KalachakraStar {
  k: number;
  star: number;
  label: string;
  /** top-left of the star's cell in 1/72ths of the drawing box */
  x: number;
  y: number;
  dir: (typeof KC_STAR_DIR)[number];
  bodies: ChakraBody[];
}

export interface KalachakraChakra {
  baseStar: number;
  mode: KalachakraMode;
  title: string;
  stars: KalachakraStar[];
  dikpalas: KcDikpala[];
  /** offset added to KC_SLOT_X / KC_SLOT_Y for the bodies of this mode (in cell/16 steps) */
  slotShift: { x: number; y: number };
  /** false when the chart data lacks what the mode needs */
  complete: boolean;
}

export interface KalachakraOptions {
  mode?: KalachakraMode;
  /** "Fully customize base nakshatra": NAK28 index */
  baseStar?: number;
  /** "Base planet": JHora body index whose star is the base (default 1 = Sun, natal) */
  baseBody?: number;
  /** "Base planet and division": JHora varga index of the base body (default 0 = D-1) */
  baseVargaIndex?: number;
  /** "Divisional chart to be used for planets" (33254, DAT_008846e8): JHora varga index */
  vargaIndex?: number;
}

/**
 * The Kalachakra wheel. Base = natal Sun's star (28-star scheme). Bodies come
 * from `transit` when given (JHora when a transit chart is being viewed),
 * else from the natal chart.
 */
export function kalachakraChakra(chart: ChakraChart, transit?: ChakraChart | null, opts: KalachakraOptions = {}): KalachakraChakra {
  const mode = opts.mode ?? 'planets';
  const baseLon = chakraBody(vargaChart(chart, opts.baseVargaIndex ?? 0), opts.baseBody ?? 1)?.lon ?? chart.positions.grahas.Sun.lon;
  const baseStar = opts.baseStar ?? nakshatra28Of(baseLon);
  const stars: KalachakraStar[] = Array.from({ length: 28 }, (_, k) => {
    const star = (baseStar + k) % 28;
    return { k, star, label: NAK28[star], x: KC_STAR_X[k], y: KC_STAR_Y[k], dir: KC_STAR_DIR[k], bodies: [] };
  });
  const src = vargaChart(transit ?? chart, opts.vargaIndex ?? 0);
  let bodies: ChakraBody[] = [];
  let complete = true;
  const idx = MODE_BODIES[mode];
  if (idx) {
    bodies = bodiesByIndex(src, idx, !!transit);
    complete = bodies.length === idx.length;
  } else if (mode === 'sahamas') {
    if (src.day) {
      bodies = sahamas(src.positions, src.day.isDay).map((s) => ({ index: -1, label: s.name, lon: s.lon, retrograde: false, transit: !!transit }));
    } else complete = false;
  } else if (mode === 'yogini') {
    const ym = yoginiMrityu(src);
    if (ym) {
      // drawn in this order: +0x2752c, +0x27534, +0x27530
      (['Yogini (vara)', 'Mrityu', ''] as const).forEach((label, i) =>
        stars[ym[i] % 28].bodies.push({ index: -1, label, lon: 0, retrograde: false, transit: !!transit }));
    } else complete = false;
    return { baseStar, mode, title: KC_MODE_TITLES[mode], stars, dikpalas: KC_DIKPALA, slotShift: { x: 0, y: 2 }, complete };
  } else complete = false;
  for (const b of bodies) stars[(nakshatra28Of(b.lon) - baseStar + 28) % 28].bodies.push(b);
  return { baseStar, mode, title: KC_MODE_TITLES[mode], stars, dikpalas: KC_DIKPALA, slotShift: { x: 2, y: 1 }, complete };
}
