// Ashtakavarga as JHora 8.0 computes it (FUN_00498570): bhinnashtakavargas of
// the lagna and the seven planets, sarvashtakavarga, the trikona and
// ekadhipatya reductions and the sodhya pindas.
//
// The bindu table is JHora's own (decoded from the routine's stack table). It
// follows BPHS except for three places governed by the six
// AshtakaVargaCalculation options, which pick one of two houses each:
//   Moon from Moon 9th (option 0) or Moon from Mars 9th (option 1 off),
//   Moon from Jupiter 2nd (option 2) or 12th (option 3 off),
//   Venus from Mars 4th (option 4) or 5th (option 5 off).
// All six options are on by default, so the first house of each pair counts.
import type { Graha } from './positions';

export type AvBody = 'Lagna' | 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn';
export const AV_BODIES: AvBody[] = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
export const AV_PLANETS: Graha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

/** RULES[owner][contributor]: houses (1-based, from the contributor) where it gives a bindu. */
const RULES: Record<AvBody, Record<AvBody, number[]>> = {
  Lagna: { Lagna: [3, 6, 10, 11], Sun: [3, 4, 6, 10, 11, 12], Moon: [3, 6, 10, 11, 12], Mars: [1, 3, 6, 10, 11], Mercury: [1, 2, 4, 6, 8, 10, 11], Jupiter: [1, 2, 4, 5, 6, 7, 9, 10, 11], Venus: [1, 2, 3, 4, 5, 8, 9], Saturn: [1, 3, 4, 6, 10, 11] },
  Sun: { Lagna: [3, 4, 6, 10, 11, 12], Sun: [1, 2, 4, 7, 8, 9, 10, 11], Moon: [3, 6, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11], Mercury: [3, 5, 6, 9, 10, 11, 12], Jupiter: [5, 6, 9, 11], Venus: [6, 7, 12], Saturn: [1, 2, 4, 7, 8, 9, 10, 11] },
  Moon: { Lagna: [3, 6, 10, 11], Sun: [3, 6, 7, 8, 10, 11], Moon: [1, 3, 6, 7, 9, 10, 11], Mars: [2, 3, 5, 6, 10, 11], Mercury: [1, 3, 4, 5, 7, 8, 10, 11], Jupiter: [1, 2, 4, 7, 8, 10, 11], Venus: [3, 4, 5, 7, 9, 10, 11], Saturn: [3, 5, 6, 11] },
  Mars: { Lagna: [1, 3, 6, 10, 11], Sun: [3, 5, 6, 10, 11], Moon: [3, 6, 11], Mars: [1, 2, 4, 7, 8, 10, 11], Mercury: [3, 5, 6, 11], Jupiter: [6, 10, 11, 12], Venus: [6, 8, 11, 12], Saturn: [1, 4, 7, 8, 9, 10, 11] },
  Mercury: { Lagna: [1, 2, 4, 6, 8, 10, 11], Sun: [5, 6, 9, 11, 12], Moon: [2, 4, 6, 8, 10, 11], Mars: [1, 2, 4, 7, 8, 9, 10, 11], Mercury: [1, 3, 5, 6, 9, 10, 11, 12], Jupiter: [6, 8, 11, 12], Venus: [1, 2, 3, 4, 5, 8, 9, 11], Saturn: [1, 2, 4, 7, 8, 9, 10, 11] },
  Jupiter: { Lagna: [1, 2, 4, 5, 6, 7, 9, 10, 11], Sun: [1, 2, 3, 4, 7, 8, 9, 10, 11], Moon: [2, 5, 7, 9, 11], Mars: [1, 2, 4, 7, 8, 10, 11], Mercury: [1, 2, 4, 5, 6, 9, 10, 11], Jupiter: [1, 2, 3, 4, 7, 8, 10, 11], Venus: [2, 5, 6, 9, 10, 11], Saturn: [3, 5, 6, 12] },
  Venus: { Lagna: [1, 2, 3, 4, 5, 8, 9, 11], Sun: [8, 11, 12], Moon: [1, 2, 3, 4, 5, 8, 9, 11, 12], Mars: [3, 4, 6, 9, 11, 12], Mercury: [3, 5, 6, 9, 11], Jupiter: [5, 8, 9, 10, 11], Venus: [1, 2, 3, 4, 5, 8, 9, 10, 11], Saturn: [3, 4, 5, 8, 9, 10, 11] },
  Saturn: { Lagna: [1, 3, 4, 6, 10, 11], Sun: [1, 2, 4, 7, 8, 10, 11], Moon: [3, 6, 11], Mars: [3, 5, 6, 10, 11, 12], Mercury: [6, 8, 9, 10, 11, 12], Jupiter: [5, 6, 11, 12], Venus: [6, 11, 12], Saturn: [3, 5, 6, 11] },
};

/** The option-dependent cells: [owner, contributor, house when on, house when off]. */
const OPTION_CELLS: [AvBody, AvBody, number][] = [
  ['Moon', 'Moon', 9], ['Moon', 'Mars', 9], ['Moon', 'Jupiter', 2], ['Moon', 'Jupiter', 12], ['Venus', 'Mars', 4], ['Venus', 'Mars', 5],
];

/**
 * JHora's AshtakaVargaCalculation flags (all on by default). Even flags add
 * their cell when on; odd flags add theirs when off.
 */
export type AvOptions = [boolean, boolean, boolean, boolean, boolean, boolean];
export const AV_DEFAULT_OPTIONS: AvOptions = [true, true, true, true, true, true];

