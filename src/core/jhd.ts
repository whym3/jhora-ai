// Reader/writer for Jagannatha Hora .jhd chart files.
//
// Layout recovered from jhora.exe's loader (FUN_004037c0), which reads the whole
// file with one sscanf, so fields only need whitespace between them. Angles and
// times use JHora's "H.MMSS" encoding: integer part, then two decimals of
// minutes, and the remainder x 6000 is seconds (17.506667 = 17:50:40).
// Time zones and longitudes are stored negative for EAST; this module converts
// them to the usual east-positive convention.

export interface BirthData {
  year: number;
  month: number;
  day: number;
  /** local clock time in decimal hours */
  hour: number;
  /** offset of the local clock from UT in hours, east positive (IST = +5.5) */
  tzHours: number;
  /** geographic longitude, east positive */
  lon: number;
  /** geographic latitude, north positive */
  lat: number;
  altitudeM: number;
  /** false when the file has no altitude field (JHora then shows its DefaultAltitude ini value) */
  altitudeGiven?: boolean;
  pressureMbar: number;
  temperatureC: number;
  city: string;
  country: string;
  /** JHora's atlas country/region code (105 = India) */
  placeCode: number | null;
  /** standard and summer time zones (east positive) and the DST flag, when present */
  standardTz: number | null;
  summerTz: number | null;
  dst: boolean;
  /** field 15, meaning not yet known (default 1) */
  field15: number | null;
  /** field 18, meaning not yet known */
  field18: number | null;
  /** older files: saved sidereal longitudes Sun..Rahu and Lagna, plus a flag string */
  legacy: { longitudes: number[]; ascendant: number; flags: string } | null;
  /**
   * Derived charts only (never read from or written to .jhd files): sidereal
   * longitudes that replace the computed ones (Prasna lagna, progressions). The
   * chart is computed for the birth moment first, then these are substituted.
   */
  override?: PositionOverride | null;
  /**
   * Derived charts only (never in .jhd files): the local date and time (same zone)
   * the chart is computed for when it differs from the date it shows.  JHora's
   * Sudarsana and nakshatra dasa progressions show the progression date while
   * FUN_00403120 computes the chart from the natal date, time and zone (record
   * flag +0x275c8), so everything but the Date/Time lines stays natal.
   */
  castAt?: { year: number; month: number; day: number; hour: number } | null;
}

/** Longitudes (sidereal degrees) a derived chart substitutes; see BirthData.override. */
export interface PositionOverride {
  ascendant?: number;
  /** keyed by graha name (Sun..Ketu) */
  grahas?: Partial<Record<'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn' | 'Rahu' | 'Ketu', number>>;
  /**
   * The longitudes replace the computed ones only after the panchanga is worked out
   * (JHora's shifted progressions, record flag +0x275ca: FUN_004a0520 adds the shift
   * at its very end), so Key Info's tithi, nakshatra, yoga and karana use the computed
   * positions; otherwise (Prasna) they use these.
   */
  afterPanchanga?: boolean;
}

/** Decode JHora's H.MMSS / D.MMSS number to decimal units, keeping the sign. */
export function decodeHms(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const v = Math.abs(value);
  const whole = Math.floor(v + 1e-9);
  const frac100 = (v - whole) * 100;
  const minutes = Math.floor(frac100 + 1e-7);
  const seconds = Math.max(0, (frac100 - minutes) * 60);
  return sign * (whole + minutes / 60 + seconds / 3600);
}

/** Encode decimal units as JHora's H.MMSS number (seconds become the fraction x 6000). */
export function encodeHms(value: number): number {
  const sign = value < 0 ? -1 : 1;
  let v = Math.abs(value);
  const whole = Math.floor(v + 1e-12);
  v = (v - whole) * 60;
  const minutes = Math.floor(v + 1e-9);
  const seconds = (v - minutes) * 60;
  return sign * (whole + minutes / 100 + seconds / 6000);
}

const DEFAULT_PRESSURE = 1013.25;
const DEFAULT_TEMPERATURE = 20;

export function parseJhd(text: string): BirthData {
  const t = text.trim().split(/\s+/);
  if (t.length < 7) throw new Error(`.jhd: expected at least 7 fields, got ${t.length}`);
  const num = (i: number) => Number(t[i]);
  const data: BirthData = {
    month: num(0),
    day: num(1),
    year: num(2),
    hour: decodeHms(num(3)),
    tzHours: -decodeHms(num(4)),
    lon: -decodeHms(num(5)),
    lat: decodeHms(num(6)),
    // field 8 is the altitude in metres (JHora's Key Info shows 0.439521 as "0.44 meters")
    altitudeM: t.length > 7 ? num(7) : 0,
    altitudeGiven: t.length > 7,
    pressureMbar: DEFAULT_PRESSURE,
    temperatureC: DEFAULT_TEMPERATURE,
    city: '',
    country: '',
    placeCode: null,
    standardTz: null,
    summerTz: null,
    dst: false,
    field15: null,
    field18: null,
    legacy: null,
  };

  // Older layout: nine longitudes then a 9-character 0/1 flag string.
  if (t.length === 18 && /^[01]{9}$/.test(t[17])) {
    const lons = t.slice(8, 17).map(Number);
    data.legacy = { longitudes: lons.slice(0, 8), ascendant: lons[8], flags: t[17] };
    return data;
  }
  if (t.length >= 11) {
    data.standardTz = -num(8);
    data.summerTz = -num(9);
    data.dst = num(10) !== 0;
  }
  if (t.length >= 14) {
    data.placeCode = num(11);
    data.city = t[12].replace(/\^/g, ' ');
    data.country = t[13].replace(/\^/g, ' ');
  }
  if (t.length >= 15) data.field15 = num(14);
  if (t.length >= 17) {
    data.pressureMbar = num(15);
    data.temperatureC = num(16);
  }
  if (t.length >= 18) data.field18 = num(17);
  return data;
}

/** Write a chart in the current (non-legacy) layout, one field per line like JHora. */
export function writeJhd(b: BirthData): string {
  const f = (x: number) => x.toFixed(6);
  const lines = [
    String(b.month), String(b.day), String(b.year),
    f(encodeHms(b.hour)), f(-encodeHms(b.tzHours)), f(-encodeHms(b.lon)), f(encodeHms(b.lat)),
    f(b.altitudeM),
    f(-(b.standardTz ?? b.tzHours)), f(-(b.summerTz ?? b.tzHours)), b.dst ? '1' : '0',
    String(b.placeCode ?? 0),
    (b.city || 'Unknown').replace(/ /g, '^'), (b.country || 'Unknown').replace(/ /g, '^'),
    String(b.field15 ?? 1),
    f(b.pressureMbar), f(b.temperatureC), String(b.field18 ?? 0),
  ];
  return lines.join('\r\n') + '\r\n';
}

/** The birth data with the date and time the chart is computed for (BirthData.castAt). */
export function castBirth(b: BirthData): BirthData {
  return b.castAt ? { ...b, ...b.castAt, castAt: null } : b;
}

/** Julian day (UT) of the moment the chart is computed for, given a julday function for the calendar. */
export function birthJdUt(b: BirthData, julday: (y: number, m: number, d: number, h: number) => number): number {
  const c = castBirth(b);
  return julday(c.year, c.month, c.day, c.hour - c.tzHours);
}
