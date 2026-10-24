// Basics > Key Info: the panchanga summary pane, as jhora.exe computes and copies it.
//
// * Text builder (clipboard copy): FUN_004b1400. The on-screen pane is drawn by
//   FUN_004ae890 from the same document fields.
// * Tithi / nakshatra / yoga / karana and the lunar year-month: FUN_004a4270.
// * Weekday, hora, kaala and the "5 min sign": FUN_004a1c50, on the three day
//   frames built by FUN_004a1350 (sunrise frame, 6:00 LMT frame, 6:00 clock frame).
// * Number formats: HMS splitter FUN_004c1b00 + time formatter FUN_004c1f00,
//   DMS splitter FUN_004c1830 (ayanamsa).
//
// Only the default options are ported (LunarYrDef=2 amanta months from the new
// moon, KaalaInDayNightSeparate=1, WeekdayDefinition=0, WeekdayDefinitionKaala=1).
import type { Sweph } from '../sweph';
import type { Chart } from './chart';
import { siderealLongitude, norm360 } from './positions';
import { calcSettingsFromIni, type Settings } from './settings';

// ---- JHora's name tables (runtime-initialised CStrings, filled at 0x4f0e00-0x4f8a00) ----

export const SAMVATSARAS = ['Prabhava', 'Vibhava', 'Sukla', 'Pramoda', 'Prajapati', 'Angirasa', 'Sreemukha', 'Bhava',
  'Yuva', 'Dhaata', 'Isvara', 'Bahu-dhanya', 'Pramathi', 'Vikrama', 'Vrisha', 'Chitrabhanu', 'Subhanu', 'Tarana',
  'Parthiva', 'Vyaya', 'Sarva-jit', 'Sarva-dhari', 'Virodhi', 'Vikriti', 'Khara', 'Nandana', 'Vijaya', 'Jaya',
  'Manmatha', 'Durmukha', 'Hemalamba', 'Vilamba', 'Vikari', 'Sharvari', 'Plava', 'Shubha-krit', 'Shobhana', 'Krodhi',
  'Viswa-vasu', 'Parabhava', 'Plavanga', 'Keelaka', 'Saumya', 'Sadharana', 'Virodha-krit', 'Paridhavi', 'Pramadi',
  'Ananda', 'Rakshasa', 'Nala', 'Pingala', 'Kaala-yukta', 'Siddarthi', 'Raudra', 'Durmati', 'Dundubhi',
  'Rudhirodgaari', 'Raktaaksha', 'Krodhana', 'Kshaya'];

/** Lunar month names indexed by the Sun's sidereal sign at the month's new moon (Aries = Vaisakha). */
export const LUNAR_MONTHS = ['Vaisakha', 'Jyeshtha', 'Ashadha', 'Sravana', 'Bhadrapada', 'Aswayuja', 'Karthika',
  'Margasira', 'Pushya', 'Magha', 'Phalguna', 'Chaitra'];

export const TITHI_NAMES = [
  ...['Pratipat', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Sapthami', 'Ashtami', 'Navami',
    'Dasami', 'Ekadasi', 'Dwadasi', 'Trayodasi', 'Chaturdasi'].map((n) => `Sukla ${n}`), 'Pournimasya',
  ...['Pratipat', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Sapthami', 'Ashtami', 'Navami',
    'Dasami', 'Ekadasi', 'Dwadasi', 'Trayodasi', 'Chaturdasi'].map((n) => `Krishna ${n}`), 'Amavasya'];

export const KI_NAKSHATRAS = ['Aswini', 'Bharani', 'Krittika', 'Rohini', 'Mrigasira', 'Aardra', 'Punarvasu', 'Pushyami',
  'Aasresha', 'Magha', 'Poorva Phalguni', 'Uttara Phalguni', 'Hastha', 'Chitra', 'Swaati', 'Visakha', 'Anuraadha',
  'Jyeshtha', 'Moola', 'Poorvashadha', 'Uttarashadha', 'Sravanam', 'Dhanishtha', 'Satabhishak', 'Poorvabhadra',
  'Uttarabhadra', 'Revati'];

export const YOGAS = ['Vishkambha', 'Priti', 'Ayushman', 'Soubhagya', 'Sobhana', 'Atiganda', 'Sukarman', 'Dhriti',
  'Soola', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha',
  'Siva', 'Siddha', 'Sadhya', 'Subha', 'Sukla', 'Brahma', 'Indra', 'Vaidhriti'];

