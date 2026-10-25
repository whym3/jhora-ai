// Lagnamsaka dasa (FUN_00414d30), with JHora 8.0's default rules:
//  - the chart is LagnamsakaDasaChart (DAT_00576dac, default 1 = D-9); only the
//    lagna is taken from it: the dasas start from strong7 of that lagna sign
//    computed in the RASI chart (FUN_004ab810(s, 0));
//  - everything else is Narayana dasa of the D-1 chart: the Narayana-type
//    sequence (rasiCommon narayanaTypeSequence, D-1 Saturn/Ketu flags of the
//    start), years FUN_004acc50 with D-1 lords (FUN_004ad3f0), the second
//    cycle 12 minus the first (24 periods), no balance;
//  - antardasas: twelve signs from the sign holding the lord of strong7 of the
//    dasa sign, by that sign's parity with the SK flags of strong7 (all D-1).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { buildRasiDasa, JHORA_VARGA_NAMES, lordOfStrong7Run, narayanaTypeSequence, narayanaYearsWithLord, rasiCtx, strong7 } from './rasiCommon';
import { startOverride } from './overrides';

export const LAGNAMSAKA_DEFAULT_VARGA = 1;
export const lagnamsakaTitle = (vargaIndex = LAGNAMSAKA_DEFAULT_VARGA) =>
  `Lagnamsaka Dasa from ${JHORA_VARGA_NAMES[vargaIndex]} chart (a versatile phalita rasi dasa)`;
export const LAGNAMSAKA_TITLE = lagnamsakaTitle();

/** @param vargaIndex JHora varga index of the chart whose lagna is used (LagnamsakaDasaChart, default 1 = D-9) */
export function lagnamsakaDasa(chart: Chart, levels = 2, vargaIndex: number = chart.ini.LagnamsakaDasaChart ?? LAGNAMSAKA_DEFAULT_VARGA): Period[] {
  const d1 = rasiCtx(chart, 0);
  const start = startOverride(d1) ?? strong7(rasiCtx(chart, vargaIndex).lagna, d1);
  const seq = narayanaTypeSequence(start, d1);
  return buildRasiDasa(seq, seq.map((s) => narayanaYearsWithLord(s, d1)), (s) => lordOfStrong7Run(s, d1), levels, true);
}
