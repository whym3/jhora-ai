// Chara dasa (Parasara) (FUN_004172f0), with JHora 8.0's default rules:
//  - the chart is DAT_008a4b94 (default 0 = D-1, shared with Drigdasa and
//    Trikona); the dasas start from the sign of body DAT_008a4c48 in that chart
//    (chart+0x17d7 + 0x1d x body + varga): dialog 2079's "Choose the dasa seed from
//    the tripod of life" (combo 1003, DLGINIT: Lagna / Sun / Moon = bodies 0 / 1 / 2;
//    a session global, default 0), unless "Start dasas from" (chart+0x17eb4[33]) is set;
//  - they run sign by sign, zodiacally when (s+8)/3 is even (Ar Le Vi Li Aq
//    Pi) and backwards otherwise; no Saturn/Ketu exception;
//  - years FUN_004acce0: signs from the dasa sign to its lord (lord by
//    FUN_004ad470 = signLordByModality), counted forward for Ar..Ge and Li..Sg
//    and backward for the others, 12 when the lord is in the sign (no minus
//    one); with CharaDasaExaltationException (default 1) +1 if the lord is
//    exalted, -1 if debilitated; second cycle 12 minus the first (24 periods;
//    the by-longitude option DAT_008a4c46 is off), no balance;
//  - antardasas: from strong7 of the dasa sign, the row of the dasa sign's
//    modality (sign by sign / every 6th / 0,3,6,9,4,7,10,1,8,11,2,5), zodiacal
//    for an odd dasa sign, backwards for an even one.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { DEBILITATION, EXALTATION, signLordByModality, type VargaCtx } from '../signStrength';
import { buildRasiDasa, JHORA_VARGA_NAMES, mod12, parasaraAntardasas, rasiCtx, run } from './rasiCommon';
import { lordOverride, startOverride } from './overrides';

export const charaParasaraTitle = (vargaIndex = 0) => `Chara dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (a popular phalita rasi dasa)`;
export const CHARA_PARASARA_TITLE = charaParasaraTitle();

/** FUN_004acce0. */
export function charaParasaraYears(sign: number, ctx: VargaCtx, exaltationException = true): number {
  // the FUN_004ad470 table (chart+0x17a28/0x17bf8): dialog 2022's co-lords for this dasa
  const lord = lordOverride(sign, ctx) ?? signLordByModality(sign, ctx);
  const p = ctx.sign(lord);
  const d = Math.floor(sign / 3) % 2 === 0 ? p - sign : sign - p;
  let y = mod12(d) === 0 ? 12 : mod12(d);
  if (exaltationException) {
    if (EXALTATION[lord] === p && y < 12) y++;
    if (DEBILITATION[lord] === p && y > 0) y--;
  }
  return y;
}

/** Dialog 2079's seeds, in combo order (DAT_008a4c48). */
export const CHARA_SEEDS = ['Lagna', 'Sun', 'Moon'] as const;
export type CharaSeed = 0 | 1 | 2;

/**
 * @param vargaIndex JHora varga index (DAT_008a4b94, default 0 = D-1)
 * @param seed DAT_008a4c48: 0 Lagna, 1 Sun, 2 Moon
 * @param exaltationException CharaDasaExaltationException (default: the chart's ini, JHora default 1)
 */
export function charaParasaraDasa(chart: Chart, levels = 2, vargaIndex = 0,
  exaltationException: boolean = (chart.ini.CharaDasaExaltationException ?? 1) !== 0, seed: CharaSeed = 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const seedSign = seed === 1 ? ctx.sign('Sun') : seed === 2 ? ctx.sign('Moon') : ctx.lagna;
  const start = startOverride(ctx) ?? seedSign; // chart+0x17eb4[33] (0x41734d)
  const seq = run(start, Math.floor((start + 8) / 3) % 2 === 0 ? 1 : -1);
  return buildRasiDasa(seq, seq.map((s) => charaParasaraYears(s, ctx, exaltationException)), (s) => parasaraAntardasas(s, ctx), levels, true);
}