export const KARANAS = ['Bava', 'Balava', 'Kaulava', 'Taitula', 'Garija', 'Vanija', 'Vishti', 'Sakuna', 'Chatushpada',
  'Naga', 'Kimstughna'];

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December'];

/** JHora's planet index (1 = Sun ... 7 = Saturn, 8 = Rahu, 9 = Ketu) -> names. */
const PLANET = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const PLANET_SHORT = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
const SIGN_SHORT = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];

// Lord tables (planet indices as above).
const TITHI_LORD = [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 3, 4, 5, 6, 8]; // 0x591cf4
const WEEKDAY_LORD = [1, 2, 3, 4, 5, 6, 7];                                                                       // 0x5860c4
const NAK_LORD = [9, 6, 1, 2, 3, 8, 5, 7, 4];                                                                    // 0x586104
const YOGA_LORD = [7, 4, 9, 6, 1, 2, 3, 8, 5];                                                                   // 0x5860e0
const FIXED_KARANA_LORD = [3, 6, 4, 2, 1, 4, 6, 3, 5, 7, 7, 5];                                                  // 0x591de4
/** Karana of each 6-degree half tithi, 1-based into KARANAS (FUN_004a4270's stack table). */
const KARANA_OF_HALF = [11, ...Array.from({ length: 56 }, (_, i) => (i % 7) + 1), 8, 9, 10];

const trunc = Math.trunc;
const pmod = (a: number, n: number) => ((a % n) + n) % n;
const pad2 = (n: number) => String(n).padStart(2, '0');

// ---- number formats ----

/** FUN_004c1b00 + FUN_004c1f00: "h:mm:ss" of a (non-negative) number of hours. */
export function formatHms(hours: number): string {
  const x = Math.abs(hours);
  let h = trunc(x);
  let m = trunc((x - h) * 60);
  let sec = trunc((x - (m / 60 + h)) * 3.6e10 + 0.5) * 1e-7;
  if (60 - sec < 1e-4) { sec = 0; m++; if (m === 60) { h++; m = 0; } }
  let s = trunc(sec + 0.5);
  if (s === 60) { s = 0; m++; if (m === 60) { m = 0; h++; } }
  return `${h}:${pad2(m)}:${pad2(s)}`;
}

/** FUN_004c1830 split of an angle: whole degrees, minutes and (unrounded) seconds. */
export function splitDms(deg: number): { d: number; m: number; s: number } {
  const x = Math.abs(deg);
  let d = trunc(x);
  let m = trunc((x - d) * 60);
  let s = (x - (m / 60 + d)) * 3600;
  if (60 - s < 0.01) { s = 0; m++; if (m === 60) { d++; m = 0; } }
  return { d, m, s };
}

/** Ayanamsa as "23-06-37.20". */
export function formatAyanamsa(deg: number): string {
  const { d, m, s } = splitDms(deg);
  return `${d}-${pad2(m)}-${s.toFixed(2).padStart(5, '0')}`;
}

// ---- panchanga elements ----

export interface Element { index: number; name: string; lord: string; left: number }

export function tithi(sunLon: number, moonLon: number): Element {
  const e = norm360(moonLon - sunLon);
  const i = trunc(e * (1 / 12));
  return { index: i, name: TITHI_NAMES[i], lord: PLANET_SHORT[TITHI_LORD[i]], left: ((12 - e) + i * 12) * (1 / 12) };
}

export function nakshatra(moonLon: number): Element {
  const i = Math.floor(moonLon * 27 / 360) % 27;
  return { index: i, name: KI_NAKSHATRAS[i], lord: PLANET_SHORT[NAK_LORD[i % 9]], left: 1 - (moonLon * 0.07500000000000001 - i) };
}

export function yoga(sunLon: number, moonLon: number): Element {
  const s = norm360(sunLon + moonLon) * 0.07500000000000001;
  const i = trunc(s);
  return { index: i, name: YOGAS[i], lord: PLANET_SHORT[YOGA_LORD[i % 9]], left: 1 - (s - i) };
}

