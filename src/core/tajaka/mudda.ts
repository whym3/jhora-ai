// Mudda dasa = Vimsottari dasa of a Tajaka chart, as jhora.exe builds it
// (Vimsottari builder FUN_0040beb0 + dispatcher FUN_00408d90):
//
// * Title: "Mudda/Vimsottari Dasa" when the chart kind (doc+0x76d04) is Tajaka (1)
//   and UseDasaSeedFromNatalInTajaka[0] (byte 0x8a184c, default 1) is set.
// * Seed: with UseDasaSeedFromNatalInTajaka the nakshatra and the elapsed
//   fraction come from the NATAL Moon (FUN_004a1260 on doc+0x50), otherwise from
//   the Tajaka chart's Moon; with ProgressDasaSeedInTajaka[0] (0x8a1800, default 1)
//   the nakshatra is advanced by the completed years n (doc+0x76d10).
//   Maha dasas then run as in natal Vimsottari, from the progressed star's lord,
//   the first one shortened by the natal balance.
// * Reference moment (doc+0x77410): the Tajaka chart itself.
// * Compression (FUN_00408d90 tail): FUN_004093f0 switches the year definition to
//   3 (true sidereal, Sun-longitude based) when SpecialYearForTajaka (default 1);
//   FUN_004094b0 finds F = length of the chart span (DAT_005922b0 days, end - start)
//   in such years, i.e. the Sun's arc over the span / 360, and every maha dasa's
//   years are multiplied by F / 120.  Dates are then the moments the Sun reaches
//   tajakaSun + 360 * dasaYears (FUN_0049dc20 on the Tajaka chart): for an annual
//   chart one Vimsottari year is 3 degrees of solar motion.
// The same compression applies to every dasa shown for a Tajaka chart
// (e.g. Patyayini, dasas/patyayini.ts): use tajakaCompression + compressPeriods.
import type { Sweph } from '../../sweph';
import { siderealLongitude } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { vimsottari, type Period } from '../dasas/vimsottari';
import type { DasaClock } from '../dasas/time';
import type { Chart } from '../chart';
import { sunSearch, type TajakaChart } from './annual';

export const MUDDA_TITLE = 'Mudda/Vimsottari Dasa';
const NAK = 360 / 27;

const wrap180 = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d < -180) d += 360; return d; };

/** F of FUN_004094b0: the chart span measured in Sun-longitude years (sidereal Sun arc / 360). */
export function tajakaCompression(swe: Sweph, t: TajakaChart): number {
  const settings = calcSettingsFromIni(t.chart.ini);
  const nominal = t.period.endYears - t.period.startYears;
  const a = siderealLongitude(swe, t.start, 'Sun', settings).lon;
  const b = siderealLongitude(swe, t.end, 'Sun', settings).lon;
  return nominal + wrap180(b - a - nominal * 360) / 360;
}

/**
 * Dasa clock of a derived chart with the Sun-longitude year (mode 3): FUN_0049dae0 on
 * the chart record (doc+0x77410) -> FUN_0049dc20, i.e. JHora's own search for the Sun
 * at chartSun + 360 * years, guessed at chart + years * 365.24219 + 30 days.
 */
export function jhoraSunClock(swe: Sweph, chart: Chart): DasaClock {
  const settings = calcSettingsFromIni(chart.ini);
  const ref = chart.positions.jdUt, sun = chart.positions.grahas.Sun.lon;
  return { toJd: (y) => sunSearch(swe, settings, ref, sun, y, 365.24219) };
}

/** Scale period times (dasa years from the chart moment) by `k`, recursively. */
export function compressPeriods(ps: Period[], k: number): Period[] {
  return ps.map((p) => ({ ...p, start: p.start * k, end: p.end * k, children: p.children && compressPeriods(p.children, k) }));
}

export interface MuddaOptions {
  /** UseDasaSeedFromNatalInTajaka (default: the chart's ini, index 0) */
  natalSeed?: boolean;
  /** ProgressDasaSeedInTajaka (default: the chart's ini, index 0) */
  progress?: boolean;
  levels?: number;
}

/** Seed longitude of Mudda dasa (the Moon, possibly the natal one progressed by n stars). */
export function muddaSeed(t: TajakaChart, opts: MuddaOptions = {}): number {
  // index 0 = Vimsottari (bytes 0x8a184c / 0x8a1800 in jhora.exe)
  const natalSeed = opts.natalSeed ?? (t.chart.ini.UseDasaSeedFromNatalInTajaka?.[0] ?? 1) !== 0;
  const progress = opts.progress ?? (t.chart.ini.ProgressDasaSeedInTajaka?.[0] ?? 1) !== 0;
  if (!natalSeed) return t.chart.positions.grahas.Moon.lon;
  const moon = t.natal.positions.grahas.Moon.lon;
  const n = Math.floor(moon / NAK);
  const frac = moon / NAK - n;
  const star = progress ? (((n + t.period.years) % 27) + 27) % 27 : n;
  return (star + frac) * NAK;
}

export interface MuddaDasa { title: string; periods: Period[]; clock: DasaClock; compression: number }

/** Mudda dasa periods (times in compressed dasa years from the Tajaka moment) and their clock. */
export function muddaDasa(swe: Sweph, t: TajakaChart, opts: MuddaOptions = {}): MuddaDasa {
  const F = tajakaCompression(swe, t);
  const base = vimsottari(muddaSeed(t, opts), opts.levels ?? 2);
  return {
    title: MUDDA_TITLE,
    periods: compressPeriods(base, F / 120),
    clock: jhoraSunClock(swe, t.chart),
    compression: F,
  };
}
