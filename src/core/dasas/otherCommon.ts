// Shared pieces of JHora 8.0's "Other dasas" builders (dispatcher FUN_00408d90,
// cases 0x3d..0x4a) and of the generic period engine FUN_00401c20 that turns a
// builder's tables into periods:
//  - maha dasas: ids at obj+0x78ab0, years at obj+0x8f8e8, count obj+0x78aa8;
//    they start at birth, or (obj+0x8fa08 set) at birth minus the elapsed part
//    (1 - obj+0x8fa10) of the first dasa's years;
//  - sub-periods are keyed by the parent's id: ids at obj+0x78b40 + id*0x90.
//    Their share of the parent is, by obj flags, either
//      0x8fa18: 1 / (obj+0x78aac) for every entry (equal division),
//      0x8fa8c: explicit fractions obj+0x8fdf0 + id*0x120 (count 0x8fa90+id*4),
//      neither: years[k] / sum(years[0..0x78aac-1]) of the maha dasa whose id
//               is the sub-period's id (the "proportional" rule);
//    deeper levels re-use the same per-id tables, so a sub-period with id X is
//    divided exactly like a maha dasa of X.
//  - JHora body ids: 0 lagna, 1 Sun .. 7 Saturn, 8 Rahu, 9 Ketu; the dasa
//    labels come from the short-name table 0x8a4350 ("Asc", "Sun", ...).
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { SIGNS } from '../zodiac';
import { PLANETS, sortByStrength, strongerSignDignityFirst, type VargaCtx } from '../signStrength';
import { strongerByDignity } from '../deities';

export const mod12 = (x: number) => ((x % 12) + 12) % 12;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

/** JHora body ids (0 = lagna). */
export const BODY: (Graha | null)[] = [null, 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
export const bodyId = (g: Graha) => BODY.indexOf(g);

/** A period labelled with a JHora body id (0 prints "Asc"). */
export const bodyPeriod = (id: number, start: number, end: number): Period =>
  id === 0 ? { lord: 'Sun', label: 'Asc', start, end } : { lord: BODY[id]!, start, end };
/** A period labelled with a sign. */
export const signPeriod = (s: number, start: number, end: number): Period => ({ lord: 'Sun', label: SIGNS[mod12(s)], start, end });

export interface SubPeriod { id: number; frac: number }

export interface DasaTables {
  /** maha dasas in order */
  mds: { id: number; years: number }[];
  /** dasa years of the first maha dasa already gone at birth */
  elapsed?: number;
  /** sub-periods of a period with this id */
  subs: (id: number) => SubPeriod[];
  /** period object for an id */
  make: (id: number, start: number, end: number) => Period;
}

/** FUN_00401c20's expansion of a builder's tables, `levels` deep. */
export function expandDasa(t: DasaTables, levels: number): Period[] {
  const split = (p: Period, id: number, depth: number): Period => {
    if (depth <= 0) return p;
    const len = p.end - p.start;
    let s = p.start;
    const children = t.subs(id).map((c) => {
      const q = t.make(c.id, s, s + len * c.frac);
      s = q.end;
      return split(q, c.id, depth - 1);
    });
    return { ...p, children };
  };
  let start = -(t.elapsed ?? 0);
  return t.mds.map((m) => {
    const p = t.make(m.id, start, start + m.years);
    start += m.years;
    return split(p, m.id, levels - 1);
  });
}

/** The proportional rule: fraction of each id = its years over the total of the first `count` maha dasas. */
export function yearFractions(mds: { id: number; years: number }[], count: number): (id: number) => number {
  const first = mds.slice(0, count);
  const total = first.reduce((a, m) => a + m.years, 0);
  const f = new Map<number, number>();
  for (const m of first) f.set(m.id, m.years / total);
  return (id) => f.get(id) ?? 0;
}

/**
 * Planets of the twelve signs from `from` taken kendras, panaparas, apoklimas
 * (1/4/7/10, 2/5/8/11, 3/6/9/12 in direction `dir`), each group sorted by
 * FUN_004ab650 mode 2 (FUN_004abbb0) and the planets of a sign by dignity
 * (FUN_004ab730 / FUN_004ac7d0), as Moola, Tara, AK Kendradi and Naisargika do.
 */
export function kendradiPlanets(from: number, dir: 1 | -1, ctx: VargaCtx): Graha[] {
  const signs = Array.from({ length: 12 }, (_, u) => mod12(from + dir * ((u % 4) * 3 + Math.floor(u / 4))));
  const stronger = (a: number, b: number) => strongerSignDignityFirst(a, b, ctx);
  const ordered = [0, 4, 8].flatMap((i) => sortByStrength(signs.slice(i, i + 4), stronger));
  return ordered.flatMap((s) => sortByStrength(PLANETS.filter((g) => ctx.sign(g) === s), (p, q) => strongerByDignity(p, q, ctx)));
}

/** Tithi lords (0x591cf4) as body ids: Sun..Rahu, Sun..Saturn, Sun..Rahu, Sun..Venus, Rahu (Amavasya). */
export const TITHI_LORD = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 8];

