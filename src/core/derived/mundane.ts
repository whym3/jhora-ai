// Mundane tab (CMundaneFormView, dialog 2010), ported from jhora.exe.
//
// Form (DDX FUN_00462a30, message map 0x54cc38); every handler copies the form and
// calls a document routine that casts the chart, points doc+0x76d00 at the derived
// chart doc+0x279e0 with kind doc+0x76d04 = 5 ("mundane"), names it (doc+0x29078),
// sets DAT_008a4b68 = 1 (compress dasas) and stores the chart's period of effect in
// DAT_005922b0 (days):
//
//   button 1015 Swearing-in Chart Mode   0x462bd0 -> FUN_00409630  edit 100 years (double), 101 days:
//                                        period = years*365.24219 + days; the chart itself is unchanged;
//                                        label "%.0f-yr chart" (whole years) / "Chart of %.0f days"
//   button 1018 Planetary Transit Mode   0x462c10 -> FUN_00409780 -> FUN_0040a650
//                                        combo 1003 body (Lagna..Ketu), 1004 division, 1005 Before/After;
//                                        label "%s change (%s)" (division, body)
//   button 1052 Stationary Transit Mode  0x462c40 -> FUN_004099b0 -> FUN_0040a9d0 (FUN_0049c930)
//                                        combo 1053 Mars..Ketu (body = index+3), 1055 Before/After;
//                                        nodes refused with mean nodes; label "Retro change (%s)"
//   button 1021 Conjunction/Opposition   0x462d00 -> FUN_0040aae0 -> FUN_0040aeb0
//                                        combos 1009/1012 bodies, 1036 angle (table on the handler's
//                                        stack: 0,180,120,240,90,270,30,60,150,210,300,330), 1010 Before/After;
//                                        lon(body1) - lon(body2) = angle; label "%s-%s Opp" (180) / "%s-%s Conj"
//   button 1028 Eclipse Mode             0x462f60 -> FUN_0040b2a0: combo 1031 Previous/Next,
//                                        1032 Lunar / Global Solar / Local Solar, 1037 Start / Maximum;
//                                        swe_lun_eclipse_when / swe_sol_eclipse_when_glob / _loc
//   Lunar charts:  1022 Lunar New Year (combo 1029) FUN_00409e30, 1023 Lunar New Month (1011) FUN_0040a1c0,
//                  1043 Fortnight Chart (1044) FUN_0040a3b0 -> FUN_0040b050, 1026 New Lunar Day (1027) FUN_0040a420
//   Solar charts:  1019 Solar New Year (1046) FUN_00409b40, 1020 Solar New Month (1007) FUN_00409cc0,
//                  1038 Ardra Pravesha (1039) FUN_00409c50 = FUN_0040a650(Sun, division 2000)
//   (1060/1061 open the solar/lunar calendar option dialogs; 1016 Back to Natal Chart; 1014 dasa link.)
//
// Search bases: transit, stationary and conjunction searches start from the chart
// currently shown, moved by 0.0035 day backward/forward when it is a derived chart
// (so repeated clicks step); eclipses start from the chart shown; the lunar and
// solar charts and Ardra Pravesha always start from the natal (base) chart.
// Root finding is JHora's FUN_0049c0d0 -> FUN_0049c130 (ported in tajaka/search.ts:
// steps of 1/12 day with the lagna, 3 days with the Moon, else 10, then regula falsi
// and bisection to a 1-second bracket, its later end kept) and, for stations,
// FUN_0049c930 (20-day steps on the retrograde flag, bisection to 1 s).  Every result
// is stored as a chart record (FUN_0049d250) and later searches start from such
// records, so the JDs pass through swe_revjul / swe_julday (recordJd).
//
// Defaults (golden/jhora-defaults.ini): LunarYrDef=2 (amanta, sidereal: 0/1 purnimanta,
// 2/3 amanta, 4/5 solar; odd = tropical), LunarYrSign=11 (lunar year starts with the first
// new moon after the Sun enters Pisces), SolarYrSign=0, SolarYrTrop=0, TrueNodes,
// SpecialYearForTajaka=1, SpecialYearForTP=1, DasaSeshamInMundaneCharts=1, YearDefinition[0]=3,
// LifeCycleYearDefinition=3, LifeCycleYearLength=365.24219, LifeCycleYears=144.
//
// Compressed dasas (FUN_00408d90 tail): the year definition is YearDefinition[dasa],
// overridden by FUN_004093f0 for kind 5: chart name containing "Sol" -> 3 (Sun-longitude
// years) when SpecialYearForTajaka, containing "Lun" or "Moon" -> 4 (tithi years) when
// SpecialYearForTP. F = period in such years (FUN_004094b0); maha dasa years x F/120.
// Without DasaSeshamInMundaneCharts the dasa balance is dropped (doc+0x8fa08 = 0).
//
// Lifecycle charts (menu 33069 previous / 33070 next / 33073 options dialog 2026):
// FUN_004e73f0 moves the natal chart by +-LifeCycleYears with FUN_0049dae0 (year
// definition LifeCycleYearDefinition), at most 10 cycles, only in natal mode.
import type { Sweph } from '../../sweph';
import { SE } from '../../sweph';
import type { Chart } from '../chart';
import { calcFlags, siderealAscendant, siderealLongitude, GRAHAS, type Graha } from '../positions';
import { jhoraDeltaT } from '../deltat';
import { jhoraBodySearch, jhoraStation, n360 as jhoraNorm, recordRoundTrip, SECOND, type BodySearch } from '../tajaka/search';
import { calcSettingsFromIni, type Settings } from '../settings';
import { vimsottari, type Period } from '../dasas/vimsottari';
import { dasaClock, type DasaClock } from '../dasas/time';
import { compressPeriods, jhoraSunClock } from '../tajaka/mudda';
import { solarYearsToJd } from '../tajaka/annual';
import { formatHms } from '../keyInfo';
import type { JhoraIni } from '../../settings/generated';
import { DEFAULTS } from '../../settings/generated';

