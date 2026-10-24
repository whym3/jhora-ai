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
// Root finding is JHora's FUN_0049c0d0 -> FUN_0049c130: step (lagna 1/12 day,
// Moon 3 days, others 10) until (lon - target) mod 360 jumps between the >240 and
// <120 bands, then bisection to a 1-second bracket, taking its later end.
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
import { calcFlags, computePositions, siderealLongitude, GRAHAS, type Graha } from '../positions';
import { calcSettingsFromIni, type Settings } from '../settings';
import { vimsottari, type Period } from '../dasas/vimsottari';
import { dasaClock, type DasaClock } from '../dasas/time';
import { compressPeriods } from '../tajaka/mudda';
import { solarYearsToJd } from '../tajaka/annual';
import { formatHms } from '../keyInfo';
import type { JhoraIni } from '../../settings/generated';
import { DEFAULTS } from '../../settings/generated';

const n360 = (x: number) => ((x % 360) + 360) % 360;
const wrap180 = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d <= -180) d += 360; return d; };

/** JHora body index (combo order): 0 Lagna, 1 Sun ... 7 Saturn, 8 Rahu, 9 Ketu. */
export const MUNDANE_BODIES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
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
// longitudes and JHora's root finder

export interface Ctx {
  swe: Sweph;
  settings: Settings;
  geo: { lat: number; lon: number; alt: number };
}

export function ctxOf(swe: Sweph, chart: Chart, tropical = false): Ctx {
  let settings = calcSettingsFromIni(chart.ini);
  if (tropical) settings = { ...settings, ayanamsa: 'tropical', ayanamsaDelta: 0 };
  return { swe, settings, geo: { lat: chart.birth.lat, lon: chart.birth.lon, alt: chart.birth.altitudeM } };
}

/** Longitude of a JHora body index (0 = lagna) at a UT moment. */
export function bodyLon(c: Ctx, body: number, jd: number): number {
  if (body === 0) return computePositions(c.swe, jd, c.geo, c.settings).ascendant;
  return siderealLongitude(c.swe, jd, GRAHAS[body - 1], c.settings).lon;
}

export function bodySpeed(c: Ctx, body: number, jd: number): number {
  return siderealLongitude(c.swe, jd, GRAHAS[body - 1], c.settings).speed;
}

const stepOf = (body: number) => (body === 0 ? 1 / 12 : body === 2 ? 3 : 10);
const SECOND = 1 / 86400;

/**
 * FUN_0049c130: first moment from `from` in direction `dir` at which f crosses `target`
 * (f an angle), bracketed by `step` and bisected to 1 s; returns the later bracket end.
 */
export function crossing(f: (jd: number) => number, target: number, from: number, dir: 1 | -1, step: number, tol = SECOND): number {
  const g = (t: number) => n360(f(t) - target);
  let a = from, ga = g(a);
  for (let i = 0; i < 40000; i++) {
    const b = a + dir * step, gb = g(b);
    if ((ga > 240 && gb < 120) || (ga < 120 && gb > 240)) {
      let lo = a, hi = b, glo = ga;
      while (Math.abs(hi - lo) > tol) {
        const m = (lo + hi) / 2, gm = g(m);
        if ((glo > 180) === (gm > 180)) { lo = m; glo = gm; } else hi = m;
      }
      return Math.max(lo, hi);
    }
    a = b; ga = gb;
  }
  throw new Error('crossing not found');
}

/** First zero of a body's longitude speed (station) from `from` in direction `dir` (FUN_0049c930). */
export function station(c: Ctx, body: number, from: number, dir: 1 | -1): number {
  const step = body >= 8 ? 0.25 : 1;
  let a = from, sa = bodySpeed(c, body, a);
  for (let i = 0; i < 400000; i++) {
    const b = a + dir * step, sb = bodySpeed(c, body, b);
    if ((sa < 0) !== (sb < 0)) {
      let lo = a, hi = b, slo = sa;
      while (Math.abs(hi - lo) > SECOND) {
        const m = (lo + hi) / 2, sm = bodySpeed(c, body, m);
        if ((sm < 0) === (slo < 0)) { lo = m; slo = sm; } else hi = m;
      }
      return Math.max(lo, hi);
    }
    a = b; sa = sb;
  }
  throw new Error('station not found');
}

// ---------------------------------------------------------------------------
// the searches; each returns the chart moment and its period of effect (days)

export interface MundaneMoment { jd: number; periodDays: number; label: string }

