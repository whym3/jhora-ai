// Shoola dasa (FUN_00407920), with JHora 8.0's default rules (always D-1):
//  - the dasas start from strong7 of the lagna (FUN_004ab810: stronger of the
//    lagna and the 7th) and run zodiacally sign by sign, nine years each (108
//    years, one cycle); dialog 2007's "Which house should Shoola dasa start
//    from?" (combo 1009 "1st (self)" .. "12th (...)", the session global
//    DAT_00597ed0, FUN_0044e230) moves the lagna by that many houses first
//    (0x40796b) and titles the dasa "Shoola dasa from %s house" with the house
//    names "1st".."12th" (0x8a2718, filled at 0x4f7490) - 0 keeps "Shoola dasa";
//  - antardasas run zodiacally sign by sign, each a twelfth, starting
//    (ShoolaDasaAntardasaStart, DAT_00592340, default 1) from: 0 the dasa sign,
//    1 strong7 of the dasa sign, 2 the sign holding the lord (FUN_004ad3f0) of
//    strong7 of the dasa sign.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { buildRasiDasa, dasaLord, mod12, rasiCtx, run, strong7 } from './rasiCommon';

export const SHOOLA_TITLE = 'Shoola dasa (troubles and death)';
const HOUSE_NAMES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
/** Title with the DAT_00597ed0 option (house names: the 0x8a2718 table). */
export const shoolaTitle = (fromHouse = 0, houseName = HOUSE_NAMES[fromHouse] ?? '') => (fromHouse === 0 ? SHOOLA_TITLE : `Shoola dasa from ${houseName} house (troubles and death)`);

/**
 * @param fromHouse  DAT_00597ed0: houses counted from the lagna (default 0)
 * @param adStart    ShoolaDasaAntardasaStart (default: the chart's ini, JHora default 1)
 */
export function shoolaDasa(chart: Chart, levels = 2, fromHouse = 0, adStart: number = chart.ini.ShoolaDasaAntardasaStart ?? 1): Period[] {
  const ctx = rasiCtx(chart, 0);
  const seq = run(strong7(mod12(ctx.lagna + fromHouse), ctx), 1);
  const subs = (s: number) => {
    let from = s;
    if (adStart !== 0) {
      from = strong7(s, ctx);
      if (adStart === 2) from = ctx.sign(dasaLord(from, ctx));
    }
    return run(from, 1);
  };
  return buildRasiDasa(seq, seq.map(() => 9), subs, levels, false);
}
