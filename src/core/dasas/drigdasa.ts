// Drigdasa (FUN_00414670, groups FUN_00414c50), with JHora 8.0's default rules:
//  - the chart is DAT_008a4b94 (default 0 = D-1; the same option drives Trikona
//    and Chara dasa); DrigdasaOfParasara (DAT_00592358) is 1 in JHora's
//    default ini;
//  - three groups of four signs, starting from the 9th, 10th and 11th from the
//    lagna (non-Parasara option: 9th, then 8th and 7th when the lagna is dual);
//    each group is its first sign followed by the signs it aspects (rasi
//    drishti) in the order met while stepping from it: Parasara option:
//    backwards from a movable sign, zodiacally from a fixed one, zodiacally
//    from Ge/Sg and backwards from Vi/Pi; non-Parasara: zodiacally when
//    floor(s/3) is even (Ar Ta Ge Li Sc Sg), with the Saturn/Ketu flags;
//  - years: Parasara option 7 movable, 8 fixed, 9 dual, one cycle (96 years);
//    non-Parasara: Narayana years with the FUN_004ad470 lords
//    (signLordByModality), second cycle 12 minus the first;
//  - antardasas: Parasara option: from strong7 of the dasa sign, the row of its
//    modality (sign by sign / every 6th / 0,3,6,9,4,7,10,1,8,11,2,5), zodiacal
//    for an odd dasa sign and backwards for an even one; non-Parasara: the
//    Narayana-style run from the lord of strong7.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { DEBILITATION, EXALTATION, rasiAspects, signLordByModality, type VargaCtx } from '../signStrength';
import { buildRasiDasa, JHORA_VARGA_NAMES, lordOfStrong7Run, mod12, parasaraAntardasas, rasiCtx, skFlag, sthiraYears } from './rasiCommon';

export const drigdasaTitle = (vargaIndex = 0) => `Drigdasa of ${JHORA_VARGA_NAMES[vargaIndex]} (religious and spiritual activities)`;
export const DRIGDASA_TITLE = drigdasaTitle();

/** FUN_00414c50: a sign and the three signs it aspects, in stepping order. */
export function drigGroup(s: number, ctx: VargaCtx, parasara: boolean): number[] {
  let dir: number;
  if (parasara) dir = s % 3 === 0 ? -1 : s % 3 === 1 ? 1 : s % 2 === 0 ? 1 : -1;
  else {
    dir = Math.floor(s / 3) % 2 === 0 ? 1 : -1;
    const f = skFlag(s, ctx);
    if (f === 1) dir = 1; else if (f === 2) dir = -dir;
  }
  const out = [s];
  for (let k = 1; k < 12; k++) {
    const x = mod12(s + dir * k);
    if (rasiAspects(x, s)) out.push(x);
  }
  return out;
}

/** FUN_004acc50 with the FUN_004ad470 lord (non-Parasara Drigdasa years). */
function yearsByModalityLord(sign: number, ctx: VargaCtx): number {
  const lord = signLordByModality(sign, ctx);
  const p = ctx.sign(lord);
  const d = Math.floor(sign / 3) % 2 === 0 ? p - sign : sign - p;
  let y = mod12(d) === 0 ? 12 : mod12(d);
  if (EXALTATION[lord] === p && y < 12) y++;
  if (DEBILITATION[lord] === p && y > 0) y--;
  return y;
}

/**
 * @param vargaIndex JHora varga index (DAT_008a4b94, default 0 = D-1)
 * @param parasara   DrigdasaOfParasara (default: the chart's ini, JHora default 1)
 */
export function drigDasa(chart: Chart, levels = 2, vargaIndex = 0, parasara: boolean = (chart.ini.DrigdasaOfParasara ?? 1) !== 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const L = ctx.lagna;
  const offsets = !parasara && L % 3 === 2 ? [8, 7, 6] : [8, 9, 10];
  const seq = offsets.flatMap((o) => drigGroup(mod12(L + o), ctx, parasara));
  if (parasara) return buildRasiDasa(seq, seq.map(sthiraYears), (s) => parasaraAntardasas(s, ctx), levels, false);
  return buildRasiDasa(seq, seq.map((s) => yearsByModalityLord(s, ctx)), (s) => lordOfStrong7Run(s, ctx), levels, true);
}
