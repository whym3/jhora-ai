// Miscellany > Panchanga (CPanchangaView, RTTI 0x57d394, vtable 0x54d2c8, menu 150).
//
// The view keeps one record per day (stride 0x2e60, first at view+0x98) filled by
//   FUN_00465c80(n)  (copy commands, n = 31)  /  FUN_004665f0(n)  (screen, n = 2):
//     start = 12:00 local on day 1 of the chart's month (n > 2) or on the chart's
//     date (n <= 2); for each day the chart is recomputed at noon, moved to the
//     sunrise of the WeekdayDefinition frame (FUN_004a1350, default 0 = sunrise
//     frame) and FUN_00467af0 fills the record from that sunrise chart.
//   FUN_00467af0: the "day" is [sunrise, sunrise + 1.0 day). For tithi, nakshatra,
//     yoga, karana and the Moon's sign it stores the element at sunrise and its end
//     (transit search FUN_0049c0d0 -> FUN_0049c130), then the following element and
//     its end while the ends fall inside the day: count 0 = "whole day", 1 or 2
//     (karana up to 3). Rise/set times FUN_004a1a00(body): JHora's *ecliptic*
//     rise/set - the moment the ascendant equals the body's longitude (minus the
//     semi-diameter for SunriseDefinition 1/2, plus refraction 0.5667 for 2; 0 by
//     default), sunset/moonset when the descendant does. Sun: backward search
//     from the sunrise chart (= the day frame's sunrise); others forward.
//   Rahu/Gulika/Yama kaalas: eighths of (sunset - sunrise), part tables by weekday
//     [7,1,6,4,5,3,2] / [6,5,4,3,2,1,0] (+1 when GulikaInSaturnPortion = 0) /
//     [4,3,2,1,0,6,5].
//   FUN_00466f80: Varjya = 4 ghatis starting VARJYA[nak] ghatis (of 60) into the
//     nakshatra, for the current and the next nakshatra, kept when overlapping the
//     day; Durmuhurta = muhurta (sunset - sunrise)/15 number DUR1[wd] and DUR2[wd].
//   Horas: 24 entries, lord ((wd - 2k) + 49) % 7 + 1; choghadiyas: 16 entries,
//     (wd + 5k) % 7 by day and (wd + 4(k-7)) % 7 by night (names 0x8a2240).
// Copy formats:
//   33085 "Copy monthly panchanga"        FUN_00463fc0 -> FUN_0046a150 (no horas)
//   33086 "Copy monthly panchanga in JD format" FUN_00464310 -> FUN_0046af00
//   33420 DP format (FUN_00464070 -> FUN_0046eee0, asks month/year in a dialog): not ported
//   33087/33088/33089 monthly ephemeris / movements / co-ordinates: not ported
// Times: FUN_004ba720 -> FUN_004c1d40 "%d:%02d" (mode 0 truncates the seconds,
// mode 2 rounds them) plus "*" when the event's local day-of-month differs from
// the row's day counter.
//
// Defaults assumed: SunriseDefinition 0, WeekdayDefinition 0, GulikaInSaturnPortion 1,
// English name tables (0x8a2918 signs 'Ar'.., 0x8a4684 planets 'Sun'..).
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { siderealLongitude, ayanamsa, norm360, type Graha } from '../positions';
import { calcSettingsFromIni, type Settings } from '../settings';
import { dayFrame } from '../day';
import { jhoraDeltaT } from '../deltat';
import { TITHI_NAMES, KI_NAKSHATRAS, YOGAS, KARANAS, WEEKDAYS } from '../keyInfo';
import { solveAngle, scanCrossing, wrap180 } from './common';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];          // 0x8a294c
const SIGN_SHORT = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi']; // 0x8a2918
const PLANET = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']; // 0x8a4684
export const CHOGHADIYAS = ['Udyoga', 'Amrita', 'Roga', 'Laabha', 'Shubha', 'Chala', 'Kaala']; // 0x8a2240
/** Karana of each 6-degree half tithi, 1-based into KARANAS (as keyInfo.ts). */
const KARANA_OF_HALF = [11, ...Array.from({ length: 56 }, (_, i) => (i % 7) + 1), 8, 9, 10];
/** FUN_00466f80 stack table: Varjya start in ghatis (of the nakshatra's 60). */
export const VARJYA = [50, 4, 30, 40, 14, 21, 30, 20, 32, 30, 20, 1, 21, 20, 14, 14, 10, 14, 20, 20, 20, 10, 10, 18, 16, 30, 30];
const DUR1 = [13, 7, 3, 7, 11, 3, 0];
const DUR2 = [-1, 11, 10, -1, 12, 8, 1];
const RAHU = [7, 1, 6, 4, 5, 3, 2];
const GULIKA = [6, 5, 4, 3, 2, 1, 0];
const YAMA = [4, 3, 2, 1, 0, 6, 5];

