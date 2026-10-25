// House systems of JHora's Basics > Houses menu (menu 145) and the KP (Krishnamurti
// Paddhati) tables of Basics > KP (menu 146, CKPView) that depend on them.
//
// Recovered from jhora.exe:
// * Menu 145 commands 32995..33008 (handlers 0x454d30..0x454f60) store the house
//   type in the global 0x57c87c (ini HouseTypeWanted); 33003/33004 set the byte
//   0x5922bd (ini HouseCuspsInMiddle, 1 = lagna in the middle of the 1st house).
// * Cusps (types 1 and 3..10): the chart calculation at 0x49b631 maps the type to a
//   Swiss Ephemeris house letter (jump table 0x49bad4: 1,2 -> 'E', 0,3 -> 'O',
//   4 'P', 5 'K', 6 'R', 7 'C', 8 'X', 9 'T', 10 'B'), calls swe_houses(jd_ut, lat,
//   lon, hsys) tropically and stores cusp[1..12] minus the mean ayanamsa
//   (doc+0x1680) at doc+0x1620.
// * FUN_004a30c0 turns them into the start / cusp / end of each house
//   (doc+0x21bb8, 12 x 0x98 bytes):
//     type 0  (each rasi a house): start = sign of lagna + i, end = start + 30,
//             cusp = lagna + 30 i;
//     type 2  (9 nakshatra padas each): d = floor(lagna / 3°20') * 3°20' + 1°40';
//             middle: cusp = d + 30 i, start/end = cusp -/+ 15;
//             start:  start = d + 30 i, cusp = start + 15, end = start + 30;
//     others: middle: cusp = c[i], start = midpoint(c[i-1], c[i]), end = midpoint(c[i], c[i+1]);
//             start:  start = c[i], end = c[i+1], cusp = midpoint of the two.
// * KP lords of the house rows (0x4a2f24..0x4a2fe0, stored at doc+0x22cb0): the
//   longitude used is the house's cusp when HouseCuspsInMiddle is set and its
//   start otherwise -- i.e. the Swiss Ephemeris cusp itself for real house systems.
// * The KP view (0x4590f0) lists 13 bodies (As, Su..Ke, Ur, Ne, Pl) and the 12 houses.
//
// * "Choose the reference longitude for finding houses" (33248, FUN_00454ff0, dialog 2060:
//   Lagna, Sun .. Ketu) stores a body index in DAT_008846d0 (a session setting, not in the
//   ini). FUN_004a30c0 then takes that body's longitude (and sign) in place of the lagna
//   for types 0 and 2, and for the other types the cusps of FUN_0049bd80(longitude): the
//   chart recomputed at the moment the lagna was at that longitude, found with FUN_0049c130
//   searching backwards from the chart's moment (lagna steps of 2 h, 1/15 s bracket).
// * Siddhanta=1 (SSS) with any house type but 11: FUN_004a30c0 clears the siddhanta flag
//   around FUN_0049bd80(lagna), i.e. the drik cusps of the moment the drik lagna was at
//   the SSS lagna.
//
// Not ported: the SSS house system (menu 33388, HouseTypeWanted 11, FUN_00454dc0: only
// with Siddhanta=1). Its cusps are filled by FUN_0049aaa0's SSS branch (0x49b2a2..0x49b614):
// c1 = the SSS lagna, c10 = the "MC" of FUN_004bfc00 (the lagna iteration of FUN_004bfd60
// with FUN_004bfa50's flag 1 - right ascension only - on a time derived from the half-day
// length of FUN_004bfec0, with a before/after-midday branch at 0x49b2f6), both moved into
// the user's zodiac by (doc+0x1688 - doc+0x1680); c4 = c10 + 180,
// c2 = c1 + (c4 - c1)/3, c3 = c2 + (c4 - c1)/3, c5 = c4 + 2 (30 - (c4 - c1)/6),
// c6 = c5 + 2 (30 - (c4 - c1)/6), c7..c9, c11, c12 = c1..c3, c5, c6 + 180 (all mod 360).
// The MC's time argument is not pinned down yet, so type 11 still uses Porphyry here.
import type { Sweph } from '../sweph';
import type { Chart } from './chart';
import { kpLords } from './kp';
import { SIGN_LORD } from './lords';
import { ayanamsa, GRAHAS, norm360, siderealAscendant, type Graha } from './positions';
import { calcSettingsFromIni } from './settings';
import { jhoraBodySearch } from './tajaka/search';
import { jhoraDeltaT } from './deltat';
import { ORDINAL, SHORT } from './basics';

