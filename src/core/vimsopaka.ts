// Vimsopaka bala (out of 20) in JHora's four schemes, ported from jhora.exe
// FUN_004c1190: each varga scores the planet 20 when it owns the sign (never for
// the nodes), otherwise 18/15/10/7/5 for its compound relationship with the
// sign's lord, the temporary part taken in that same varga (table filled by
// FUN_004a34c0). JHora's sapta-varga weights are the textbook list applied to a
// shifted varga order, kept here as it computes them.
import type { Chart } from './chart';
import { GRAHAS, type Graha } from './positions';
import { ALL_VARGAS, vargaLongitude, type VargaName } from './vargas';
import { SIGN_LORD } from './lords';
import { naturalRelation } from './relations';

export type VimsopakaScheme = 'dasa' | 'shodasa' | 'sapta' | 'shad';

export const VIMSOPAKA_WEIGHTS: Record<VimsopakaScheme, [VargaName, number][]> = {
  dasa: [['D1', 3], ['D2', 1.5], ['D3', 1.5], ['D7', 1.5], ['D9', 1.5], ['D10', 1.5], ['D12', 1.5], ['D16', 1.5], ['D30', 1.5], ['D60', 5]],
  shodasa: [['D1', 3.5], ['D2', 1], ['D3', 1], ['D4', 0.5], ['D7', 0.5], ['D9', 3], ['D10', 0.5], ['D12', 0.5], ['D16', 2], ['D20', 0.5], ['D24', 0.5], ['D27', 0.5], ['D30', 1], ['D40', 0.5], ['D45', 0.5], ['D60', 4]],
  sapta: [['D1', 5], ['D2', 2], ['D3', 3], ['D7', 1], ['D9', 2.5], ['D12', 4.5], ['D30', 2]],
  shad: [['D1', 6], ['D2', 2], ['D3', 4], ['D9', 5], ['D12', 2], ['D30', 1]],
};

const RELATION_SCORE: Record<number, number> = { 2: 18, 1: 15, 0: 10, '-1': 7, '-2': 5 };
const ownSign = (g: Graha, s: number) => SIGN_LORD[s] === g;

/** Points (5..20) of a graha in one varga. */
export function vargaPoints(g: Graha, varga: VargaName, sign: (x: Graha, v: VargaName) => number): number {
  const s = sign(g, varga);
  if (ownSign(g, s)) return 20;
  const lord = SIGN_LORD[s] as Graha;
  const d = (((sign(lord, varga) - s) % 12) + 12) % 12;
  const r = naturalRelation(g, lord) + ([1, 2, 3, 9, 10, 11].includes(d) ? 1 : -1);
  return RELATION_SCORE[r];
}

export function vimsopaka(chart: Chart): Record<Graha, Record<VimsopakaScheme, number>> {
  const lon = (g: Graha) => chart.positions.grahas[g].lon;
  const sign = (x: Graha, v: VargaName) => Math.floor(vargaLongitude(lon(x), ALL_VARGAS[v]) / 30) % 12;
  const out = {} as Record<Graha, Record<VimsopakaScheme, number>>;
  for (const g of GRAHAS) {
    const r = {} as Record<VimsopakaScheme, number>;
    for (const sch of Object.keys(VIMSOPAKA_WEIGHTS) as VimsopakaScheme[]) {
      r[sch] = VIMSOPAKA_WEIGHTS[sch].reduce((a, [v, w]) => vargaPoints(g, v, sign) * w * 0.05 + a, 0);
    }
    out[g] = r;
  }
  return out;
}