const trunc = Math.trunc;
const pad2 = (n: number) => String(n).padStart(2, '0');

/** A moment with its local clock date (the 0x68-byte date records). */
export interface Moment { jd: number; year: number; month: number; day: number; hour: number }
export interface Element { index: number; end: Moment }
export interface Track { count: number; items: Element[] }
export interface Span { start: Moment; end: Moment }

export interface PanchangaDay {
  /** row counter JHora compares event days against (1-based day of month, or the chart's day) */
  counter: number;
  date: { year: number; month: number; day: number };
  weekday: number;
  sunrise: Moment; sunset: Moment; moonrise: Moment | null; moonset: Moment | null;
  tithi: Track; nakshatra: Track; yoga: Track; karana: Track; moonSign: Track;
  rahu: Span; gulika: Span; yama: Span;
  varjya: Span[]; durmuhurta: Span[];
  horas: { lord: number; start: Moment; end: Moment }[];
  choghadiyas: { index: number; start: Moment; end: Moment }[];
}

interface Ctx { swe: Sweph; s: Settings; tz: number; lat: number; lon: number }

function moment(c: Ctx, jd: number): Moment {
  const r = c.swe.revjul(jd + c.tz / 24);
  return { jd, year: r.year, month: r.month, day: r.day, hour: r.hour };
}

const lonOf = (c: Ctx, g: Graha) => (jd: number) => siderealLongitude(c.swe, jd, g, c.s);

/** Sidereal ascendant (mean ayanamsa, as positions.ts) with a numeric speed. */
function ascendantAt(c: Ctx, jd: number): number {
  const jdEt = jd + (jhoraDeltaT(jd) ?? c.swe.deltaT(jd));
  const ay = ayanamsa(c.swe, jd, jdEt, c.s);
  return norm360(c.swe.houses(jd, 0, c.lat, c.lon, 'P').ascmc[0] - ay.mean);
}

type Fn = (jd: number) => { lon: number; speed: number };
const elongation = (c: Ctx): Fn => (jd) => {
  const m = lonOf(c, 'Moon')(jd), s = lonOf(c, 'Sun')(jd);
  return { lon: norm360(m.lon - s.lon), speed: m.speed - s.speed };
};
const sumSM = (c: Ctx): Fn => (jd) => {
  const m = lonOf(c, 'Moon')(jd), s = lonOf(c, 'Sun')(jd);
  return { lon: norm360(m.lon + s.lon), speed: m.speed + s.speed };
};

/** Next moment after jd when f reaches the multiple of `step` above its value at jd. */
function nextBoundary(f: Fn, jd: number, step: number): { index: number; jd: number } {
  const v = f(jd);
  const index = Math.floor(v.lon / step + 1e-12) % Math.round(360 / step);
  const target = norm360((index + 1) * step);
  let gap = target - v.lon; if (gap <= 0) gap += 360;
  return { index, jd: solveAngle(f, target, jd + gap / v.speed) };
}

/** The element at sunrise and up to `max` following ones whose ends fall in [t0, t0 + 1). */
function track(c: Ctx, f: Fn, step: number, t0: number, max: number, nameIndex: (i: number) => number = (i) => i): Track {
  const items: Element[] = [];
  let t = t0;
  let count = 0;
  for (let k = 0; k < max; k++) {
    const b = nextBoundary(f, t, step);
    items.push({ index: nameIndex(b.index), end: moment(c, b.jd) });
    if (b.jd < t0 || b.jd >= t0 + 1) break;
    count = k + 1;
    t = b.jd + 1e-7;
  }
  return { count, items };
}

/** FUN_004a1a00 for the Moon: ascendant (or descendant) reaching the Moon's longitude after `from`. */
function moonRiseSet(c: Ctx, from: number, set: boolean): Moment | null {
  const moon = lonOf(c, 'Moon');
  const t = scanCrossing((jd) => norm360(ascendantAt(c, jd) - moon(jd).lon), set ? 180 : 0, from, 1, 1 / 24, 2.5, 1e-8);
  return t === null ? null : moment(c, t);
}