/** Karana; the fixed karanas' lords depend on the lagna sign (doc+0x17d7). */
export function karana(sunLon: number, moonLon: number, lagnaSign: number): Element {
  const e = norm360(moonLon - sunLon);
  const i = KARANA_OF_HALF[trunc(e / 6)] - 1;
  let left = tithi(sunLon, moonLon).left * 2;
  if (left > 1) left -= 1;
  const lord = i < 7 ? i + 1 : FIXED_KARANA_LORD[(lagnaSign + i * 3 + 0x7b) % 12];
  return { index: i, name: KARANAS[i], lord: PLANET_SHORT[lord], left };
}

// ---- lunar year and month ----

function elongation(swe: Sweph, jd: number, s: Settings): { e: number; speed: number; sun: number; moon: number } {
  const sun = siderealLongitude(swe, jd, 'Sun', s);
  const moon = siderealLongitude(swe, jd, 'Moon', s);
  return { e: norm360(moon.lon - sun.lon), speed: moon.speed - sun.speed, sun: sun.lon, moon: moon.lon };
}

/** The new moon before (dir -1) or after (dir +1) jd: Moon - Sun = 0, by Newton iteration. */
export function newMoon(swe: Sweph, jd: number, dir: 1 | -1, s: Settings): { jd: number; sun: number; moon: number } {
  let { e, speed } = elongation(swe, jd, s);
  let t = dir < 0 ? jd - e / speed : jd + (360 - e) / speed;
  for (let k = 0; k < 30; k++) {
    const x = elongation(swe, t, s);
    const d = x.e > 180 ? x.e - 360 : x.e;
    const dt = -d / x.speed;
    t += dt;
    if (Math.abs(dt) < 1e-9) return { jd: t, sun: x.sun, moon: x.moon };
    speed = x.speed; e = x.e;
  }
  const x = elongation(swe, t, s);
  return { jd: t, sun: x.sun, moon: x.moon };
}

export interface LunarYearMonth {
  samvatsara: number;
  /** Sun's sign at the month's new moon (index into LUNAR_MONTHS) */
  month: number;
  /** 0 none, 1 Nija (the previous month had the same name), 2 Adhika */
  adhika: 0 | 1 | 2;
  text: string;
}

/** FUN_004a4270 (LunarYrDef=2): amanta month of the previous new moon, adhika when no sankranti follows. */
export function lunarYearMonth(swe: Sweph, chart: Chart, s: Settings = calcSettingsFromIni(chart.ini)): LunarYearMonth {
  const nm = newMoon(swe, chart.positions.jdUt, -1, s);
  const month = Math.floor(nm.sun / 30) % 12;
  const moonSign = Math.floor(nm.moon / 30) % 12;
  let adhika: 0 | 1 | 2 = 0;
  const next = newMoon(swe, nm.jd + 0.0035, 1, s);
  if (Math.floor(next.moon / 30) % 12 === moonSign) adhika = 2;
  else {
    const prev = newMoon(swe, nm.jd - 0.0035, -1, s);
    if (Math.floor(prev.moon / 30) % 12 === moonSign) adhika = 1;
  }
  const b = chart.birth;
  let year = b.year;
  if (b.month < 6 && month >= 6 && month <= 10) year--;
  const samvatsara = (year + 0x37fd) % 60;
  const text = `${SAMVATSARAS[samvatsara]} - ${['', 'Nija ', 'Adhika '][adhika]}${LUNAR_MONTHS[month]}`;
  return { samvatsara, month, adhika, text };
}

// ---- day frames, weekday, hora, kaala ----

/** One of FUN_004a1350's day frames; times in ghatis (60 per day). */
export interface Frame {
  /** ghatis since the frame's day start */
  g: number;
  /** ghatis since its night start */
  gn: number;
  dayLen: number;
  nightLen: number;
  total: number;
  isDay: boolean;
}

function frame(jd: number, start: number, mid: number, end: number): Frame {
  return {
    g: (jd - start) * 60, gn: (jd - mid) * 60, dayLen: (mid - start) * 60, nightLen: (end - mid) * 60,
    total: (end - start) * 60, isDay: jd < mid,
  };
}

