// JHora's place atlas (jhworld.adb / jhlite.adb), read the way jhora.exe does
// (search 0x497b50 -> 0x497d40 -> 0x497fb0, record parser 0x498293):
//  - header "Jagannatha Hora" + BE u32 version 1; at 0x60 a BE u32 index whose
//    entry i+1 is the offset of country block i (country numbers = positions
//    in the exe's 308-entry table, 249..307 being the US states);
//  - a country block (first byte | 0xC0, 30-bit length, 0 = to the end) holds
//    its FIPS code and letter buckets (first byte 0x80, 30-bit length); each
//    bucket holds the places starting with one letter;
//  - a place: length byte, name, BE u16 county id, lon d / m|0x80 East / s,
//    lat d / m|0x80 North / s, BE u16 altitude, standard and summer zone in
//    signed quarter-hours.
// Search: case-insensitive prefix match in the bucket of the query's first
// letter, at most 100 results; with no match the last letter is dropped and the
// search repeated ("approximate matches").
import COUNTRIES from './data/atlas-countries.json';

export const ATLAS_COUNTRIES = COUNTRIES as [string, string][];
export const US_FIRST = 249;

export interface Place {
  country: number;
  name: string;
  lat: number;
  lon: number;
  /** standard and summer time zones, hours east of UTC */
  tz: number;
  tzDst: number;
  altitude: number;
}

export interface AtlasResult { places: Place[]; approximate: boolean; truncated: boolean }

/** Which countries to search: one country number, all but the US, the US states, or everything. */
export type AtlasScope = number | 'WORLD' | 'US' | 'ALL';

const MAX_RESULTS = 100;
const latin1 = new TextDecoder('latin1');

export class Atlas {
  private readonly view: DataView;

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const magic = latin1.decode(bytes.subarray(0, 15));
    if (magic !== 'Jagannatha Hora' || this.view.getUint32(15) !== 1) throw new Error('The atlas file is corrupted');
  }

  private countries(scope: AtlasScope): number[] {
    const all = ATLAS_COUNTRIES.map((_, i) => i);
    if (typeof scope === 'number') return [scope];
    if (scope === 'WORLD') return all.filter((i) => i < US_FIRST);
    if (scope === 'US') return all.filter((i) => i >= US_FIRST);
    return all;
  }

  /** Offset and end of country `c`'s block, or null if the file has none. */
  private block(c: number): [number, number] | null {
    const code = ATLAS_COUNTRIES[c][0];
    let off = this.view.getUint32(0x64 + 4 * c);
    while (off < this.bytes.length) {
      const len = this.view.getUint32(off) & 0x3fffffff;
      const end = len ? off + len : this.bytes.length;
      const cl = this.bytes[off + 4];
      if (latin1.decode(this.bytes.subarray(off + 5, off + 5 + cl)) === code) return [off + 5 + cl, end];
      if (!len) return null;
      off = end;
    }
    return null;
  }

  private scan(c: number, query: string, out: Place[]): void {
    const b = this.block(c);
    if (!b) return;
    const q = query.toUpperCase();
    let [off, end] = b;
    while (off < end && out.length < MAX_RESULTS) {
      const len = this.view.getUint32(off) & 0x3fffffff;
      const bucketEnd = len ? off + len : end;
      let p = off + 4;
      const first = String.fromCharCode(this.bytes[p + 1]).toUpperCase();
      if (q && first !== q[0]) { off = bucketEnd; if (!len) break; continue; }
      while (p < bucketEnd && this.bytes[p] < 0x80 && out.length < MAX_RESULTS) {
        const L = this.bytes[p];
        const name = latin1.decode(this.bytes.subarray(p + 1, p + 1 + L));
        if (name.slice(0, q.length).toUpperCase() === q) out.push(this.record(c, name, p + 1 + L));
        p += 1 + L + 12;
      }
      if (!len) break;
      off = bucketEnd;
    }
  }

  private record(country: number, name: string, r: number): Place {
    const by = this.bytes;
    const angle = (d: number, m: number, s: number) => (d + (m & 0x7f) / 60 + s / 3600) * (m & 0x80 ? 1 : -1);
    const s8 = (x: number) => (x > 127 ? x - 256 : x);
    return {
      country, name,
      lon: angle(by[r + 2], by[r + 3], by[r + 4]),
      lat: angle(by[r + 5], by[r + 6], by[r + 7]),
      altitude: this.view.getUint16(r + 8),
      tz: s8(by[r + 10]) / 4,
      tzDst: s8(by[r + 11]) / 4,
    };
  }

  search(query: string, scope: AtlasScope = 'ALL'): AtlasResult {
    const list = this.countries(scope);
    let q = query.trim();
    let approximate = false;
    for (;;) {
      const out: Place[] = [];
      for (const c of list) { if (out.length >= MAX_RESULTS) break; this.scan(c, q, out); }
      if (out.length || !q) return { places: out, approximate, truncated: out.length >= MAX_RESULTS };
      q = q.slice(0, -1);
      approximate = true;
    }
  }
}

// ---------------------------------------------------------------- DST (0x4aaa10)

