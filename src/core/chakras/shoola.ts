// Shoola chakra (Chakras > Shoola): CShoolaChakraView, RTC 0x54e1e8, vtbl 0x54e340,
// OnDraw 0x4784a0 -> draw routine FUN_004785d0(dc, chart, baseStar).
//
// * Coordinates are in 144ths of the drawing rectangle (client rect minus 24 px at
//   the top for the title and 24 px at the bottom); a "cell" is 12 units.
// * Trident (pen width 2): (72,12)-(72,132) handle, (36,12)-(36,52) and
//   (108,12)-(108,52) side prongs, (36,52)-(108,52) cross bar (traced at 0x4786fb).
// * 28 stars (28-star scheme, labels = the 4-letter table at 0x8a3fc8 that the
//   pointer 0x8a29a0 selects, i.e. NAK28) at the 28 positions SHOOLA_POS: position i
//   holds star (base + i) mod 28; text box [x, x+12] x [y, y+12], centred (DT_CENTER).
// * Base star (OnDraw 0x4784a0): 28-star byte chart+0x1705+b of body b = 0x57e384
//   (= 1, Sun) taken from the NATAL chart (doc+0x50, since 0x57c9a0 = 1); flag
//   0x57e389 (= 1) keeps that star (0 would use the next one). Tajaka/other chart kinds
//   (doc+0x76d04 in 1, 2, 5) use body 0x884864 (= 0, never written: lagna) of the shown
//   chart. "Fully customize base nakshatra" (33126) sets 0x884868 (fixed star 0x88486c)
//   or 0x884869 (body 0x884878 in varga 0x884874); the constructor 0x4780c0 clears both.
// * Bodies come from the document's CURRENT chart (doc+0x76d00; 0x8846d4 is never set),
//   i.e. the natal chart unless the document shows a transit/derived chart - there is
//   no separate transit overlay. Varga for planets: 0x884870 (default 0 = D-1).
// * Body set = view+0x12c (constructor default 0): 0 Planets (bodies 0..9),
//   1 Yogini & Mrityu (ints chart+0x2752c, +0x27534, +0x27530 mod 28 as slot indices),
//   2 Trisphuta etc (33..36), 3 Upagrahas (32,31,22..30), 4 Special lagnas
//   (0,14,15,17,18,19,20), 5 Sahamas (36 longitudes at chart+0x214f0, step 0x30).
//   Menu 152 commands 33091/33094/33092/33095/33096/33093 select them.
// * Body label: short body name, "(%s)" (0x57afc4) when the retrograde byte
//   chart+0x108+0x30*b is set, else "%s". The k-th body in a star (k = count & 7) is
//   drawn at x + 0.75*(XOFF[k]+2), y + 0.75*(YOFF[k]+1) (cell/16 steps); Yogini & Mrityu
//   use x + 0.75*XOFF[k], y + 0.75*(YOFF[k]+2); sahamas 1.125*XOFF[k], 0.75*YOFF[k].
// * Title (top-left, above the grid): "Planets:", "Yogini & Mrityu:", "Trisphuta etc:",
//   "Upagrahas:", "Special Lagnas:", "Sahamas (sahams):" (0x57c1c0.., '&&' in the
//   resource is the escaped ampersand).
// * No copy-to-clipboard command exists in this view's message map.
import { sahamas } from '../sahamas';
import {
  bodiesByIndex, nakshatra28Of, NAK28, planetBodies, yoginiMrityu,
  type ChakraBody, type ChakraChart,
} from './common';

