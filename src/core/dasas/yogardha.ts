// Yogardha dasa (FUN_00417770), with JHora 8.0's default rules:
//  - the chart is the dasa varga (DAT_008a4b94, default 0 = D-1);
//  - the dasas start from strong7(lagna) (FUN_004ab810: stronger of the lagna
//    and the 7th) and run sign by sign, zodiacally from an odd sign and
//    backwards from an even one; Saturn there forces zodiacal, Ketu reverses
//    (the SK flags, sequenceDirection);
//  - years = the mean of the Narayana years (FUN_004acc50 with the lord of
//    FUN_004ad3f0) and the Sthira years (7 movable, 8 fixed, 9 dual), so
//    halves occur; the second cycle gives each sign 12 minus its first years;
//  - antardasas run sign by sign from the sign holding the lord of strong7 of
//    the dasa sign, zodiacally if that sign is odd and backwards if even, with
//    the SK flags of strong7 of the dasa sign; each a twelfth.
// The Chara (Narayana) and Sthira years are computed locally (rasiCommon.ts).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { sequenceDirection } from './narayana';
import { buildRasiDasa, JHORA_VARGA_NAMES, lordOfStrong7Run, narayanaYearsWithLord, rasiCtx, run, sthiraYears, strong7 } from './rasiCommon';
import { startOverride } from './overrides';

export const yogardhaTitle = (vargaIndex = 0) => `Yogardha dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (a rasi dasa based on chara and sthira dasas)`;
export const YOGARDHA_TITLE = yogardhaTitle(0);

/** @param vargaIndex JHora varga index of the dasa chart (0 = D-1, the default). */
export function yogardhaDasa(chart: Chart, levels = 2, vargaIndex = 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const start = startOverride(ctx) ?? strong7(ctx.lagna, ctx); // chart+0x17eb4[36] (0x4177e9)
  const seq = run(start, sequenceDirection(start, ctx));
  const years = seq.map((s) => (narayanaYearsWithLord(s, ctx) + sthiraYears(s)) / 2);
  return buildRasiDasa(seq, years, (s) => lordOfStrong7Run(s, ctx), levels, true);
}