/** Menu 145 entries: label, command id, HouseTypeWanted value. */
export const HOUSE_SYSTEMS: [string, number, number][] = [
  ['Each rasi is a house', 32995, 0],
  ['Equal houses (30 deg each)', 33001, 1],
  ['Equal houses based on nakshatra padas (9 padas each)', 33129, 2],
  ['Porphyry houses (Sripathi)', 32998, 3],
  ['Placidus houses (KP/Krishnamoorthy)', 32997, 4],
  ['Koch houses', 32996, 5],
  ['Regiomontanus houses', 32999, 6],
  ['Campanus houses', 33000, 7],
  ['Axial rotation system houses', 33005, 8],
  ['Polich/Page (topocentric system) houses', 33007, 9],
  ['Alcabitus houses', 33008, 10],
];

/** Swiss Ephemeris house letter per HouseTypeWanted (jump table 0x49bad4; 11 = SSS falls back to Porphyry). */
const HSYS = ['O', 'E', 'E', 'O', 'P', 'K', 'R', 'C', 'X', 'T', 'B', 'O'];

export interface HouseOptions {
  /** HouseTypeWanted (0..10) */
  type: number;
  /** HouseCuspsInMiddle */
  middle: boolean;
  /** reference body of 33248 (DAT_008846d0): 0 Lagna, 1..9 Sun..Ketu */
  ref?: number;
}

export function houseOptions(chart: Pick<Chart, 'ini'>, ref = 0): HouseOptions {
  return { type: Number(chart.ini.HouseTypeWanted ?? 1), middle: Number(chart.ini.HouseCuspsInMiddle ?? 1) !== 0, ref };
}

/** Dialog 2060's reference bodies (index = DAT_008846d0). */
export const HOUSE_REFERENCES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

const refLongitude = (chart: Chart, ref: number) => (ref ? chart.positions.grahas[GRAHAS[ref - 1]].lon : chart.positions.ascendant);

/**
 * FUN_0049bd80(target): sidereal cusps 1..12 of the (drik) chart at the moment the lagna
 * stood at `target`, searched backwards from the chart's moment (FUN_0049c130).
 */
export function cuspsWithLagnaAt(chart: Chart, type: number, target: number, swe: Sweph): number[] {
  const s = { ...calcSettingsFromIni(chart.ini), sss: false };
  const geo = { lat: chart.birth.lat, lon: chart.birth.lon, alt: chart.birth.altitudeM };
  const t = jhoraBodySearch({ lon: (_b, jd) => siderealAscendant(swe, jd, geo, s), b1: 0, target, backward: true }, chart.positions.jdUt);
  const hsys = HSYS[type] ?? 'O';
  const ay = ayanamsa(swe, t, t + (jhoraDeltaT(t) ?? swe.deltaT(t)), s, geo.lon).mean;
  if (hsys === 'E') return Array.from({ length: 12 }, (_, i) => norm360(siderealAscendant(swe, t, geo, s) + 30 * i));
  return swe.houses(t, 0, geo.lat, geo.lon, hsys).cusps.slice(1, 13).map((c) => norm360(c - ay));
}

/** Sidereal cusps 1..12 of a house system (doc+0x1620): tropical swe_houses minus the mean ayanamsa. */
export function systemCusps(chart: Chart, type: number, swe?: Sweph): number[] {
  const p = chart.positions;
  const hsys = HSYS[type] ?? 'O';
  // equal houses need no ephemeris: swe's 'E' cusps are the ascendant + 30 i
  if (hsys === 'E') return Array.from({ length: 12 }, (_, i) => norm360(p.ascendant + 30 * i));
  if (!swe) throw new Error('this house system needs the ephemeris');
  const h = swe.houses(p.jdUt, 0, chart.birth.lat, chart.birth.lon, hsys);
  return h.cusps.slice(1, 13).map((c) => norm360(c - p.ayanamsaMean));
}

export interface HouseSpan { start: number; cusp: number; end: number }

