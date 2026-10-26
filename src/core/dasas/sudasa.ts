// Sudasa (Lakshmi's blessings) as JHora 8.0 builds it (FUN_004156d0):
//  - direction: zodiacal from an even-indexed Sree Lagna sign (Ar, Ge, ...),
//    backwards from an odd one; Saturn alone in that sign forces zodiacal,
//    Ketu alone reverses it, both: the stronger by dignity decides
//    (the flags of FUN_004ab2a0);
//  - the first dasa is the strongest kendra from Sree Lagna (FUN_004ab890 in a
//    knock-out SL, SL+3, SL+6, SL+9); the next groups start from the strongest
//    of g+1, g+4, g+7, g+10 of the previous group's start g. JHora does not
//    reduce g+1 modulo 12, so after a group starting in Pisces it compares
//    "sign 12": empty, lord = the lagna, movable, even;
//  - each group runs start, start+3*dir, start+6*dir, start+9*dir;
//  - years are Narayana dasa's; the first dasa only gets the part of Sree
//    Lagna's sign still to run, and the second cycle is 12 minus the first
//    (for the first sign: 12 minus its balance);
//  - antardasas (SudasaADOption, DAT_00592350, dialog 2049 "How to calculate antardasas in
//    Sudasa", 0x415a20..0x415b1d): from a sign f with base b, direction = parity of f with the
//    Saturn/Ketu flag of b, each a twelfth:
//      0 "Like in Narayana dasa": b = strong7 of the dasa sign, f = the sign of b's lord;
//      1 "Quadrants from dasa sign", 2 "Regular from dasa sign": b = f = the dasa sign;
//      3 "Quadrants from dasa sign or 7th", 4 (default) "Regular from dasa sign or 7th":
//        b = f = strong7 of the dasa sign;
//    "Quadrants" (1, 3) run f, f+3d, f+6d, f+9d, f+d, f+4d, ...; "Regular" sign by sign;
//  - "Start dasas from" of dialog 2049 (chart+0x17e3c, 0x415888) replaces the first group's
//    start only; the temporary strengths (overrides.ts) reach the lords, strong7 and the SK
//    flags, not FUN_004ab890's group comparisons.
import type { Period } from './vimsottari';
import { SIGNS } from '../zodiac';
import { aspectScore, DEBILITATION, EXALTATION, PLANETS, rasiAspects, signLordJaimini, strongerSign, type VargaCtx } from '../signStrength';
import { narayanaYears, sequenceDirection } from './narayana';
import { dasaLord, strong7 } from './rasiCommon';
import { startOverride } from './overrides';

const mod12 = (x: number) => ((x % 12) + 12) % 12;
export const SUDASA_TITLE = "Sudasa (phalita dasa showing Lakshmi's blessings)";

export interface SudasaCtx extends VargaCtx {
  lagnaSign: number;
  /** degrees of the lagna inside its sign */
  lagnaDegree: number;
}

const lordDegree = (s: number, ctx: VargaCtx) => {
  const l = signLordJaimini(s, ctx);
  return l === 'Rahu' || l === 'Ketu' ? 30 - ctx.degree(l) : ctx.degree(l);
};

/** FUN_004ab890, also accepting JHora's unreduced "sign 12" as the first argument. */
function stronger(a: number, b: number, ctx: SudasaCtx): number {
  if (a < 12) return strongerSign(a, b, ctx);
  if (PLANETS.some((g) => ctx.sign(g) === b)) return b;
  const sa = [ctx.sign('Mercury'), ctx.sign('Jupiter'), ctx.lagnaSign].filter((s) => rasiAspects(12, s)).length;
  const sb = aspectScore(b, ctx);
  if (sa > sb) return a;
  if (sb > sa) return b;
  if (PLANETS.some((g) => ctx.sign(g) === b && EXALTATION[g] === b)) return b;
  if (PLANETS.some((g) => ctx.sign(g) === b && DEBILITATION[g] === b)) return a;
  const pa = ctx.lagnaSign % 2 !== 0;
  const pb = ctx.sign(signLordJaimini(b, ctx)) % 2 !== b % 2;
  if (pa && !pb) return a;
  if (pb && !pa) return b;
  if (b % 3 > 0) return b;
  return lordDegree(b, ctx) > ctx.lagnaDegree ? b : a;
}

const best = (cands: number[], ctx: SudasaCtx) => cands.slice(1).reduce((acc, s) => stronger(acc, s, ctx), cands[0]);

const direction = (sign: number, ctx: VargaCtx) => sequenceDirection(sign, ctx);

export function sudasaSequence(sl: number, ctx: SudasaCtx): number[] {
  const dir = direction(sl, ctx);
  const g = best([sl, mod12(sl + 3), mod12(sl + 6), mod12(sl + 9)], ctx);
  const next = (g: number) => mod12(best([g + 1, mod12(g + 4), mod12(g + 7), mod12(g + 10)], ctx));
  const g2 = next(g), g3 = next(g2);
  const g1 = startOverride(ctx) ?? g;
  return [g1, g2, g3].flatMap((g) => [0, 3, 6, 9].map((k) => mod12(g + k * dir)));
}

/** SudasaADOption values (dialog 2049's combo). */
export type SudasaADOption = 0 | 1 | 2 | 3 | 4;
const QUADRANT_ROW = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11];

/** The antardasa signs of a Sudasa dasa sign (0x415a20). */
export function sudasaAntardasaSigns(sign: number, ctx: VargaCtx, option: SudasaADOption = 4): number[] {
  let base: number, from: number;
  if (option === 0) { base = strong7(sign, ctx); from = ctx.sign(dasaLord(base, ctx)); }
  else if (option === 1 || option === 2) base = from = sign;
  else base = from = strong7(sign, ctx);
  const dir = sequenceDirection(from, ctx, base);
  return option === 1 || option === 3 ? QUADRANT_ROW.map((k) => mod12(from + k * dir)) : Array.from({ length: 12 }, (_, i) => mod12(from + i * dir));
}

function antardasas(p: Period, sign: number, ctx: SudasaCtx, levels: number, option: SudasaADOption): Period {
  if (levels <= 0) return p;
  const len = (p.end - p.start) / 12;
  const children = sudasaAntardasaSigns(sign, ctx, option).map((s, i) =>
    antardasas({ lord: 'Sun', label: SIGNS[s], start: p.start + i * len, end: p.start + (i + 1) * len }, s, ctx, levels - 1, option));
  return { ...p, children };
}

/** @param option SudasaADOption (JHora default 4) */
export function sudasa(sreeLagnaLon: number, ctx: SudasaCtx, levels = 2, option: SudasaADOption = 4): Period[] {
  const sl = Math.floor(sreeLagnaLon / 30) % 12;
  const seq = sudasaSequence(sl, ctx);
  const first = seq.map((s) => narayanaYears(s, ctx));
  first[0] *= 1 - (sreeLagnaLon % 30) / 30;
  const out: Period[] = [];
  let t = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    seq.forEach((s, i) => {
      const years = cycle === 0 ? first[i] : 12 - first[i];
      out.push(antardasas({ lord: 'Sun', label: SIGNS[s], start: t, end: t + years }, s, ctx, levels - 1, option));
      t += years;
    });
  }
  return out;
}
