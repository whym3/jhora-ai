// Tithi Pravesha tab (CTPFormView, dialog 2012, message map 0x54f190, DDX 0x484e90).
//
// Form (DDX offsets of the view):
//   edit 100 (+0x7c)  Year                        combo 1003 (+0x80) Month: None, 1st..14th
//   check 1002 (+0x88) "Daily chart: Enter 1-30"  edit 101 (+0x84) day 1..30
//   combo 1011 (+0xc4) Tithi / Nakshatra / Yoga Pravesha (CBN_SELCHANGE 0x485070 sets
//        DAT_00597f1c = index and the name suffix DAT_00597f18 = "TP" / "NP" / "YP")
//   button 1000 "Find Tithi Pravesha Chart" (0x4851b0): globals year DAT_00597f98,
//        month DAT_00597f94, day DAT_00597f90 (0 unless 1002 is checked), then
//        FUN_0041b200 -> FUN_0041b250 (annual) / FUN_0041bc60 (monthly) / FUN_0041bf50 (daily)
//   "OR": combo 1005 (+0x8c) Annual / Monthly / Fortnightly / Daily chart, combo 1006
//        (+0x90) before / after, date 1007/102/103, time 1008/1009/1010, zone 1020/1021/1079;
//        button 1004 (0x485230) -> FUN_0041c2b0 -> FUN_0041c4c0 / 0041ce70 / 0041d050 / 0041d390
//   button 1001 Back to Natal Chart (0x48ae20); links 1014 Vimsottari, 1023 Yoga Vimsottari,
//        1018 Tithi Ashtottari, 1017 Narayana, 1019 Mixed TP-Natal chart.
//
// The search primitive FUN_0049d7c0(A, B, backward, &month, &chart) asks the root finder
// FUN_0049c130 for the moment the "pravesha angle" reaches its natal value:
//   Tithi    norm(Moon - Sun)  (FUN_004ae540)      descriptor {Moon, Sun, diff}
//   Yoga     norm(Moon + Sun)  (FUN_004ae5e0)      descriptor {Moon, Sun, sum}
//   Nakshatra  the Moon's longitude (see the caveat below)
// stepping 3 days (Moon involved) forward or backward from the start, then bisecting to
// ~1 s. It also returns the found chart's lunar month: LunarYrDef (DAT_005922c0, default 2)
//   0/2: Sun's sign at the previous full (0) / new (2) moon   4: (Sun sign + 11) % 12
// (1/3/5, tropical variants, are not ported and fall back to 2).
//
// Annual chart (FUN_0041b250): start from natal + (Y - birthYear + 0.24641184) x 365.24219
// days (FUN_0049dac0 mode 0) and search BACKWARD; while the found moment's primary key
// differs from the natal one, restart 0.0035 day before it. Primary key with
// SolarMonthUsedInTP=1 (DAT_005922c8, default): Sun's sign (chart+0x118); with 0: lunar month
// (doc+0x12078). If the secondary key then differs too, one more backward search is made and
// used when both keys match. The period ends at the same search for (Y - birthYear + 1.24641184)
// years; its length (DAT_005922b0) drives dasa compression. Chart name "Annual TP".
// Monthly (FUN_0041bc60): the annual search without the secondary check, then month-1 forward
// searches from 0.0035 day after each hit; the period ends at the next forward hit ("Monthly TP").
// Daily (FUN_0041bf50): from 0.0035 day before the monthly hit, forward search for the natal
// angle + (day-1) x 12 deg; ends at angle + day x 12 ("Daily TP").
// Date mode (FUN_0041c4c0 annual with both checks, searching backward for "before"; the end
// is the forward annual search from hit +/- 0.0035 + 0.007), monthly FUN_0041ce70 (plain
// search, end = next forward hit), fortnightly FUN_0041d050 (natal angle or angle + 180,
// whichever comes first in the search direction; "Fortntly" / "Fortntly " names; the period
// ends at the next hit of either angle), daily FUN_0041d390 (the first angle natal + 12k past
// the date's angle in the search direction; end = next + 12 deg).
// The chart keeps the natal place and zone; kind code doc+0x76d04 = 2.
// Caveat (Nakshatra Pravesha): FUN_0049d7c0 stores the natal Moon in the descriptor's first
// double (+8) while FUN_0049c130 reads its target from +0x10 (zeroed), with no second body;
// taken literally JHora would search for the Moon at 0 Aries. We search for the natal Moon
// longitude (the evident intent); capture a golden NP chart before relying on it.
// The root finder is JHora's own (1 s bracket, later end returned), see search() below.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { siderealLongitude, norm360 } from '../positions';
import { calcSettingsFromIni, type Settings } from '../settings';
import { newMoon } from '../keyInfo';
import { scanCrossing, wrap180 } from './common';
import { jhoraCrossing } from '../tajaka/search';

