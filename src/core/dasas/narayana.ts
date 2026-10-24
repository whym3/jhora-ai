// Narayana dasa (Jaimini), with the rules JHora 8.0 applies by default:
//  - the dasas start from the stronger of lagna and the 7th;
//  - the sequence runs zodiacally from an odd sign and backwards from an even
//    one (Saturn in the sign forces zodiacal, Ketu backwards); movable signs go
//    sign by sign, fixed signs every 6th sign, dual signs take the trines and
//    then move a kendra;
//  - years = signs counted from the dasa sign to its lord (forward for odd-
//    footed signs Ar..Ge and Li..Sg, backward for the others) minus one, 12 if
//    the lord is in the sign, +1 exalted, -1 debilitated; the second cycle is
//    12 minus the first;
//  - antardasas run sign by sign from the sign holding the dasa sign's lord,
//    zodiacally if that sign is odd and backwards if even (no Saturn/Ketu
//    exception here), each a twelfth of the dasa.
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { SIGNS } from '../zodiac';
import { DEBILITATION, EXALTATION, signLordJaimini, strongerSign, type VargaCtx } from '../signStrength';
import { strongerByDignity } from '../deities';

const mod12 = (x: number) => ((x % 12) + 12) % 12;
const ODD_FOOTED = new Set([0, 1, 2, 6, 7, 8]);

/** +1 zodiacal, -1 backwards for a sequence starting at `sign`. */
export function narayanaDirection(sign: number, ctx: VargaCtx): 1 | -1 {
  if (ctx.sign('Saturn') === sign) return 1;
  if (ctx.sign('Ketu') === sign) return -1;
  return sign % 2 === 0 ? 1 : -1;
}

/** The 12 dasa signs from `start` (movable / fixed / dual patterns). */
export function narayanaSequence(start: number, dir: 1 | -1): number[] {
  const kind = start % 3; // 0 movable, 1 fixed, 2 dual
  if (kind === 0) return Array.from({ length: 12 }, (_, i) => mod12(start + dir * i));
  if (kind === 1) return Array.from({ length: 12 }, (_, i) => mod12(start + dir * 5 * i));
  const out: number[] = [];
  for (let g = 0; g < 4; g++) for (let i = 0; i < 3; i++) out.push(mod12(start + dir * (3 * g - 4 * i)));
  return out;
}

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
  const seq = narayanaSequence(start, narayanaDirection(start, ctx));
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
