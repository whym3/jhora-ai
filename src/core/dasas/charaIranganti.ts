// Iranganti Rangacharya Chara dasa (FUN_00417d10), with JHora 8.0's default
// rules (always the rasi chart):
//  - L = the lagna, dir = +1 for an odd lagna (Ar, Ge, ...), -1 for an even one;
//    for a female chart (chart+0xd8 == 2, the "Gender" field: 0 unknown,
//    1 male, 2 female) the dasas start from L + 3*dir, otherwise from L;
//  - order: offsets by the LAGNA's modality times dir: movable sign by sign,
//    fixed every 6th sign (0,5,10,3,8,1,6,11,4,9,2,7), dual 0,4,8,1,5,9,2,6,10,
//    3,7,11; no Saturn/Ketu exception;
//  - years FUN_004acef0 with the plain sign lord (FUN_004ad4b0): 12 when the
//    lord is in the sign; otherwise n = (sign - lordSign) mod 12 or
//    (lordSign - sign) mod 12 (0 read as 12): male/unknown: the first when the
//    LORD's sign is odd (Ar, Ge, ...), the second when even, plus one; female:
//    the first when the DASA sign is odd, the second when even, and 6 becomes
//    10; second cycle 12 minus the first (24 periods),
//    no balance;
//  - antardasas: from the dasa sign itself, its own modality row and parity
//    direction (same tables); each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { SIGN_LORD } from '../lords';
import type { VargaCtx } from '../signStrength';
import { buildRasiDasa, mod12, rasiCtx } from './rasiCommon';

export const CHARA_IRANGANTI_TITLE = 'Iranganti Rangacharya Chara dasa (Modified version of a phalita rasi dasa)';

const ROWS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7],
  [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11],
];
const parityDir = (s: number) => (s % 2 === 0 ? 1 : -1);
const count1to12 = (d: number) => (mod12(d) === 0 ? 12 : mod12(d));

/** FUN_004acef0. */
export function charaIrangantiYears(sign: number, ctx: VargaCtx, female = false): number {
  const p = ctx.sign(SIGN_LORD[sign]);
  if (p === sign) return 12;
  if (female) {
    const n = count1to12(sign % 2 === 0 ? sign - p : p - sign);
    return n === 6 ? 10 : n;
  }
  return count1to12(p % 2 === 0 ? sign - p : p - sign) + 1;
}

/** @param female chart+0xd8 == 2 (JHora's Gender = Female); our birth data has no gender, so it is a parameter */
export function charaIrangantiDasa(chart: Chart, levels = 2, female = false): Period[] {
  const ctx = rasiCtx(chart, 0);
  const L = ctx.lagna;
  const dir = parityDir(L);
  const start = female ? mod12(L + 3 * dir) : L;
  const seq = ROWS[L % 3].map((k) => mod12(start + dir * k));
  const subs = (s: number) => ROWS[s % 3].map((k) => mod12(s + parityDir(s) * k));
  return buildRasiDasa(seq, seq.map((s) => charaIrangantiYears(s, ctx, female)), subs, levels, true);
}