const n360 = (x: number) => ((x % 360) + 360) % 360;

/** JHora body index (combo order): 0 Lagna, 1 Sun ... 7 Saturn, 8 Rahu, 9 Ketu. */
export const MUNDANE_BODIES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
/** Short names JHora puts in chart labels ("Retro change (Ju)", "Mo-Su Opp", "Ang Ret As-Su"). */
export const BODY_SHORT = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'] as const;
/** Combo 1004 (division of the transit mode). */
export const TRANSIT_DIVISIONS = ['Rasi', 'Nakshatra', 'Navamsa', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-10', 'D-11',
  'D-12', 'D-16', 'D-20', 'D-24', 'D-27', 'D-30', 'D-40', 'D-45', 'D-60', 'D-108', 'D-144'];
/** Combo 1036 labels and the angle table of handler 0x462d00. */
export const ASPECTS: [string, number][] = [['Conjunction (yuti)', 0], ['Opposition (samasaptaka)', 180], ['Trine (5th)', 120],
  ['Trine (9th)', 240], ['Quadrant (4th)', 90], ['Quadrant (10th)', 270], ['2nd', 30], ['3rd', 60], ['6th', 150], ['8th', 210],
  ['11th', 300], ['12th', 330]];
/** Division counts 0x591ed4 (index = code - 1 for codes >= 2). */
const DIVISIONS = [1, 9, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144];
/** Chart-name table built by FUN_00409780: Rasi, Nakshatra, Navamsa, then 0x8a287c (D-2, D-3 ...). */
const DIVISION_NAMES = ['Rasi', 'Nakshatra', 'Navamsa', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-10', 'D-11', 'D-12',
  'D-16', 'D-20', 'D-24', 'D-27', 'D-30', 'D-40', 'D-45', 'D-60', 'D-81', 'D-108', 'D-144'];

/** Arc of one division for a FUN_0040a650 division code (combo index, or 1000+ / 2000 specials). */
export function divisionArc(code: number): number {
  if (code >= 1000) return 360;
  if (code === 1) return 360 / 27;
  return 30 / DIVISIONS[code === 0 ? 0 : code - 1];
}

/** Name used in "%s change (%s)". Note: combo items "D-108"/"D-144" compute (and name) D-81/D-108. */
export const divisionName = (code: number) => DIVISION_NAMES[code] ?? `D-${code}`;