export const PRAVESHA_TYPES = ['Tithi Pravesha', 'Nakshatra Pravesha', 'Yoga Pravesha'] as const;
/** DAT_00597f18 after CBN_SELCHANGE of combo 1011 (strings 0x57808c / 0x57e784 / 0x57e7a0). */
export const PRAVESHA_SUFFIX = ['TP', 'NP', 'YP'];
/** Button 1000 caption for each type (0x57e7c0 / 0x57e788 / 0x57e7a4). */
export const PRAVESHA_BUTTON = ['Find Tithi Pravesha Chart', 'Find Nakshatra Pravesha', 'Find Yoga Pravesha Chart'];
export type PraveshaType = 0 | 1 | 2;

/** Year-mode input (button 1000). */
export interface TPYearSelection {
  type?: PraveshaType;
  year: number;
  /** combo 1003: 0 None (annual), 1..14 = 1st..14th month */
  month?: number;
  /** edit 101 when check 1002 is set: 1..30 (only used with a month) */
  day?: number;
}

/** Date-mode input (button 1004). */
export interface TPDateSelection {
  type?: PraveshaType;
  /** combo 1005: 0 annual, 1 monthly, 2 fortnightly, 3 daily */
  kind: 0 | 1 | 2 | 3;
  /** combo 1006: before (true) / after */
  before: boolean;
  year: number; month: number; day: number;
  /** local clock time, decimal hours */
  hour: number;
  /** zone of the entered time, east positive (defaults to the natal zone) */
  tzHours?: number;
}

export interface TPResult { start: number; end: number; label: string }

const STEP = 0.0035;

interface Ctx {
  swe: Sweph;
  s: Settings;
  type: PraveshaType;
  target: number;
  natalSunSign: number;
  natalMonth: number;
  solarMonthFirst: boolean;
  lunarYrDef: number;
}

const sunSign = (c: Ctx, jd: number) => Math.floor(siderealLongitude(c.swe, jd, 'Sun', c.s).lon / 30) % 12;

/** The pravesha angle of a type at `jd`. */
export function praveshaAngle(swe: Sweph, s: Settings, type: PraveshaType, jd: number): number {
  const m = siderealLongitude(swe, jd, 'Moon', s).lon;
  if (type === 1) return m;
  const sun = siderealLongitude(swe, jd, 'Sun', s).lon;
  return type === 2 ? norm360(m + sun) : norm360(m - sun);
}

/** Lunar month returned by FUN_0049d7c0 (LunarYrDef 0/2: Sun's sign at the previous full/new moon; 4: solar). */
export function lunarMonthAt(swe: Sweph, s: Settings, jd: number, lunarYrDef: number): number {
  if (lunarYrDef === 4) return (Math.floor(siderealLongitude(swe, jd, 'Sun', s).lon / 30) + 11) % 12;
  if (lunarYrDef === 0) {
    // previous full moon: elongation 180 searched backward
    const f = (t: number) => norm360(siderealLongitude(swe, t, 'Moon', s).lon - siderealLongitude(swe, t, 'Sun', s).lon);
    const t = scanCrossing(f, 180, jd, -1, 3, 40) ?? jd;
    return Math.floor(siderealLongitude(swe, t, 'Sun', s).lon / 30) % 12;
  }
  return Math.floor(newMoon(swe, jd, -1, s).sun / 30) % 12;
}

function context(swe: Sweph, natal: Chart, type: PraveshaType): Ctx {
  const s = calcSettingsFromIni(natal.ini);
  const jd = natal.positions.jdUt;
  const lunarYrDef = natal.ini.LunarYrDef === 0 || natal.ini.LunarYrDef === 4 ? natal.ini.LunarYrDef : 2;
  return {
    swe, s, type,
    target: praveshaAngle(swe, s, type, jd),
    natalSunSign: Math.floor(natal.positions.grahas.Sun.lon / 30) % 12,
    natalMonth: lunarMonthAt(swe, s, jd, lunarYrDef),
    solarMonthFirst: natal.ini.SolarMonthUsedInTP !== 0,
    lunarYrDef,
  };
}

/**
 * FUN_0049d7c0 + FUN_0049c130: the next (dir 1) or previous (dir -1) moment the angle hits
 * `target`, as JHora finds it: 3-day steps (the Moon is involved), regula falsi / bisection
 * to a 1 s bracket, returning the bracket's later end (tajaka/search.ts jhoraCrossing).
 */
function search(c: Ctx, target: number, from: number, dir: 1 | -1): number {
  const f = (t: number) => praveshaAngle(c.swe, c.s, c.type, t);
  return jhoraCrossing(f, norm360(target), from, { step: 3 * dir, tol: SECOND });
}

const SECOND = 1 / 86400;

