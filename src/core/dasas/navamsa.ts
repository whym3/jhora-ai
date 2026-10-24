// Navamsa dasa (FUN_00407b60), with JHora 8.0's rules (D-1 signs):
//  - the dasas start from strong7 of the lagna (FUN_004ab810: stronger of the
//    lagna and the 7th); when that is an even sign it is replaced through the
//    builder's table {Ta->Li, Cn->Aq, Vi->Ge, Sc->Ar, Cp->Le, Pi->Sg};
//  - they run zodiacally sign by sign, nine years each (108 years, one cycle);
//  - antardasas run zodiacally sign by sign from strong7 of the dasa sign,
//    mapped through the same table when even; each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import type { VargaCtx } from '../signStrength';
import { buildRasiDasa, rasiCtx, run, strong7 } from './rasiCommon';

export const NAVAMSA_TITLE = 'Navamsa dasa (death)';
/** The builder's local table (only the odd indices = even signs are used). */
const EVEN_MAP = [7, 6, 5, 10, 9, 2, 1, 0, 11, 4, 3, 8];

const startOf = (s: number, ctx: VargaCtx) => {
  const x = strong7(s, ctx);
  return x % 2 === 1 ? EVEN_MAP[x] : x;
};

export function navamsaDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  const seq = run(startOf(ctx.lagna, ctx), 1);
  return buildRasiDasa(seq, seq.map(() => 9), (s) => run(startOf(s, ctx), 1), levels, false);
}
