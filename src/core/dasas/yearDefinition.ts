// Dasa year definitions and the compression of dasas of derived charts, ported
// from jhora.exe.
//
// Slots: JHora keeps one dasa index DAT_008a4b58 (0..74) for the dasa shown,
// the case of the dispatcher FUN_00408d90: 0..24 nakshatra dasas (12 used: 0
// Vimsottari FUN_0040beb0, 1 Ashtottari, 2 Kalachakra, 3 Yogini, 4 Dwisaptati,
// 5 Shattrimsa, 6 Dwadasottari, 7 Chaturaseeti, 8 Sataabdika, 9 Shodasottari,
// 10 Panchottari, 11 Shashtihayani, 12 Saptarshi - the menu order), 25..59 rasi
// dasas (25 Narayana .. 45 Varnada, registry order) and 60..74 other dasas
// (60 Moola, 61 Naisargika, 62 Tara, 63 Kaala, 64 AK Kendradi Graha, 65 Patyayini,
// 66 Sudarsana Chakra, 67 Buddhi Gati, 68 Rasi-Bhukta Vimsottari, 69 Tithi
// Ashtottari, 70 Yoga Vimsottari, 71 Karana Chaturaseeti, 72 Tithi Yogini,
// 73 Karaka, 74 Chakra). The ini arrays of 75 entries are indexed by it.
//
// Every builder starts with obj+0x76d3c = YearDefinition[slot] (int array
// 0x8a1d98) and obj+0x76d40 = YearLength[slot] (double array 0x8a1b40); the
// period engine FUN_00401620 turns dasa years into a moment with FUN_0049dae0
// (years, record, obj+0x76d3c, obj+0x76d40) from the chart record obj+0x77410
// (a copy of the chart shown):
//   3 true sidereal  FUN_0049dc20: the sidereal Sun at chartSun + 360 x years (time.ts)
//   7 true tropical  FUN_0049de30: the same with the tropical Sun (tajaka/annual.ts mode 7)
//   4 360 tithis     FUN_0049e3f0: Moon - Sun gains 4320 deg a year (derived/mundane.ts tithiClock)
//   5 (not in the menu) FUN_0049e1b0: the Moon at chartMoon + 360 x years, searched backwards
//                    from chart + years x 327.84 + 15 days (one year = 12 sidereal months)
//   0, 1, 2, 6       julday(record) + years x obj+0x76d40, i.e. YearLength[slot] days
// So mean tropical (0), savana (1), user (2) and mean sidereal (6) use the slot's
// YearLength, whatever it holds: the menu handlers (32882 -> 0, 32883 -> 1, 32884 -> 2,
// 32885 -> 3, 32886 -> 4, 33418 -> 6, 33419 -> 7; FUN_00450290) store the definition
// AND the length (0, 7: 365.24219; 1: 360; 2: user dialog 143; 3, 6: 365.256364;
// 4: 354.36708) for this dasa, all 75 dasas or the dasas of the menu's category
// (0..24, 25..59, 60..74), and the SpecialYearForTajaka / SpecialYearForTP checks.
//
// Compression (FUN_00408d90 tail, when DAT_008a4b68 is set: Tajaka, Tithi Pravesha,
// mundane / angular return / transit search charts and prasna charts with
// "Compress dasas"; cleared by natal and progressed charts):
//   def = FUN_004093f0(YearDefinition[slot]): kind 1 (Tajaka) -> 3 with
//         SpecialYearForTajaka, kind 2 (TP) -> 4 with SpecialYearForTP, kind 5 with
//         "Sol" in the chart name -> 3 (SpecialYearForTajaka), with "Lun" or "Moon"
//         -> 4 (SpecialYearForTP); stored back into obj+0x76d3c for the dates;
//   F   = FUN_004094b0(DAT_005922b0 = period of effect in days, def, nominal):
//         y += (target - clock(y)) / nominal until within 1 s (500 steps), the clock
//         being FUN_0049dae0 with the nominal length (0, 3: 365.24219; 1: 360;
//         2: YearLength[slot]; 4: 354.36708; 6, 7: 365.256364);
//   every maha dasa's years x F / obj+0x8fa20 (the dasa's total, DASA_TOTAL);
//   kind 5 without DasaSeshamInMundaneCharts: no balance (obj+0x8fa08 = 0).
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { siderealLongitude } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { DEFAULTS, type JhoraIni } from '../../settings/generated';
import { dasaClock, type DasaClock } from './time';
import { jhoraCrossing, recordRoundTrip, SECOND } from '../tajaka/search';
import { jhoraSunClock } from '../tajaka/mudda';
import { solarYearsToJd } from '../tajaka/annual';
import { tithiClock } from '../derived/mundane';

