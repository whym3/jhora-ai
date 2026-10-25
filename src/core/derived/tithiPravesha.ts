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
// The search primitive FUN_0049d7c0(A, B, backward, &month, &out), `this` = the record searched
// from, gets A = the natal Moon and B = the natal Sun (the natal record's longitudes, doc+0x1b0 /
// doc+0x180; the daily charts pass A = Moon + 12k) and calls the root finder FUN_0049c130
// (tajaka/search.ts) directly with
//   Tithi      bodies Moon, Sun, c = norm(A - B) (FUN_004ae540), comparator 0x49a780:
//              norm(Moon - (Sun + c))
//   Yoga       bodies Moon, Sun, c = norm(A + B) (FUN_004ae5e0), +0x19 = comparator 0x49a7b0:
//              norm(Moon + (Sun - c))
//   Nakshatra  the Moon alone against the target A (+0x08), c = 0
// (3-day steps as the Moon is involved, 1 s bracket, later end). The lunar month it returns
// comes from a second FUN_0049c130 call from the found record: the Moon-Sun conjunction
// (LunarYrDef 2/3, c = 0) or opposition (0/1, c = 180) searched backwards, month = that
// record's Sun sign (0/2) or, tropical variants 1/3, trunc(norm(Sun + ayanamsa - 30) / 30)
// with the record's Sun (+0x130) and mean ayanamsa (+0x1680); LunarYrDef 4: (found Sun sign
// + 11) % 12, 5: the tropical form of 1/3 on the found record. The natal month (doc+0x12078)
// is FUN_004a4270's, the same switch (jump table 0x4a4aec) on the backward search from the
// natal record, or on the natal record itself for 4/5 (keyInfo.ts lunarYearMonth).
//
// Annual chart (FUN_0041b250): start from the record natal + (Y - birthYear + 0.24641184) x
// 365.24219 days (FUN_0049dac0 mode 0) and search BACKWARD; while the found moment's primary key
// differs from the natal one, restart from the record 0.0035 day before it. Primary key with
// SolarMonthUsedInTP=1 (DAT_005922c8, default): Sun's sign (chart+0x118); with 0: lunar month
// (doc+0x12078). If the secondary key then differs too, one more backward search is made and
// used when both keys match. The period ends at the same search for (Y - birthYear + 1.24641184)
// years; its length (DAT_005922b0) drives dasa compression. Chart name "Annual TP".
// Monthly (FUN_0041bc60): the annual search without the secondary check, then month-1 forward
// searches from 0.0035 day after each hit; the period ends at the next forward hit ("Monthly TP").
// Daily (FUN_0041bf50): from 0.0035 day before the monthly hit, forward search with A = Moon +
// (day-1) x 12; ends at A = Moon + day x 12 ("Daily TP").
// Date mode (FUN_0041c2b0 first stores the entered moment as a record in the natal zone):
// annual FUN_0041c4c0 with both checks, restarting 0.0035 day before (after) each hit when
// searching backward (forward); the end is the forward annual search from the last restart
// moment + 0.007. Monthly FUN_0041ce70 (plain search, end = next forward hit), fortnightly
// FUN_0041d050 (A = Moon or norm(Moon + 180) (FUN_004ae800), the second kept only when strictly
// nearer in the search direction; "Fortntly" / "Fortntly " names; the period ends at the nearer
// of the next forward hits of both), daily FUN_0041d390 (A = Moon + 12k, k from the TITHI angles
// of the entered moment and of the natal chart whatever the type; end = A + 12).
// Every found moment and every restart point is stored as a chart record (FUN_0049d250), so the
// JDs pass through swe_revjul / swe_julday (mundane.ts recordJd). The chart keeps the natal
// place and zone; kind code doc+0x76d04 = 2.
// Nakshatra Pravesha: FUN_0049d7c0 puts the natal Moon at +0x08, the one-body target of
// FUN_0049c130, so JHora searches for the Moon at its natal longitude (no golden NP capture).
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { ayanamsa, siderealLongitude, norm360 } from '../positions';
import { jhoraDeltaT } from '../deltat';
import { calcSettingsFromIni, type Settings } from '../settings';
import { wrap180 } from './common';
import { n360, type BodySearch } from '../tajaka/search';
import { bodyLon, ctxOf, recordJd, recordSearch, type Ctx as RecordCtx } from './mundane';

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
  /** natal place and zone: the records' frame */
  m: RecordCtx;
  type: PraveshaType;
  /** A and B of FUN_0049d7c0: the natal Moon and Sun (record longitudes) */
  moon: number;
  sun: number;
  natalSunSign: number;
  natalMonth: number;
  solarMonthFirst: boolean;
  lunarYrDef: number;
}

