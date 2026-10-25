// Bhava arudha padas (AL, A2 .. A11, UL = JHora bodies 59..70) of a chart in any varga
// with every option of the "Arudha Pada Calculation" dialog (2059, Preferences 33245,
// FUN_004e82a0), as jhora.exe FUN_004a3800 stores them:
//  * sign based (default): houses counted from the lagna of the varga (ArudhaBasePlanet
//    is not read on this path); bhavaArudha() in arudhas.ts;
//  * LongitudeBasedBhavaArudhas: from exact longitudes, houses counted from
//    ArudhaBasePlanet (longitudeBhavaArudhas()). Without DivLongsInBhavaArudhas only the
//    rasi chart is computed this way and FUN_004a2ff0 then derives every varga's sign
//    from the arudha's rasi longitude like any other body; with it, each varga uses its
//    own varga longitudes and signs.
import type { JhoraIni } from '../settings/generated';
import { DEFAULTS } from '../settings/generated';
import { bhavaArudha, longitudeBhavaArudhas, type BhavaArudhaOptions } from './arudhas';
import { bodyLongitude, type ChakraChart } from './chakras/common';
import type { Graha } from './positions';
import type { VargaCtx } from './signStrength';
import { vargaLongitude, type VargaName } from './vargas';
import { vargaSpec } from './vargaOptions';

export function bhavaArudhaOptions(ini: Partial<JhoraIni> = {}): BhavaArudhaOptions {
  const v = <K extends keyof JhoraIni>(k: K) => (ini[k] ?? DEFAULTS[k]) as number;
  return {
    bhavaExceptions: v('ExceptionsInBhavaArudhas') !== 0,
    grahaExceptions: v('ExceptionsInGrahaArudhas') !== 0,
    nodesAsLords: v('NodesInArudhas') !== 0,
    longitudeBased: v('LongitudeBasedBhavaArudhas') !== 0,
    base: v('ArudhaBasePlanet'),
    divLongs: v('DivLongsInBhavaArudhas') !== 0,
  };
}

/** Signs (0 = Aries) of AL, A2 .. A11, UL in a varga. */
export function bhavaArudhaSigns(chart: ChakraChart, varga: VargaName, ini: Partial<JhoraIni> = chart.ini ?? {}): number[] {
  const opt = bhavaArudhaOptions(ini);
  const spec = vargaSpec(varga, ini);
  const vlon = (lon: number) => vargaLongitude(lon, spec);
  const g = chart.positions.grahas;
  const signOfLon = (lon: number) => Math.trunc(lon / 30) % 12;
  const ctxV: VargaCtx = { sign: (p: Graha) => signOfLon(vlon(g[p].lon)), degree: (p: Graha) => g[p].lon % 30 };
  if (!opt.longitudeBased) {
    const lagna = signOfLon(vlon(chart.positions.ascendant));
    return Array.from({ length: 12 }, (_, k) => bhavaArudha((lagna + k) % 12, ctxV, opt));
  }
  const d1 = (b: number) => bodyLongitude(chart, b) ?? chart.positions.ascendant;
  if (opt.divLongs) {
    return longitudeBhavaArudhas((b) => vlon(d1(b)), opt.base, ctxV, opt).map(signOfLon);
  }
  const ctx1: VargaCtx = { sign: (p: Graha) => signOfLon(g[p].lon), degree: (p: Graha) => g[p].lon % 30 };
  return longitudeBhavaArudhas(d1, opt.base, ctx1, opt).map((lon) => signOfLon(vlon(lon)));
}
