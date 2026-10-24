// Trikona dasa (FUN_00416e90), with JHora 8.0's default rules:
//  - the chart is DAT_008a4b94 (default 0 = D-1, shared with Drigdasa and
//    Chara dasa);
//  - the dasas start from the strongest of the lagna and its trines
//    (FUN_004ab890 folded: stronger(stronger(L, L+4), L+8)) and run sign by
//    sign, zodiacally from an odd start (Ar, Ge, ...) and backwards from an even
//    one; no Saturn/Ketu exception;
//  - years FUN_004acc50 (lords FUN_004ad3f0); JHora stores one cycle only
//    (12 periods), no balance;
//  - antardasas: from strong7 of the dasa sign, the row of the dasa sign's
//    modality (sign by sign / every 6th / 0,3,6,9,4,7,10,1,8,11,2,5), zodiacal
//    for an odd dasa sign, backwards for an even one.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { strongerSign } from '../signStrength';
import { buildRasiDasa, JHORA_VARGA_NAMES, mod12, narayanaYearsWithLord, parasaraAntardasas, rasiCtx, run } from './rasiCommon';

export const trikonaTitle = (vargaIndex = 0) =>
  `Trikona Dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (dasa showing purusharthas - four purposes in life)`;
export const TRIKONA_TITLE = trikonaTitle();

/** @param vargaIndex JHora varga index (DAT_008a4b94, default 0 = D-1) */
export function trikonaDasa(chart: Chart, levels = 2, vargaIndex = 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const L = ctx.lagna;
  const start = strongerSign(strongerSign(L, mod12(L + 4), ctx), mod12(L + 8), ctx);
  const seq = run(start, start % 2 === 0 ? 1 : -1);
  return buildRasiDasa(seq, seq.map((s) => narayanaYearsWithLord(s, ctx)), (s) => parasaraAntardasas(s, ctx), levels, false);
}