// ---------------------------------------------------------------------------
// longitudes and JHora's searches

export interface Ctx {
  swe: Sweph;
  settings: Settings;
  geo: { lat: number; lon: number; alt: number };
  /** the chart's zone (east-positive hours), kept by every record a search makes */
  tz: number;
}

export function ctxOf(swe: Sweph, chart: Chart, tropical = false): Ctx {
  let settings = calcSettingsFromIni(chart.ini);
  if (tropical) settings = { ...settings, ayanamsa: 'tropical', ayanamsaDelta: 0 };
  return { swe, settings, geo: { lat: chart.birth.lat, lon: chart.birth.lon, alt: chart.birth.altitudeM }, tz: chart.birth.tzHours };
}

/** Longitude of a JHora body index (0 = lagna) at a UT moment (FUN_0049aaa0). */
export function bodyLon(c: Ctx, body: number, jd: number): number {
  if (body === 0) return siderealAscendant(c.swe, jd, c.geo, c.settings);
  return siderealLongitude(c.swe, jd, GRAHAS[body - 1], c.settings).lon;
}

const SWE_BODY = [SE.SUN, SE.MOON, SE.MARS, SE.MERCURY, SE.JUPITER, SE.VENUS, SE.SATURN];

/**
 * The longitude speed behind FUN_0049aaa0's retrograde flag: swe_calc of Swiss 2.02
 * with SEFLG_SIDEREAL (Lahiri) computes it without nutation and does not subtract the
 * ayanamsa's rate, i.e. it is the tropical speed with SEFLG_NONUT.
 */
export function bodySpeed(c: Ctx, body: number, jd: number): number {
  const jdEt = jd + (jhoraDeltaT(jd) ?? c.swe.deltaT(jd));
  const id = body >= 8 ? (c.settings.trueNodes ? SE.TRUE_NODE : SE.MEAN_NODE) : SWE_BODY[body - 1];
  return c.swe.calcEt(jdEt, id, calcFlags(c.settings) | SE.FLG_NONUT).speedLon;
}

/**
 * The JD a search starts from when `jd` is stored as a chart record first
 * (FUN_0049d250: swe_revjul(jd + zone/24) -> date and hour; FUN_0049d210 /
 * FUN_0049c130: swe_julday(date, hour - zone)).
 */
export function recordJd(c: Ctx, jd: number): number {
  return recordRoundTrip(c.swe, c.tz, jd);
}

/** FUN_0049c0d0 -> FUN_0049c130 from `from`: one body against `target`, or b1 against b2 + offset; the found record's JD. */
export function recordSearch(c: Ctx, s: Omit<BodySearch, 'lon'>, from: number): number {
  return recordJd(c, jhoraBodySearch({ ...s, lon: (b, t) => bodyLon(c, b, t) }, from));
}

const NEXT_STEP = 0.0035;

// ---------------------------------------------------------------------------
// the searches; each returns the chart moment and its period of effect (days).
// `base` is the JD of the record searched from (natal: its own moment; a derived
// chart shown: recordJd(moment -+ 0.0035)).

export interface MundaneMoment { jd: number; periodDays: number; label: string }

/**
 * FUN_0040a650: the body changes division (code = combo 1004 index, or 2000 = Ardra)
 * before/after `base`.  t0 = trunc(lon / arc) * arc of the record's longitude; both
 * boundaries t0 and t0 + arc are searched and the nearer kept; the period runs from it
 * to the nearer of the next two boundaries searched forward from 0.01 day later.
 */