/** 12-hour frame starting at local clock hour `t` on the birth's (or the previous) day. */
function fixedFrame(swe: Sweph, chart: Chart, t: number): Frame {
  const b = chart.birth;
  let jd = chart.positions.jdUt;
  if (b.hour < t) jd -= 1;
  const d = swe.revjul(jd + b.tzHours / 24);
  const start = swe.julday(d.year, d.month, d.day, t - b.tzHours);
  return frame(chart.positions.jdUt, start, start + 0.5, start + 1);
}

export interface KeyFrames { A: Frame; B: Frame; C: Frame }

export function keyFrames(swe: Sweph, chart: Chart): KeyFrames {
  const { day, birth: b } = chart;
  return {
    A: frame(chart.positions.jdUt, day.sunrise, day.sunset, day.nextSunrise),
    // sunrise at 6:00 local mean time
    B: fixedFrame(swe, chart, 6 + b.tzHours - b.lon / 15),
    // sunrise at 6:00 clock time
    C: fixedFrame(swe, chart, 6),
  };
}

// Kaala sequence (FUN_004a1c50): start offsets per weekday for day and night parts.
const KAALA_DAY = [0, 6, 1, 3, 2, 4, 5, 7];
const KAALA_NIGHT = [4, 2, 5, 7, 6, 0, 1, 3];
const KAALA_LORD = [1, 3, 5, 4, 6, 7, 2, 8];
// First "5 min sign" of a hora by its lord, at night and by day.
const SIGN5_NIGHT = [0, 3, 3, 0, 2, 8, 1, 9];
const SIGN5_DAY = [0, 4, 4, 7, 5, 11, 6, 10];

export interface FrameLords { weekday: number; hora: number; sign5: number; kaala: number }

/** Weekday (0 = Sunday), hora lord, 5 min sign and kaala lord of one frame. `part` overrides the kaala part. */
function frameLords(swe: Sweph, chart: Chart, f: Frame, part: number): FrameLords {
  const b = chart.birth;
  let dayNum = trunc(swe.julday(b.year, b.month, b.day, b.hour) - 0.5) - 0x7f5;
  if (b.hour < 12 && !f.isDay) dayNum--;
  let weekday = (pmod(dayNum, 7) + 2) % 7;
  const x = f.g * 24 / f.total;
  let h = trunc(x);
  const five = trunc((x - h) * 12);
  if (h >= 24) { h -= 24; weekday = (weekday + 1) % 7; }
  const hora = (h * 5 + weekday) % 7 + 1;
  const sign5 = ((f.isDay ? SIGN5_DAY : SIGN5_NIGHT)[hora] + five) % 12;
  const row = part < 8 ? KAALA_DAY : KAALA_NIGHT;
  const kaala = KAALA_LORD[pmod(row[weekday] + part, 8)];
  return { weekday, hora, sign5, kaala };
}

export interface HoraInfo {
  weekday: number;
  hora: FrameLords;
  mahakalaHora: FrameLords;
  kaala: number;
  mahakalaKaala: number;
}

/** FUN_004a1c50 with the default options. */
export function horaInfo(swe: Sweph, chart: Chart, frames = keyFrames(swe, chart)): HoraInfo {
  const { A, B, C } = frames;
  // KaalaInDayNightSeparate=1: eighths of the day or of the night. JHora reuses the
  // sunrise frame's day part for the 6:00 frame when the birth is by day.
  const dayPart = (f: Frame) => trunc(f.g * 8 / f.dayLen);
  const nightPart = (f: Frame) => 8 - trunc(f.gn * -8 / f.nightLen);
  const pA = A.isDay ? dayPart(A) : nightPart(A);
  const pB = A.isDay ? dayPart(B) : nightPart(B);
  const pC = A.isDay ? pA : nightPart(C);
  const a = frameLords(swe, chart, A, pA);
  const bl = frameLords(swe, chart, B, pB);
  const c = frameLords(swe, chart, C, pC);
  // WeekdayDefinition=0 -> sunrise frame; WeekdayDefinitionKaala=1 -> Mahakala hora from the LMT frame.
  return { weekday: a.weekday, hora: a, mahakalaHora: bl, kaala: a.kaala, mahakalaKaala: c.kaala };
}

// ---- the text ----

function localTime(swe: Sweph, jdUt: number, tz: number) {
  return swe.revjul(jdUt + tz / 24);
}

function eventText(swe: Sweph, chart: Chart, jdUt: number): string {
  const t = localTime(swe, jdUt, chart.birth.tzHours);
  const time = formatHms(t.hour);
  return t.day === chart.birth.day ? time : `${time} (${MONTHS[t.month - 1]} ${t.day})`;
}