/** Nakshatra dasa slots (menu order, = DasasView NAKSHATRA_DASA_SYSTEMS). */
export const NAKSHATRA_SLOTS = [
  'Vimsottari', 'Ashtottari', 'Kalachakra', 'Yogini', 'Dwisaptati sama', 'Shattrimsa sama', 'Dwadasottari',
  'Chaturaseeti sama', 'Sataabdika', 'Shodasottari', 'Panchottari', 'Shashtihayani', 'Saptarshi nakshatra',
] as const;
/** Rasi dasa slots 25.. (registry RASI_DASAS order). */
export const RASI_SLOTS = [
  'Narayana', 'Lagnamsaka', 'Padanaathaamsa', 'Sudasa', 'Drigdasa', 'Lagna Kendradi', 'AK Kendradi Rasi', 'Trikona',
  'Chara (Parasara)', 'Chara (K.N. Rao)', 'Chara (Rangacharya)', 'Yogardha', 'Paryaaya', 'Shoola', 'Niryaana Shoola',
  'Brahma', 'Sthira', 'Mandooka (D-11)', 'Mandooka (K.N. Rao)', 'Navamsa', 'Varnada',
] as const;
/** Other dasa slots 60.. (dispatcher cases 0x3c..0x4a). */
export const OTHER_SLOTS = [
  'Moola', 'Naisargika', 'Tara', 'Kaala', 'AK Kendradi Graha', 'Patyayini', 'Sudarsana Chakra', 'Buddhi Gati',
  'Rasi-Bhukta Vimsottari', 'Tithi Ashtottari', 'Yoga Vimsottari', 'Karana Chaturaseeti', 'Tithi Yogini', 'Karaka', 'Chakra',
] as const;

export type DasaTableId = 'dasas.nakshatra' | 'dasas.rasi' | 'dasas.other';

/** DAT_008a4b58 of a dasa system shown by one of the Dasas jobs. */
export function dasaSlot(table: DasaTableId, system: string): number {
  const find = (list: readonly string[], base: number) => {
    const i = list.indexOf(system);
    if (i < 0) throw new Error(`unknown dasa system ${system}`);
    return base + i;
  };
  return table === 'dasas.nakshatra' ? find(NAKSHATRA_SLOTS, 0) : table === 'dasas.rasi' ? find(RASI_SLOTS, 25) : find(OTHER_SLOTS, 60);
}

/** The slot's YearDefinition / YearLength (obj+0x76d3c / obj+0x76d40). */
export function slotYear(ini: Partial<JhoraIni>, slot: number): { def: number; len: number } {
  return {
    def: ini.YearDefinition?.[slot] ?? DEFAULTS.YearDefinition[slot] ?? 3,
    len: ini.YearLength?.[slot] ?? DEFAULTS.YearLength[slot] ?? 365.24219,
  };
}

/** Menu texts of the definitions (resource menu 108 "Definition of year in dasas"), by value. */
export const YEAR_DEFINITION_NAMES: Record<number, string> = {
  0: 'Mean tropical solar year (365.24219 days)', 1: 'Savana year (360 days)', 2: 'User defined year (n days)',
  3: 'True sidereal solar year (Sun traversing 360 deg sidereally)', 4: 'Year with 360 tithis', 5: 'Lunar year (12 sidereal months)',
  6: 'Mean sidereal solar year (365.256364 days)', 7: 'True tropical solar year (Sun traversing 360 deg tropically)',
};

/** FUN_00450290: the length the menu stores with a definition (2: the user's value). */
export function menuYearLength(def: number, user = 365.24219): number {
  return def === 1 ? 360 : def === 2 ? user : def === 3 || def === 6 ? 365.256364 : def === 4 ? 354.36708 : 365.24219;
}

/**
 * FUN_0049e1b0 (definition 5): the sidereal Moon at chartMoon + 360 x years, JHora's search
 * (3-day steps, 1 s) backwards from the record + years x 327.84 + 15 days (minus 15 for
 * negative years); not reachable from JHora's menu, so not verified against its output.
 */
