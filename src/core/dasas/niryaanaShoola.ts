// Niryaana Shoola dasa (FUN_00408040), with JHora 8.0's default rules (D-1):
//  - the dasas start from strong7 of the 8th house (FUN_004ab810: the stronger
//    of the 2nd and the 8th, the one of Ar..Vi winning ties) and run sign by
//    sign, zodiacally from an odd sign and backwards from an even one; Saturn
//    there forces zodiacal, Ketu reverses (SK flags);
//  - years: 7 movable, 8 fixed, 9 dual (one cycle, 96 years);
//  - antardasas: twelve signs from the sign holding the lord (FUN_004ad3f0) of
//    strong7 of the dasa sign, by that sign's parity with the SK flags of
//    strong7 of the dasa sign; each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { sequenceDirection } from './narayana';
import { buildRasiDasa, lordOfStrong7Run, mod12, rasiCtx, run, sthiraYears, strong7 } from './rasiCommon';
import { startOverride } from './overrides';

export const NIRYAANA_SHOOLA_TITLE = 'Niryana Shoola Dasa (death)';

export function niryaanaShoolaDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  // "Start dasas from" (chart+0x17eb4[39], 0x4080a3)
  const start = startOverride(ctx) ?? strong7(mod12(ctx.lagna + 7), ctx);
  const seq = run(start, sequenceDirection(start, ctx));
  return buildRasiDasa(seq, seq.map(sthiraYears), (s) => lordOfStrong7Run(s, ctx), levels, false);
}
