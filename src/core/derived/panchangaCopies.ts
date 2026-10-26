// Miscellany > Panchanga: the other copy commands of menu 150 (see panchanga.ts for the
// day records and 33085).
//
// 33087 "Copy monthly ephemeris in JD format (5:30 am)": FUN_004644c0 fills the view's 31
//   day records (FUN_00465c80(31)), then FUN_0046b9d0(out, chart, 31):
//   jd0 = the chart's month, day 1, 5:30 clock time (FUN_0049d210 = julday(date, hour + zone)).
//   Row i (31 rows, spilling into the next month):
//     chart A at jd0 + i (stored as a record, FUN_0049d3e0), computed (FUN_0049bcf0) and given
//       its day frame (FUN_004a1350: the sunrise *before* 5:30 and the sunset after it, so
//       when the Sun rises after 5:30 the row shows the previous day's times);
//     chart B at jd0 + i + 6.5 h (12:00 clock time) with its zone replaced by the longitude
//       / 15 (B+0x68 = B+0x90 * 1/15): local mean noon. SidTime = its ARMC / 15
//       (swe_houses, FUN_0049aaa0 body 0 stores ascmc[2] / 15 at chart+0x1690).
//   "\n%d\t" A's day, the weekday 'Su'.. (0x8a294c) of view record i, "\t", then
//   FUN_004c1f00 "h:mm:ss" of the sunrise (A+0x2680), sunset (A+0x53b0) and sidereal time,
//   each + "\t", then bodies 1..8 (Sun..Rahu) of chart A as "%03d:%02d:%02d" + "\t"
//   (FUN_004c1980 split: 30 * sign + degrees, minutes, trunc(seconds + 0.5)).
//
// 33088 "Copy monthly planetary movements (in JD format)": FUN_00464720 ->
//   FUN_0046c890(out, chart, 31). The window is the chart's calendar month: jd0 = day 1,
//   0:00 clock time, end = jd0 + days in the month (Gregorian leap rule FUN_004ae7c0).
//   Every search is FUN_0049c0d0 forward from a record (tajaka/search.ts jhoraBodySearch);
//   a result before jd0 or after the end stops the loop, otherwise the found record
//   becomes the next start.
//   * "Entry of planets into signs": bodies 1, 3..9 (the Moon is left out). From jd0, the
//     next sign (1 + trunc(lon / 30)) % 12 is searched repeatedly; then again from jd0 the
//     start of the current sign trunc(lon / 30) (entries while retrograde, printed with
//     the previous sign). "\n%s\tenters\t%s\t%d\t%s": long body name (*0x8a4b54 =
//     0x8a49bc), sign (0x8a4188), the record's day of month, "h:mm:ss".
//   * "Entry of planets in nakshatras": the same with 13.333333333333332-degree divisions
//     and the names at 0x8a4038.
//   * "Planetary aspects of Jyotish": lines kept in a list sorted by time (an entry goes
//     after those with an equal or earlier JD) and appended at the end. Pairs a < b of
//     bodies 1..9 (not Rahu-Ketu): conjunctions lon(a) - lon(b) = 0 "[C]" and, except for
//     Sun-Mercury, Sun-Venus and Mercury-Venus, oppositions (offset 180) "[S]",
//     "\n%s\t[C]\t%s\t%d\t%s" with the short names (*0x8a4820 = 0x8a4684). Then for every
//     body x, six offsets c (jump table 0x46ee88) and every other body y (same exclusions):
//     lon(x) - lon(y) = c gives "\n%s\t%s\t%s\t%d\t%s" (x, label 1, y) and, for the
//     aspects that are mutual, also (y, label 2, x). Both orders of a pair are searched,
//     so mutual aspects appear twice (JHora's list has the same duplicates).
//
// 33420 "Copy monthly panchanga (DP format)": FUN_00464070 opens dialog 2081 ("Panchanga
//   period": start month / date / year, number of days; defaults the chart's date and 20)
//   and calls FUN_0046eee0(out, chart, year, month, day, days), days capped at 400.
//   jd0 = the start date at 12:00 clock time. Each day is the panchanga record of the day
//   containing jd0 + i (as FUN_00465c80 with WeekdayDefinition 0: chart C moved to the
//   frame sunrise + 0.01 hour, FUN_00467af0 fills the record). Header without a leading
//   newline, rows "\n" + tab-separated fields (see dpRow). Times are FUN_004c1d20 =
//   FUN_004c1d40 mode 2 ("h:mm", seconds rounded, no day mark).
//   R1/L1 ..: the lagna's exits: from C's date at 0:00 the lagna (body 0, 1/12-day steps,
//   1/15 s) is searched to (s + 1) * 30 for s = Sun's sign, Sun's sign + 1, ...; each
//   search starts 0.1 hour after the previous result; "%s\t%s\t" = sign name, time.
//   Then twelve columns (Aries..Pisces) listing the bodies 1..9 (0x8a4354 names) in
//   each sign at C, joined by ", ".
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { siderealAscendant, siderealLongitude, GRAHAS } from '../positions';
import { calcSettingsFromIni, type Settings } from '../settings';
import { dayFrame } from '../day';
import { formatHms, lunarYearMonthAt, SAMVATSARAS, LUNAR_MONTHS, KI_NAKSHATRAS, YOGAS, KARANAS, WEEKDAYS } from '../keyInfo';
import { SIGN_NAMES, NAKSHATRAS } from '../zodiac';
import { jhoraBodySearch } from '../tajaka/search';
import { MONTHS, WEEKDAY_SHORT, panchangaDay, sunriseWeekday, timeText, type Moment, type PanchangaDay, type Span } from './panchanga';