export function transitChange(c: Ctx, body: number, code: number, base: number, after: boolean): { jd: number; periodDays: number } {
  const b = body === 9 && code !== 1 ? 8 : body;         // Ketu crosses with Rahu except in nakshatras
  const arc = divisionArc(code);
  let t0 = Math.trunc(bodyLon(c, b, base) / arc) * arc;
  if (code >= 1000 && code < 1012) t0 -= (1012 - code) * 30;
  if (code === 2000) t0 += 66.66666666666667;
  if (body === 9 && code === 1) t0 += 180;
  const A = recordSearch(c, { b1: b, target: t0, backward: !after }, base);
  const B = recordSearch(c, { b1: b, target: t0 + arc, backward: !after }, base);
  const useB = after ? A > B : A < B;
  const jd = useB ? B : A;
  const lower = useB ? (after ? 1 : 0) * arc + t0 : t0 - (after ? 1 : 0) * arc;
  const from = recordJd(c, jd + 0.01);
  const C = recordSearch(c, { b1: b, target: lower, backward: false }, from);
  const D = recordSearch(c, { b1: b, target: lower + arc, backward: false }, from);
  return { jd, periodDays: Math.min(C, D) - jd };
}

/**
 * FUN_0040a9d0: the body (3..9; Ketu searched as Rahu) becomes stationary before/after
 * `base` (FUN_0049c930); the period runs to the next station searched forward from it.
 */
export function stationaryChange(c: Ctx, body: number, base: number, after: boolean): { jd: number; periodDays: number } {
  const b = body === 9 ? 8 : body;
  const retro = (t: number) => bodySpeed(c, b, t) < 0;
  const jd = recordJd(c, jhoraStation(retro, base, after));
  const next = recordJd(c, jhoraStation(retro, jd, true));
  return { jd, periodDays: next - jd };
}

/** FUN_0040aeb0: lon(p1) - lon(p2) = angle before/after `base`; period until it recurs (searched from 0.0035 day later). */
export function aspectMoment(c: Ctx, p1: number, p2: number, angle: number, base: number, after: boolean): { jd: number; periodDays: number } {
  const jd = recordSearch(c, { b1: p1, b2: p2, offset: angle, backward: !after }, base);
  const next = recordSearch(c, { b1: p1, b2: p2, offset: angle, backward: false }, recordJd(c, jd + NEXT_STEP));
  return { jd, periodDays: next - jd };
}

/** FUN_0040acd0: the Sun reaches `start` (prev: backward, next: forward), then `end` after that. */
export function solarSpan(c: Ctx, start: number, end: number, base: number, next: boolean): { jd: number; end: number } {
  const jd = recordSearch(c, { b1: 1, target: start, backward: !next }, base);
  return { jd, end: recordSearch(c, { b1: 1, target: end, backward: false }, recordJd(c, jd + NEXT_STEP)) };
}

export interface LunarSolarOptions {
  /** LunarYrDef: 0/1 purnimanta, 2/3 amanta, 4/5 solar; odd = tropical */
  lunarYrDef: number;
  lunarYrSign: number;
  solarYrSign: number;
  solarYrTrop: boolean;
}

export function lunarSolarOptions(ini: Partial<JhoraIni>): LunarSolarOptions {
  const s = { ...DEFAULTS, ...ini };
  return { lunarYrDef: s.LunarYrDef, lunarYrSign: s.LunarYrSign, solarYrSign: s.SolarYrSign, solarYrTrop: s.SolarYrTrop !== 0 };
}

/** FUN_00409b40: Sun enters SolarYrSign (prev/next from the natal moment); period one year. Label "Solar Month". */
export function solarNewYear(swe: Sweph, natal: Chart, next: boolean, o = lunarSolarOptions(natal.ini)): MundaneMoment {
  const c = ctxOf(swe, natal, o.solarYrTrop);
  const t = o.solarYrSign * 30;
  const s = solarSpan(c, t, t, natal.positions.jdUt, next);
  return { jd: s.jd, periodDays: s.end - s.jd, label: 'Solar Month' };
}

/** FUN_00409cc0: the Sun's last (prev) or next sign ingress from the natal Sun; period until the next ingress. */
export function solarNewMonth(swe: Sweph, natal: Chart, next: boolean, tropical: boolean, label = 'Solar Month'): MundaneMoment {
  const c = ctxOf(swe, natal, tropical);
  const sun = bodyLon(c, 1, natal.positions.jdUt);
  let start = Math.trunc(sun / 30) * 30;
  if (next) start += 30;
  const s = solarSpan(c, start, n360(start + 30), natal.positions.jdUt, next);
  return { jd: s.jd, periodDays: s.end - s.jd, label };
}

