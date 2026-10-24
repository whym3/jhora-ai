// Mandooka dasa of K.N. Rao (FUN_00408ae0), with JHora 8.0's rules (D-1):
//  - the dasas start from the lagna if it is an odd sign, else from its 7th;
//    as that sign is always odd the sequence is always zodiacal (no
//    Saturn/Ketu exception): the kendras from it, then the panaparas, then the
//    apoklimas (offsets 0,3,6,9,1,4,7,10,2,5,8,11);
//  - years (FUN_004ad090, lord from the plain table 0x591de4: Sc = Mars,
//    Aq = Saturn): signs from the dasa sign to its lord counted inclusively,
//    forward for an odd sign and backward for an even one; 12 when the lord is
//    in the sign, 10 when it is in the 7th; one cycle;
//  - antardasas: the same kendra / panapara / apoklima pattern zodiacally from
//    the dasa sign itself, each a twelfth (equal parts although the years
//    differ: obj+0x8fa18 = 1).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { SIGN_LORD } from '../lords';
import type { VargaCtx } from '../signStrength';
import { buildRasiDasa, mod12, rasiCtx } from './rasiCommon';

export const MANDOOKA_KN_RAO_TITLE = 'Mandooka dasa of K.N. Rao';
const KENDRAS = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11];

/** FUN_004ad090. */
export function mandookaKNRaoYears(s: number, ctx: VargaCtx): number {
  const p = ctx.sign(SIGN_LORD[s]);
  const n = mod12(s % 2 === 0 ? p - s : s - p) + 1;
  return n === 1 ? 12 : n === 7 ? 10 : n;
}

export function mandookaKNRaoDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  let start = ctx.lagna;
  if (start % 2 === 1) start = mod12(start + 6);
  const dir = start % 2 === 0 ? 1 : -1; // always 1
  const pattern = (from: number) => KENDRAS.map((k) => mod12(from + k * dir));
  const seq = pattern(start);
  return buildRasiDasa(seq, seq.map((s) => mandookaKNRaoYears(s, ctx)), pattern, levels, false);
}