/** JHora stores longitudes west-positive: 'E' only for lon > 0, but 'N' for lat >= 0. */
function placeDms(deg: number, positive: boolean, pos: string, neg: string): string {
  const { d, m, s } = splitDms(deg);
  return `${d} ${positive ? pos : neg} ${pad2(m)}' ${pad2(trunc(s + 0.5))}"`;
}

function timeZoneText(tz: number): string {
  // HMS split of JHora's stored zone (west positive); "West" when that is >= 0
  const x = Math.abs(tz);
  let h = trunc(x);
  let m = trunc((x - h) * 60);
  let sec = trunc((x - (m / 60 + h)) * 3.6e10 + 0.5) * 1e-7;
  if (60 - sec < 1e-4) { sec = 0; m++; if (m === 60) { h++; m = 0; } }
  return `${h}:${pad2(m)}:${pad2(trunc(sec + 0.5))} (${-tz >= 0 ? 'West' : 'East'} of GMT)`;
}

const pct = (x: number) => `(${(x * 100).toFixed(2)}% left)`;

/** The Key Info pane as JHora copies it (without the leading chart-file line). */
export function keyInfoText(swe: Sweph, chart: Chart): string[] {
  const b = chart.birth;
  const p = chart.positions;
  const s = calcSettingsFromIni(chart.ini);
  const sun = p.grahas.Sun.lon, moon = p.grahas.Moon.lon;
  const lagnaSign = Math.floor(p.ascendant / 30) % 12;
  const t = tithi(sun, moon), n = nakshatra(moon), y = yoga(sun, moon), k = karana(sun, moon, lagnaSign);
  const ly = lunarYearMonth(swe, chart, s);
  const frames = keyFrames(swe, chart);
  const h = horaInfo(swe, chart, frames);
  const armc = swe.houses(p.jdUt, 0, b.lat, b.lon, 'P').ascmc[2];
  const lines = [
    'Natal Chart',
    '',
    `Date:          ${MONTHS[b.month - 1]} ${b.day}, ${b.year}`,
    `Time:          ${formatHms(b.hour)}`,
    `Time Zone:     ${timeZoneText(b.tzHours)}`,
    `Place:         ${placeDms(b.lon, b.lon > 0, 'E', 'W')}, ${placeDms(b.lat, b.lat >= 0, 'N', 'S')}`,
  ];
  if (b.city && b.city !== 'Unknown') lines.push(`               ${b.city}, ${b.country}`);
  lines.push(
    `Altitude:      ${(b.altitudeGiven === false ? chart.ini.DefaultAltitude : b.altitudeM).toFixed(2)} meters`,
    '',
    `Lunar Yr-Mo:   ${ly.text}`,
    `Tithi:         ${t.name} (${t.lord}) ${pct(t.left)}`,
    `Vedic Weekday: ${WEEKDAYS[h.weekday]} (${PLANET_SHORT[WEEKDAY_LORD[h.weekday]]})`,
    `Nakshatra:     ${n.name} (${n.lord}) ${pct(n.left)}`,
    `Yoga:          ${y.name} (${y.lord}) ${pct(y.left)}`,
    `Karana:        ${k.name} (${k.lord}) ${pct(k.left)}`,
    `Hora Lord:     ${PLANET[h.hora.hora]} (5 min sign: ${SIGN_SHORT[h.hora.sign5]})`,
    `Mahakala Hora: ${PLANET[h.mahakalaHora.hora]} (5 min sign: ${SIGN_SHORT[h.mahakalaHora.sign5]})`,
    `Kaala Lord:    ${PLANET[h.kaala]} (Mahakala: ${PLANET[h.mahakalaKaala]})`,
    '',
    `Sunrise:       ${eventText(swe, chart, chart.day.sunrise)}`,
    `Sunset:        ${eventText(swe, chart, chart.day.sunset)}`,
    `Janma Ghatis:  ${frames.A.g.toFixed(4)}`,
    '',
    `Ayanamsa:      ${formatAyanamsa(p.ayanamsaMean)}`,
    `Sidereal Time: ${formatHms(armc * 0.06666666666666667)}`,
  );
  return lines;
}