/** *0x8a4b54 (English: 0x8a49bc) and *0x8a4820 (0x8a4684), by JHora body index. */
const BODY_LONG = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const BODY_SHORT = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
/** 0x8a4354: the DP format's sign columns. */
const DP_BODY = ['Sun', 'Moon', 'Mars', 'Merc', 'Jup', 'Ven', 'Sat', 'Rah', 'Ket'];
const SOLAR_MONTHS = ['Mesh', 'Vrish', 'Mith', 'Kark', 'Simh', 'Kanya', 'Tula', 'Vrisch', 'Dhanu', 'Makar', 'Kumbh', 'Meen']; // 0x8a28e8
const RITUS = ['Vasanta', 'Greeshma', 'Varsha', 'Sharad', 'Hemanta', 'Shishira'];                                      // 0x8a2424
const PAKSHAS = ['Sukla', 'Krishna'];                                                                                  // 0x8a255c
/** 0x8a24e4: tithi names without the paksha. */
const TITHI_SHORT = [0, 1].flatMap((p) => ['Pratipat', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Sapthami',
  'Ashtami', 'Navami', 'Dasami', 'Ekadasi', 'Dwadasi', 'Trayodasi', 'Chaturdasi', p ? 'Amavasya' : 'Pournimasya']);

const trunc = Math.trunc;
const pad2 = (n: number) => String(n).padStart(2, '0');

interface Ctx { swe: Sweph; s: Settings; tz: number; lat: number; lon: number; sunriseDef: number; lunarYrDef: number }

function ctxOf(chart: Chart, swe: Sweph): Ctx {
  const b = chart.birth;
  return { swe, s: calcSettingsFromIni(chart.ini), tz: b.tzHours, lat: b.lat, lon: b.lon, sunriseDef: chart.ini.SunriseDefinition, lunarYrDef: chart.ini.LunarYrDef };
}

/** FUN_0049aaa0: longitude of JHora body b (0 lagna, 1 Sun .. 9 Ketu). */
function bodyLon(c: Ctx, b: number, jd: number): number {
  return b === 0 ? siderealAscendant(c.swe, jd, c, c.s) : siderealLongitude(c.swe, jd, GRAHAS[b - 1], c.s).lon;
}

/** The local clock date and hour of a JD (FUN_0049d250 / FUN_0049d3e0: swe_revjul(jd + zone / 24)). */
function local(c: Ctx, jd: number): Moment {
  const r = c.swe.revjul(jd + c.tz * 0.041666666666666664);
  return { jd, year: r.year, month: r.month, day: r.day, hour: r.hour };
}

/** The JD of a record made from `jd` (FUN_0049d210: swe_julday(date, hour + zone)). */
function recordJd(c: Ctx, jd: number): number {
  const r = local(c, jd);
  return c.swe.julday(r.year, r.month, r.day, r.hour - c.tz);
}

/** FUN_0049c0d0 forward from the record at t0: body b1 reaches `target`, or b1 - b2 = offset. Raw JD. */
function search(c: Ctx, spec: { b1: number; b2?: number; target?: number; offset?: number }, t0: number): number {
  return jhoraBodySearch({ ...spec, lon: (b, t) => bodyLon(c, b, t), backward: false }, t0);
}

