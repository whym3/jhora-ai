// Sarvatobhadra chakra (CSarvatobhadraChakraView, RTC 0x54da30, vtbl 0x54dde0).
//
// OnDraw 0x471c20 -> FUN_00471cd0(dc, cur, natal) where
//   cur   = FUN_004a1260(doc->+0x76d00 (current chart), varga DAT_0088484c)
//   natal = FUN_004a1260(doc+0x50 (natal chart),          varga DAT_00884850)
// Both vargas default to D-1 (bss); menu 33244 (0x475c10) picks the varga.
// doc+0x76d00 is the natal chart until "View transits on this date" (32968,
// FUN_00475a70: a date dialog pre-filled from the transit-date globals at
// 0x896720) calls FUN_0041d660, which computes doc+0x279e0 for that date and
// makes it current (doc+0x76d04 = 3, title "Transit"). So the grid shows ONE
// set of bodies - natal by default, the transit chart once one is chosen -
// while the special-nakshatra table always uses the natal chart.
//
// 9x9 grid (cell size = client/9; arrays at view+0xd0 (special-point bytes)
// and view+0x124 (highlight ints) are indexed [x*9 + y]); in the tables below
// row = y (0 = top) and col = x (0 = left). JHora draws North at the top:
//   stars  (FUN_00471cd0 locals 0x224[k] = row, [0x1c+k] = col; names from
//          the 28-name table *0x8a29a0 = Aswi..Reva incl. Abhi), colour SBCViewNakshatra
//   vowels a aa i ii u uu ri rii lu luu e ai o au am ah + a (strings
//          0x57e164.., 17 entries, local_2c4), colour SBCViewVowel
//   consonants v k h d m t~ p r t n y bh j kh g s d ch l (local_280, 19), SBCViewConsonant
//   rasis  (*0x8a2948 names), SBCViewRasi
//   tithi groups Nanda Bhadra Jaya Rikta Poorna (0x57e188..0x57e168), upper half of the cell
//   weekdays Sun..Sat (0x8a2968), lower part of the cell (Tue/Wed shifted 5/8 down)
// Bodies (0x4722xx loop): bodies 0..9 (As, Su..Ke) of the current chart in the
// cell of their 28-scheme nakshatra (chart+0x1705+b); the n-th body of a star
// is offset (x, y) = ([8,8,2,2,2,8][n%6], [8,12,8,12,4,4][n%6]) / 16 cell;
// label "%s" or "(%s)" when retrograde (retro byte chart+0x108+0x30b).
//
// Table right of the grid ("Nakshatra" / "From Moon" / "From Lagna", 0x4733cc..):
// 11 special nakshatras (names 0x8a1f84: Janma .. Maanasa), offsets 0x591cc8
// = [1,10,18,16,4,7,12,28,19,22,25] counted (28-star scheme when byte
// 0x59234b = 1, the default) from the natal Moon (chart+0x1707) and lagna
// (chart+0x1705) stars.
//
// Highlights (state codes as stored in view+0x124: 1 = SBCViewHighlightFrom,
// 2 = SBCViewHighlightTo; body colours view+0x268[b]: 3 = 0xfa0a78 graha
// drishti, 4 = 0x500afa latta). The selected box is view+0x290 (x) / +0x294 (y),
// initially (4,4) (OnUpdate 0x471b70); a left click clears all (0x473a00).
//   32961 FROM this star  FUN_00474490 -> sarvatobhadraVedhasFrom
//   32963 ON this box     FUN_00473e60 -> sarvatobhadraVedhasOn
//   33249 graha drishti   FUN_00474000 -> grahaDrishtiOn
//   33250 lattas          FUN_00474270 -> lattasOn
//   33253 vedhas+aspects+lattas = 0x473e60 + 0x474000 + 0x474270 (FUN_00474410)
import { NAK28, SIGNS } from '../zodiac';
import { planetBodies, nakshatra28Of, type ChakraBody, type ChakraChart } from './common';

export type SbcKind = 'nakshatra' | 'vowel' | 'consonant' | 'rasi' | 'tithi';

export interface SbcCell {
  row: number;
  col: number;
  /** main text (star / letter / sign / tithi group) */
  label: string;
  kind: SbcKind;
  /** index into NAK28 for star cells */
  star?: number;
  /** 0 = Aries for rasi cells */
  sign?: number;
  /** 0 Nanda, 1 Bhadra, 2 Jaya, 3 Rikta, 4 Poorna for tithi cells */
  tithiGroup?: number;
  /** weekdays (0 = Sunday) drawn in a tithi cell */
  weekdays?: number[];
  bodies: ChakraBody[];
}

export const SBC_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SBC_TITHI_GROUPS = ['Nanda', 'Bhadra', 'Jaya', 'Rikta', 'Poorna'];

