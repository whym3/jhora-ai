// Vimsottari dasa: 120-year cycle of the nakshatra lords, started from the
// Moon's nakshatra with the balance of the running dasa.
// Options of FUN_0040beb0 (per dasa slot, nakshatra.ts NakOptions): NakshatraDasaShift
// (DAT_008a15a8[slot]) moves the counting star back, AntiZodiacalDasa (byte
// DAT_008a158c[slot]) runs the maha dasas backwards from the star's lord with the
// elapsed part of the star as the balance (obj+0x8fa10 = 1 - remaining), and
// NaksDasaADMethodPreference (DAT_008a160c[slot]) orders the sub-periods (FUN_004b3720).
import type { Graha } from '../positions';
import { NAK_LORD, VIMSOTTARI_YEARS } from '../lords';

export interface Period {
  lord: Graha;
  /** label shown instead of the lord (nakshatra or rasi dasas) */
  label?: string;
  start: number;
  end: number;
  children?: Period[];
}

const NAK = 360 / 27;

/**
 * FUN_004b3720: the cycle index of sub-period j of a period with cycle index i, by
 * NaksDasaADMethodPreference: 0 from the lord, 1 backwards from it, 2 from the next lord,
 * 3 backwards from the next, 4 from the previous, 5 backwards from the previous; j is
 * negated for an anti-zodiacal dasa.
 */
export function adIndex(i: number, j: number, n: number, method = 0, reverse = false): number {
  if (reverse) j = -j;
  const k = method === 1 ? i - j : method === 2 ? i + 1 + j : method === 3 ? i - j + 1 : method === 4 ? i - 1 + j : method === 5 ? i - j - 1 : i + j;
  return ((k % n) + n) % n;
}

export interface VimsottariOptions { shift?: number; adMethod?: number; reverse?: boolean }

/** Maha dasas (times in dasa years from birth), `levels` deep. */
export function vimsottari(moonLon: number, levels = 2, opts: VimsottariOptions = {}): Period[] {
  const n = Math.floor(moonLon / NAK);
  const frac = (moonLon - n * NAK) / NAK;
  const first = ((((n % 9) - (opts.shift ?? 0)) % 9) + 9) % 9;
  const reverse = !!opts.reverse;
  // the first dasa keeps the unelapsed part of the star (anti-zodiacal: the elapsed part)
  const start0 = -(reverse ? 1 - frac : frac) * VIMSOTTARI_YEARS[NAK_LORD[first]];
  const out: Period[] = [];
  let t = start0;
  for (let i = 0; i < 9; i++) {
    const lord = NAK_LORD[(((first + (reverse ? -i : i)) % 9) + 9) % 9];
    const len = VIMSOTTARI_YEARS[lord];
    out.push(subdivide({ lord, start: t, end: t + len }, levels - 1, opts));
    t += len;
  }
  return out;
}

/** Split a period among the nine lords (from its own lord by default), proportionally to their years. */
export function subdivide(p: Period, levels: number, opts: VimsottariOptions = {}): Period {
  if (levels <= 0) return p;
  const len = p.end - p.start;
  const i0 = NAK_LORD.indexOf(p.lord);
  const children: Period[] = [];
  let t = p.start;
  for (let i = 0; i < 9; i++) {
    const lord = NAK_LORD[adIndex(i0, i, 9, opts.adMethod, opts.reverse)];
    const sub = (len * VIMSOTTARI_YEARS[lord]) / 120;
    children.push(subdivide({ lord, start: t, end: t + sub }, levels - 1, opts));
    t += sub;
  }
  return { ...p, children };
}