/** The pravesha angle of a type at `jd`. */
export function praveshaAngle(swe: Sweph, s: Settings, type: PraveshaType, jd: number): number {
  const m = siderealLongitude(swe, jd, 'Moon', s).lon;
  if (type === 1) return m;
  const sun = siderealLongitude(swe, jd, 'Sun', s).lon;
  return type === 2 ? norm360(m + sun) : norm360(m - sun);
}

/** Sun's sign (record+0x118) of the record at `jd`. */
const sunSign = (c: RecordCtx, jd: number) => Math.floor(bodyLon(c, 1, jd) / 30);

/** Tropical month of the record at `jd` (LunarYrDef 1/3/5): trunc(norm(Sun + doc+0x1680 - 30) x 1/30). */
function tropicalMonth(c: RecordCtx, jd: number): number {
  const ayan = ayanamsa(c.swe, jd, jd + (jhoraDeltaT(jd) ?? c.swe.deltaT(jd)), c.settings).mean;
  return Math.trunc(norm360(bodyLon(c, 1, jd) + ayan - 30) * 0.03333333333333333);
}

/**
 * Lunar month returned by FUN_0049d7c0 for the record at `jd` (LunarYrDef 0/2: Sun's sign at
 * the previous full / new moon, searched backwards from the record; 1/3: the same moments'
 * tropical month; 4: solar; 5: tropical solar).
 */
export function lunarMonthAt(c: RecordCtx, jd: number, lunarYrDef: number): number {
  if (lunarYrDef === 4) return (sunSign(c, jd) + 11) % 12;
  if (lunarYrDef === 5) return tropicalMonth(c, jd);
  const phase = recordSearch(c, { b1: 2, b2: 1, offset: lunarYrDef <= 1 ? 180 : 0, backward: true }, jd);
  return lunarYrDef % 2 ? tropicalMonth(c, phase) : sunSign(c, phase);
}

function context(swe: Sweph, natal: Chart, type: PraveshaType): Ctx {
  const m = ctxOf(swe, natal);
  const lunarYrDef = natal.ini.LunarYrDef >= 0 && natal.ini.LunarYrDef <= 5 ? natal.ini.LunarYrDef : 2;
  const g = natal.positions.grahas;
  return {
    m, type, moon: g.Moon.lon, sun: g.Sun.lon,
    natalSunSign: Math.floor(g.Sun.lon / 30) % 12,
    natalMonth: lunarMonthAt(m, natal.positions.jdUt, lunarYrDef),
    solarMonthFirst: natal.ini.SolarMonthUsedInTP !== 0,
    lunarYrDef,
  };
}

/** The descriptor FUN_0049d7c0 hands to FUN_0049c130 for angles A (Moon) and B (Sun). */
function spec(type: PraveshaType, a: number, b: number, backward: boolean): Omit<BodySearch, 'lon'> {
  if (type === 1) return { b1: 2, target: a, backward };
  if (type === 2) return { b1: 2, b2: 1, offset: n360(a + b), sum: true, backward };
  return { b1: 2, b2: 1, offset: n360(a - b), backward };
}

/**
 * FUN_0049d7c0: the next (dir 1) or previous (dir -1) pravesha moment for A = `a` from the
 * record at `from`, as the found record's JD.
 */
function search(c: Ctx, a: number, from: number, dir: 1 | -1): number {
  return recordSearch(c.m, spec(c.type, a, c.sun, dir < 0), from);
}

/** The annual hit-and-check loop of FUN_0041b250 / FUN_0041c4c0; `next` = the last restart moment (before its record). */
function annualSearch(c: Ctx, from: number, dir: 1 | -1, secondary: boolean): { jd: number; next: number } {
  const month = (t: number) => lunarMonthAt(c.m, t, c.lunarYrDef);
  const primary = (t: number) => (c.solarMonthFirst ? sunSign(c.m, t) === c.natalSunSign : month(t) === c.natalMonth);
  let t = from;
  let jd = NaN, next = NaN;
  for (let k = 0; k < 40; k++) {
    jd = search(c, c.moon, t, dir);
    next = jd + dir * STEP;
    t = recordJd(c.m, next);
    if (primary(jd)) break;
  }
  if (secondary) {
    const ok = c.solarMonthFirst ? month(jd) === c.natalMonth : sunSign(c.m, jd) === c.natalSunSign;
    if (!ok) {
      const g = search(c, c.moon, t, dir);
      if (sunSign(c.m, g) === c.natalSunSign && month(g) === c.natalMonth) jd = g;
    }
  }
  return { jd, next };
}