/** [row, col] of NAK28 star k (FUN_00471cd0 local_224). */
export const SBC_STAR_CELLS: [number, number][] = [
  [0, 6], [0, 7], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 8], [7, 8], [8, 7], [8, 6], [8, 5], [8, 4], [8, 3],
  [8, 2], [8, 1], [7, 0], [6, 0], [5, 0], [4, 0], [3, 0], [2, 0], [1, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5],
];
/** Vowels and their cells (local_2c4, 17 entries; the last 'a' sits in the East consonant row). */
export const SBC_VOWELS: [string, number, number][] = [
  ['a', 0, 8], ['aa', 8, 8], ['i', 8, 0], ['ii', 0, 0], ['u', 1, 7], ['uu', 7, 7], ['ri', 7, 1], ['rii', 1, 1],
  ['lu', 2, 6], ['luu', 6, 6], ['e', 6, 2], ['ai', 2, 2], ['o', 3, 5], ['au', 5, 5], ['am', 5, 3], ['ah', 3, 3], ['a', 2, 7],
];
/** Consonants (local_280, 19 entries). */
export const SBC_CONSONANTS: [string, number, number][] = [
  ['v', 3, 7], ['k', 4, 7], ['h', 5, 7], ['d', 6, 7], ['m', 7, 6], ['t~', 7, 5], ['p', 7, 4], ['r', 7, 3], ['t', 7, 2],
  ['n', 6, 1], ['y', 5, 1], ['bh', 4, 1], ['j', 3, 1], ['kh', 2, 1], ['g', 1, 2], ['s', 1, 3], ['d', 1, 4], ['ch', 1, 5], ['l', 1, 6],
];
/** [row, col] of Aries..Pisces. */
export const SBC_RASI_CELLS: [number, number][] = [
  [2, 5], [3, 6], [4, 6], [5, 6], [6, 5], [6, 4], [6, 3], [5, 2], [4, 2], [3, 2], [2, 3], [2, 4],
];
/** [row, col] of Nanda, Bhadra, Jaya, Rikta, Poorna. */
export const SBC_TITHI_CELLS: [number, number][] = [[4, 5], [5, 4], [4, 3], [3, 4], [4, 4]];
/** [row, col] of Sunday..Saturday. */
export const SBC_WEEKDAY_CELLS: [number, number][] = [[4, 5], [5, 4], [4, 5], [5, 4], [4, 3], [3, 4], [4, 4]];

/** Sub-cell offset (sixteenths of a cell) of the n-th body in a star cell. */
export const SBC_BODY_OFFSETS: [number, number][] = [[8, 8], [8, 12], [2, 8], [2, 12], [2, 4], [8, 4]];

export const SBC_SPECIAL_NAKSHATRAS: [string, number][] = [
  ['Janma', 1], ['Karma', 10], ['Samudayika', 18], ['Sanghatika', 16], ['Jaati', 4], ['Naidhana', 7],
  ['Desa', 12], ['Abhisheka', 28], ['Aadhaana', 19], ['Vainasika', 22], ['Maanasa', 25],
];

export interface SbcSpecialRow { name: string; fromMoon: string; fromLagna: string }

export interface Sarvatobhadra {
  /** 81 cells, row-major (row 0 = top) */
  cells: SbcCell[];
  /** whether the bodies come from the transit chart */
  transit: boolean;
  /** the "Nakshatra / From Moon / From Lagna" table (natal chart) */
  special: SbcSpecialRow[];
}

/** NAK28 index of the star in a cell, or -1 (FUN_00474cd0's role). */
export function sbcStarAt(row: number, col: number): number {
  return SBC_STAR_CELLS.findIndex(([r, c]) => r === row && c === col);
}

/** The static grid without bodies. */
export function sarvatobhadraGrid(): SbcCell[] {
  const grid: (SbcCell | null)[] = Array(81).fill(null);
  const put = (row: number, col: number, cell: Omit<SbcCell, 'row' | 'col' | 'bodies'>) => {
    grid[row * 9 + col] = { row, col, ...cell, bodies: [] };
  };
  SBC_STAR_CELLS.forEach(([r, c], k) => put(r, c, { label: NAK28[k], kind: 'nakshatra', star: k }));
  for (const [l, r, c] of SBC_VOWELS) put(r, c, { label: l, kind: 'vowel' });
  for (const [l, r, c] of SBC_CONSONANTS) put(r, c, { label: l, kind: 'consonant' });
  SBC_RASI_CELLS.forEach(([r, c], s) => put(r, c, { label: SIGNS[s], kind: 'rasi', sign: s }));
  SBC_TITHI_CELLS.forEach(([r, c], t) => put(r, c, {
    label: SBC_TITHI_GROUPS[t], kind: 'tithi', tithiGroup: t,
    weekdays: SBC_WEEKDAY_CELLS.map(([wr, wc], w) => (wr === r && wc === c ? w : -1)).filter((w) => w >= 0),
  }));
  return grid.map((g, i) => {
    if (!g) throw new Error(`sarvatobhadra: cell ${i} unassigned`);
    return g;
  });
}

/** Tithi group (0 Nanda .. 4 Poorna) of a tithi index 0..29. */
export const tithiGroupOf = (tithi: number) => tithi % 5;