/** FUN_00409c50: Ardra Pravesha, the Sun entering Ardra (66 deg 40'); label "Meteorological Yr". */
export function ardraPravesha(swe: Sweph, natal: Chart, next: boolean): MundaneMoment {
  const r = transitChange(ctxOf(swe, natal), 1, 2000, natal.positions.jdUt, next);
  return { ...r, label: 'Meteorological Yr' };
}

/**
 * FUN_00409e30: lunar year: FUN_0040acd0 finds the Sun entering LunarYrSign and the
 * next such ingress; amanta / purnimanta years then start at the first new / full
 * moon searched forward from each of the two records.  Label "Lunar Year".
 */
export function lunarNewYear(swe: Sweph, natal: Chart, next: boolean, o = lunarSolarOptions(natal.ini)): MundaneMoment {
  const tropical = o.lunarYrDef % 2 === 1;
  const t = o.lunarYrSign * 30;
  const s = solarSpan(ctxOf(swe, natal, tropical), t, t, natal.positions.jdUt, next);
  if (o.lunarYrDef >= 4) return { jd: s.jd, periodDays: s.end - s.jd, label: 'Lunar Year' };
  const c = ctxOf(swe, natal);
  const moon = { b1: 2, b2: 1, offset: o.lunarYrDef <= 1 ? 180 : 0, backward: false };
  const a = recordSearch(c, moon, s.jd), b = recordSearch(c, moon, s.end);
  return { jd: a, periodDays: b - a, label: 'Lunar Year' };
}

/** FUN_0040a1c0: lunar month from the natal moment (FUN_0040aeb0 with the Moon and Sun; solar months for LunarYrDef 4/5). */
export function lunarNewMonth(swe: Sweph, natal: Chart, next: boolean, o = lunarSolarOptions(natal.ini)): MundaneMoment {
  if (o.lunarYrDef >= 4) return solarNewMonth(swe, natal, next, o.lunarYrDef === 5, 'Lunar Month');
  const r = aspectMoment(ctxOf(swe, natal), 2, 1, o.lunarYrDef <= 1 ? 180 : 0, natal.positions.jdUt, next);
  return { ...r, label: 'Lunar Month' };
}

/**
 * FUN_0040a3b0 -> FUN_0040b050: the last / next new or full moon from the natal moment
 * (both searched, the nearer kept); the period runs to the other phase searched
 * forward from 0.0035 day later.
 */
export function fortnight(swe: Sweph, natal: Chart, next: boolean): MundaneMoment {
  const c = ctxOf(swe, natal);
  const base = natal.positions.jdUt;
  const phase = (offset: number, backward: boolean, from: number) => recordSearch(c, { b1: 2, b2: 1, offset, backward }, from);
  const a = phase(0, !next, base), b = phase(180, !next, base);
  const useB = next ? b < a : b > a;
  const jd = useB ? b : a;
  const end = phase(useB ? 0 : 180, false, recordJd(c, jd + NEXT_STEP));
  return { jd, periodDays: end - jd, label: 'Fortnight Chart' };
}

/** FUN_0040a420: start of the natal tithi (prev) or of the next tithi (next); period one tithi. */
export function newLunarDay(swe: Sweph, natal: Chart, next: boolean): MundaneMoment {
  const c = ctxOf(swe, natal);
  const base = natal.positions.jdUt;
  const e = n360(bodyLon(c, 2, base) - bodyLon(c, 1, base));
  let target = Math.trunc(e * 0.08333333333333333) * 12;
  if (next) target += 12;
  const jd = recordSearch(c, { b1: 2, b2: 1, offset: target, backward: !next }, base);
  const end = recordSearch(c, { b1: 2, b2: 1, offset: target + 12, backward: false }, recordJd(c, jd + NEXT_STEP));
  return { jd, periodDays: end - jd, label: 'Lunar Day' };
}

// ---------------------------------------------------------------------------
// eclipses (FUN_0040b2a0); Swiss eclipse functions are exported by our wasm build
// (tools/build-sweph.sh) but not wrapped by src/sweph, so they are called directly.

export type EclipseType = 0 | 1 | 2;   // Lunar, Global Solar, Local Solar
export const ECLIPSE_TYPES = ['Lunar', 'Global Solar', 'Local Solar'];