/**
 * Tithi of the k-th harmonic (FUN_004a4110 / FUN_004a41b0, stored for k = 0..35
 * at chart+0x12034 / +0x120c8 by FUN_004a4270): d = ((Moon - Sun) * (k + 1)) mod
 * 360, index = trunc(d / 12), remaining fraction = (12 (index + 1) - d) / 12.
 */
export function tithiOf(chart: Chart, k = 0): { index: number; remaining: number } {
  const g = chart.positions.grahas;
  const d = norm360(norm360(g.Moon.lon - g.Sun.lon) * (k + 1));
  const index = Math.trunc(d / 12);
  return { index, remaining: (12 * (index + 1) - d) / 12 };
}

/** Yoga (FUN_004a4270 -> chart+0x123b0 / +0x123a0): x = ((Moon + Sun) mod 360) * 0.075. */
export function yogaOf(chart: Chart): { index: number; remaining: number } {
  const g = chart.positions.grahas;
  const x = norm360(g.Moon.lon + g.Sun.lon) * 0.07500000000000001;
  const index = Math.trunc(x);
  return { index, remaining: 1 - (x - index) };
}

/**
 * Karana (FUN_004a4270 -> chart+0x123b4 / +0x123a8): n = trunc((Moon - Sun) / 6);
 * id 10 (Kimstughna) for n = 0, the seven movable karanas 0..6 (Bava..Vishti)
 * for n = 1..56, then 7 Shakuni, 8 Chatushpada, 9 Naga. The remaining part is
 * twice the tithi's remaining fraction, less one when that exceeds 1.
 */
export function karanaOf(chart: Chart): { id: number; remaining: number } {
  const g = chart.positions.grahas;
  const n = Math.trunc(norm360(g.Moon.lon - g.Sun.lon) / 6);
  const id = n === 0 ? 10 : n <= 56 ? (n - 1) % 7 : n - 50;
  const r = 2 * tithiOf(chart, 0).remaining;
  return { id, remaining: r > 1 ? r - 1 : r };
}

/**
 * The seeded graha cycles (Tithi Ashtottari, Yoga Vimsottari, Karana
 * Chaturaseeti, Tithi Yogini): `count` maha dasas running round `cycle` from
 * index `first`, the first one reduced to its `remaining` fraction (obj+0x8fa08
 * set); antardasas go round the same cycle from the dasa lord - or from the
 * lord after it (`adFromNext`, ending with the dasa lord) - in proportion to
 * the years over one full cycle.
 */
export function seededCycleDasa(cycle: [Graha, number][], first: number, remaining: number, count: number, adFromNext: boolean, levels: number): Period[] {
  const n = cycle.length;
  const ids = cycle.map(([g]) => bodyId(g));
  const total = cycle.reduce((a, [, y]) => a + y, 0);
  const mds = Array.from({ length: count }, (_, i) => ({ id: ids[(first + i) % n], years: cycle[(first + i) % n][1] }));
  const subs = (id: number) => {
    const u = ids.indexOf(id) + (adFromNext ? 1 : 0);
    return ids.map((_, j) => ({ id: ids[(u + j) % n], frac: cycle[(u + j) % n][1] / total }));
  };
  return expandDasa({ mds, elapsed: (1 - remaining) * mds[0].years, subs, make: bodyPeriod }, levels);
}

/** Index in `cycle` of the planet with JHora body id `id`. */
export const cycleIndex = (cycle: [Graha, number][], id: number) => cycle.findIndex(([g]) => bodyId(g) === id);
