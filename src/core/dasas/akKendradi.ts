// Atma Karaka Kendradi Rasi dasa (FUN_00415ef0), with JHora 8.0's default rules:
//  - the chart is DAT_008a4b9c (default 0 = D-1); the atmakaraka is chart+
//    0x17fe0 (chara karakas, 8-karaka scheme);
//  - the dasas start from strong7 of the AK's sign (FUN_004ab810); the twelve
//    signs are its kendras, panaparas and apoklimas, always zodiacal
//    (start + 3*(i%4) + floor(i/4)); each group of four is then sorted
//    strongest first with FUN_004ab650 mode 2, i.e. FUN_004abbb0
//    (strongerSignDignityFirst) in an insertion sort;
//  - years FUN_004acc50 (lords FUN_004ad3f0), second cycle 12 minus the first
//    (24 periods), no balance;
//  - antardasas: the Narayana-style run from the sign holding the lord of
//    strong7 of the dasa sign.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { charaKarakas } from '../basics';
import { sortByStrength, strongerSignDignityFirst } from '../signStrength';
import { buildRasiDasa, dasaSeedOf, JHORA_VARGA_NAMES, JHORA_VARGAS, lordOfStrong7Run, mod12, narayanaYearsWithLord, rasiCtx, seedShift, strong7 } from './rasiCommon';

export const akKendradiTitle = (vargaIndex = 0) => `Atma Karaka Kendradi Rasi Dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (experiences of soul)`;
export const AK_KENDRADI_TITLE = akKendradiTitle();

/** @param vargaIndex JHora varga index (DAT_008a4b9c, default 0 = D-1) */
export function akKendradiDasa(chart: Chart, levels = 2, vargaIndex = 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const seed = dasaSeedOf(chart);
  // Tajaka seed: the natal AK's sign moved by Muntha - natal lagna (0x415f3d)
  const akSign = seed
    ? seedShift(seed, rasiCtx(seed.natal, vargaIndex).sign(charaKarakas(seed.natal.positions, 8)[0].planet), JHORA_VARGAS[vargaIndex]!)
    : ctx.sign(charaKarakas(chart.positions, 8)[0].planet);
  const start = strong7(akSign, ctx);
  const signs = Array.from({ length: 12 }, (_, i) => mod12(start + 3 * (i % 4) + Math.floor(i / 4)));
  const stronger = (a: number, b: number) => strongerSignDignityFirst(a, b, ctx);
  const seq = [0, 4, 8].flatMap((i) => sortByStrength(signs.slice(i, i + 4), stronger));
  return buildRasiDasa(seq, seq.map((s) => narayanaYearsWithLord(s, ctx)), (s) => lordOfStrong7Run(s, ctx), levels, true);
}