export type StarChakraMode = 'planets' | 'yoginiMrityu' | 'trisphuta' | 'upagrahas' | 'specialLagnas' | 'sahamas';
export const STAR_CHAKRA_MODES: StarChakraMode[] = ['planets', 'yoginiMrityu', 'trisphuta', 'upagrahas', 'specialLagnas', 'sahamas'];
export const STAR_CHAKRA_TITLES: Record<StarChakraMode, string> = {
  planets: 'Planets:', yoginiMrityu: 'Yogini & Mrityu:', trisphuta: 'Trisphuta etc:',
  upagrahas: 'Upagrahas:', specialLagnas: 'Special Lagnas:', sahamas: 'Sahamas (sahams):',
};
/** Internal body indices of each body set (FUN_004785d0 / FUN_00444d50 local tables). */
export const STAR_CHAKRA_BODY_SETS = {
  trisphuta: [33, 34, 35, 36],
  upagrahas: [32, 31, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  specialLagnas: [0, 14, 15, 17, 18, 19, 20],
};
const YOGINI_LABELS = ['Yogini (vara)', 'Mrityu', ''];

/** Label boxes (top-left, 144 units) of the 28 trident positions (FUN_004785d0 locals). */
export const SHOOLA_POS: [number, number][] = [
  [66, 132], [54, 118], [54, 106], [54, 94], [60, 80], [60, 68], [60, 56], [38, 12],
  [30, 2], [24, 12], [24, 30], [24, 42], [30, 54], [60, 12], [66, 2], [74, 12],
  [74, 26], [60, 32], [74, 38], [96, 12], [102, 2], [110, 12], [110, 30], [110, 42],
  [102, 54], [74, 94], [74, 106], [74, 118],
];
export const SHOOLA_LINES: [number, number, number, number][] = [
  [72, 12, 72, 132], [36, 12, 36, 52], [108, 12, 108, 52], [36, 52, 108, 52],
];
const XOFF = [6, 6, 0, 0, 6, 6, 0, 0];
const YOFF = [6, 12, 6, 12, 18, 24, 18, 24];

export interface PlacedBody { body: ChakraBody; /** star (or sign) slot index */ pos: number; x: number; y: number; text: string }
export interface ChakraSlot { pos: number; /** NAK28 index (Shoola) or sign (Tripataki) */ id: number; label: string; x: number; y: number }

export interface ShoolaOptions {
  mode?: StarChakraMode;
  /** internal body index whose natal star is the base (default 1 = Sun, 0x57e384) */
  baseBody?: number;
  /** false = start from the star after the base body's star (flag 0x57e389, default true) */
  baseIsStar?: boolean;
  /** fixed base star (NAK28 index), "Fully customize base nakshatra" */
  fixedBaseStar?: number;
  /** chart whose bodies are drawn (doc+0x76d00); defaults to the natal chart */
  current?: ChakraChart | null;
  /**
   * chart+0x2752c / +0x27534 / +0x27530 for mode 'yoginiMrityu' (slot indices, used mod 28
   * without the base star); default: common.ts yoginiMrityu of the drawn chart
   */
  yoginiMrityuStars?: [number, number, number];
}

export interface ShoolaChakra {
  title: string;
  baseStar: number;
  slots: ChakraSlot[];
  lines: [number, number, number, number][];
  bodies: PlacedBody[];
}

/** Text JHora draws for a body: "(Ma)" when retrograde. */
export const bodyText = (b: ChakraBody) => (b.retrograde ? `(${b.label})` : b.label);

/** The bodies of a star/sign chakra body set (sahamas need chart.day). */
export function starChakraBodies(chart: ChakraChart, mode: StarChakraMode, transit = false): ChakraBody[] {
  switch (mode) {
    case 'planets': return planetBodies(chart, transit);
    case 'trisphuta': case 'upagrahas': case 'specialLagnas': return bodiesByIndex(chart, STAR_CHAKRA_BODY_SETS[mode], transit);
    case 'sahamas':
      if (!chart.day) return [];
      return sahamas(chart.positions, chart.day.isDay).map((s) => ({
        index: -1, label: s.name.replace(/ Sahama$/, ''), lon: s.lon, retrograde: false, transit,
      }));
    case 'yoginiMrityu': return [];
  }
}

export function shoolaChakra(chart: ChakraChart, opts: ShoolaOptions = {}): ShoolaChakra {
  const mode = opts.mode ?? 'planets';
  const baseBody = opts.baseBody ?? 1;
  let baseStar: number;
  if (opts.fixedBaseStar !== undefined) baseStar = ((opts.fixedBaseStar % 28) + 28) % 28;
  else {
    const lon = baseBody === 0 ? chart.positions.ascendant : bodiesByIndex(chart, [baseBody])[0]?.lon ?? chart.positions.grahas.Sun.lon;
    baseStar = nakshatra28Of(lon);
    if (opts.baseIsStar === false) baseStar = (baseStar + 1) % 28;
  }
  const slots: ChakraSlot[] = SHOOLA_POS.map(([x, y], pos) => {
    const id = (baseStar + pos) % 28;
    return { pos, id, label: NAK28[id], x, y };
  });
  const current = opts.current ?? chart;
  const isTransit = !!opts.current && opts.current !== chart;
  const count = new Array<number>(28).fill(0);
  const place = (body: ChakraBody, star: number, text: string): PlacedBody => {
    const pos = (star - baseStar + 28) % 28;
    const k = count[pos]++ & 7;
    const [x, y] = SHOOLA_POS[pos];
    const dx = mode === 'yoginiMrityu' ? 0.75 * XOFF[k] : mode === 'sahamas' ? 1.125 * XOFF[k] : 0.75 * (XOFF[k] + 2);
    const dy = mode === 'yoginiMrityu' ? 0.75 * (YOFF[k] + 2) : mode === 'sahamas' ? 0.75 * YOFF[k] : 0.75 * (YOFF[k] + 1);
    return { body, pos, x: x + dx, y: y + dy, text };
  };
  let bodies: PlacedBody[];
  if (mode === 'yoginiMrityu') {
    // FUN_004785d0 takes value % 28 as the slot itself; place() subtracts the base star again
    const stars = opts.yoginiMrityuStars ?? yoginiMrityu(current);
    bodies = stars ? stars.map((s, i) => place({ index: -1, label: YOGINI_LABELS[i], lon: 0, retrograde: false, transit: isTransit }, (((s % 28) + 28) % 28 + baseStar) % 28, YOGINI_LABELS[i])) : [];
  } else {
    bodies = starChakraBodies(current, mode, isTransit).map((b) => place(b, nakshatra28Of(b.lon), bodyText(b)));
  }
  return { title: STAR_CHAKRA_TITLES[mode], baseStar, slots, lines: SHOOLA_LINES, bodies };
}