/** Contact names per tret index (the 30 CStrings of FUN_0040b2a0), per type. */
const CONTACT_NAMES: Record<EclipseType, string[]> = {
  0: ['Maximum eclipse point: ', '', 'Start of partial phase: ', 'End of partial phase: ', 'Start of totality: ', 'End of totality: ',
    'Start of penumbral phase: ', 'End of penumbral phase: ', '', ''],
  1: ['Maximum eclipse point: ', 'Local apparent noon eclipse point: ', 'Start of eclipse: ', 'End of eclipse: ',
    'Start of annularity/totality: ', 'End of annularity/totality: ', 'Start of eclipse on central line: ', 'End of eclipse on central line: ', '', ''],
  2: ['Maximum eclipse point: ', 'Start of eclipse: ', 'Start of annularity/totality: ', 'End of annularity/totality: ', 'End of eclipse: ', '', '', '', '', ''],
};
/** Display order of the contacts (tables on FUN_0040b2a0's stack). */
const CONTACT_ORDER: Record<EclipseType, number[]> = { 0: [6, 2, 4, 0, 5, 3, 7], 1: [2, 4, 0, 5, 3, 6, 7], 2: [1, 2, 0, 3, 4] };
/** Note shown above the contact list (0x57d29c, 0x57d13c, 0x57d0b8). */
export const ECLIPSE_NOTES: Record<EclipseType, string> = {
  0: 'Lunar eclipse shown below may or may not be visible at the place. Check if it is in the night time or not.',
  1: 'Solar eclipse times greatly vary from place to place. Global solar eclipse covers eclipse as seen at many places in the world. At the start time given, eclipse starts at some place or the other and it continues at some place or the other till the end time given below. If you want information about a specific city, try the local solar eclipse option.',
  2: 'Local solar eclipse may not be visible during the entire period listed below. Check if sunrise or sunset occurs during this period.',
};