function lunarClock(swe: Sweph, chart: Chart): DasaClock {
  const settings = calcSettingsFromIni(chart.ini);
  const jd0 = chart.positions.jdUt, moon0 = chart.positions.grahas.Moon.lon;
  const lon = (jd: number) => siderealLongitude(swe, jd, 'Moon', settings).lon;
  return {
    toJd: (years) => recordRoundTrip(swe, chart.birth.tzHours,
      jhoraCrossing(lon, years * 360 + moon0, jd0 + years * 327.84 + (years > 0 ? 15 : -15), { step: years > 0 ? -3 : 3, tol: SECOND })),
  };
}

/**
 * FUN_0049dae0(years, record, def, len) from `chart`'s moment. `derived` charts use the
 * record-based Sun search of tajaka/mudda.ts for definition 3 (as the Tajaka goldens do).
 */
export function yearClock(swe: Sweph, chart: Chart, def: number, len: number, derived = false): DasaClock {
  const jd0 = chart.positions.jdUt;
  switch (def) {
    case 3: return derived ? jhoraSunClock(swe, chart) : dasaClock(swe, chart, 'true-sidereal');
    case 7: return { toJd: (y) => solarYearsToJd(swe, chart, y, 7) };
    case 4: return tithiClock(swe, chart);
    case 5: return lunarClock(swe, chart);
    default: return { toJd: (y) => jd0 + y * len };
  }
}

/** The dasa clock of a slot on a chart that is not compressed (natal, progressed). */
export function slotClock(swe: Sweph, chart: Chart, slot: number): DasaClock {
  const { def, len } = slotYear(chart.ini, slot);
  return yearClock(swe, chart, def, len);
}

/** JHora's derived-chart kind codes (doc+0x76d04). */
export const DERIVED_KIND_CODE = { tajaka: 1, tithiPravesha: 2, progression: 4, mundane: 5, angularReturn: 5, prasna: 6 } as const;

/** FUN_004093f0: the year definition of a compressed dasa. */
export function compressedYearDefinition(kindCode: number, label: string, ini: Partial<JhoraIni>, def: number): number {
  const s = { ...DEFAULTS, ...ini };
  if (s.SpecialYearForTajaka && kindCode === 1) def = 3;
  if (s.SpecialYearForTP && kindCode === 2) def = 4;
  if (s.SpecialYearForTajaka && kindCode === 5 && label.includes('Sol')) def = 3;
  if (s.SpecialYearForTP && kindCode === 5 && (label.includes('Lun') || label.includes('Moon'))) def = 4;
  return def;
}

/** The nominal year of FUN_00408d90's switch (definition 5 leaves it unset; 365.24219 used). */
export function nominalYearLength(def: number, len: number): number {
  return def === 1 ? 360 : def === 2 ? len : def === 4 ? 354.36708 : def === 6 || def === 7 ? 365.256364 : 365.24219;
}

/** FUN_004094b0: `periodDays` after the chart moment measured in years of definition `def`. */
export function periodInYears(swe: Sweph, chart: Chart, periodDays: number, def: number, len: number, derived = true): number {
  const nominal = nominalYearLength(def, len);
  const clock = yearClock(swe, chart, def, nominal, derived);
  const jd0 = chart.positions.jdUt, target = jd0 + periodDays;
  let y = 0, jd = jd0;
  for (let i = 0; i < 500 && Math.abs(jd - target) > SECOND; i++) {
    y += (target - jd) / nominal;
    jd = clock.toJd(y);
  }
  return y;
}

/**
 * obj+0x8fa20, the total years a compressed dasa is scaled by (F / total): constants
 * stored by each builder; 'sum' = the sum of the listed maha dasa years (Kalachakra,
 * Mandooka K.N. Rao), 'sum12' = the sum of the first twelve (Trikona, Chara Parasara),
 * 'karaka' = 12 x the number of karakas; Drigdasa 96 with DrigdasaOfParasara, else 120.
 */
export const DASA_TOTAL: Record<number, number | 'sum' | 'sum12' | 'karaka' | 'drig'> = {
  0: 120, 1: 108, 2: 'sum', 3: 36, 4: 72, 5: 36, 6: 112, 7: 84, 8: 100, 9: 116, 10: 105, 11: 60, 12: 100,
  25: 120, 26: 120, 27: 120, 28: 120, 29: 'drig', 30: 120, 31: 120, 32: 'sum12', 33: 'sum12', 34: 120, 35: 120, 36: 120,
  37: 120, 38: 108, 39: 96, 40: 120, 41: 96, 42: 96, 43: 'sum', 44: 108, 45: 108,
  60: 120, 61: 120, 62: 120, 63: 120, 64: 120, 65: 120, 66: 12, 67: 120, 68: 120, 69: 108, 70: 120, 71: 84, 72: 36, 73: 'karaka', 74: 120,
};

