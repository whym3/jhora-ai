// Tajaka (varshaphal) chart times, ported from jhora.exe's Tajaka form
// (CTajakaFormView, dialog 2009):
//
// * "Find Tajaka Chart" (button 1000, handler 0x484740) / "Find Tajaka Sunrise
//   Chart" (button 1014, handler 0x4847c0) copy the form into globals and call
//   FUN_0041aee0 -> FUN_0041af10 (exact) / FUN_0041b000 (sunrise).
// * FUN_0041a940 turns the form into a span of "solar years" from birth:
//     Year (edit 100)            n  = year - birthYear                 -> [n, n+1)
//     Month (combo 1003)         m  = monthIndex - birthMonth (1/12 yr) ; if m < 0: n--, m += 12
//     Sixty-hour (combo 1004)    p  = index - 1                  (1/144 yr)
//     Five-hour (combo 1005)     q  = index - 1                  (1/1728 yr)
//     25-min (combo 1006)        r  = index - 1                  (1/20736 yr)
//     2-min (combo 1007)         s  = index - 1                  (1/248832 yr)
//   Each level only counts when the level above is selected (combo index 0 =
//   "None"); the month combo lists calendar months January..December, so the
//   monthly chart is the m-th Tajaka month of the year.  The span's start and end
//   are converted to Julian days by FUN_0049dac0/FUN_0049dae0 with the year mode
//     TropicalTajaka=0: TrueTajaka ? 3 : 6       TropicalTajaka=1: TrueTajaka ? 7 : 0
//   (defaults TrueTajaka=1, TropicalTajaka=0 -> mode 3):
//     3  FUN_0049dc20: the moment the sidereal Sun reaches natalSun + 360*years
//     7  FUN_0049de30: the same with tropical positions
//     6  natal JD + years * 365.256364        0  natal JD + years * 365.24219
//   The crossing is found with JHora's own search FUN_0049c130 (search.ts), which
//   returns the later end of a bracket under 1 s, not the exact root; it is ported
//   step by step so the chart moment matches JHora's.
// * Sunrise variant (FUN_0041b000): after finding start and end, each is replaced
//   by the sunrise of its day (day frame FUN_004a1350 obj+0x2660 = DayFrame.sunrise).
// * The chart is cast for the natal place and time zone (FUN_0049d250 copies the
//   location of the natal record); the span length (end - start, days) is kept in
//   DAT_005922b0 and drives dasa compression (see mudda.ts).
import type { Sweph } from '../../sweph';
import { computeChart, type Chart } from '../chart';
import { siderealLongitude } from '../positions';
import { calcSettingsFromIni, type Settings } from '../settings';
import { dayFrame } from '../day';
import type { BirthData } from '../jhd';
import { jhoraCrossing, SUN_SEARCH } from './search';

/** Form input of the Tajaka tab. Sub-period indices are 1-based (0/undefined = "None"). */
export interface TajakaSelection {
  /** calendar year (edit control 100) */
  year: number;
  /** calendar month 1..12 (combo 1003) */
  month?: number;
  /** 1..12 (combo 1004) */
  sixtyHour?: number;
  /** 1..12 (combo 1005) */
  fiveHour?: number;
  /** 1..12 (combo 1006) */
  twentyFiveMin?: number;
  /** 1..12 (combo 1007) */
  twoMin?: number;
}

export type TajakaVariant = 'exact' | 'sunrise';
export type TajakaLevel = 'annual' | 'monthly' | 'sixtyHour' | 'fiveHour' | 'twentyFiveMin' | 'twoMin';

/** Chart names JHora assigns (strings 0x57806c..0x577fc4). */
export const TAJAKA_LABEL: Record<TajakaLevel, [exact: string, sunrise: string]> = {
  annual: ['Tajaka annual', 'Taj ann sunrise'],
  monthly: ['Tajaka monthly', 'Taj mon sunrise'],
  sixtyHour: ['Tajaka 2.5-day', 'Taj 2.5d sunrise'],
  fiveHour: ['Tajaka 5-hr', 'Taj 5hr sunrise'],
  twentyFiveMin: ['Tajaka 25-min', 'Taj 25min sunrise'],
  twoMin: ['Tajaka 2-min', 'Taj 2min sunrise'],
};

export interface TajakaPeriod {
  level: TajakaLevel;
  /** completed years n (doc+0x76d10), after the month wrap-around */
  years: number;
  /** 0-based offsets of the selected sub-levels (month 0..11, others 0..11), null if not selected */
  month: number | null;
  sixtyHour: number | null;
  fiveHour: number | null;
  twentyFiveMin: number | null;
  twoMin: number | null;
  /** span in solar years from birth */
  startYears: number;
  endYears: number;
  /** n + m + p + q + r + s: the number of signs muntha has progressed (MunthaPreference 1) */
  signCount: number;
}

const STEP = [1 / 12, 1 / 144, 1 / 1728, 1 / 20736, 1 / 248832];
const LEVELS: TajakaLevel[] = ['monthly', 'sixtyHour', 'fiveHour', 'twentyFiveMin', 'twoMin'];