/** The annual hit-and-check loop of FUN_0041b250 / FUN_0041c4c0. */
function annualSearch(c: Ctx, from: number, dir: 1 | -1, secondary: boolean): { jd: number; next: number } {
  const month = (t: number) => lunarMonthAt(c.swe, c.s, t, c.lunarYrDef);
  const primary = (t: number) => (c.solarMonthFirst ? sunSign(c, t) === c.natalSunSign : month(t) === c.natalMonth);
  let t = from;
  let jd = NaN;
  for (let k = 0; k < 40; k++) {
    jd = search(c, c.target, t, dir);
    t = jd + dir * STEP;
    if (primary(jd)) break;
  }
  if (secondary) {
    const ok = c.solarMonthFirst ? month(jd) === c.natalMonth : sunSign(c, jd) === c.natalSunSign;
    if (!ok) {
      const g = search(c, c.target, t, dir);
      if (sunSign(c, g) === c.natalSunSign && month(g) === c.natalMonth) jd = g;
    }
  }
  return { jd, next: t };
}

const MEAN_YEAR = 365.24219;
const OFFSET = 0.24641183977130354;   // 0x546d38 (1.2464... at 0x546d30 for the end)

/** Button 1000: annual / monthly / daily Pravesha chart of a calendar year. */
export function tpYearChart(swe: Sweph, natal: Chart, sel: TPYearSelection): TPResult {
  const type = sel.type ?? 0;
  const c = context(swe, natal, type);
  const jd0 = natal.positions.jdUt;
  const years = sel.year - natal.birth.year;
  const guess = (y: number) => jd0 + (y + OFFSET) * MEAN_YEAR;
  const sfx = PRAVESHA_SUFFIX[type];
  if (!sel.month) {
    const start = annualSearch(c, guess(years), -1, true).jd;
    const end = annualSearch(c, guess(years + 1), -1, true).jd;
    return { start, end, label: `Annual ${sfx}` };
  }
  let jd = annualSearch(c, guess(years), -1, false).jd;
  for (let i = 1; i < sel.month; i++) jd = search(c, c.target, jd + STEP, 1);
  if (!sel.day) return { start: jd, end: search(c, c.target, jd + STEP, 1), label: `Monthly ${sfx}` };
  const start = search(c, c.target + (sel.day - 1) * 12, jd - STEP, 1);
  const end = search(c, c.target + sel.day * 12, start + STEP, 1);
  return { start, end, label: `Daily ${sfx}` };
}

/** Button 1004: the Pravesha chart before/after a date. */
export function tpDateChart(swe: Sweph, natal: Chart, sel: TPDateSelection): TPResult {
  const type = sel.type ?? 0;
  const c = context(swe, natal, type);
  const tz = sel.tzHours ?? natal.birth.tzHours;
  const from = swe.julday(sel.year, sel.month, sel.day, sel.hour - tz);
  const dir: 1 | -1 = sel.before ? -1 : 1;
  const sfx = PRAVESHA_SUFFIX[type];
  switch (sel.kind) {
    case 0: {
      const a = annualSearch(c, from, dir, true);
      const end = annualSearch(c, a.next + 0.007, 1, true).jd;
      return { start: a.jd, end, label: `Annual ${sfx}` };
    }
    case 1: {
      const start = search(c, c.target, from, dir);
      return { start, end: search(c, c.target, start + STEP, 1), label: `Monthly ${sfx}` };
    }
    case 2: {
      const c1 = search(c, c.target, from, dir);
      const c2 = search(c, c.target + 180, from, dir);
      const first = sel.before ? c1 >= c2 : c1 <= c2;
      const start = first ? c1 : c2;
      const t0 = first ? c.target : c.target + 180;
      const e1 = search(c, t0, start + STEP, 1);
      const e2 = search(c, t0 + 180, start + STEP, 1);
      return { start, end: Math.min(e1, e2), label: first ? `Fortntly${sfx}` : `Fortntly ${sfx}` };
    }
    default: {
      // FUN_0041d390: the first natal + 12k past the date's angle in the search direction
      const ed = praveshaAngle(swe, c.s, type, from);
      const en = c.target;
      let off = 0;
      if (!sel.before) { for (let d = en - 360; d <= ed; d += 12) off += 12; }
      else { for (let d = en + 360; ed <= d; d -= 12) off -= 12; }
      const t = en + off;
      const start = search(c, t, from, dir);
      return { start, end: search(c, t + 12, start + STEP, 1), label: `Daily ${sfx}` };
    }
  }
}

/** Signed difference of the pravesha angle at `jd` from its natal value (degrees). */
export function praveshaError(swe: Sweph, natal: Chart, type: PraveshaType, jd: number, offset = 0): number {
  const s = calcSettingsFromIni(natal.ini);
  return wrap180(praveshaAngle(swe, s, type, jd) - praveshaAngle(swe, s, type, natal.positions.jdUt) - offset);
}