function span(c: Ctx, a: number, b: number): Span { return { start: moment(c, a), end: moment(c, b) }; }

/** One record of FUN_00467af0 for the sunrise of the day containing jdNoon. */
export function panchangaDay(chart: Chart, swe: Sweph, jdNoon: number, counter: number): PanchangaDay {
  const s = calcSettingsFromIni(chart.ini);
  const b = chart.birth;
  const c: Ctx = { swe, s, tz: b.tzHours, lat: b.lat, lon: b.lon };
  const geo = { lat: b.lat, lon: b.lon, alt: b.altitudeM };
  const fr = dayFrame(swe, jdNoon, geo, s, chart.ini.SunriseDefinition);
  const t0 = fr.sunrise;
  const sr = moment(c, t0);
  const local = swe.revjul(t0 + c.tz / 24);
  const weekday = (Math.floor(swe.julday(local.year, local.month, local.day, 12) + 0.5) + 1) % 7;
  const moonAt = lonOf(c, 'Moon');

  const tithi = track(c, elongation(c), 12, t0, 2);
  const nakshatra = track(c, (jd) => moonAt(jd), 360 / 27, t0, 2);
  const yoga = track(c, sumSM(c), 360 / 27, t0, 2);
  const karana = track(c, elongation(c), 6, t0, 3, (h) => KARANA_OF_HALF[h] - 1);
  const moonSign = track(c, (jd) => moonAt(jd), 30, t0, 1);

  // Rahu / Gulika / Yama kaalas: eighths of the day part
  const part = (fr.sunset - t0) / 8;
  const kaala = (k: number) => span(c, t0 + k * part, t0 + (k + 1) * part);
  const gulikaK = GULIKA[weekday] + (chart.ini.GulikaInSaturnPortion ? 0 : 1);

  // Varjya (FUN_00466f80)
  const varjya: Span[] = [];
  const nak = trunc(moonAt(t0).lon * 27 / 360) % 27;
  const step = 360 / 27;
  const nakStart = solveAngle(moonAt, nak * step, t0 - wrap180(moonAt(t0).lon - nak * step) / moonAt(t0).speed);
  const nakEnd = solveAngle(moonAt, norm360((nak + 1) * step), t0 + wrap180((nak + 1) * step - moonAt(t0).lon) / moonAt(t0).speed);
  const nakEnd2 = solveAngle(moonAt, norm360((nak + 2) * step), nakEnd + step / moonAt(nakEnd).speed);
  for (const [i, a, z] of [[nak, nakStart, nakEnd], [(nak + 1) % 27, nakEnd, nakEnd2]] as const) {
    const d = z - a;
    const st = a + VARJYA[i] * d / 60;
    const en = st + d / 15;
    if (t0 <= en && st <= t0 + 1) varjya.push(span(c, st, en));
  }
  // Durmuhurta
  const muh = (fr.sunset - t0) / 15;
  const durmuhurta = [DUR1[weekday], DUR2[weekday]].filter((k) => k >= 0).map((k) => span(c, t0 + k * muh, t0 + (k + 1) * muh));

  // Horas and choghadiyas (end times shown); day and night divided separately
  const dayLen = fr.sunset - t0, nightLen = fr.nextSunrise - fr.sunset;
  const horas = Array.from({ length: 24 }, (_, k) => {
    const a = k < 12 ? t0 + k * dayLen / 12 : fr.sunset + (k - 12) * nightLen / 12;
    const z = k < 12 ? a + dayLen / 12 : a + nightLen / 12;
    return { lord: ((weekday - 2 * k) + 49) % 7 + 1, start: moment(c, a), end: moment(c, z) };
  });
  const choghadiyas = Array.from({ length: 16 }, (_, k) => {
    const a = k < 8 ? t0 + k * dayLen / 8 : fr.sunset + (k - 8) * nightLen / 8;
    const z = k < 8 ? a + dayLen / 8 : a + nightLen / 8;
    const index = k < 8 ? (weekday + 5 * k) % 7 : (weekday + 4 * (k - 7)) % 7;
    return { index, start: moment(c, a), end: moment(c, z) };
  });

  return {
    counter, date: { year: sr.year, month: sr.month, day: sr.day }, weekday,
    sunrise: sr, sunset: moment(c, fr.sunset),
    moonrise: moonRiseSet(c, t0, false), moonset: moonRiseSet(c, t0, true),
    tithi, nakshatra, yoga, karana, moonSign,
    rahu: kaala(RAHU[weekday]), gulika: kaala(gulikaK), yama: kaala(YAMA[weekday]),
    varjya, durmuhurta, horas, choghadiyas,
  };
}