/** FUN_0041a940, first half: the selected span in solar years. */
export function tajakaPeriod(natal: Chart, sel: TajakaSelection): TajakaPeriod {
  let years = sel.year - natal.birth.year;
  let start = years;
  let len = 1;
  let level: TajakaLevel = 'annual';
  const offs: (number | null)[] = [null, null, null, null, null];
  const idx = [sel.month, sel.sixtyHour, sel.fiveHour, sel.twentyFiveMin, sel.twoMin];
  for (let k = 0; k < 5; k++) {
    const v = idx[k] ?? 0;
    if (!v) break;
    let o = k === 0 ? v - natal.birth.month : v - 1;
    start += o * STEP[k];
    len = STEP[k];
    if (k === 0 && o < 0) { years -= 1; o += 12; }
    offs[k] = o;
    level = LEVELS[k];
  }
  const signCount = years + offs.reduce<number>((a, o) => a + (o ?? 0), 0);
  return {
    level, years,
    month: offs[0], sixtyHour: offs[1], fiveHour: offs[2], twentyFiveMin: offs[3], twoMin: offs[4],
    startYears: start, endYears: start + len, signCount,
  };
}

/** Year mode passed to FUN_0049dae0 for Tajaka charts. */
export function tajakaYearMode(ini: { TrueTajaka: number; TropicalTajaka: number }): 0 | 3 | 6 | 7 {
  if (ini.TropicalTajaka) return ini.TrueTajaka ? 7 : 0;
  return ini.TrueTajaka ? 3 : 6;
}

/**
 * FUN_0049dc20 / FUN_0049de30: the moment the Sun reaches refSun + 360 * years,
 * found by JHora's backward search (search.ts) from refJd + years * yearLen + 30 days.
 */
export function sunSearch(swe: Sweph, settings: Settings, refJd: number, refSun: number, years: number, yearLen: number): number {
  return jhoraCrossing((jd) => siderealLongitude(swe, jd, 'Sun', settings).lon, years * 360 + refSun, refJd + years * yearLen + 30, SUN_SEARCH);
}

/** FUN_0049dae0: JD (UT) at `years` solar years after the natal moment, in year mode `mode`. */
export function solarYearsToJd(swe: Sweph, natal: Chart, years: number, mode: 0 | 3 | 6 | 7): number {
  const jd0 = natal.positions.jdUt;
  if (mode === 0) return jd0 + years * 365.24219;
  if (mode === 6) return jd0 + years * 365.256364;
  let settings = calcSettingsFromIni(natal.ini);
  if (mode === 7) settings = { ...settings, ayanamsa: 'tropical', ayanamsaDelta: 0 };
  const sun0 = siderealLongitude(swe, jd0, 'Sun', settings).lon;
  // (sic) the sidereal search guesses with the tropical year and vice versa
  return sunSearch(swe, settings, jd0, sun0, years, mode === 7 ? 365.256364 : 365.24219);
}

export interface TajakaWindow { period: TajakaPeriod; start: number; end: number; variant: TajakaVariant; label: string }

/** Start and end (JD UT) of the selected Tajaka chart (FUN_0041af10 / FUN_0041b000). */
export function tajakaWindow(swe: Sweph, natal: Chart, sel: TajakaSelection, variant: TajakaVariant = 'exact'): TajakaWindow {
  const period = tajakaPeriod(natal, sel);
  const mode = tajakaYearMode(natal.ini);
  let start = solarYearsToJd(swe, natal, period.startYears, mode);
  let end = solarYearsToJd(swe, natal, period.endYears, mode);
  if (variant === 'sunrise') {
    const geo = { lat: natal.birth.lat, lon: natal.birth.lon, alt: natal.birth.altitudeM };
    const settings = calcSettingsFromIni(natal.ini);
    start = dayFrame(swe, start, geo, settings, natal.ini.SunriseDefinition).sunrise;
    end = dayFrame(swe, end, geo, settings, natal.ini.SunriseDefinition).sunrise;
  }
  return { period, start, end, variant, label: TAJAKA_LABEL[period.level][variant === 'sunrise' ? 1 : 0] };
}

/** JD (UT) of the Tajaka chart: the annual chart of `year`, or any finer selection. */
export function tajakaChartTime(swe: Sweph, natal: Chart, year: number | TajakaSelection, variant: TajakaVariant = 'exact'): number {
  const sel = typeof year === 'number' ? { year } : year;
  return tajakaWindow(swe, natal, sel, variant).start;
}

/** Birth record of a derived chart: same place and zone, clock time of `jdUt` (FUN_0049d250). */
export function birthAt(swe: Sweph, natal: Chart, jdUt: number): BirthData {
  const r = swe.revjul(jdUt + natal.birth.tzHours / 24);
  return { ...natal.birth, year: r.year, month: r.month, day: r.day, hour: r.hour, legacy: null };
}

export interface TajakaChart extends TajakaWindow { chart: Chart; natal: Chart }

/** The Tajaka chart JHora switches to after "Find Tajaka Chart". */
export async function computeTajakaChart(swe: Sweph, natal: Chart, sel: TajakaSelection, variant: TajakaVariant = 'exact'): Promise<TajakaChart> {
  const n = natal.positions.jdUt + (sel.year - natal.birth.year) * 365.25;
  await swe.ensureEphemeris(n);
  const w = tajakaWindow(swe, natal, sel, variant);
  const chart = await computeChart(swe, birthAt(swe, natal, w.start), natal.ini);
  return { ...w, chart, natal };
}