function rulesFor(opts: AvOptions): Record<AvBody, Record<AvBody, number[]>> {
  const r = Object.fromEntries(AV_BODIES.map((b) => [b, Object.fromEntries(AV_BODIES.map((c) => [c, RULES[b][c].slice()]))])) as Record<AvBody, Record<AvBody, number[]>>;
  OPTION_CELLS.forEach(([b, c, h], i) => {
    const on = i % 2 === 0 ? opts[i] : !opts[i];
    const list = r[b][c].filter((x) => x !== h);
    if (on) list.push(h);
    r[b][c] = list.sort((x, y) => x - y);
  });
  return r;
}

const RASI_MULT = [7, 10, 8, 4, 10, 5, 7, 8, 9, 5, 11, 12];
const GRAHA_MULT: Record<string, number> = { Sun: 5, Moon: 5, Mars: 8, Mercury: 5, Jupiter: 10, Venus: 7, Saturn: 5 };

/** Bindus per sign (Aries first) for each body, from the bodies' signs. */
export function bhinnashtakavargas(sign: (b: AvBody) => number, opts: AvOptions = AV_DEFAULT_OPTIONS): Record<AvBody, number[]> {
  const rules = rulesFor(opts);
  const out = {} as Record<AvBody, number[]>;
  for (const body of AV_BODIES) {
    const bav = new Array(12).fill(0);
    for (const c of AV_BODIES) for (const h of rules[body][c]) bav[(sign(c) + h - 1) % 12]++;
    out[body] = bav;
  }
  return out;
}

/** Sum of the seven planets' BAVs (JHora's default leaves the lagna's out). */
export function sarvashtakavarga(bav: Record<AvBody, number[]>, withLagna = false): number[] {
  const bodies = withLagna ? AV_BODIES : AV_BODIES.slice(1);
  return Array.from({ length: 12 }, (_, s) => bodies.reduce((a, b) => a + bav[b][s], 0));
}

/** Trikona reduction: each fire/earth/air/water triad loses its minimum; three equal values all become 0. */
export function trikonaSodhana(v: number[]): number[] {
  const r = v.slice();
  for (let s = 0; s < 4; s++) {
    const t = [s, s + 4, s + 8];
    const vals = t.map((i) => r[i]);
    if (vals[0] === vals[1] && vals[1] === vals[2]) { t.forEach((i) => (r[i] = 0)); continue; }
    const m = Math.min(...vals);
    t.forEach((i) => (r[i] -= m));
  }
  return r;
}

/** Sign pairs with one lord, in the order JHora reduces them (FUN_0049a210). */
const PAIRS: [number, number][] = [[0, 7], [1, 6], [2, 5], [8, 11], [9, 10]];

/**
 * Ekadhipatya reduction (FUN_0049a210) for the pairs owned by Mars, Venus,
 * Mercury, Jupiter and Saturn. Nothing changes when either count is 0 or both
 * signs are occupied. Neither occupied: equal counts both become 0, otherwise
 * both take the smaller one. One occupied: the other takes the occupied
 * sign's count if it was larger, else becomes 0.
 */
export function ekadhipatyaSodhana(v: number[], occupied: (s: number) => boolean): number[] {
  const r = v.slice();
  for (const [a, b] of PAIRS) {
    const oa = occupied(a), ob = occupied(b);
    if (r[a] === 0 || r[b] === 0 || (oa && ob)) continue;
    if (!oa && !ob) {
      if (r[a] === r[b]) { r[a] = 0; r[b] = 0; } else { const m = Math.min(r[a], r[b]); r[a] = m; r[b] = m; }
    } else if (ob) r[a] = r[a] > r[b] ? r[b] : 0;
    else r[b] = r[b] > r[a] ? r[a] : 0;
  }
  return r;
}

export interface SodhyaPinda { rasi: number; graha: number; total: number }

/** Rasi and graha pindas of a reduced BAV; the graha pinda weighs the signs holding the seven planets. */
export function sodhyaPinda(reduced: number[], sign: (g: Graha) => number): SodhyaPinda {
  const rasi = reduced.reduce((a, x, s) => a + x * RASI_MULT[s], 0);
  let graha = 0;
  for (const g of AV_PLANETS) graha += reduced[sign(g)] * GRAHA_MULT[g];
  return { rasi, graha, total: rasi + graha };
}

export interface Ashtakavarga {
  bav: Record<AvBody, number[]>;
  sav: number[];
  reduced: Record<AvBody, number[]>;
  pindas: Record<AvBody, SodhyaPinda>;
}

/** Full AV of a chart given each body's sign in the chosen varga. */
export function ashtakavarga(sign: (b: AvBody) => number, opts: AvOptions = AV_DEFAULT_OPTIONS): Ashtakavarga {
  const bav = bhinnashtakavargas(sign, opts);
  const occupied = (s: number) => AV_PLANETS.some((g) => sign(g as AvBody) === s);
  const reduced = {} as Record<AvBody, number[]>;
  const pindas = {} as Record<AvBody, SodhyaPinda>;
  for (const b of AV_BODIES) {
    reduced[b] = ekadhipatyaSodhana(trikonaSodhana(bav[b]), occupied);
    pindas[b] = sodhyaPinda(reduced[b], (g) => sign(g as AvBody));
  }
  return { bav, sav: sarvashtakavarga(bav), reduced, pindas };
}

/**
 * Prastara (PAV) of one body: for each contributor (Lagna, Sun..Saturn) the
 * signs where it gives this body a bindu, as 0/1 per sign.
 */
export function prastara(owner: AvBody, sign: (b: AvBody) => number, opts: AvOptions = AV_DEFAULT_OPTIONS): Record<AvBody, number[]> {
  const rules = rulesFor(opts);
  const out = {} as Record<AvBody, number[]>;
  for (const c of AV_BODIES) {
    const row = new Array(12).fill(0);
    for (const h of rules[owner][c]) row[(sign(c) + h - 1) % 12] = 1;
    out[c] = row;
  }
  return out;
}