/** FUN_0040a650: the body changes division (code = combo 1004 index, or 2000 = Ardra) before/after `base`. */
export function transitChange(c: Ctx, body: number, code: number, base: number, after: boolean): { jd: number; periodDays: number } {
  const b = body === 9 && code !== 1 ? 8 : body;         // Ketu crosses with Rahu except in nakshatras
  const arc = divisionArc(code);
  const f = (t: number) => bodyLon(c, b, t);
  let t0 = Math.floor(f(base) / arc) * arc;
  if (code >= 1000 && code < 1012) t0 -= (1012 - code) * 30;
  if (code === 2000) t0 += 66.66666666666667;
  const dir = after ? 1 : -1;
  const step = stepOf(b);
  const A = crossing(f, t0, base, dir, step), B = crossing(f, t0 + arc, base, dir, step);
  const useB = after ? A > B : A < B;
  const jd = useB ? B : A;
  const lower = useB ? t0 + (after ? arc : 0) : t0 - (after ? arc : 0);
  const from = jd + 0.01;
  const next = Math.min(crossing(f, lower, from, 1, step), crossing(f, lower + arc, from, 1, step));
  return { jd, periodDays: next - jd };
}

/** FUN_0040a9d0: the body (3..9) becomes stationary before/after `base`; period until the next station. */
export function stationaryChange(c: Ctx, body: number, base: number, after: boolean): { jd: number; periodDays: number } {
  const jd = station(c, body, base, after ? 1 : -1);
  const next = station(c, body, jd + 0.01, 1);
  return { jd, periodDays: next - jd };
}

/** FUN_0040aeb0: lon(p1) - lon(p2) = angle before/after `base`; period until it recurs. */
export function aspectMoment(c: Ctx, p1: number, p2: number, angle: number, base: number, after: boolean): { jd: number; periodDays: number } {
  const f = (t: number) => bodyLon(c, p1, t) - bodyLon(c, p2, t);
  const step = Math.min(stepOf(p1), stepOf(p2));
  const jd = crossing(f, angle, base, after ? 1 : -1, step);
  const next = crossing(f, angle, jd + 0.0035, 1, step);
  return { jd, periodDays: next - jd };
}

/** FUN_0040acd0: the Sun reaches `start` (prev: backward, next: forward), then `end` after that. */
export function solarSpan(c: Ctx, start: number, end: number, base: number, next: boolean): { jd: number; end: number } {
  const f = (t: number) => bodyLon(c, 1, t);
  const jd = crossing(f, start, base, next ? 1 : -1, 10);
  return { jd, end: crossing(f, end, jd + 0.0035, 1, 10) };
}

const elongation = (c: Ctx) => (t: number) => bodyLon(c, 2, t) - bodyLon(c, 1, t);

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
  let start = Math.floor(sun / 30) * 30;
  if (next) start += 30;
  const s = solarSpan(c, n360(start), n360(start + 30), natal.positions.jdUt, next);
  return { jd: s.jd, periodDays: s.end - s.jd, label };
}

/** FUN_00409c50: Ardra Pravesha, the Sun entering Ardra (66 deg 40'); label "Meteorological Yr". */
export function ardraPravesha(swe: Sweph, natal: Chart, next: boolean): MundaneMoment {
  const r = transitChange(ctxOf(swe, natal), 1, 2000, natal.positions.jdUt, next);
  return { ...r, label: 'Meteorological Yr' };
}

/** FUN_00409e30: lunar year (first new/full moon after the Sun enters LunarYrSign); label "Lunar Year". */
export function lunarNewYear(swe: Sweph, natal: Chart, next: boolean, o = lunarSolarOptions(natal.ini)): MundaneMoment {
  const tropical = o.lunarYrDef % 2 === 1;
  const c = ctxOf(swe, natal, tropical);
  const t = o.lunarYrSign * 30;
  const s = solarSpan(c, t, t, natal.positions.jdUt, next);
  if (o.lunarYrDef >= 4) return { jd: s.jd, periodDays: s.end - s.jd, label: 'Lunar Year' };
  const angle = o.lunarYrDef <= 1 ? 180 : 0;
  const f = elongation(ctxOf(swe, natal));
  const a = crossing(f, angle, s.jd, 1, 3), b = crossing(f, angle, s.end, 1, 3);
  return { jd: a, periodDays: b - a, label: 'Lunar Year' };
}

