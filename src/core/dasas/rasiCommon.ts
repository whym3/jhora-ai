// Shared pieces of JHora 8.0's Jaimini rasi dasa builders (FUN_00407920 ..
// FUN_00417770), used by the Yogardha, Paryaaya, Shoola, Niryaana Shoola,
// Brahma, Sthira, Mandooka, Navamsa and Varnada dasa modules.
//
//  - JHora's varga index (0 D-1, 1 D-9, 2 D-2, ... 6 D-6, ... 10 D-11; names
//    at 0x8a2874, division numbers at 0x591ed4) picks the chart; strength
//    comparisons always use the rasi-chart degrees.
//  - strong7(s) (FUN_004ab810) reads the table FUN_004ab2a0 fills with
//    FUN_004ab890(i, i+6) for i = 0..5, so Ar..Vi is argument a and wins ties.
//  - lord(s) (FUN_004ad3f0) resolves Aquarius/Scorpio with FUN_004ac110
//    (signLordByDistance); FUN_004ad370 uses FUN_004abeb0 (signLordJaimini).
//  - Saturn/Ketu flags SK[s] (chart+0x173d0+varga*0x30) are applied by
//    sequenceDirection (narayana.ts).
//  - All these builders set obj+0x8fa18 = 1: the generic engine (around
//    0x401cd7) then gives every sub-period 1/(sub count) of its parent, i.e.
//    twelfths. Sub-period signs come from the per-sign table obj+0x78b40, so
//    deeper levels re-use the antardasa rule of the sub-period's sign.
//  - No balance of dasa (obj+0x8fa08 = 0) and the user "start from" overrides
//    (chart+0x17eb4[dasa], 0x17ce0/0x17e40[varga]) are 12 = unused by default.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { SIGNS, signOf } from '../zodiac';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../vargas';
import { DEBILITATION, EXALTATION, signLordByDistance, strongerSign, type VargaCtx } from '../signStrength';
import { sequenceDirection } from './narayana';
import { strongerByDignity } from '../deities';

export const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** JHora's varga index -> our varga name (the order of the names table at 0x8a2874). */
export const JHORA_VARGAS: (VargaName | null)[] = [
  'D1', 'D9', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12', 'D16', 'D20', 'D24', 'D27',
  'D30', 'D40', 'D45', 'D60', 'D81', 'D108', 'D144', null, null, null, null, null, null,
];
/** The names JHora prints for its varga indices (CString array 0x8a2874). */
export const JHORA_VARGA_NAMES = [
  'D-1', 'D-9', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-10', 'D-11', 'D-12', 'D-16', 'D-20', 'D-24', 'D-27',
  'D-30', 'D-40', 'D-45', 'D-60', 'D-81', 'D-108', 'D-144', '', '', 'D-150', 'Hora', 'Hadda', 'D-1 (B)',
];

export interface RasiCtx extends VargaCtx {
  /** lagna sign in this varga */
  lagna: number;
}

/** Planet signs in one varga (by JHora varga index) with rasi-chart degrees. */
export function rasiCtx(chart: Chart, vargaIndex = 0): RasiCtx {
  const name = JHORA_VARGAS[vargaIndex];
  if (!name) throw new Error(`varga index ${vargaIndex} not supported`);
  const spec = ALL_VARGAS[name];
  const p = chart.positions;
  return {
    sign: (g) => signOf(vargaLongitude(p.grahas[g].lon, spec)),
    degree: (g) => p.grahas[g].lon % 30,
    lagna: signOf(vargaLongitude(p.ascendant, spec)),
  };
}

/** FUN_004ab810: stronger of s and its 7th, the sign of Ar..Vi as first argument. */
export const strong7 = (s: number, ctx: VargaCtx) => {
  const low = mod12(s) % 6;
  return strongerSign(low, low + 6, ctx);
};

/** FUN_004ad3f0. */
export const dasaLord = signLordByDistance;

/** FUN_004acc50 with the lord given: Narayana dasa years of `sign` (1..12, 0 possible). */
export function narayanaYearsWithLord(sign: number, ctx: VargaCtx): number {
  const lord = dasaLord(sign, ctx);
  const p = ctx.sign(lord);
  const d = Math.floor(sign / 3) % 2 === 0 ? p - sign : sign - p;
  let y = mod12(d) === 0 ? 12 : mod12(d);
  if (EXALTATION[lord] === p && y < 12) y++;
  if (DEBILITATION[lord] === p && y > 0) y--;
  return y;
}

/** Sthira dasa years: 7 movable, 8 fixed, 9 dual. */
export const sthiraYears = (s: number) => 7 + (s % 3);

/** Twelve signs from `from`, `step` signs at a time. */
export const run = (from: number, step: number) => Array.from({ length: 12 }, (_, i) => mod12(from + step * i));

