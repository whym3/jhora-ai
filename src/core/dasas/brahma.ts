// Brahma dasa (FUN_004082e0), with JHora 8.0's default rules (D-1):
//  - the dasas start from the sign of Brahma (chart+0x27520, the planet of
//    FUN_004ad580 = brahmaRudraMaheswara), or from its 7th when Brahma is in an
//    even sign, and always run zodiacally sign by sign;
//  - years (FUN_004acfb0): take the lord (FUN_004ad370: Aq/Sc co-lords by
//    FUN_004abeb0) of the 6th from an odd dasa sign or of the 8th from an even
//    one, count signs from the dasa sign to that lord (forward for an odd
//    dasa sign, backward for an even one; 0 when it is in the dasa sign),
//    +1 exalted, -1 debilitated; second cycle 12 minus the first;
//  - antardasas run zodiacally sign by sign from the sign holding the dasa
//    sign's lord (FUN_004ad3f0), each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { DEBILITATION, EXALTATION, signLordJaimini, type VargaCtx } from '../signStrength';
import { brahmaRudraMaheswara } from '../deities';
import { charaKarakas } from '../basics';
import { buildRasiDasa, dasaLord, dasaSeedOf, mod12, rasiCtx, run, seedShift } from './rasiCommon';
import { startOverride } from './overrides';

export const BRAHMA_TITLE = 'Brahma dasa (cycle of life, death and life)';

/**
 * Sign of JHora's Brahma in the rasi chart; in a Tajaka chart with the dasa seed flags
 * (rasiCommon DasaSeed) the natal Brahma's sign moved by Muntha - natal lagna.
 */
export function brahmaSign(chart: Chart): number {
  const seed = dasaSeedOf(chart);
  if (seed) return seedShift(seed, brahmaSign(seed.natal));
  const ctx = rasiCtx(chart, 0);
  const ak = charaKarakas(chart.positions)[0].planet;
  return ctx.sign(brahmaRudraMaheswara(ctx.lagna, ak, ctx).brahma);
}

/** FUN_004acfb0 with FUN_004ad370's lord of the 6th/8th. */
export function brahmaYears(s: number, ctx: VargaCtx): number {
  const odd = s % 2 === 0;
  const lord = signLordJaimini(mod12(s + (odd ? 5 : 7)), ctx);
  const p = ctx.sign(lord);
  let y = mod12(odd ? p - s : s - p);
  if (EXALTATION[lord] === p && y < 12) y++;
  if (DEBILITATION[lord] === p && y > 0) y--;
  return y;
}

export function brahmaDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  let start = brahmaSign(chart);
  if (start % 2 === 1) start = mod12(start + 6);
  start = startOverride(ctx) ?? start; // "Start dasas from" (chart+0x17eb4[40], 0x408395)
  const seq = run(start, 1);
  const subs = (s: number) => run(ctx.sign(dasaLord(s, ctx)), 1);
  return buildRasiDasa(seq, seq.map((s) => brahmaYears(s, ctx)), subs, levels, true);
}
