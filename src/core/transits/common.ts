// Shared pieces of JHora 8.0's Transits tab (top tab node built at 0x4dde80..0x4de360):
//
//   Transits (2x1 splitter): CChartView over CTabWnd with four sub-tabs
//     Basic Transit Results  CTransitFormView (dialog 2013) | CTransitView (list) | CCoreInfoView/CBasicInfoView
//     Special Search         CTransitConjFormView (dialog 2024), CBasicInfoView, CCoreInfoView, CTransitView
//     Transit Calendar       CTranCalenFormView (dialog 2048) -> opens CTransitCalenView (custom drawn)
//     Longitude Correlation  CTranResearchFormView (dialog 2069) | CTranResearchView (list)
//
// The "transit chart" (doc+0x279e0, made current via doc+0x76d00) is a copy of the
// natal chart with only the clock date/time replaced (FUN_0041d660 for "Show Transit
// Calculations", FUN_00488c80 for each calendar row): natal place AND natal time
// zone. The time-zone fields on those forms are written to the globals at 0x896720
// but never reach the chart, so the entered time is natal-zone clock time.
import type { Sweph } from '../../sweph';
import type { BirthData } from '../jhd';
import { computeChart, type Chart } from '../chart';
import { GRAHAS, norm360, type Graha, type Positions } from '../positions';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../vargas';
import { NAK28, nakshatra28Of, nakshatraOf, NAKSHATRAS, signOf } from '../zodiac';
import { bhavaArudha, lordOf, DEFAULT_ARUDHA, type ArudhaOptions } from '../arudhas';
import type { VargaCtx } from '../signStrength';
import { SIGN_LORD } from '../lords';