/**
 * Days of the monthly panchanga (FUN_00465c80, n = 31: always 31 rows from day 1
 * of the month, spilling into the next month) or of the screen (n <= 2: from the
 * chart's own date).
 */
export async function panchangaDays(chart: Chart, swe: Sweph, n: number, year = chart.birth.year, month = chart.birth.month): Promise<PanchangaDay[]> {
  const startDay = n > 2 ? 1 : chart.birth.day;
  const jd0 = swe.julday(year, month, startDay, 12 - chart.birth.tzHours);
  await swe.ensureEphemeris(jd0);
  await swe.ensureEphemeris(jd0 + n + 2);
  return Array.from({ length: n }, (_, k) => panchangaDay(chart, swe, jd0 + k, startDay + k));
}

// ---- text formats ----

/** FUN_004ba720 -> FUN_004c1d40: "h:mm" (mode 0 truncates, mode 2 rounds the seconds) + "*" on another day. */
export function timeText(t: Moment | null, mode: 0 | 2, counter: number): string {
  if (!t) return '';
  const x = Math.abs(t.hour);
  let h = trunc(x);
  let m = trunc((x - h) * 60);
  let sec = trunc((x - (m / 60 + h)) * 3.6e10 + 0.5) * 1e-7;
  if (60 - sec < 1e-4) { sec = 0; m++; if (m === 60) { h++; m = 0; } }
  if (mode === 2 && sec >= 30) { m++; if (m > 59) { h++; m -= 60; } }
  return `${h}:${pad2(m)}${t.day !== counter ? '*' : ''}`;
}

function partsText(tr: Track, names: string[], suffix: string, counter: number): string {
  const nm = (i: number) => names[i] ?? '';
  if (tr.count === 0) return `${nm(tr.items[0].index)}${suffix} (whole day), `;
  let out = '';
  for (let j = 0; j < tr.count; j++) out += `${nm(tr.items[j].index)}${suffix} till ${timeText(tr.items[j].end, 0, counter)}, `;
  return out;
}

/**
 * FUN_0046a150: one day of "Copy monthly panchanga" (horas = false) or, with horas,
 * the same text plus the Horas / Choghadiyas lines the screen shows.
 */
export function dayText(d: PanchangaDay, horas = false): string {
  const k = d.counter;
  const T2 = (t: Moment | null) => timeText(t, 2, k);
  let out = `\n${MONTHS[d.date.month - 1]} ${d.date.day}, ${d.date.year}:\n`;
  out += '    ';
  let buf = `${WEEKDAYS[d.weekday]}, ` + partsText(d.tithi, TITHI_NAMES, '', k) + '\n    ';
  buf += partsText(d.nakshatra, KI_NAKSHATRAS, '', k) + partsText(d.yoga, YOGAS, ' yoga', k);
  out += buf + '\n    ';
  out += partsText(d.karana, KARANAS, ' karana', k) + '\n    ';
  out += `RahuK: ${T2(d.rahu.start)} - ${T2(d.rahu.end)}, GulikaK: ${T2(d.gulika.start)} - ${T2(d.gulika.end)}, YamaG: ${T2(d.yama.start)} - ${T2(d.yama.end)}, `;
  out += '\n    ';
  buf = '';
  if (d.varjya.length > 0) buf += `Varjya: ${T2(d.varjya[0].start)} - ${T2(d.varjya[0].end)}, `;
  if (d.varjya.length > 1) buf += `${T2(d.varjya[1].start)} - ${T2(d.varjya[1].end)}, `;
  if (d.durmuhurta.length > 0) buf += `Durmuhurta: ${T2(d.durmuhurta[0].start)} - ${T2(d.durmuhurta[0].end)}, `;
  if (d.durmuhurta.length > 1) buf += `${T2(d.durmuhurta[1].start)} - ${T2(d.durmuhurta[1].end)}, `;
  out += buf + '\n    ';
  out += `Sunrise at ${T2(d.sunrise)}, Sunset at ${T2(d.sunset)},\n    Moonrise at ${T2(d.moonrise)}, `;
  out += `Moonset at ${T2(d.moonset)}, `;
  // JHora repeats "Moon in X till T" once per tithi end of the day (it loops on the tithi count)
  if (d.moonSign.count === 0) out += `Moon in ${SIGN_SHORT[d.moonSign.items[0].index]} (whole day)`;
  else for (let j = 0; j < d.tithi.count; j++) out += `Moon in ${SIGN_SHORT[d.moonSign.items[0].index]} till ${timeText(d.moonSign.items[0].end, 0, k)}`;
  if (horas) {
    out += '\n' + 'Horas: ';
    d.horas.forEach((h, i) => { if (i % 6 === 0 && i) out += '\n       '; out += `${PLANET[h.lord]}: ${timeText(h.end, 0, k)}, `; });
    out += '\n' + 'Choghadiyas: ';
    d.choghadiyas.forEach((g, i) => { if (i % 4 === 0 && i) out += '\n       '; out += `${CHOGHADIYAS[g.index]}: ${timeText(g.end, 0, k)}, `; });
  }
  return out + '\n';
}

