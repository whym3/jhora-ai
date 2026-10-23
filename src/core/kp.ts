// KP (Krishnamurti) star lord and sub-lords: each nakshatra (13°20') is divided
// among the nine Vimsottari lords in dasa-year proportion, starting from the
// star's own lord; each sub is divided the same way again, and so on.
import type { Graha } from './positions';
import { NAK_LORD, VIMSOTTARI_YEARS } from './lords';

const NAK_SPAN = 360 / 27;
const TOTAL = 120;

/** Lords of the nakshatra and `levels` sub-levels for a longitude. */
export function kpLords(lon: number, levels = 6): Graha[] {
  let start = Math.floor(lon / NAK_SPAN) * NAK_SPAN;
  let span = NAK_SPAN;
  let lordIdx = Math.floor(lon / NAK_SPAN) % 9;
  const out: Graha[] = [NAK_LORD[lordIdx]];
  for (let level = 1; level < levels; level++) {
    let pos = start;
    for (let k = 0; k < 9; k++) {
      const idx = (lordIdx + k) % 9;
      const sub = span * VIMSOTTARI_YEARS[NAK_LORD[idx]] / TOTAL;
      if (lon < pos + sub || k === 8) {
        out.push(NAK_LORD[idx]);
        start = pos; span = sub; lordIdx = idx;
        break;
      }
      pos += sub;
    }
  }
  return out;
}