/** JHora's varga index (divisor table 0x591ed4, order of every varga combo on these forms). */
export const VARGA_ORDER: VargaName[] = ['D1', 'D9', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60', 'D81', 'D108', 'D144'];
/** Varga names *0x8a2874 ("D-1", "D-9", ...). */
export const VARGA_LABEL = VARGA_ORDER.map((v) => v.replace('D', 'D-'));
/** Varga names *0x8a2800 used in the calendar title ("Rasi", "Navamsa", "D-2", ...). */
export const VARGA_TITLE = ['Rasi', 'Navamsa', ...VARGA_LABEL.slice(2)];

/** Body index as in the chart record: 0 Lagna, 1 Sun .. 9 Ketu. */
export const BODY_NAMES = ['Lagna', ...GRAHAS] as const;
/** Short names *0x8a4684 (body name table behind *0x8a4820 / *0x8a481c). */
export const BODY_ABBR = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
export const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

/** Nava taras *0x8a1fd4 and their meanings *0x8a1fb0. */
export const TARA_NAMES = ['Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyak', 'Saadhana', 'Naidhana', 'Mitra', 'Parama Mitra'];
export const TARA_MEANINGS = ['Birth', 'Wealth', 'Danger', 'Well-being', 'Obstacles', 'Achievement', 'Death', 'Friend', 'Good friend'];
/** Murthi names *0x8a1f48 (index 0 Swarna .. 3 Loha). */
export const MURTHI_NAMES = ['Swarna - golden', 'Rajata - silver', 'Taamra - copper', 'Loha - iron'];
/** Special nakshatras *0x8a1f84, meanings *0x8a1f58, offsets 0x591cc8 (counted from the natal star, 28-star scheme). */
export const SPECIAL_NAKS: [string, string, number][] = [
  ['Janma', 'Existence', 1], ['Karma', 'Work', 10], ['Samudayika', 'Collective', 18], ['Sanghatika', 'Social', 16],
  ['Jaati', 'Family', 4], ['Naidhana', 'Death', 7], ['Desa', 'Nation', 12], ['Abhisheka', 'Coronation', 28],
  ['Aadhaana', 'Kindling', 19], ['Vainasika', 'Destructive', 22], ['Maanasa', 'Mental', 25],
];

/**
 * Good houses (table 0x57eff0, row = body 1..9, 0-based house from the reference):
 * > 0 counts as good; -1 and 0 are both "not good".
 */
export const GOOD_HOUSE: number[][] = [
  [],
  [0, 0, 1, 0, 0, 1, 0, -1, 0, 1, 1, -1],
  [1, 0, 1, 0, 0, 1, 1, -1, 0, 1, 1, -1],
  [0, 0, 1, 0, 0, 1, 0, -1, 0, 0, 1, -1],
  [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, -1],
  [0, 1, 0, 0, 1, 0, 1, -1, 1, 0, 1, -1],
  [1, 1, 1, 1, 1, -1, 0, 1, 1, 0, 1, 1],
  [-1, -1, 1, -1, 0, 1, 0, -1, 0, 0, 1, -1],
  [0, 0, 1, 0, 0, 1, 0, -1, 0, 0, 1, -1],
  [0, 0, 1, 0, 0, 1, 0, -1, 0, 0, 1, -1],
];
/** Vedha houses (table 0x57f1a0, rows Sun..Saturn): 1-based house from the reference that obstructs a good house; 0 = none. */
export const VEDHA_HOUSE: number[][] = [
  [],
  [0, 0, 9, 0, 0, 12, 0, 0, 0, 4, 5, 0],
  [5, 0, 9, 0, 0, 12, 2, 0, 0, 4, 8, 0],
  [0, 0, 12, 0, 0, 9, 0, 0, 0, 0, 5, 0],
  [0, 5, 0, 3, 0, 9, 0, 1, 0, 7, 12, 0],
  [0, 12, 0, 0, 4, 0, 3, 0, 10, 0, 8, 0],
  [8, 7, 1, 10, 9, 0, 0, 5, 11, 0, 6, 3],
  [0, 0, 12, 0, 0, 9, 0, 0, 0, 0, 5, 0],
  // Rahu and Ketu: the calendar reads past the table into string bytes (0x57f320..);
  // the effective houses were worked out from those bytes (quirk).
  [0, 0, 8, 0, 0, 10, 0, 0, 0, 0, 1, 0],
  [0, 0, 5, 0, 0, 2, 0, 0, 0, 0, 8, 0],
];
/** Murthi from the house of the Moon (at the planet's sign ingress) counted from the natal Moon (FUN_004a5ba0). */
export const MURTHI_BY_HOUSE = [0, 1, 2, 3, 1, 0, 2, 3, 1, 2, 0, 3];
/** Kakshya lords of the eight 3 deg 45' parts of a sign (local table in FUN_0048c3a0): Sa Ju Ma Su Ve Me Mo Lagna. */
export const KAKSHYA_LORD = [7, 5, 3, 1, 6, 4, 2, 0];

/** Longitude of body index b (0 = Lagna). */
export function bodyLon(p: Positions, b: number): number {
  return b === 0 ? p.ascendant : p.grahas[GRAHAS[b - 1]].lon;
}
export const graha = (b: number): Graha => GRAHAS[b - 1];

/** Sign of body b in varga index v (chart+0x17d7 + b*0x1d + v). */
export function bodySign(p: Positions, b: number, v: number): number {
  return signOf(vargaLongitude(bodyLon(p, b), ALL_VARGAS[VARGA_ORDER[v] ?? 'D1']));
}
export const nak27 = (p: Positions, b: number) => nakshatraOf(bodyLon(p, b));
export const nak28 = (p: Positions, b: number) => nakshatra28Of(bodyLon(p, b));
export { NAK28, NAKSHATRAS };

/** Kakshya (0..7) of a D-1 longitude: trunc((lon - sign*30) * 8/30). */
export const kakshyaOf = (lon: number) => Math.min(7, Math.trunc((lon - signOf(lon) * 30) * 8 / 30));

/** Varga context for the arudha helpers. */
export function vargaCtx(p: Positions, v: number): VargaCtx {
  const spec = ALL_VARGAS[VARGA_ORDER[v] ?? 'D1'];
  return {
    sign: (g) => signOf(vargaLongitude(p.grahas[g].lon, spec)),
    degree: (g) => vargaLongitude(p.grahas[g].lon, spec) % 30,
  };
}

export function arudhaOptions(ini: Chart['ini']): ArudhaOptions {
  return {
    bhavaExceptions: ini.ExceptionsInBhavaArudhas !== 0,
    grahaExceptions: ini.ExceptionsInGrahaArudhas !== 0,
    nodesAsLords: ini.NodesInArudhas !== 0,
  };
}

/** Natal reference of the Basic transit view (dialog 2035; DAT_005922d4 = 2 Moon / 0 Lagna / 59 AL). */
export type NatalRef = 'Moon' | 'Lagna' | 'AL';
export const NATAL_REFS: NatalRef[] = ['Moon', 'Lagna', 'AL'];

/** Sign of the natal reference in varga v. */
export function refSign(natal: Chart, ref: NatalRef, v: number): number {
  const p = natal.positions;
  if (ref === 'Moon') return bodySign(p, 2, v);
  if (ref === 'Lagna') return bodySign(p, 0, v);
  return bhavaArudha(bodySign(p, 0, v), vargaCtx(p, v), arudhaOptions(natal.ini) ?? DEFAULT_ARUDHA);
}

/**
 * Bhava arudha longitudes (FUN_004a3800 with DivLongsInBhavaArudhas on): house h
 * point hp = lagna + 30h, x = 2*(lordLon - hp), exception (x in [345,15) or
 * [165,195)) adds 270. JHora only fills these longitudes when that option is on.
 */
export function arudhaLongitudes(natal: Chart): number[] {
  const p = natal.positions;
  const opt = arudhaOptions(natal.ini);
  const ctx = vargaCtx(p, 0);
  return Array.from({ length: 12 }, (_, h) => {
    const hp = norm360(p.ascendant + 30 * h);
    const sign = signOf(hp);
    const lord = opt.nodesAsLords ? lordOf(sign, ctx, opt) : SIGN_LORD[sign];
    let x = norm360(2 * norm360(p.grahas[lord].lon - hp));
    if (opt.bhavaExceptions && (x >= 345 || x < 15 || (x >= 165 && x < 195))) x += 270;
    return norm360(hp + x);
  });
}

/** A transit moment as typed on the forms: clock time in the natal time zone. */
export interface TransitDate { year: number; month: number; day: number; hour: number }

/** The transit chart's birth record: natal place and zone, entered clock date/time (FUN_0041d660). */
export function transitBirth(natal: BirthData, d: TransitDate): BirthData {
  return { ...natal, year: d.year, month: d.month, day: d.day, hour: d.hour, legacy: null, override: null };
}

export function computeTransitChart(swe: Sweph, natal: Chart, d: TransitDate): Promise<Chart> {
  return computeChart(swe, transitBirth(natal.birth, d), natal.ini);
}

/** Calendar date + decimal hour from `days` added to a TransitDate (via JD, as FUN_0049d250 does). */
export function addDays(swe: Sweph, d: TransitDate, days: number): TransitDate {
  const r = swe.revjul(swe.julday(d.year, d.month, d.day, d.hour) + days);
  return { year: r.year, month: r.month, day: r.day, hour: r.hour };
}

// Longitude searches (Special Search, murthi ingresses) are JHora's FUN_0049c130,
// tajaka/search.ts, through derived/mundane.ts recordSearch (found moments are records).

/** "%d:%02d" clock text with seconds >= 30 rounding the minute up (calendar row labels, 0x48847a). */
export function clockText(hour: number): string {
  let secs = Math.round(hour * 3600);
  let h = Math.floor(secs / 3600); secs -= h * 3600;
  let m = Math.floor(secs / 60); const s = secs - m * 60;
  if (s >= 30) m += 1;
  if (m === 60) { m = 0; h += 1; }
  return `${h}:${String(m).padStart(2, '0')}`;
}