export function sarvatobhadra(chart: ChakraChart, transit?: ChakraChart | null): Sarvatobhadra {
  const cells = sarvatobhadraGrid();
  const cur = transit ?? chart;
  for (const b of planetBodies(cur, !!transit)) {
    const [r, c] = SBC_STAR_CELLS[nakshatra28Of(b.lon)];
    cells[r * 9 + c].bodies.push(b);
  }
  const moon = nakshatra28Of(chart.positions.grahas.Moon.lon);
  const lagna = nakshatra28Of(chart.positions.ascendant);
  const special = SBC_SPECIAL_NAKSHATRAS.map(([name, n]) => ({
    name, fromMoon: NAK28[(moon + n - 1) % 28], fromLagna: NAK28[(lagna + n - 1) % 28],
  }));
  return { cells, transit: !!transit, special };
}

/** A highlighted cell: state 1 = "from" colour, 2 = "to" colour (view+0x124). */
export interface SbcMark { row: number; col: number; state: 1 | 2 }

/** The straight/diagonal line test shared by 0x474490 and 0x473e60 (x = col, y = row). */
function onLine(r0: number, c0: number, r: number, c: number): boolean {
  return (c0 === c && c0 !== 0 && c0 !== 8) || (r0 === r && r0 !== 0 && r0 !== 8)
    || c0 - c === r0 - r || c0 - c === r - r0;
}

/**
 * "Highlight aspects (vedhas) FROM this star" (FUN_00474490): every cell on the
 * straight line across (unless the source lies in the outer row/column) and on
 * both diagonals; a corner vowel is also hit by the two stars next to it. The
 * source cell gets state 1, the aspected cells state 2.
 */
export function sarvatobhadraVedhasFrom(row: number, col: number): SbcMark[] {
  const out: SbcMark[] = [];
  for (let c = 0; c < 9; c++) for (let r = 0; r < 9; r++) {
    let hit = onLine(row, col, r, c);
    if (c === 0 && r === 0 && row + col === 1) hit = true;
    if (c === 0 && r === 8 && col - row === -7) hit = true;
    if (c === 8 && r === 0 && col - row === 7) hit = true;
    if (c === 8 && r === 8 && row + col === 15) hit = true;
    if (hit) out.push({ row: r, col: c, state: 2 });
  }
  const self = out.find((m) => m.row === row && m.col === col);
  if (self) self.state = 1; else out.push({ row, col, state: 1 });
  return out;
}

/**
 * "Highlight aspects (vedhas) ON this box" (FUN_00473e60): the stars (outer
 * ring, corners excluded) whose vedha lines pass through the box get state 1;
 * the box itself state 2.
 */
export function sarvatobhadraVedhasOn(row: number, col: number): SbcMark[] {
  const out: SbcMark[] = [];
  for (let c = 0; c < 9; c++) for (let r = 0; r < 9; r++) {
    let hit = onLine(row, col, r, c);
    if (col === 0 && row === 0 && r + c === 1) hit = true;
    if (col === 8 && row === 0 && c - r === 7) hit = true;
    if (col === 8 && row === 8 && r + c === 15) hit = true;
    if (col === 0 && row === 8 && c - r === -7) hit = true;
    const outer = c === 0 || c === 8 || r === 0 || r === 8;
    const corner = (c === 0 || c === 8) && (r === 0 || r === 8);
    if (hit && outer && !corner) out.push({ row: r, col: c, state: 1 });
  }
  const self = out.find((m) => m.row === row && m.col === col);
  if (self) self.state = 2; else out.push({ row, col, state: 2 });
  return out;
}

/** Nakshatra drishti counts (1 = own star) of Sun..Saturn (FUN_00474000 local_c8). */
export const SBC_GRAHA_DRISHTI: number[][] = [[14, 15], [14, 15], [1, 3, 7, 8, 15], [1, 15], [10, 15, 19], [1, 15], [3, 5, 15, 19]];
/** Latta counts and directions of Sun..Rahu (FUN_00474270 local_50). */
export const SBC_LATTAS: [number, 1 | -1][] = [[12, 1], [22, -1], [3, 1], [7, -1], [6, 1], [5, -1], [8, 1], [9, -1]];

/** Body indices (1..7) of the current chart whose fixed nakshatra drishti falls on the star in this cell. */
export function grahaDrishtiOn(cur: ChakraChart, row: number, col: number): number[] {
  const star = sbcStarAt(row, col);
  if (star < 0) return [];
  const bodies = planetBodies(cur);
  return SBC_GRAHA_DRISHTI.flatMap((offs, i) => {
    const s = nakshatra28Of(bodies[i + 1].lon);
    return offs.some((n) => (n + 27 + s) % 28 === star) ? [i + 1] : [];
  });
}

/** Body indices (1..8) of the current chart whose latta falls on the star in this cell. */
export function lattasOn(cur: ChakraChart, row: number, col: number): number[] {
  const star = sbcStarAt(row, col);
  if (star < 0) return [];
  const bodies = planetBodies(cur);
  return SBC_LATTAS.flatMap(([n, d], i) => {
    const s = nakshatra28Of(bodies[i + 1].lon);
    return ((n - 1) * d + 56 + s) % 28 === star ? [i + 1] : [];
  });
}
