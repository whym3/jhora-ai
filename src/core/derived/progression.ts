// Miscellany > Progressions (CProgFormView, dialog 2014, message map 0x54d6c8).
//
// Form (DDX 0x470ec0): combo 1007 varga (+0x7c), combo 1013 seed body (+0x80),
// combo 1014 nakshatra dasa (+0x84), combo 1003 month (+0x8c), edit 100 day
// (+0x90), edit 101 year (+0x88), edits 1004/1005/1006 hour/min/sec (doubles).
// There is no time-zone field: the progression date is read in the natal zone
// (the date struct is a copy of the natal record, FUN_0049d660).
// Buttons (all pass varga, year, month, day, h, m, s to a document routine):
//   1001 0x470fd0 -> FUN_00418f70  solar progression ("Progressed (%d deg)" /
//                                  "Progressed (%d:%02d deg)", strings 0x577f44/0x577f28)
//   1012 0x4710b0 -> FUN_00419230  Bhrigu pada progression ("Progressed (Bhrigu)")
//   1008 0x4711b0 -> FUN_004196b0  Sudarsana chakra dasa progression ("Progressed (SCD)")
//   1009 0x4712b0 -> FUN_00419aa0  nakshatra dasa progression ("Prog (NaksDasa)"),
//                                  extra args seed body (1013) and dasa (1014)
//   1011 0x4713a0 -> FUN_0041a050 (Yogini) and 1010 0x471490 -> FUN_0041a540 (KCD)
//   are wired in the message map but have no control in dialog 2014 (unreachable).
// The derived chart has kind doc+0x76d04 = 4.
//
// Common step (all four routines): the chart for the progression date is cast
// (FUN_0049bcf0) and the *true solar arc* since birth is resolved with the mean
// motion 0.9856473590852141 deg/day (360/365.256364):
//     arc = (Sun(date) - Sun(natal)) + ((year - birthYear) - 4) * 360
//     while |arc - (jd - jd0) * 0.98564736| > 30: arc += 360            (FUN_004ae520 = fabs)
// i.e. `arc / 360` completed sidereal solar years.
//
// * Solar (FUN_00418f70): step = 30 / n degrees per year in D-n (division table
//   0x591ed4 indexed by the combo: 1,9,2,3,...,45,60,81 - so the last entry,
//   labelled "D-108", is really D-81 in jhora.exe). The chart is the natal chart
//   moved in time until the Sun has advanced arc*step/360 degrees:
//   FUN_0049dac0(arc*step/360/360 years, mode 3 = true sidereal solar years).
//   It is a real chart (all bodies valid); label from the DMS split of `step`.
// * Bhrigu (FUN_00419230): the chart of the progression date (no natal swap: lagna,
//   nodes and the rest are of that moment, as JHora's longitudes show) with Sun..Saturn
//   replaced by natal + arc / k, k = 19, 45, 14, 46, 83, 27, 30 years per revolution
//   (stack table; doc+0x4f030 overrides, flags doc+0x4efb8).  Its Key Info was not
//   captured: we take the panchanga from the replaced positions.
// * SCD (FUN_004196b0): arc reduced to (0, 4320] (12-year cycle), shift = arc/12
//   (one sign per year) stored at chart+0x275d0 with flags 0x275c9/0x275ca, which
//   make the varga routines (0x4a0da1, 0x4a11c2) add the shift to the
//   *divisional* longitude of all 105 bodies in every varga.
// * Nakshatra dasa (FUN_00419aa0): the chosen dasa is computed in the chosen varga
//   with the chosen seed body (seed option table [4,8,0,9..15] by body); FUN_00401820
//   finds the running periods at the date (6 levels) and turns them into a
//   "progressed seed": base + sum(index_k * unit / N^k) + fraction * unit / N^5,
//   with base and unit doc+0x9f0f0 / +0x9f0f8 as the dasa builder leaves them (see
//   progressedSeed: the seed's star for Vimsottari, Yogini and Sataabdika, its pada for
//   Kalachakra, else Aries 0) and N the sub-period count (equal arcs per sub-period, not
//   proportional to their years); the date is read with the dasa's year definition
//   (YearDefinition[slot]). shift = progressed seed - natal seed (varga), applied like
//   SCD (flags 0x275c8/9/a).
// SCD and nakshatra dasa (and Yogini / KCD) set the derived record's flag +0x275c8:
// it shows the progression date, but FUN_00403120 computes it from the natal date,
// time and zone and FUN_004a0520 adds the shift only at its end, so Key Info is the
// natal one under the progression date (BirthData.castAt, override.afterPanchanga).
//
// The derived chart is expressed with BirthData.override (rasi longitudes). For the
// varga-space shifts (SCD, nakshatra dasa) the override carries natal + shift in the
// rasi chart, which equals JHora in D-1 only; progressedVargaLongitudes() returns
// the exact JHora divisional longitudes for any varga.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { BirthData, PositionOverride } from '../jhd';
import { GRAHAS, norm360, siderealLongitude, type Graha } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { vargaLongitude, type VargaName } from '../vargas';
import { vargaSpec } from '../vargaOptions';
import { solarYearsToJd } from '../tajaka/annual';
import { splitDms } from '../keyInfo';
import { slotClock } from '../dasas/yearDefinition';
import { kalachakraDasa, kalachakraLevel, kalachakraMahaId } from '../dasas/kalachakra';
import { vimsottari, subdivide, type Period } from '../dasas/vimsottari';
import { NAKSHATRA_DASAS, nakshatraDasa, type NakshatraDasaDef } from '../dasas/nakshatra';
import { birthAt, birthWithOverride } from './common';