/** Start, cusp and end of the 12 houses (FUN_004a30c0). */
export function houseSpans(chart: Chart, opt: HouseOptions, swe?: Sweph): HouseSpan[] {
  const ref = opt.ref ?? 0;
  const lagna = refLongitude(chart, ref);
  const at = (start: number, cusp: number, end: number): HouseSpan => ({ start: norm360(start), cusp: norm360(cusp), end: norm360(end) });
  // FUN_004a30c0 reads the house type and the middle flag from globals; here they come from the chart's ini
  if (opt.type === 0) {
    const sign = Math.floor(lagna / 30);
    return Array.from({ length: 12 }, (_, i) => at((sign + i) * 30, lagna + 30 * i, (sign + i) * 30 + 30));
  }
  if (opt.type === 2) {
    const pada = 10 / 3;
    const d = Math.floor(lagna * 0.3) * pada + pada / 2;
    return Array.from({ length: 12 }, (_, i) => (opt.middle
      ? at(d + 30 * i - 15, d + 30 * i, d + 30 * i + 15)
      : at(d + 30 * i, d + 30 * i + 15, d + 30 * i + 30)));
  }
  const sss = Number(chart.ini.Siddhanta ?? 0) === 1;
  let c: number[];
  if (ref || (sss && opt.type !== 11)) {
    if (!swe) throw new Error('houses from a reference longitude need the ephemeris');
    c = cuspsWithLagnaAt(chart, opt.type, lagna, swe);
  } else c = systemCusps(chart, opt.type, swe);
  return c.map((ci, i) => {
    const next = c[(i + 1) % 12], prev = c[(i + 11) % 12];
    const fwd = norm360(next + 360 - ci);
    if (!opt.middle) return at(ci, ci + fwd / 2, ci + fwd);
    return at(prev + norm360(ci + 360 - prev) / 2, ci, ci + fwd / 2);
  });
}

/** Bodies of the Houses table and the KP tables: lagna, the nine grahas, Uranus, Neptune, Pluto. */
export function kpBodies(chart: Chart): [string, number][] {
  const p = chart.positions;
  return [
    ['Lagna', p.ascendant],
    ...GRAHAS.map((g): [string, number] => [g, p.grahas[g].lon]),
    ...(['Uranus', 'Neptune', 'Pluto'] as const).map((o): [string, number] => [o, p.outer[o].lon]),
  ];
}

export interface HouseRow extends HouseSpan { bodies: string[] }

/** Basics > Houses rows: the spans plus the occupants (in body order, short names). */
export function houseRows(chart: Chart, opt: HouseOptions, swe?: Sweph): HouseRow[] {
  const bodies = kpBodies(chart);
  return houseSpans(chart, opt, swe).map((h) => {
    const span = norm360(h.end - h.start) || 360;
    return { ...h, bodies: bodies.filter(([, lon]) => norm360(lon - h.start) < span).map(([n]) => SHORT[n]) };
  });
}

/** The longitude whose KP lords JHora shows for each house (cusp in "middle" mode, start otherwise). */
export function kpCusps(chart: Chart, opt: HouseOptions, swe?: Sweph): number[] {
  return houseSpans(chart, opt, swe).map((h) => (opt.middle ? h.cusp : h.start));
}

/** All rows of the KP tables: [long name, short label, longitude]; bodies first, then the house cusps. */
export function kpPoints(chart: Chart, opt: HouseOptions, swe?: Sweph): { name: string; label: string; lon: number }[] {
  return [
    ...kpBodies(chart).map(([name, lon]) => ({ name, label: SHORT[name], lon })),
    ...kpCusps(chart, opt, swe).map((lon, i) => ({ name: `${ORDINAL[i]} house`, label: `${ORDINAL[i]} house`, lon })),
  ];
}

/** KP view modes (menu 146): label, command id, sub level (null = the lords table). */
export const KP_MODES: [string, number, number | null][] = [
  ['Nakshatra and sub lords of each planet (upto 5 levels of subs)', 33011, null],
  ["Planets occupying each planet's nakshatra", 33012, 0],
  ["Planets occupying each planet's sub", 33014, 1],
  ["Planets occupying each planet's prati-sub (2nd level)", 33015, 2],
  ["Planets occupying each planet's sookshma-sub (3rd level)", 33016, 3],
  ["Planets occupying each planet's praana-sub (4th level)", 33017, 4],
  ["Planets occupying each planet's deha-sub (5th level)", 33018, 5],
];

/** Column header of the "Planets occupying..." modes (CKPView strings). */
export const KP_LEVEL_HEADERS = [
  "Bodies occupying this planets's nakshatra",
  "Bodies occupying this planets's sub",
  "Bodies occupying this planets's prati-sub (2nd level)",
  "Bodies occupying this planets's sookshma-sub (3rd level)",
  "Bodies occupying this planets's praana-sub (4th level)",
  "Bodies occupying this planets's deha-sub (5th level)",
];

/** For each graha: the bodies and cusps whose lord at `level` (0 = star) is that graha. */
export function kpOccupants(chart: Chart, level: number, opt: HouseOptions, swe?: Sweph): Record<Graha, string[]> {
  const out = Object.fromEntries(GRAHAS.map((g) => [g, [] as string[]])) as Record<Graha, string[]>;
  for (const pt of kpPoints(chart, opt, swe)) out[kpLords(pt.lon, level + 1)[level]].push(pt.name);
  return out;
}