const MEAN_YEAR = 365.24219;
const OFFSET = 0.24641183977130354;   // 0x546d38 (1.2464... at 0x546d30 for the end)

/** Button 1000: annual / monthly / daily Pravesha chart of a calendar year. */
export function tpYearChart(swe: Sweph, natal: Chart, sel: TPYearSelection): TPResult {
  const type = sel.type ?? 0;
  const c = context(swe, natal, type);
  const jd0 = natal.positions.jdUt;
  const years = sel.year - natal.birth.year;
  // FUN_0049dac0 mode 0 stores natal + years x 365.24219 as a record
  const guess = (y: number) => recordJd(c.m, jd0 + (y + OFFSET) * MEAN_YEAR);
  const after = (jd: number, d: number) => recordJd(c.m, jd + d);
  const sfx = PRAVESHA_SUFFIX[type];
  if (!sel.month) {
    const start = annualSearch(c, guess(years), -1, true).jd;
    const end = annualSearch(c, guess(years + 1), -1, true).jd;
    return { start, end, label: `Annual ${sfx}` };
  }
  let jd = annualSearch(c, guess(years), -1, false).jd;
  for (let i = 1; i < sel.month; i++) jd = search(c, c.moon, after(jd, STEP), 1);
  if (!sel.day) return { start: jd, end: search(c, c.moon, after(jd, STEP), 1), label: `Monthly ${sfx}` };
  const start = search(c, (sel.day - 1) * 12 + c.moon, after(jd, -STEP), 1);
  const end = search(c, sel.day * 12 + c.moon, after(start, STEP), 1);
  return { start, end, label: `Daily ${sfx}` };
}

/** Button 1004: the Pravesha chart before/after a date. */
export function tpDateChart(swe: Sweph, natal: Chart, sel: TPDateSelection): TPResult {
  const type = sel.type ?? 0;
  const c = context(swe, natal, type);
  const tz = sel.tzHours ?? natal.birth.tzHours;
  const from = recordJd(c.m, swe.julday(sel.year, sel.month, sel.day, sel.hour - tz));
  const after = (jd: number, d: number) => recordJd(c.m, jd + d);
  const dir: 1 | -1 = sel.before ? -1 : 1;
  const sfx = PRAVESHA_SUFFIX[type];
  switch (sel.kind) {
    case 0: {
      const a = annualSearch(c, from, dir, true);
      const end = annualSearch(c, after(a.next, 0.007), 1, true).jd;
      return { start: a.jd, end, label: `Annual ${sfx}` };
    }
    case 1: {
      const start = search(c, c.moon, from, dir);
      return { start, end: search(c, c.moon, after(start, STEP), 1), label: `Monthly ${sfx}` };
    }
    case 2: {
      const opp = n360(c.moon + 180);
      const c1 = search(c, c.moon, from, dir);
      const c2 = search(c, opp, from, dir);
      const first = sel.before ? !(c2 > c1) : !(c2 < c1);
      const start = first ? c1 : c2;
      const e1 = search(c, c.moon, after(start, STEP), 1);
      const e2 = search(c, opp, after(start, STEP), 1);
      return { start, end: e2 - start < e1 - start ? e2 : e1, label: first ? `Fortntly${sfx}` : `Fortntly ${sfx}` };
    }
    default: {
      // FUN_0041d390: the first A = Moon + 12k past the date's tithi angle in the search direction
      const ed = n360(bodyLon(c.m, 2, from) - bodyLon(c.m, 1, from));
      const en = n360(c.moon - c.sun);
      let off = 0;
      if (!sel.before) { for (let d = en - 360; d <= ed; d += 12) off += 12; }
      else { for (let d = en + 360; !(d < ed); d -= 12) off -= 12; }
      const a = off + c.moon;
      const start = search(c, a, from, dir);
      return { start, end: search(c, a + 12, after(start, STEP), 1), label: `Daily ${sfx}` };
    }
  }
}

/** Signed difference of the pravesha angle at `jd` from its natal value (degrees). */
export function praveshaError(swe: Sweph, natal: Chart, type: PraveshaType, jd: number, offset = 0): number {
  const s = calcSettingsFromIni(natal.ini);
  return wrap180(praveshaAngle(swe, s, type, jd) - praveshaAngle(swe, s, type, natal.positions.jdUt) - offset);
}
