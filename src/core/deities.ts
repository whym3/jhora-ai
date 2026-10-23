// Brahma, Rudra and Maheswara (Jaimini), ported from jhora.exe FUN_004ad580 with
// its planet comparison FUN_004ac7d0 and own-sign test FUN_004ae4e0.
import type { Graha } from './positions';
import { SIGN_LORD } from './lords';
import { DEBILITATION, EXALTATION, signLordJaimini, strongerSign, type VargaCtx } from './signStrength';

/** Moolatrikona signs as JHora's table holds them (nodes: Virgo and Pisces). */
export const MOOLATRIKONA: Record<Graha, number> = { Sun: 4, Moon: 1, Mars: 0, Mercury: 5, Jupiter: 8, Venus: 6, Saturn: 10, Rahu: 5, Ketu: 11 };

const mod12 = (x: number) => ((x % 12) + 12) % 12;
/** Own sign incl. the nodes' co-lordship of Aquarius and Scorpio (FUN_004ae4e0). */
const ownSign = (g: Graha, s: number) => SIGN_LORD[s] === g || (s === 10 && g === 'Rahu') || (s === 7 && g === 'Ketu');

/**
 * Stronger of two planets by dignity (FUN_004ac7d0): exaltation, then not being
 * debilitated, moolatrikona, own sign, finally the higher advancement in the sign
 * (nodes counted backwards). Ties go to p.
 */
export function strongerByDignity(p: Graha, q: Graha, ctx: VargaCtx): Graha {
  const sp = ctx.sign(p), sq = ctx.sign(q);
  const ep = EXALTATION[p] === sp, eq = EXALTATION[q] === sq;
  if (ep && !eq) return p;
  if (eq && !ep) return q;
  const dp = DEBILITATION[p] === sp, dq = DEBILITATION[q] === sq;
  if (dp && !dq) return q;
  if (dq && !dp) return p;
  const mp = MOOLATRIKONA[p] === sp, mq = MOOLATRIKONA[q] === sq;
  if (mp && !mq) return p;
  if (mq && !mp) return q;
  const op = ownSign(p, sp), oq = ownSign(q, sq);
  if (op && !oq) return p;
  if (oq && !op) return q;
  const adv = (g: Graha) => (g === 'Rahu' || g === 'Ketu' ? 30 - ctx.degree(g) : ctx.degree(g));
  return adv(p) < adv(q) ? q : p;
}

export interface Deities { brahma: Graha; rudra: Graha; maheswara: Graha }

/**
 * @param lagna  sign of the lagna
 * @param ak     atmakaraka
 */
export function brahmaRudraMaheswara(lagna: number, ak: Graha, ctx: VargaCtx): Deities {
  const lord = (s: number) => signLordJaimini(mod12(s), ctx);
  // Rudra: the stronger of the lords of the 2nd and the 8th
  const rudra = strongerByDignity(lord(lagna + 1), lord(lagna + 7), ctx);

  // Maheswara: lord of the 8th from the atmakaraka (6th when a node is with the AK
  // or in that 8th); if he is exalted or in own sign, the lord of the 8th from him.
  const akSign = ctx.sign(ak);
  let h = mod12(akSign + 7);
  const ra = ctx.sign('Rahu'), ke = ctx.sign('Ketu');
  if (ra === akSign || ke === akSign || ra === h || ke === h) h = mod12(akSign + 5);
  const L = lord(h);
  const sL = ctx.sign(L);
  if (sL === h) {
    // JHora returns here: the 8th lord in that very house is Brahma as well
    return { brahma: L, rudra, maheswara: lord(sL + 7) };
  }
  let maheswara: Graha;
  if (sL !== EXALTATION[L] && lord(sL) !== L) maheswara = L;
  else maheswara = lord(sL + 7);

  // Brahma: lords of the 6th, 8th and 12th from the stronger of lagna and 7th,
  // placed in odd signs in the visible half (houses 7-12 from it); fallbacks in
  // JHora's order.
  const strong = strongerSign(lagna, mod12(lagna + 6), ctx);
  const weak = strong === lagna ? mod12(lagna + 6) : lagna;
  const lordsFrom = (s: number) => [5, 7, 11].map((o) => lord(s + o));
  const visibleOdd = (s: number) => lordsFrom(s).filter((g) => mod12(ctx.sign(g) - s) >= 6 && ctx.sign(g) % 2 === 0);
  const odd = (s: number) => lordsFrom(s).filter((g) => ctx.sign(g) % 2 === 0);
  let cands = visibleOdd(strong);
  if (!cands.length) cands = visibleOdd(weak);
  if (!cands.length) cands = odd(strong);
  if (!cands.length) cands = odd(weak);
  if (!cands.length) cands = lordsFrom(strong);
  let brahma = cands[0];
  for (const c of cands.slice(1)) brahma = strongerByDignity(brahma, c, ctx);
  // JHora replaces Saturn, Rahu and Ketu by Mars, Mercury and Jupiter
  const SUB: Partial<Record<Graha, Graha>> = { Saturn: 'Mars', Rahu: 'Mercury', Ketu: 'Jupiter' };
  brahma = SUB[brahma] ?? brahma;
  return { brahma, rudra, maheswara };
}
