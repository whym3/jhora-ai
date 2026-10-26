// Chara dasa of K.N. Rao (FUN_00417ac0), with JHora 8.0's default rules
// (always the rasi chart):
//  - the dasas start from the lagna and run sign by sign, zodiacally when
//    (s+8)/3 is even (Ar Le Vi Li Aq Pi) and backwards otherwise; no
//    Saturn/Ketu exception;
//  - years FUN_004ad020: signs from the dasa sign to its lord (lord by
//    FUN_004ad430 = signLordByDegree), forward for Ar..Ge and Li..Sg, backward
//    for the others, 12 when the lord is in the sign; no exaltation
//    correction and no second cycle (12 periods), no balance;
//  - antardasas: twelve signs starting from the sign after the dasa sign in
//    the dasa sign's own direction (same (s+8)/3 rule), so the dasa sign
//    itself comes last; each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { signLordByDegree, type VargaCtx } from '../signStrength';
import { buildRasiDasa, mod12, rasiCtx, run } from './rasiCommon';
import { lordOverride, startOverride } from './overrides';

export const CHARA_KN_RAO_TITLE = 'Chara dasa of K.N.Rao (modified version of a phalita rasi dasa)';

const dirOf = (s: number) => (Math.floor((s + 8) / 3) % 2 === 0 ? 1 : -1);

/** FUN_004ad020. */
export function charaKNRaoYears(sign: number, ctx: VargaCtx): number {
  // the FUN_004ad430 table (chart+0x179b4/0x17b84): dialog 2022's co-lords for this dasa
  const p = ctx.sign(lordOverride(sign, ctx) ?? signLordByDegree(sign, ctx));
  const d = Math.floor(sign / 3) % 2 === 0 ? p - sign : sign - p;
  return mod12(d) === 0 ? 12 : mod12(d);
}

export function charaKNRaoDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  const start = startOverride(ctx) ?? ctx.lagna; // chart+0x17eb4[34] (0x417b0c)
  const seq = run(start, dirOf(start));
  const subs = (s: number) => run(mod12(s + dirOf(s)), dirOf(s));
  return buildRasiDasa(seq, seq.map((s) => charaKNRaoYears(s, ctx)), subs, levels, false);
}