/**
 * The "Narayana-style" antardasa list used by most of these builders: from the
 * sign holding the lord of strong7(s), zodiacal if that sign is odd and backwards
 * if even, with the Saturn/Ketu flags of strong7(s).
 */
export function lordOfStrong7Run(s: number, ctx: VargaCtx): number[] {
  const base = strong7(s, ctx);
  const from = ctx.sign(dasaLord(base, ctx));
  return run(from, sequenceDirection(from, ctx, base));
}

/** Builds periods of twelfths, `levels` deep, with `subs(sign)` giving the sub-period signs. */
export function subdivideSigns(p: Period, sign: number, subs: (s: number) => number[], levels: number): Period {
  if (levels <= 0) return p;
  const list = subs(sign);
  const len = (p.end - p.start) / list.length;
  const children = list.map((s, i) =>
    subdivideSigns({ lord: 'Sun', label: SIGNS[s], start: p.start + i * len, end: p.start + (i + 1) * len }, s, subs, levels - 1));
  return { ...p, children };
}

/**
 * Maha dasas from birth: the signs `seq` with `years`; when `secondCycle` is set
 * the twelve signs repeat with 12 minus their first-cycle years (as the builders
 * that store 24 periods do).
 */
export function buildRasiDasa(seq: number[], years: number[], subs: (s: number) => number[], levels: number, secondCycle: boolean): Period[] {
  const out: Period[] = [];
  let t = 0;
  for (let cycle = 0; cycle < (secondCycle ? 2 : 1); cycle++) {
    seq.forEach((s, i) => {
      const y = cycle === 0 ? years[i] : 12 - years[i];
      out.push(subdivideSigns({ lord: 'Sun', label: SIGNS[s], start: t, end: t + y }, s, subs, levels - 1));
      t += y;
    });
  }
  return out;
}

/** Sign of a named body of the Longitudes table (D-1). */
export function bodySign(chart: Chart, name: string): number {
  const b = chart.longitudes.find((x) => x.name === name);
  if (!b) throw new Error(`body ${name} missing`);
  return signOf(b.lon);
}

// ---- Narayana-family sequences and the Parasara-style antardasa tables ----

/**
 * SK[s] as FUN_004ab2a0 stores it: 1 = Saturn in s (or Saturn and Ketu there
 * with Saturn the stronger by FUN_004ac7d0), 2 = Ketu in s (or both, Ketu
 * stronger), 0 = neither.
 */
export function skFlag(s: number, ctx: VargaCtx): 0 | 1 | 2 {
  const sat = ctx.sign('Saturn') === s, ketu = ctx.sign('Ketu') === s;
  if (sat && ketu) return strongerByDignity('Saturn', 'Ketu', ctx) === 'Ketu' ? 2 : 1;
  return sat ? 1 : ketu ? 2 : 0;
}

/** Offsets of the Narayana-type builders (FUN_00414060, 0x414d30, 0x4151f0) by modality of the start. */
export const NARAYANA_ROWS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7],
  [0, 4, 8, 9, 1, 5, 6, 10, 2, 3, 7, 11],
];

/**
 * Maha dasa signs of the Narayana-type builders: direction +1 when (s+8)/3 is
 * even (Ar Le Vi Li Aq Pi), -1 otherwise; SK flag 1 forces +1 AND the movable
 * (sign by sign) row, flag 2 reverses the direction.
 */
export function narayanaTypeSequence(start: number, ctx: VargaCtx): number[] {
  let row = start % 3;
  let dir = Math.floor((start + 8) / 3) % 2 === 0 ? 1 : -1;
  const f = skFlag(start, ctx);
  if (f === 1) { dir = 1; row = 0; } else if (f === 2) dir = -dir;
  return NARAYANA_ROWS[row].map((k) => mod12(start + dir * k));
}

/** Offsets of the Parasara-style antardasas (Drigdasa, Trikona, Chara dasa) by modality of the dasa sign. */
export const PARASARA_AD_ROWS = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7],
  [0, 3, 6, 9, 4, 7, 10, 1, 8, 11, 2, 5],
];

/**
 * Antardasas of Drigdasa (Parasara option), Trikona and Chara (Parasara) dasa:
 * from strong7 of the dasa sign s, the row of s's modality, zodiacal when s is
 * odd (Ar, Ge, ...) and backwards when even; no Saturn/Ketu flags.
 */
export function parasaraAntardasas(s: number, ctx: VargaCtx): number[] {
  const base = strong7(s, ctx);
  const dir = s % 2 === 0 ? 1 : -1;
  return PARASARA_AD_ROWS[s % 3].map((k) => mod12(base + dir * k));
}