/** FUN_0046a150 for the whole month: the clipboard text of command 33085. */
export function monthlyText(days: PanchangaDay[], horas = false): string {
  return days.map((d) => dayText(d, horas)).join('');
}

/** FUN_0046af00: "Copy monthly panchanga in JD format" (33086), tab separated. */
export function jdFormatText(days: PanchangaDay[], month: number, year: number): string {
  let out = `\nMonthly Panchanga for ${MONTHS[month - 1]}, ${year}:\n`;
  const tithiCode = (i: number) => `${i >= 15 ? 'K' : 'S'}${(i % 15) + 1}`;
  for (const d of days) {
    const k = d.counter;
    const T0 = (t: Moment) => timeText(t, 0, k);
    const T2 = (t: Moment | null) => timeText(t, 2, k);
    out += `\n${d.date.day}\t`;
    out += `${WEEKDAY_SHORT[d.weekday]}\t`;
    out += `${T2(d.sunrise)}\t${T2(d.sunset)}\t${T2(d.moonrise)}\t${T2(d.moonset)}\t`;
    out += `${d.moonSign.items[0].index + 1}\t` + (d.moonSign.count === 0 ? '24hr\t' : `${T0(d.moonSign.items[0].end)}\t`);
    out += `${tithiCode(d.tithi.items[0].index)}\t` + (d.tithi.count === 0 ? '24hr\t' : `${T0(d.tithi.items[0].end)}\t`);
    out += `${d.nakshatra.items[0].index + 1}\t` + (d.nakshatra.count === 0 ? '24hr\t' : `${T0(d.nakshatra.items[0].end)}\t`);
    out += `${d.yoga.items[0].index + 1}\t` + (d.yoga.count === 0 ? '24hr\t' : `${T0(d.yoga.items[0].end)}\t`);
    out += `${d.karana.items[0].index + 1}\t${T0(d.karana.items[0].end)}\t`;
    out += d.karana.count < 2 ? '\t\t' : `${d.karana.items[1].index + 1}\t${T0(d.karana.items[1].end)}\t`;
    if (d.tithi.count > 1 || d.nakshatra.count > 1 || d.yoga.count > 1 || d.karana.count > 2) {
      out += `\n${d.date.day}\t` + '\t\t\t\t\t\t\t';
      out += d.tithi.count < 2 ? '\t\t' : `${tithiCode(d.tithi.items[1].index)}\t${T0(d.tithi.items[1].end)}\t`;
      out += d.nakshatra.count < 2 ? '\t\t' : `${d.nakshatra.items[1].index + 1}\t${T0(d.nakshatra.items[1].end)}\t`;
      out += d.yoga.count < 2 ? '\t\t' : `${d.yoga.items[1].index + 1}\t${T0(d.yoga.items[1].end)}\t`;
      out += d.karana.count < 3 ? '\t\t' : `${d.karana.items[2].index + 1}\t${T0(d.karana.items[2].end)}\t`;
    }
  }
  return out;
}

export { SIGN_SHORT as PANCHANGA_SIGNS, PLANET as PANCHANGA_PLANETS, WEEKDAY_SHORT };
