// Vimsottari dasa: 120-year cycle of the nakshatra lords, started from the
// Moon's nakshatra with the balance of the running dasa.
import type { Graha } from '../positions';
import { NAK_LORD, VIMSOTTARI_YEARS } from '../lords';

export interface Period { lord: Graha; start: number; end: number; children?: Period[] }

const NAK = 360 / 27;

/** Maha dasas (times in dasa years from birth), `levels` deep. */
export function vimsottari(moonLon: number, levels = 2): Period[] {
  const n = Math.floor(moonLon / NAK);
  const frac = (moonLon - n * NAK) / NAK;
  const first = n % 9;
  const start0 = -frac * VIMSOTTARI_YEARS[NAK_LORD[first]];
  const out: Period[] = [];
  let t = start0;
  for (let i = 0; i < 9; i++) {
    const lord = NAK_LORD[(first + i) % 9];
    const len = VIMSOTTARI_YEARS[lord];
    out.push(subdivide({ lord, start: t, end: t + len }, levels - 1));
    t += len;
  }
  return out;
}

/** Split a period among the nine lords starting with its own lord, proportionally to their years. */
export function subdivide(p: Period, levels: number): Period {
  if (levels <= 0) return p;
  const len = p.end - p.start;
  const i0 = NAK_LORD.indexOf(p.lord);
  const children: Period[] = [];
  let t = p.start;
  for (let i = 0; i < 9; i++) {
    const lord = NAK_LORD[(i0 + i) % 9];
    const sub = (len * VIMSOTTARI_YEARS[lord]) / 120;
    children.push(subdivide({ lord, start: t, end: t + sub }, levels - 1));
    t += sub;
  }
  return { ...p, children };
}