/** Combo 1007 labels, in order. */
export const PROG_VARGA_LABELS = ['Rasi', 'Navamsa', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-10', 'D-11', 'D-12', 'D-16', 'D-20', 'D-24', 'D-27', 'D-30', 'D-40', 'D-45', 'D-60', 'D-108'];
/** Divisions jhora.exe actually uses for each combo index (table 0x591ed4). */
export const PROG_VARGA_DIVISIONS = [1, 9, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81];
/** Combo 1013 (seed body). */
export const PROG_BODIES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
export type ProgBody = (typeof PROG_BODIES)[number];
/** Combo 1014 (nakshatra dasa) -> our dasa key (null = Vimsottari). */
export const PROG_DASAS: [string, string | null][] = [
  ['Vimsottari', null], ['Ashtottari', 'Ashtottari'], ['Kalachakra', 'Kalachakra'], ['Yogini', 'Yogini'],
  ['Dwisaptati sama', 'Dwisaptati sama'], ['Shattrimsa sama', 'Shattrimsa sama'], ['Dwadasottati', 'Dwadasottari'],
  ['Chaturaseeti sama', 'Chaturaseeti sama'], ['Satabdika', 'Sataabdika'], ['Shodasottari', 'Shodasottari'],
  ['Panchottari', 'Panchottari'], ['Shashtisama', 'Shashtihayani'],
];

export type ProgressionKind = 'solar' | 'bhrigu' | 'scd' | 'nakshatra';

export interface ProgressionInput {
  kind: ProgressionKind;
  /** combo 1007 index */
  varga: number;
  /** progression date, natal time zone */
  year: number; month: number; day: number; hour: number;
  /** combo 1013 index (nakshatra dasa seed), default 2 = Moon */
  body?: number;
  /** combo 1014 index, default 0 = Vimsottari */
  dasa?: number;
}

export interface Progression {
  kind: ProgressionKind;
  label: string;
  /** JD (UT) of the progression date */
  jd: number;
  /** true solar arc since birth (degrees) */
  arc: number;
  /** divisions of the chosen varga */
  n: number;
  /** degrees added in varga space (SCD, nakshatra) */
  shift?: number;
  /** progressed seed longitude in the varga (nakshatra) */
  seed?: number;
  /** birth data of the derived chart */
  birth: BirthData;
  /** JD the derived chart is cast for (solar: the progressed moment; Bhrigu: the progression date; SCD, nakshatra: natal) */
  chartJd: number;
}

/** Years per revolution of Sun..Saturn in Bhrigu pada progression (FUN_00419230). */
export const BHRIGU_YEARS: Record<'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn', number> = {
  Sun: 19, Moon: 45, Mars: 14, Mercury: 46, Jupiter: 83, Venus: 27, Saturn: 30,
};

const MEAN_SUN = 0.9856473590852141;
const NAK = 360 / 27;

export const vargaNameOf = (n: number) => `D${n}` as VargaName;
const lonOf = (natal: Chart, b: ProgBody) => (b === 'Lagna' ? natal.positions.ascendant : natal.positions.grahas[b].lon);

/** True solar arc (degrees) from birth to `jd` (common step of FUN_00418f70 etc.). */
export function solarArc(swe: Sweph, natal: Chart, jd: number, year: number): number {
  const s = calcSettingsFromIni(natal.ini);
  const sun = siderealLongitude(swe, jd, 'Sun', s).lon;
  const mean = (jd - natal.positions.jdUt) * MEAN_SUN;
  let arc = (sun - natal.positions.grahas.Sun.lon) + ((year - natal.birth.year) - 4) * 360;
  for (let i = 0; Math.abs(arc - mean) > 30 && i < 1000; i++) arc += 360;
  return arc;
}

/** "Progressed (3:20 deg)" / "Progressed (30 deg)" for a step in degrees. */
export function solarLabel(step: number): string {
  const { d, m } = splitDms(step);
  return d === step ? `Progressed (${d} deg)` : `Progressed (${d}:${String(m).padStart(2, '0')} deg)`;
}

/** Child periods of a nakshatra dasa period (same sequence from the period's lord, proportional to years). */
function children(p: Period, def: NakshatraDasaDef | null): Period[] {
  if (!def) return subdivide(p, 1).children!;
  const total = def.lords.reduce((a, [, y]) => a + y, 0);
  const i0 = def.lords.findIndex(([g]) => g === p.lord);
  const out: Period[] = [];
  let t = p.start;
  for (let i = 0; i < def.lords.length; i++) {
    const [lord, years] = def.lords[(i0 + i) % def.lords.length];
    const len = ((p.end - p.start) * years) / total;
    out.push({ lord, start: t, end: t + len });
    t += len;
  }
  return out;
}

/**
 * Base and unit of FUN_00401820's sum, doc+0x9f0f0 / doc+0x9f0f8 (= engine obj+0x283d0 /
 * +0x283d8, the engine object being doc+0x76d20): the dispatcher FUN_00408d90 resets them to
 * 0 and 13 deg 20' (0x408e1a) before every builder; only Vimsottari (0x40c0b6), Yogini
 * (0x40e335) and Sataabdika (0x40f5cd) then set base = trunc(seed x 0.075) x 13 deg 20' (the
 * seed's star), and Kalachakra (0x40d3a9) base = trunc(seed x 0.3) x 3 deg 20' (its pada) with
 * unit 3 deg 20'. Ashtottari, Dwisaptati, Shattrimsa, Dwadasottari, Chaturaseeti, Shodasottari,
 * Panchottari and Shashtihayani keep base 0 (Aries 0) and unit one star.
 */
const STAR_BASED = new Set<string | null>([null, 'Yogini', 'Sataabdika']);
const STAR = 13.333333333333334, PADA = 3.3333333333333335;

/**
 * FUN_00401820: the progressed seed longitude at `years` dasa years after birth, from the
 * running periods of 6 levels: base + sum_k index_k x unit / N^k + fraction x unit / N^5,
 * index_k = the running period's position in its level's list and N the entry count of the
 * deepest level (obj+0x28400 after the last FUN_00401c20 call: the sub-period count), i.e.
 * equal arcs per sub-period, not proportional to their years. Grouped dasas (Ashtottari,
 * Shashtihayani) run their maha dasas from the seed's group as the Dasas tab lists them;
 * Kalachakra its nine maha padas with the antardasas of each pada's row.
 */
export function progressedSeed(seedLon: number, dasaKey: string | null, years: number, rohini4InLeo = true): number {
  type Node = { period: Period; id: number; maha: boolean };
  let list: Node[], sub: (n: Node) => Node[], base: number, unit: number, n: number;
  if (dasaKey === 'Kalachakra') {
    list = kalachakraDasa(seedLon, 9, rohini4InLeo, 1).periods.map((period, i) => ({ period, id: kalachakraMahaId(seedLon, i), maha: true }));
    sub = (x) => kalachakraLevel(x.period, x.id, x.maha, rohini4InLeo).map((c) => ({ ...c, maha: false }));
    base = Math.trunc(seedLon * 0.3) * PADA;
    unit = PADA;
    n = 9;
  } else {
    const def = dasaKey ? NAKSHATRA_DASAS[dasaKey] : null;
    if (dasaKey && !def) throw new Error(`nakshatra dasa progression: ${dasaKey} not ported`);
    const wrap = (period: Period): Node => ({ period, id: 0, maha: false });
    list = (def ? nakshatraDasa(def, seedLon, 1) : vimsottari(seedLon, 1)).map(wrap);
    sub = (x) => children(x.period, def).map(wrap);
    base = STAR_BASED.has(dasaKey) ? Math.trunc(seedLon * 0.075) * STAR : 0;
    unit = STAR;
    n = def ? def.lords.length : 9;
  }
  // JHora's maha dasa list covers a fixed number of cycles (one; Yogini and Shattrimsa
  // sama three); a later date is found in it modulo its span (the pane's cycle offset
  // DAT_0071fbbc), so the period index - and with it the progressed seed - starts again
  const first = list[0].period, last = list[list.length - 1].period;
  const span = last.end - first.start;
  while (years >= last.end) years -= span;
  let lon = base;
  for (let level = 0; level < 6; level++) {
    let idx = list.findIndex((x) => years >= x.period.start && years < x.period.end);
    if (idx < 0) idx = years < list[0].period.start ? 0 : list.length - 1;
    const p = list[idx];
    lon += idx * unit;
    if (level === 5) lon += ((years - p.period.start) / (p.period.end - p.period.start)) * unit;
    unit /= n;
    list = sub(p);
  }
  return norm360(lon);
}

/** Dasa years at `jd` for the natal dasa clock of nakshatra dasa slot `slot` (inverse of its toJd). */
export function dasaYearsAt(swe: Sweph, natal: Chart, jd: number, slot = 0): number {
  const clock = slotClock(swe, natal, slot);
  let y = (jd - natal.positions.jdUt) / 365.256364;
  for (let i = 0; i < 20; i++) {
    const t = clock.toJd(y);
    const dy = (jd - t) / 365.256364;
    y += dy;
    if (Math.abs(dy) < 1e-12) break;
  }
  return y;
}

/**
 * Birth data of a shifted progression (SCD, nakshatra dasa): FUN_004196b0 /
 * FUN_00419aa0 write the progression date into the derived record and set its flags
 * +0x275c8..ca, so FUN_00403120 computes the chart from the natal date, time and zone
 * and FUN_004a0520 adds the shift at its end: Key Info shows the progression date
 * with the natal panchanga, sunrise and sidereal time, and every body (lagna, grahas,
 * upagrahas, special lagnas, arudhas...) is natal + shift.
 */
function shiftedBirth(natal: Chart, inp: ProgressionInput, shift: number): BirthData {
  const b = natal.birth;
  return {
    ...b, year: inp.year, month: inp.month, day: inp.day, hour: inp.hour, legacy: null,
    castAt: { year: b.year, month: b.month, day: b.day, hour: b.hour },
    override: { shift, afterPanchanga: true },
  };
}

/** The progressed chart for one of the four buttons. */
export function progression(swe: Sweph, natal: Chart, inp: ProgressionInput): Progression {
  const b = natal.birth;
  const jd = swe.julday(inp.year, inp.month, inp.day, inp.hour - b.tzHours);
  const arc = solarArc(swe, natal, jd, inp.year);
  const n = PROG_VARGA_DIVISIONS[inp.varga] ?? 1;
  const base = { jd, arc, n };
  switch (inp.kind) {
    case 'solar': {
      const step = 30 / n;
      const chartJd = solarYearsToJd(swe, natal, (arc * step) / 360 / 360, 3);
      return { ...base, kind: 'solar', label: solarLabel(step), birth: birthAt(swe, natal, chartJd), chartJd };
    }
    case 'bhrigu': {
      const grahas: PositionOverride['grahas'] = {};
      for (const [g, k] of Object.entries(BHRIGU_YEARS) as [Graha, number][]) grahas[g] = norm360(natal.positions.grahas[g].lon + arc / k);
      const at = { ...b, year: inp.year, month: inp.month, day: inp.day, hour: inp.hour };
      return { ...base, kind: 'bhrigu', label: 'Progressed (Bhrigu)', birth: birthWithOverride(b, { grahas, afterBodies: true }, at), chartJd: jd };
    }
    case 'scd': {
      let a = arc;
      while (a > 4320) a -= 4320;
      const shift = a / 12;
      return { ...base, kind: 'scd', label: 'Progressed (SCD)', shift, birth: shiftedBirth(natal, inp, shift), chartJd: natal.positions.jdUt };
    }
    case 'nakshatra': {
      const body = PROG_BODIES[inp.body ?? 2];
      const dasaKey = PROG_DASAS[inp.dasa ?? 0][1];
      const seed0 = vargaLongitude(lonOf(natal, body), vargaSpec(vargaNameOf(n), natal.ini));
      const seed = progressedSeed(seed0, dasaKey, dasaYearsAt(swe, natal, jd, inp.dasa ?? 0), natal.ini.KCDRohini4NavamsaInLeo !== 0);
      const shift = norm360(seed - seed0);
      return { ...base, kind: 'nakshatra', label: 'Prog (NaksDasa)', shift, seed, birth: shiftedBirth(natal, inp, shift), chartJd: natal.positions.jdUt };
    }
  }
}

/**
 * Longitudes of the progressed chart in varga `v`, as JHora shows them: for SCD and
 * nakshatra progressions the shift is added to the divisional longitude
 * (FUN_004a0da1 / 0x4a11c2); otherwise the varga of the progressed rasi longitude.
 */
export function progressedVargaLongitudes(natal: Chart, p: Progression, v: VargaName, chart?: Chart): Record<ProgBody, number> {
  const spec = vargaSpec(v, natal.ini);
  const out = {} as Record<ProgBody, number>;
  for (const body of PROG_BODIES) {
    if (p.shift !== undefined) out[body] = norm360(vargaLongitude(lonOf(natal, body), spec) + p.shift);
    else {
      const src = chart ?? natal;
      const o = p.birth.override;
      const lon = body === 'Lagna' ? (o?.ascendant ?? src.positions.ascendant) : (o?.grahas?.[body] ?? src.positions.grahas[body].lon);
      out[body] = vargaLongitude(lon, spec);
    }
  }
  return out;
}