/** Day of month of a rule date: n > 0 the n-th weekday on/after `day`, n < 0 the |n|-th on/before, 0 the date itself. */
function ruleDay(y: number, month: number, day: number, n: number, wd: number): number {
  const lastDay = new Date(Date.UTC(y, month, 0)).getUTCDate();
  const d0 = Math.min(day, lastDay);
  if (n === 0) return d0;
  const w0 = new Date(Date.UTC(y, month - 1, d0)).getUTCDay();
  if (n > 0) return d0 + ((wd - w0 + 7) % 7) + 7 * (n - 1);
  return d0 - ((w0 - wd + 7) % 7) - 7 * (-n - 1);
}

type Rule = [month: number, day: number, hour: number, n: number, wd: number];
const SUN = 0, THU = 4, FRI = 5, SAT = 6;
const LAST_SUN_MAR: Rule = [3, 31, 2, -1, SUN], LAST_SUN_OCT: Rule = [10, 31, 1, -1, SUN];
const EX_USSR = new Set(['AM', 'AJ', 'BO', 'GG', 'KZ', 'KG', 'LG', 'RS', 'TI', 'TX', 'UP', 'UZ']);

function rulesFor(code: string, y: number, ms: number): [Rule, Rule] | 'always' | null {
  if (code.startsWith('US') || code === 'CA') {
    if (y > 2006) return [[3, 1, 2, 2, SUN], [11, 1, 1, 1, SUN]];
    if (y >= 1987) return [[4, 1, 2, 1, SUN], LAST_SUN_OCT];
    if (y >= 1976) return [[4, 30, 2, -1, SUN], LAST_SUN_OCT];
    if (y === 1975) return [[2, 29, 2, -1, SUN], LAST_SUN_OCT];
    if (y === 1974) return [[1, 1, 2, 1, SUN], LAST_SUN_OCT];
    if (y >= 1967) return [[4, 30, 2, -1, SUN], LAST_SUN_OCT];
    if (ms >= Date.UTC(1942, 1, 2) && ms < Date.UTC(1945, 9, 1)) return 'always';
    if (y === 1918 || y === 1919) return [[3, 31, 0, -1, SUN], [10, 31, 0, -1, SUN]];
    if (y >= 1920 && y <= 1965 && (code === 'USMA' || code === 'USRI')) return [[4, 30, 2, -1, SUN], [9, 30, 1, -1, SUN]];
    return null;
  }
  if (EX_USSR.has(code)) return [LAST_SUN_MAR, LAST_SUN_OCT];
  switch (code) {
    case 'AS': return [[10, 31, 0, -1, SUN], [3, 31, 0, -1, SUN]];
    case 'NZ': return [[10, 1, 0, 1, SUN], [3, 1, 0, 3, SUN]];
    case 'BR': return [[11, 1, 0, 1, SUN], [2, 1, 0, 3, SUN]];
    case 'CI': return [[10, 1, 0, 2, SAT], [3, 1, 0, 2, SAT]];
    case 'PA': case 'WA': return [[9, 1, 0, 1, SUN], [4, 1, 0, 1, SUN]];
    case 'MX': case 'BF': case 'TK': return [[4, 1, 2, 1, SUN], LAST_SUN_OCT];
    case 'EG': return [[4, 30, 0, -1, FRI], [9, 30, 0, -1, THU]];
    case 'IS': return [[4, 1, 0, 1, FRI], [9, 1, 0, 1, FRI]];
    case 'IZ': case 'SY': return [[4, 1, 0, 0, SUN], [10, 1, 0, 0, SUN]];
    case 'CU': return [[4, 1, 0, 0, SUN], [10, 31, 0, -1, SUN]];
    case 'LE': return [[3, 31, 0, -1, SUN], [10, 31, 0, -1, SUN]];
    default: return null;
  }
}

/**
 * Whether JHora's atlas picks the summer zone for a birth at the given
 * standard local time. Places whose two zones are equal never use DST; the
 * default (EU) rule is evaluated in UTC (last Sunday of March/October, 01:00).
 */
export function dstInEffect(place: Place, y: number, m: number, d: number, hour: number): boolean {
  if (place.tzDst === place.tz) return false;
  const code = ATLAS_COUNTRIES[place.country][0];
  const localMs = Date.UTC(y, m - 1, d) + hour * 3600e3;
  const rules = rulesFor(code, y, localMs);
  if (rules === 'always') return true;
  let start: number, end: number, t: number;
  if (rules) {
    const at = ([mo, day, h, n, wd]: Rule) => Date.UTC(y, mo - 1, ruleDay(y, mo, day, n, wd)) + h * 3600e3;
    start = at(rules[0]); end = at(rules[1]); t = localMs;
  } else {
    if (code.startsWith('US') || code === 'CA') return false;
    start = Date.UTC(y, 2, ruleDay(y, 3, 31, -1, SUN), 1);
    end = Date.UTC(y, 9, ruleDay(y, 10, 31, -1, SUN), 1);
    t = localMs - place.tz * 3600e3;
  }
  return start <= end ? t >= start && t < end : t >= start || t < end;
}

/** JHora's special case for Russia: a summer zone one hour ahead becomes two (0x4d0d20). */
export function summerZone(place: Place): number {
  return ATLAS_COUNTRIES[place.country][1] === 'Russia' && place.tzDst === place.tz + 1 ? place.tz + 2 : place.tzDst;
}
