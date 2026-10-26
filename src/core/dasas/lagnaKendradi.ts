// Lagna Kendradi Rasi dasa (FUN_00415b40), with JHora 8.0's default rules:
//  - the chart is DAT_008a4ba0 (default 0 = D-1);
//  - the dasas start from strong7 of the lagna (FUN_004ab810) and take the
//    kendras, panaparas and apoklimas from it: offsets 0,3,6,9,1,4,7,10,2,5,8,
//    11, zodiacal from an odd start (Ar, Ge, ...) and backwards from an even
//    one; Saturn in the start forces zodiacal, Ketu reverses (SK flags; unlike
//    Narayana there is no change of row);
//  - years FUN_004acc50 (lords FUN_004ad3f0), second cycle 12 minus the first
//    (24 periods), no balance;
//  - antardasas: the Narayana-style run from the sign holding the lord of
//    strong7 of the dasa sign.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { buildRasiDasa, JHORA_VARGA_NAMES, lordOfStrong7Run, mod12, narayanaYearsWithLord, rasiCtx, skFlag, strong7 } from './rasiCommon';
import { startOverride } from './overrides';

export const KENDRADI_OFFSETS = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11];
export const lagnaKendradiTitle = (vargaIndex = 0) => `Lagna Kendradi Rasi Dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (fructification of yogas)`;
export const LAGNA_KENDRADI_TITLE = lagnaKendradiTitle();

/** @param vargaIndex JHora varga index (DAT_008a4ba0, default 0 = D-1) */
export function lagnaKendradiDasa(chart: Chart, levels = 2, vargaIndex = 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const start = startOverride(ctx) ?? strong7(ctx.lagna, ctx); // chart+0x17eb4[30] (0x415c14)
  let dir = start % 2 === 0 ? 1 : -1;
  const f = skFlag(start, ctx);
  if (f === 1) dir = 1; else if (f === 2) dir = -dir;
  const seq = KENDRADI_OFFSETS.map((k) => mod12(start + dir * k));
  return buildRasiDasa(seq, seq.map((s) => narayanaYearsWithLord(s, ctx)), (s) => lordOfStrong7Run(s, ctx), levels, true);
}
