// Narayana dasa (Jaimini), with the rules JHora 8.0 applies by default:
//  - the dasas start from the stronger of lagna and the 7th;
//  - the sequence follows FUN_00414060's tables (rasiCommon
//    narayanaTypeSequence): movable signs go sign by sign, fixed signs every 6th
//    sign, dual signs take the trines and then move on; Saturn in the start sign
//    forces zodiacal sign-by-sign order, Ketu reverses the direction;
//  - years = signs counted from the dasa sign to its lord (forward for odd-
//    footed signs Ar..Ge and Li..Sg, backward for the others) minus one, 12 if
//    the lord is in the sign, +1 exalted, -1 debilitated; the second cycle is
//    12 minus the first;
//  - antardasas run sign by sign from the sign holding the lord of the stronger
//    of the dasa sign and its 7th, in that sign's parity direction with the
//    Saturn/Ketu flag of the stronger sign, each a twelfth of the dasa.
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { SIGNS } from '../zodiac';
import { DEBILITATION, EXALTATION, signLordJaimini, strongerSign, type VargaCtx } from '../signStrength';
import { strongerByDignity } from '../deities';
import { narayanaTypeSequence } from './rasiCommon';

const mod12 = (x: number) => ((x % 12) + 12) % 12;
const ODD_FOOTED = new Set([0, 1, 2, 6, 7, 8]);

export function narayanaYears(sign: number, ctx: VargaCtx): number {
  const lord: Graha = signLordJaimini(sign, ctx);
  const ls = ctx.sign(lord);
  if (ls === sign) return 12;
  let n = ODD_FOOTED.has(sign) ? mod12(ls - sign) : mod12(sign - ls);
  if (EXALTATION[lord] === ls) n += 1;
  if (DEBILITATION[lord] === ls) n -= 1;
  return mod12(n) === 0 && n !== 0 ? 12 : n;
}

export interface NarayanaDasa { title: string; periods: Period[] }

export function narayanaDasa(lagna: number, ctx: VargaCtx, varga = 'D-1', levels = 2): NarayanaDasa {
  const start = strongerSign(lagna, mod12(lagna + 6), ctx);
  const seq = narayanaTypeSequence(start, ctx);
  const first = seq.map((s) => narayanaYears(s, ctx));
  const periods: Period[] = [];
  let t = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    seq.forEach((s, i) => {
      const years = cycle === 0 ? first[i] : 12 - first[i];
      periods.push(narayanaAntardasas({ lord: 'Sun', label: SIGNS[s], start: t, end: t + years }, s, ctx, levels - 1));
      t += years;
    });
  }
  return { title: `Narayana Dasa of ${varga} chart (a versatile phalita rasi dasa)`, periods };
}

export function narayanaAntardasas(p: Period, sign: number, ctx: VargaCtx, levels: number): Period {
  if (levels <= 0) return p;
  const low = sign % 6;
  const strong = strongerSign(low, low + 6, ctx);
  const from = ctx.sign(signLordJaimini(strong, ctx));
  const dir = sequenceDirection(from, ctx, strong);
  const len = (p.end - p.start) / 12;
  const children = Array.from({ length: 12 }, (_, i) => {
    const s = mod12(from + dir * i);
    return narayanaAntardasas({ lord: 'Sun', label: SIGNS[s], start: p.start + i * len, end: p.start + (i + 1) * len }, s, ctx, levels - 1);
  });
  return { ...p, children };
}

/**
 * Parity direction of `sign` with the Saturn/Ketu flags of FUN_004ab2a0 for
 * `flagSign` (default the same sign): Saturn there forces forward, Ketu
 * reverses, both: the stronger by dignity decides.
 */
export function sequenceDirection(sign: number, ctx: VargaCtx, flagSign = sign): 1 | -1 {
  const dir: 1 | -1 = sign % 2 === 0 ? 1 : -1;
  const sat = ctx.sign('Saturn') === flagSign, ketu = ctx.sign('Ketu') === flagSign;
  const reversed = (dir === 1 ? -1 : 1) as 1 | -1;
  if (sat && ketu) return strongerByDignity('Saturn', 'Ketu', ctx) === 'Ketu' ? reversed : 1;
  if (sat) return 1;
  if (ketu) return reversed;
  return dir;
}
