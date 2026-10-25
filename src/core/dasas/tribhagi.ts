// "Use Tribhagi variation" (menu 32971, FUN_00450840 toggles DAT_008a4b60, a session setting
// that is not saved in jhora.ini).
//
// FUN_00408d90, after the builder, when DAT_008a4b60 is set and the dasa shown is the nakshatra
// dasa of the pane (DAT_008a4b58 == DAT_008a4b5c) other than Kalachakra (2), Yogini (3) and
// Shattrimsa (5): " - Tribhagi variation" is appended to the title, the maha dasa count n becomes
// 3n and every maha dasa year is multiplied by 1/3 (0x546bf8), entries i, i+n and i+2n getting
// the same years; the owners repeat (Vimsottari: owner + n, + 2n, see below). The balance of the
// first dasa is taken from the reduced years too, so the first cycle is the normal dasa scaled by
// 1/3 and the cycle repeats twice more.
//
// Vimsottari (FUN_0040beb0 with DAT_008a4b60): obj+0x76d48/4a/4b are set, the owners are custom
// names: for k = 0..26 the lord (two-letter names 0x8a4684, "Ve") and the star (0x8a40a4, "Bhar")
// of the seed star + k (- k anti-zodiacally; the seed star before NakshatraDasaShift); maha dasa i
// has owner i, i + 9, i + 18 after the dispatcher. FUN_004013f0 labels an owner "Ve (Bhar)" at
// the maha dasa level (0x76d4b: the star only there) and "Ve" below. The antardasas of owner o are
// the custom owners (o mod 9 + j) mod 9 ((o - j) anti-zodiacally) for j = 0..8, NaksDasaADMethod
// being ignored, each lasting its share years / 120 of the period (FUN_00401c20 divides the first
// nine maha dasa years by their sum, 40).
// Not reproduced: on a Tajaka chart with ProgressDasaSeedInTajaka JHora adds the completed years to
// the star after building the names (0x40c2fd), so its labels keep the natal star; here the
// progressed seed names them.
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { NAK_LORD, VIMSOTTARI_YEARS } from '../lords';
import { NAKSHATRAS } from '../zodiac';

const NAK = 360 / 27;
const mod = (a: number, n: number) => ((a % n) + n) % n;

export const TRIBHAGI_SUFFIX = ' - Tribhagi variation';
/** Slots FUN_00408d90 leaves alone: Kalachakra, Yogini, Shattrimsa sama. */
export const TRIBHAGI_EXCLUDED: ReadonlySet<number> = new Set([2, 3, 5]);

/** JHora's two-letter planet names (0x8a4684, English names). */
export const PLANET_2: Record<Graha, string> = {
  Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

/** Scale period times by `k` and shift them by `dt` (dasa years), recursively. */
function scaleShift(p: Period, k: number, dt: number): Period {
  return { ...p, start: p.start * k + dt, end: p.end * k + dt, children: p.children?.map((c) => scaleShift(c, k, dt)) };
}

/** FUN_00408d90's Tribhagi tail for the other nakshatra dasas: the n maha dasas at 1/3, three times. */
export function tribhagi(periods: Period[]): Period[] {
  const T = periods.reduce((a, p) => a + (p.end - p.start), 0);
  return [0, 1, 2].flatMap((c) => periods.map((p) => scaleShift(p, 1 / 3, (c * T) / 3)));
}

export interface TribhagiVimsottariOptions {
  /** NakshatraDasaShift[0] */
  shift?: number;
  /** AntiZodiacalDasa[0] */
  reverse?: boolean;
}

/** Tribhagi Vimsottari (27 maha dasas of 40 years in all) from the seed longitude, `levels` deep. */
export function tribhagiVimsottari(seedLon: number, levels = 2, o: TribhagiVimsottariOptions = {}): Period[] {
  const star = Math.floor(seedLon / NAK);
  const frac = seedLon / NAK - star;
  const dir = o.reverse ? -1 : 1;
  const first = mod(star - (o.shift ?? 0), 27);
  // years of maha dasas 0..8 (full Vimsottari years; the dispatcher's 1/3 is applied below)
  const years = Array.from({ length: 9 }, (_, i) => VIMSOTTARI_YEARS[NAK_LORD[mod(first + dir * i, 27) % 9]]);
  const lordOf = (k: number) => NAK_LORD[mod(star + dir * k, 27) % 9];
  const sub = (p: Period, owner: number, depth: number): Period => {
    if (depth <= 0) return p;
    const len = p.end - p.start;
    let t = p.start;
    const children = Array.from({ length: 9 }, (_, j) => {
      const idx = mod(mod(owner, 9) + dir * j, 9);
      const q: Period = { lord: lordOf(idx), label: PLANET_2[lordOf(idx)], start: t, end: t + (len * years[idx]) / 120 };
      t = q.end;
      return sub(q, idx, depth - 1);
    });
    return { ...p, children };
  };
  // obj+0x8fa10: the part of the star left (anti-zodiacally the part elapsed)
  const remaining = o.reverse ? frac : 1 - frac;
  let t = -(1 - remaining) * (years[0] / 3);
  return Array.from({ length: 27 }, (_, k) => {
    const lord = lordOf(k);
    const y = years[k % 9] / 3;
    const p: Period = { lord, label: `${PLANET_2[lord]} (${NAKSHATRAS[mod(star + dir * k, 27)]})`, start: t, end: t + y };
    t += y;
    return sub(p, k, levels - 1);
  });
}
