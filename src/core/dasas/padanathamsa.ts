// Padanaathaamsa dasa (FUN_004151f0), with JHora 8.0's default rules:
//  - the chart is PadanathamsaDasaChart (DAT_00576db0, default 1 = D-9);
//  - the reference sign: the plain lord (table 0x591de4, no node co-lords) of
//    the rasi-chart arudha lagna (chart body 59 = A1 of FUN_004a3800, D-1), and
//    the sign that lord occupies in the chosen chart; the dasas start from
//    strong7 of that sign in that chart;
//  - the rest is Narayana dasa of that chart: Narayana-type sequence with its
//    Saturn/Ketu flags, years FUN_004acc50 (lords FUN_004ad3f0), second cycle
//    12 minus the first (24 periods), no balance;
//  - antardasas: twelve signs from the sign holding the lord of strong7 of the
//    dasa sign, by that sign's parity with the SK flags of strong7.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { SIGN_LORD } from '../lords';
import { bhavaArudha } from '../arudhas';
import { buildRasiDasa, JHORA_VARGA_NAMES, lordOfStrong7Run, narayanaTypeSequence, narayanaYearsWithLord, rasiCtx, strong7 } from './rasiCommon';

export const PADANATHAMSA_DEFAULT_VARGA = 1;
export const padanathamsaTitle = (vargaIndex = PADANATHAMSA_DEFAULT_VARGA) =>
  `Padanaathaamsa Dasa of ${JHORA_VARGA_NAMES[vargaIndex]} chart (a versatile phalita rasi dasa)`;
export const PADANATHAMSA_TITLE = padanathamsaTitle();

/** @param vargaIndex JHora varga index (PadanathamsaDasaChart, default 1 = D-9) */
export function padanathamsaDasa(chart: Chart, levels = 2, vargaIndex: number = chart.ini.PadanathamsaDasaChart ?? PADANATHAMSA_DEFAULT_VARGA): Period[] {
  const d1 = rasiCtx(chart, 0);
  const ctx = rasiCtx(chart, vargaIndex);
  const ini = chart.ini;
  const al = bhavaArudha(d1.lagna, d1, {
    bhavaExceptions: (ini.ExceptionsInBhavaArudhas ?? 1) !== 0,
    grahaExceptions: (ini.ExceptionsInGrahaArudhas ?? 1) !== 0,
    nodesAsLords: (ini.NodesInArudhas ?? 1) !== 0,
  });
  const start = strong7(ctx.sign(SIGN_LORD[al]), ctx);
  const seq = narayanaTypeSequence(start, ctx);
  return buildRasiDasa(seq, seq.map((s) => narayanaYearsWithLord(s, ctx)), (s) => lordOfStrong7Run(s, ctx), levels, true);
}