/** FUN_0040a1c0: lunar month from the natal moment (new or full moon; solar months for LunarYrDef 4/5). */
export function lunarNewMonth(swe: Sweph, natal: Chart, next: boolean, o = lunarSolarOptions(natal.ini)): MundaneMoment {
  if (o.lunarYrDef >= 4) return solarNewMonth(swe, natal, next, o.lunarYrDef === 5, 'Lunar Month');
  const r = aspectMoment(ctxOf(swe, natal), 2, 1, o.lunarYrDef <= 1 ? 180 : 0, natal.positions.jdUt, next);
  return { ...r, label: 'Lunar Month' };
}

/** FUN_0040b050: the last / next new or full moon from the natal moment; period until the next one. */
export function fortnight(swe: Sweph, natal: Chart, next: boolean): MundaneMoment {
  const f = elongation(ctxOf(swe, natal));
  const base = natal.positions.jdUt, dir = next ? 1 : -1;
  const a = crossing(f, 0, base, dir, 3), b = crossing(f, 180, base, dir, 3);
  const jd = next ? Math.min(a, b) : Math.max(a, b);
  const end = Math.min(crossing(f, 0, jd + 0.0035, 1, 3), crossing(f, 180, jd + 0.0035, 1, 3));
  return { jd, periodDays: end - jd, label: 'Fortnight Chart' };
}

/** FUN_0040a420: start of the natal tithi (prev) or of the next tithi (next); period one tithi. */
export function newLunarDay(swe: Sweph, natal: Chart, next: boolean): MundaneMoment {
  const f = elongation(ctxOf(swe, natal));
  const base = natal.positions.jdUt;
  let target = Math.floor(n360(f(base)) / 12) * 12;
  if (next) target += 12;
  const jd = crossing(f, target, base, next ? 1 : -1, 3);
  const end = crossing(f, target + 12, jd + 0.0035, 1, 3);
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
  const first = eclipseWhen(c.swe, type, base, flags, !next, c.geo);
  const jd = first.tret[idx];
  // FUN_0040b2a0 searches again forward from one day after the chart moment: the period of
  // effect runs until the same contact of the next eclipse
  const again = eclipseWhen(c.swe, type, jd + 1, flags, false, c.geo);
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

/** Tithi years: the Moon gains 360 tithis (12 x 360 deg) on the Sun per year. */
export function tithiClock(swe: Sweph, chart: Chart): DasaClock {
  const c = ctxOf(swe, chart);
  const jd0 = chart.positions.jdUt;
  const e0 = chart.positions.grahas.Moon.lon - chart.positions.grahas.Sun.lon;
  return {
    toJd(years) {
      const target = e0 + years * 4320;
      let t = jd0 + years * 354.36708;
      for (let i = 0; i < 30; i++) {
        const m = siderealLongitude(swe, t, 'Moon', c.settings), s = siderealLongitude(swe, t, 'Sun', c.settings);
        const d = wrap180(target - (m.lon - s.lon));
        t += d / (m.speed - s.speed);
        if (Math.abs(d) < 1e-9) break;
      }
      return t;
    },
  };
}

function trueTropicalClock(swe: Sweph, chart: Chart): DasaClock {
  const c = ctxOf(swe, chart, true);
  const jd0 = chart.positions.jdUt;
  const sun0 = bodyLon(c, 1, jd0);
  return {
    toJd(years) {
      let t = jd0 + years * 365.24219;
      for (let i = 0; i < 12; i++) {
        const { lon, speed } = siderealLongitude(swe, t, 'Sun', c.settings);
        const d = wrap180(sun0 + years * 360 - lon);
        t += d / speed;
        if (Math.abs(d) < 1e-9) break;
      }
      return t;
    },
  };
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
    default: return dasaClock(swe, chart, 'true-sidereal');
  }
}

/** FUN_004094b0: the period (days) measured in years of `def`. */
export function periodInYears(swe: Sweph, chart: Chart, periodDays: number, def: number): number {
  const jd0 = chart.positions.jdUt, jd1 = jd0 + periodDays;
  const len = def === 2 ? ({ ...DEFAULTS, ...chart.ini }.YearLength?.[0] ?? 365.24219) : YEAR_LEN[def] || 365.256364;
  const nominal = periodDays / len;
  if (def === 3 || def === 7) {
    const c = ctxOf(swe, chart, def === 7);
    return nominal + wrap180(bodyLon(c, 1, jd1) - bodyLon(c, 1, jd0) - nominal * 360) / 360;
  }
  if (def === 4) {
    const c = ctxOf(swe, chart);
    const e = (t: number) => bodyLon(c, 2, t) - bodyLon(c, 1, t);
    return nominal + wrap180(e(jd1) - e(jd0) - nominal * 4320) / 4320;
  }
  return nominal;
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