export function dasaTotal(slot: number, periods: Period[], ini: Partial<JhoraIni>): number {
  const t = DASA_TOTAL[slot] ?? 120;
  const years = (ps: Period[]) => ps.reduce((a, p) => a + (p.end - p.start), 0);
  if (t === 'sum') return years(periods);
  if (t === 'sum12') return years(periods.slice(0, 12));
  if (t === 'karaka') return 6 * periods.length; // 2n maha dasas, 12 n years
  if (t === 'drig') return ({ ...DEFAULTS, ...ini }.DrigdasaOfParasara ?? 1) ? 96 : 120;
  return t;
}

/**
 * Maha dasa counts the builders change when DAT_008a4b68 is set: Yogini and Shattrimsa
 * (FUN_0040e150 / FUN_0040e900) and Tithi Yogini (FUN_004125e0) 24 -> 8, Chara Parasara
 * (FUN_004172f0) 24 -> 12; Karana Chaturaseeti (FUN_00413160) 7 -> 8 is built with its count.
 */
export const COMPRESSED_COUNT: Record<number, number> = { 3: 8, 5: 8, 72: 8, 33: 12 };

/** Scale period times (dasa years from the chart moment) by `k`, recursively. */
export function scalePeriods(ps: Period[], k: number): Period[] {
  return ps.map((p) => ({ ...p, start: p.start * k, end: p.end * k, children: p.children && scalePeriods(p.children, k) }));
}

/** Shift period times so the first maha dasa starts at the chart moment (no dasa balance). */
export function dropBalance(ps: Period[]): Period[] {
  const s0 = ps[0]?.start ?? 0;
  const shift = (qs: Period[]): Period[] => qs.map((p) => ({ ...p, start: p.start - s0, end: p.end - s0, children: p.children && shift(p.children) }));
  return s0 ? shift(ps) : ps;
}

export interface Compression {
  /** the chart's period of effect (DAT_005922b0, days) */
  periodDays: number;
  /** doc+0x76d04 */
  kindCode: number;
  /** chart name (doc+0x29078) */
  label: string;
  /** F of FUN_004094b0 when already known (Tajaka: tajakaCompression) */
  years?: number;
}

export interface CompressedDasa { periods: Period[]; clock: DasaClock; def: number; F: number; total: number }

/** FUN_00408d90's tail for one dasa built on the derived `chart`. */
export function compressDasa(swe: Sweph, chart: Chart, slot: number, periods: Period[], c: Compression): CompressedDasa {
  const { def: def0, len } = slotYear(chart.ini, slot);
  const def = compressedYearDefinition(c.kindCode, c.label, chart.ini, def0);
  const F = c.years !== undefined && def === 3 ? c.years : periodInYears(swe, chart, c.periodDays, def, len);
  const total = dasaTotal(slot, periods, chart.ini);
  let out = scalePeriods(periods, F / total);
  const sesham = ({ ...DEFAULTS, ...chart.ini }.DasaSeshamInMundaneCharts ?? 1) !== 0;
  if (c.kindCode === 5 && !sesham) out = dropBalance(out);
  return { periods: out, clock: yearClock(swe, chart, def, len, true), def, F, total };
}

/** The year-definition menu in JHora's order (resource 108): value of each item. */
export const YEAR_MENU = [0, 7, 6, 3, 1, 4, 2] as const;

/**
 * FUN_00450290: what a "Definition of year in dasas" menu command stores. `def` and its
 * length (menuYearLength; 2: the user's days, dialog 143) go to YearDefinition / YearLength of
 * the dasa shown (scope 0), all 75 dasas (1) or the dasas of its category (2: 0..24, 25..59,
 * 60..74); the dialog also sets SpecialYearForTajaka / SpecialYearForTP.
 */
export function applyYearDefinition(ini: Pick<JhoraIni, 'YearDefinition' | 'YearLength'>, slot: number, def: number, userDays: number,
  scope: 0 | 1 | 2): Pick<JhoraIni, 'YearDefinition' | 'YearLength'> {
  const [lo, hi] = scope === 0 ? [slot, slot + 1] : scope === 1 ? [0, 75] : slot < 25 ? [0, 25] : slot < 60 ? [25, 60] : [60, 75];
  const len = menuYearLength(def, userDays);
  return {
    YearDefinition: ini.YearDefinition.map((v, i) => (i >= lo && i < hi ? def : v)),
    YearLength: ini.YearLength.map((v, i) => (i >= lo && i < hi ? len : v)),
  };
}
