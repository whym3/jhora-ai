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
//  - antardasas (SudasaADOption 4) run sign by sign from the stronger of the
//    dasa sign and its 7th, in that sign's own direction (same flags).
import type { Period } from './vimsottari';
import { SIGNS } from '../zodiac';
import { aspectScore, DEBILITATION, EXALTATION, PLANETS, rasiAspects, signLordJaimini, strongerSign, type VargaCtx } from '../signStrength';
import { strongerByDignity } from '../deities';
import { narayanaYears } from './narayana';

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

/** Direction of a sequence from `sign`: parity, then the Saturn/Ketu flags. */
function direction(sign: number, ctx: VargaCtx): 1 | -1 {
  const dir: 1 | -1 = sign % 2 === 0 ? 1 : -1;
  const sat = ctx.sign('Saturn') === sign, ketu = ctx.sign('Ketu') === sign;
  const reversed = (dir === 1 ? -1 : 1) as 1 | -1;
  if (sat && ketu) return strongerByDignity('Saturn', 'Ketu', ctx) === 'Ketu' ? reversed : 1;
  if (sat) return 1;
  if (ketu) return reversed;
  return dir;
}

export function sudasaSequence(sl: number, ctx: SudasaCtx): number[] {
  const dir = direction(sl, ctx);
  const g1 = best([sl, mod12(sl + 3), mod12(sl + 6), mod12(sl + 9)], ctx);
  const next = (g: number) => mod12(best([g + 1, mod12(g + 4), mod12(g + 7), mod12(g + 10)], ctx));
  const g2 = next(g1), g3 = next(g2);
  return [g1, g2, g3].flatMap((g) => [0, 3, 6, 9].map((k) => mod12(g + k * dir)));
}

function antardasas(p: Period, sign: number, ctx: SudasaCtx, levels: number): Period {
  if (levels <= 0) return p;
  const low = sign % 6;
  const base = strongerSign(low, low + 6, ctx);
  const dir = direction(base, ctx);
  const len = (p.end - p.start) / 12;
  const children = Array.from({ length: 12 }, (_, i) => {
    const s = mod12(base + dir * i);
    return antardasas({ lord: 'Sun', label: SIGNS[s], start: p.start + i * len, end: p.start + (i + 1) * len }, s, ctx, levels - 1);
  });
  return { ...p, children };
}

export function sudasa(sreeLagnaLon: number, ctx: SudasaCtx, levels = 2): Period[] {
  const sl = Math.floor(sreeLagnaLon / 30) % 12;
  const seq = sudasaSequence(sl, ctx);
  const first = seq.map((s) => narayanaYears(s, ctx));
  first[0] *= 1 - (sreeLagnaLon % 30) / 30;
  const out: Period[] = [];
  let t = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    seq.forEach((s, i) => {
      const years = cycle === 0 ? first[i] : 12 - first[i];
      out.push(antardasas({ lord: 'Sun', label: SIGNS[s], start: t, end: t + years }, s, ctx, levels - 1));
      t += years;
    });
  }
  return out;
}
