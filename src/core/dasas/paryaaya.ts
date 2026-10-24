// Paryaaya dasa (FUN_00416df0 picks one of three builders), JHora 8.0 defaults:
//  - the chart is ParyaayaDasaChart (DAT_00576db4, default 6 = D-6, also set
//    by FUN_004e5870); the reference sign is the 6th from the lagna of that
//    chart (lagna + division number - 1, division table 0x591ed4);
//  - its modality picks the dasa: a movable sign gives Ubhaya Paryaya
//    (FUN_00416a10), a fixed one Sthira Paryaya (FUN_004162b0), a dual one
//    Chara Paryaya (FUN_00416650) - JHora's own mapping;
//  - start: Ubhaya: the strongest of the four kendras of that sign
//    (FUN_004ab890 folded left over s, s+3, s+6, s+9); Sthira: the stronger of
//    the sign and its 7th; Chara: the strongest of its trines (s, s+4, s+8);
//  - direction: zodiacal when the start is odd-footed (Ar Ta Ge Li Sc Sg),
//    backwards otherwise; Saturn in the start forces zodiacal, Ketu reverses;
//  - order (offsets from the start, times the direction): Ubhaya
//    0,3,6,9,1,4,7,10,2,5,8,11; Sthira 0,6,1,7,2,8,3,9,4,10,5,11; Chara
//    0,4,8,1,5,9,2,6,10,3,7,11;
//  - years are Narayana dasa's (FUN_004acc50); second cycle 12 minus them;
//  - antardasas: twelve signs from the sign holding the lord of strong7 of the
//    dasa sign, parity direction of that sign with SK flags of strong7.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { strongerSign, type VargaCtx } from '../signStrength';
import { strongerByDignity } from '../deities';
import { buildRasiDasa, JHORA_VARGA_NAMES, lordOfStrong7Run, mod12, narayanaYearsWithLord, rasiCtx } from './rasiCommon';

export type ParyaayaKind = 'Chara' | 'Sthira' | 'Ubhaya';
export const PARYAAYA_DEFAULT_VARGA = 6;
export const paryaayaTitleOf = (kind: ParyaayaKind, vargaIndex = PARYAAYA_DEFAULT_VARGA) =>
  `${kind} Paryaya dasa of ${JHORA_VARGA_NAMES[vargaIndex]} chart`;
/** The title depends on the chart (use paryaayaDasa(...).title); this is the Chara variant. */
export const PARYAAYA_TITLE = paryaayaTitleOf('Chara');

const ORDER: Record<ParyaayaKind, number[]> = {
  Ubhaya: [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11],
  Sthira: [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11],
  Chara: [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11],
};
const CANDIDATES: Record<ParyaayaKind, number[]> = { Ubhaya: [3, 6, 9], Sthira: [6], Chara: [4, 8] };
/** Division numbers of JHora's varga indices (0x591ed4). */
const DIVISION = [1, 9, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144, 90, 150, 2, 30, 1, 9];

/** Odd-footed direction of `sign` with its Saturn/Ketu flags. */
function footedDirection(sign: number, ctx: VargaCtx): 1 | -1 {
  const dir: 1 | -1 = Math.floor(sign / 3) % 2 === 0 ? 1 : -1;
  const rev = (dir === 1 ? -1 : 1) as 1 | -1;
  const sat = ctx.sign('Saturn') === sign, ketu = ctx.sign('Ketu') === sign;
  if (sat && ketu) return strongerByDignity('Saturn', 'Ketu', ctx) === 'Ketu' ? rev : 1;
  if (sat) return 1;
  if (ketu) return rev;
  return dir;
}

export interface ParyaayaDasa { kind: ParyaayaKind; title: string; periods: Period[] }

/** @param vargaIndex JHora varga index of ParyaayaDasaChart (default 6 = D-6). */
export function paryaayaDasa(chart: Chart, levels = 2, vargaIndex = PARYAAYA_DEFAULT_VARGA): ParyaayaDasa {
  const ctx = rasiCtx(chart, vargaIndex);
  const ref = (DIVISION[vargaIndex] + 11 + ctx.lagna) % 12;
  const kind: ParyaayaKind = ref % 3 === 0 ? 'Ubhaya' : ref % 3 === 1 ? 'Sthira' : 'Chara';
  const start = CANDIDATES[kind].reduce((acc, k) => strongerSign(acc, mod12(ref + k), ctx), ref);
  const dir = footedDirection(start, ctx);
  const seq = ORDER[kind].map((k) => mod12(start + k * dir));
  const years = seq.map((s) => narayanaYearsWithLord(s, ctx));
  const periods = buildRasiDasa(seq, years, (s) => lordOfStrong7Run(s, ctx), levels, true);
  return { kind, title: paryaayaTitleOf(kind, vargaIndex), periods };
}