export interface Eclipse extends MundaneMoment {
  type: EclipseType;
  /** Swiss tret[0..9] (JD UT, 0 = no such contact) */
  tret: number[];
  /** [name, JD] in JHora's display order, empty contacts skipped */
  contacts: [string, number][];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function eclipseWhen(swe: Sweph, type: EclipseType, jd: number, flags: number, backward: boolean, geo: Ctx['geo']): { ret: number; tret: number[] } {
  const m = (swe as unknown as { m: any }).m;
  const tret = m._malloc(8 * 10), attr = m._malloc(8 * 20), gp = m._malloc(8 * 3), serr = m._malloc(256);
  const H: Float64Array = m.HEAPF64;
  try {
    for (let i = 0; i < 10; i++) H[(tret >> 3) + i] = 0;
    let ret: number;
    if (type === 0) ret = m._swe_lun_eclipse_when(jd, flags, 0, tret, backward ? 1 : 0, serr);
    else if (type === 1) ret = m._swe_sol_eclipse_when_glob(jd, flags, 0, tret, backward ? 1 : 0, serr);
    else {
      H[gp >> 3] = geo.lon; H[(gp >> 3) + 1] = geo.lat; H[(gp >> 3) + 2] = geo.alt;
      ret = m._swe_sol_eclipse_when_loc(jd, flags, gp, tret, attr, backward ? 1 : 0, serr);
    }
    if (ret < 0) throw new Error(`eclipse search failed: ${m.UTF8ToString(serr)}`);
    return { ret, tret: Array.from({ length: 10 }, (_, i) => m.HEAPF64[(tret >> 3) + i]) };
  } finally { m._free(tret); m._free(attr); m._free(gp); m._free(serr); }
}

/** Eclipse label from Swiss's type bits (FUN_0040b2a0). */
function eclipseLabel(type: EclipseType, ret: number): string {
  if (type === 0) return ret & 4 ? 'Tot Lun Ecli' : ret & 64 ? 'Pen Lun Ecli' : ret & 16 ? 'Part Lun Ecli' : '';
  const total = type === 1 ? 'Tot Solar Ecli' : 'Total Solar Ecli';
  return ret & 4 ? total : ret & 8 ? 'Annular Solar Ecli' : ret & 16 ? 'Part Solar Ecli' : ret & 32 ? 'Ann Tot S.Ecli' : '';
}

/** Previous/next eclipse from `base`; the chart is cast at its start (first contact) or maximum. */
export function eclipse(c: Ctx, type: EclipseType, base: number, next: boolean, maximum: boolean): Eclipse {
  if (c.settings.topocentric) c.swe.setTopo(c.geo.lon, c.geo.lat, c.geo.alt);
  const flags = calcFlags(c.settings) | SE.FLG_SPEED;
  const idx = maximum ? 0 : [6, 2, 1][type];
  // Swiss converts its TT results with swe_deltat; JHora's DLL (2.02) uses its own model
  // (deltat.ts), which our build only sees pinned at one moment: search once to find the
  // eclipse, then again with delta-T pinned at it
  const when = (from: number, backward: boolean) => {
    c.swe.pinDeltaT(from);
    const r = eclipseWhen(c.swe, type, from, flags, backward, c.geo);
    c.swe.pinDeltaT(r.tret[0]);
    return eclipseWhen(c.swe, type, from, flags, backward, c.geo);
  };
  const first = when(base, !next);
  const jd = first.tret[idx];
  // FUN_0040b2a0 searches again forward from one day after the chart moment: the period of
  // effect runs until the same contact of the next eclipse
  const again = when(jd + 1, false);
  const contacts: [string, number][] = CONTACT_ORDER[type]
    .filter((i) => first.tret[i] !== 0 && first.tret[i] < 1e12)
    .map((i) => [CONTACT_NAMES[type][i], first.tret[i]]);
  return { jd, periodDays: again.tret[idx] - jd, label: eclipseLabel(type, first.ret), type, tret: first.tret, contacts };
}

/** FUN_004b2370 date text: "h:mm:ss (Month d, yyyy)" in the chart's zone. */
export function contactTime(swe: Sweph, jd: number, tzHours: number): string {
  const r = swe.revjul(jd + tzHours / 24);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${formatHms(r.hour)} (${MONTHS[r.month - 1]} ${r.day}, ${r.year})`;
}

// ---------------------------------------------------------------------------
// swearing-in label and lifecycle charts

/** FUN_00409630: label of a swearing-in chart of `years` (of 365.24219 days) plus `days`. */
export function swearingInLabel(periodDays: number): string {
  const y = Math.trunc(periodDays / 365.24219);
  return periodDays - y * 365.24219 === 0 ? `${y}-yr chart` : `Chart of ${periodDays.toFixed(0)} days`;
}

/**
 * FUN_004e73f0: the n-th lifecycle chart (n = 1..10): the natal chart moved by
 * n * LifeCycleYears years of LifeCycleYearDefinition (0: 365.2425 days, 1: 360 days,
 * 2: LifeCycleYearLength days, 3: Sun-longitude years, 4: 360-tithi years).
 */
export function lifecycleMoment(swe: Sweph, natal: Chart, n: number): number {
  const s = { ...DEFAULTS, ...natal.ini };
  const years = n * s.LifeCycleYears;
  const jd0 = natal.positions.jdUt;
  switch (s.LifeCycleYearDefinition) {
    case 0: return jd0 + years * 365.2425;
    case 1: return jd0 + years * 360;
    case 2: return jd0 + years * s.LifeCycleYearLength;
    case 4: return tithiClock(swe, natal).toJd(years);
    default: return solarYearsToJd(swe, natal, years, 3);
  }
}

// ---------------------------------------------------------------------------
// compressed dasas of a mundane chart

/** YearDefinition index -> nominal year length (jump table 0x4093cc). */
const YEAR_LEN = [365.24219, 360, NaN, 365.24219, 354.36708, NaN, 365.256364, 365.256364];

/** FUN_004093f0 for kind 5. */
export function mundaneYearDefinition(ini: Partial<JhoraIni>, label: string): number {
  const s = { ...DEFAULTS, ...ini };
  let def = s.YearDefinition?.[0] ?? 3;
  if (s.SpecialYearForTajaka && label.includes('Sol')) def = 3;
  if (s.SpecialYearForTP && (label.includes('Lun') || label.includes('Moon'))) def = 4;
  return def;
}

/**
 * Tithi years (FUN_0049dae0 mode 4 -> FUN_0049e3f0): the Moon gains 360 tithis (12 x 360 deg)
 * on the Sun per year.  From the record jd + years x 354.36708 + 15 days, FUN_0049c130 searches
 * backwards for Moon - Sun = norm(chartMoon - chartSun) + norm(years x 4320) (bodies Moon, Sun,
 * comparator 0x49a780); the result is a record.
 */
export function tithiClock(swe: Sweph, chart: Chart): DasaClock {
  const c = ctxOf(swe, chart);
  const jd0 = chart.positions.jdUt;
  const e0 = jhoraNorm(chart.positions.grahas.Moon.lon - chart.positions.grahas.Sun.lon);
  return {
    toJd: (years) => recordSearch(c, { b1: 2, b2: 1, offset: e0 + jhoraNorm(years * 4320), backward: true }, recordJd(c, years * 354.36708 + jd0 + 15)),
  };
}

/** FUN_0049de30 (year definition 7): JHora's search for the tropical Sun at chartSun + 360 x years (tajaka/annual.ts solarYearsToJd mode 7). */
function trueTropicalClock(swe: Sweph, chart: Chart): DasaClock {
  return { toJd: (years) => solarYearsToJd(swe, chart, years, 7) };
}

/** The dasa clock of a year definition, from the mundane chart's moment. */
export function mundaneClock(swe: Sweph, chart: Chart, def: number): DasaClock {
  const s = { ...DEFAULTS, ...chart.ini };
  switch (def) {
    case 0: return dasaClock(swe, chart, 'mean-tropical');
    case 1: return dasaClock(swe, chart, 'savana');
    case 2: return dasaClock(swe, chart, 'user', s.YearLength?.[0] ?? 365.24219);
    case 4: return tithiClock(swe, chart);
    case 5: case 6: return dasaClock(swe, chart, 'mean-sidereal');
    case 7: return trueTropicalClock(swe, chart);
    default: return jhoraSunClock(swe, chart);
  }
}

/**
 * FUN_004094b0: the period (days) measured in years of `def`: from y = 0, y += (target - clock(y)) /
 * nominal year length (the caller's table, 0x4093cc) until clock(y) (FUN_0049dae0) is within 1 s of
 * chart + period, at most 500 times.
 */
export function periodInYears(swe: Sweph, chart: Chart, periodDays: number, def: number): number {
  const len = def === 2 ? ({ ...DEFAULTS, ...chart.ini }.YearLength?.[0] ?? 365.24219) : YEAR_LEN[def] || 365.256364;
  const clock = mundaneClock(swe, chart, def);
  const jd0 = chart.positions.jdUt, target = jd0 + periodDays;
  let y = 0, jd = jd0;
  for (let i = 0; i < 500 && Math.abs(jd - target) > SECOND; i++) {
    y += (target - jd) / len;
    jd = clock.toJd(y);
  }
  return y;
}

export interface MundaneDasa { title: string; periods: Period[]; clock: DasaClock; compression: number; yearDefinition: number }

/** Vimsottari of a mundane chart compressed into its period of effect (FUN_00408d90 for kind 5). */
export function mundaneDasa(swe: Sweph, chart: Chart, periodDays: number, label: string, levels = 2): MundaneDasa {
  const def = mundaneYearDefinition(chart.ini, label);
  const F = periodInYears(swe, chart, periodDays, def);
  let base = vimsottari(chart.positions.grahas.Moon.lon, levels);
  const sesham = ({ ...DEFAULTS, ...chart.ini }.DasaSeshamInMundaneCharts ?? 1) !== 0;
  if (!sesham) {
    const s0 = base[0].start;
    const shift = (ps: Period[]): Period[] => ps.map((p) => ({ ...p, start: p.start - s0, end: p.end - s0, children: p.children && shift(p.children) }));
    base = shift(base);
  }
  return { title: 'Vimsottari Dasa', periods: compressPeriods(base, F / 120), clock: mundaneClock(swe, chart, def), compression: F, yearDefinition: def };
}

export type { Graha };