/** FUN_004c1980: sign, degrees, minutes and seconds of a longitude (x87 order, no carry into the sign). */
export function splitLongitude(x: number): { sign: number; deg: number; min: number; sec: number } {
  let lon = x;
  while (lon < 0) lon += 360;
  while (lon >= 360) lon -= 360;
  const sign = trunc(lon * 0.03333333333333333);
  let deg = trunc(lon - sign * 30);
  let min = trunc((lon - (sign * 30 + deg)) * 60);
  let sec = (lon - (sign * 30 + deg + min * 0.016666666666666666)) * 3600;
  if (60 - sec < 0.0001) { sec = 0; min++; if (min === 60) { min = 0; deg++; } }
  if (sec < 0.0001) sec = 0;
  return { sign, deg, min, sec };
}

/** FUN_0046b9d0's "%03d:%02d:%02d" of a longitude. */
export function ephemerisDms(lon: number): string {
  const p = splitLongitude(lon);
  return `${String(p.sign * 30 + p.deg).padStart(3, '0')}:${pad2(p.min)}:${pad2(trunc(p.sec + 0.5))}`;
}

// ---------------------------------------------------------------------------
// 33087

/** FUN_0046b9d0: the clipboard text of 33087 for a month (the chart's by default). */
export async function ephemerisText(chart: Chart, swe: Sweph, year = chart.birth.year, month = chart.birth.month): Promise<string> {
  const c = ctxOf(chart, swe);
  const geo = { lat: c.lat, lon: c.lon, alt: chart.birth.altitudeM };
  const jd0 = swe.julday(year, month, 1, 5.5 - c.tz);
  await swe.ensureEphemeris(jd0 - 2);
  await swe.ensureEphemeris(jd0 + 33);
  // FUN_00465c80(31): record i is the day containing day 1 + i at 12:00; its weekday is that of its sunrise
  const noon0 = swe.julday(year, month, 1, 12 - c.tz);
  let out = `\nMonthly Ephemeris for ${MONTHS[month - 1]}, ${year} (at 5:30 am everyday):\n`;
  out += '\nDate\tDay\tSunrise\tSunset   \tSidTime    \tSun    \tMoon   \tMars   \tMercury \tJupiter  \tVenus   \tSaturn   \tRahu\n';
  for (let i = 0; i < 31; i++) {
    const a = recordJd(c, jd0 + i);
    const fr = dayFrame(swe, a, geo, c.s, c.sunriseDef);
    const weekday = sunriseWeekday(swe, dayFrame(swe, noon0 + i, geo, c.s, c.sunriseDef).sunrise, c.tz);
    // chart B: the record of 12:00 clock time, re-zoned to local mean time
    const b = local(c, jd0 + i + 0.2708333333333333);
    const sid = swe.houses(swe.julday(b.year, b.month, b.day, b.hour - c.lon / 15), 0, c.lat, c.lon, 'P').ascmc[2] / 15;
    out += `\n${local(c, a).day}\t${WEEKDAY_SHORT[weekday]}\t`;
    out += `${formatHms(local(c, fr.sunrise).hour)}\t${formatHms(local(c, fr.sunset).hour)}\t${formatHms(sid)}\t`;
    for (let k = 1; k <= 8; k++) out += `${ephemerisDms(bodyLon(c, k, a))}\t`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 33088

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Pairs FUN_0046c890 never searches for oppositions and aspects (Sun/Mercury/Venus, Rahu/Ketu). */
function excluded(a: number, b: number): boolean {
  const inner = [1, 4, 6];
  return (inner.includes(a) && inner.includes(b)) || (a === 8 && b === 9) || (a === 9 && b === 8);
}

/** The six aspect searches of FUN_0046c890 (jump table 0x46ee88): offset, label x->y, label y->x, y->x printed too. */
const ASPECTS: [number, string, string, boolean][] = [
  [270, '[4]', '[10]', true], [150, '[8]', '[6]', false], [240, '[5]', '[9]', true],
  [120, '[9]', '[5]', true], [300, '[3]', '[11]', false], [90, '[10]', '[4]', true],
];

/** One "Entry of planets ..." block: divisions of `arc` degrees (inv = its reciprocal as JHora multiplies). */
function entries(c: Ctx, jd0: number, end: number, arc: number, inv: number, n: number, names: readonly string[]): string {
  let out = '';
  for (let p = 1; p <= 9; p++) {
    if (p === 2) continue;
    for (const back of [false, true]) {
      // forward: the next division; back: the start of the current one, entered retrograde
      let t = jd0;
      for (;;) {
        const v = trunc(bodyLon(c, p, t) * inv);
        const target = (back ? v : (1 + v) % n) * arc;
        const raw = search(c, { b1: p, target }, t);
        const jd = recordJd(c, raw);
        if (jd < jd0 || jd > end) break;
        const shown = trunc((target + 1) * inv);
        const m = local(c, raw);
        out += `\n${BODY_LONG[p]}\tenters\t${names[back ? (shown + n - 1) % n : shown]}\t${m.day}\t${formatHms(m.hour)}`;
        t = jd;
      }
    }
  }
  return out;
}

/** FUN_0046c890: the clipboard text of 33088 for a calendar month (the chart's by default). */
export async function movementsText(chart: Chart, swe: Sweph, year = chart.birth.year, month = chart.birth.month): Promise<string> {
  const c = ctxOf(chart, swe);
  const days = [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  const jd0 = swe.julday(year, month, 1, -c.tz);
  const end = jd0 + days;
  await swe.ensureEphemeris(jd0);
  // slow pairs (Jupiter-Saturn, the nodes' wrong-way sign entries) are searched up to ~20 years ahead
  await swe.ensureEphemeris(jd0 + 7500);
  let out = `\nPlanetary Movements for ${MONTHS[month - 1]}, ${year}:\n\nEntry of planets into signs\n`;
  out += entries(c, jd0, end, 30, 0.03333333333333333, 12, SIGN_NAMES);
  out += '\n\nEntry of planets in nakshatras\n';
  out += entries(c, jd0, end, 13.333333333333332, 0.07500000000000001, 27, KI_NAKSHATRAS);
  out += '\n\nPlanetary aspects of Jyotish:\n';

  const list: { jd: number; text: string }[] = [];
  const insert = (jd: number, text: string) => {
    let i = 0;
    while (i < list.length && list[i].jd <= jd) i++;
    list.splice(i, 0, { jd, text });
  };
  const scan = (b1: number, b2: number, offset: number, emit: (jd: number, m: Moment) => void) => {
    for (let t = jd0; ;) {
      const raw = search(c, { b1, b2, offset }, t);
      const jd = recordJd(c, raw);
      if (jd < jd0 || jd > end) return;
      emit(jd, local(c, raw));
      t = jd;
    }
  };
  const when = (m: Moment) => `${m.day}\t${formatHms(m.hour)}`;
  for (let a = 1; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      if (a === 8 && b === 9) continue;
      scan(a, b, 0, (jd, m) => insert(jd, `\n${BODY_SHORT[a]}\t[C]\t${BODY_SHORT[b]}\t${when(m)}`));
      if (!excluded(a, b)) scan(a, b, 180, (jd, m) => insert(jd, `\n${BODY_SHORT[a]}\t[S]\t${BODY_SHORT[b]}\t${when(m)}`));
    }
  }
  for (let x = 1; x <= 9; x++) {
    for (const [offset, l1, l2, mutual] of ASPECTS) {
      for (let y = 1; y <= 9; y++) {
        if (x === y || excluded(x, y)) continue;
        scan(x, y, offset, (jd, m) => {
          insert(jd, `\n${BODY_SHORT[x]}\t${l1}\t${BODY_SHORT[y]}\t${when(m)}`);
          if (mutual) insert(jd, `\n${BODY_SHORT[y]}\t${l2}\t${BODY_SHORT[x]}\t${when(m)}`);
        });
      }
    }
  }
  return out + list.map((e) => e.text).join('');
}

// ---------------------------------------------------------------------------
// 33420

export interface DpOptions { year: number; month: number; day: number; days: number }

export const DP_HEADER = 'Gregorian Date\tYear\tMonth\tFullDate\tYearName\tAyana\tRitu\tSidSolarMonth\tLunarMonth\tPaksha\tTithi\tTithiEndTime\tRahuKala\tDay\tNakshatra\tNakshatraEndTime\tYoga\tKarana\t'
  + 'Varjya1Start\tVarjya1End\tVarjya2Start\tVarjya2End\tDurMuhurta1Start\tDurMuhurta1End\tDurMuhurta2Start\tDurMuhurta2End\tSunrise\tSunset\t'
  + Array.from({ length: 12 }, (_, i) => `R${i + 1}\tL${i + 1}\t`).join('')
  + '1_Mesham\t2_Vrushabham\t3_Mithunam\t4_Karkatakam\t5_Simham\t6_Kanya\t7_Tula\t8_Vruschikam\t9_Dhanur\t10_Makaram\t11_Kumbham\t12_Meenam';

/** FUN_004c1d20: "h:mm" with the seconds rounded, no day mark. */
const hm = (t: Moment) => timeText(t, 2, t.day);

/** One row of FUN_0046eee0 from a panchanga record (the chart C fields read at its moment, dayStart). */
function dpRow(c: Ctx, d: PanchangaDay): string {
  const t1 = d.dayStart;
  const sunSign = splitLongitude(bodyLon(c, 1, t1.jd)).sign;
  // FUN_004a4270 at C: lunar month and samvatsara (+0x12028 / +0x12030), tithi (+0x12034)
  const ly = lunarYearMonthAt(c.swe, t1.jd, t1.year, t1.month, c.s, c.lunarYrDef);
  const ti = d.tithi.items[0].index;
  let out = `\n${t1.day}-${pad2(t1.month)}-${String(t1.year).padStart(4, '0')}\t${String(t1.year).padStart(4, '0')}\t${MONTHS[t1.month - 1]}\t${t1.day}\t`;
  out += `${SAMVATSARAS[ly.samvatsara]}\t${sunSign >= 3 && sunSign < 9 ? 'Dakshinayana' : 'Uttarayana'}\t${RITUS[trunc(((ly.month + 1) % 12) / 2)]}\t`;
  out += `${SOLAR_MONTHS[sunSign]}\t${LUNAR_MONTHS[ly.month]}\t`;
  out += `${PAKSHAS[trunc(ti / 15)]}\t${TITHI_SHORT[ti]}\t${hm(d.tithi.items[0].end)}\t${hm(d.rahu.start)} - ${hm(d.rahu.end)}\t`;
  out += `${WEEKDAYS[d.weekday]}\t`;
  // record +0x740 (Varjya) and +0x8e8 (Durmuhurta): the second span only when there are two
  const spans = (sp: Span[]) => [0, 1].flatMap((k) => (sp.length > k ? [hm(sp[k].start), hm(sp[k].end)] : ['', '']));
  const cells = [NAKSHATRAS[d.nakshatra.items[0].index], hm(d.nakshatra.items[0].end), YOGAS[d.yoga.items[0].index], KARANAS[d.karana.items[0].index],
    ...spans(d.varjya), ...spans(d.durmuhurta), hm(d.sunrise), hm(d.sunset)];
  out += cells.map((x) => `${x}\t`).join('');
  // the lagna leaving each sign, from 0:00 of C's date (C's planets are not recomputed)
  let t = c.swe.julday(t1.year, t1.month, t1.day, -c.tz);
  for (let i = 0; i < 12; i++) {
    const s = (i + sunSign) % 12;
    const m = local(c, search(c, { b1: 0, target: (s + 1) * 30 }, t));
    out += `${SIGN_NAMES[s]}\t${hm(m)}\t`;
    t = c.swe.julday(m.year, m.month, m.day, m.hour + 0.1 - c.tz);
  }
  const signs = DP_BODY.map((_, k) => splitLongitude(bodyLon(c, k + 1, t1.jd)).sign);
  out += Array.from({ length: 12 }, (_, s) => DP_BODY.filter((_, k) => signs[k] === s).join(', ')).join('\t');
  return out;
}

/** FUN_0046eee0: the clipboard text of 33420 for `days` days from a start date. */
export async function dpFormatText(chart: Chart, swe: Sweph, o: DpOptions): Promise<string> {
  const c = ctxOf(chart, swe);
  const n = Math.min(Math.max(0, trunc(o.days)), 400);
  const jd0 = swe.julday(o.year, o.month, o.day, 12 - c.tz);
  await swe.ensureEphemeris(jd0 - 2);
  await swe.ensureEphemeris(jd0 + n + 2);
  let out = DP_HEADER;
  for (let i = 0; i < n; i++) out += dpRow(c, panchangaDay(chart, swe, jd0 + i, o.day + i));
  return out;
}
