// User-defined bodies of a chart: Edit > "User defined special point" (33199, dialog
// 2051) and Edit > "Planetary Special Lagnas (research)" (33252, dialog 2062).
//
// jhora.exe facts:
// * The dialogs (handlers FUN_004067d0 and FUN_00406c00) only store ini keys (section
//   CurrentState): SpecialPointOn = !"Remove this special point", SpecialPointBehindAfter
//   (combo 1003: 0 behind, 1 ahead of), SpecialPointDeg/Min/Sec (edits 102/103/1015), the
//   radio group 201..204 -> SpecialPointUsePlanet / UseSaham / UseRasi / UseMidPoint, the
//   combos 1004 (body), 1005 (sahama), 1006 (sign), 1007/1009 (mid-point bodies) ->
//   SpecialPointPlanetIndex / SahamIndex / SignIndex / PlanetIndex1 / PlanetIndex2, the
//   name (edit 100, 50 chars) and symbol (edit 101, 4 chars). The body combos list the 47
//   bodies of the table at 0x8a49bc (English) / 0x8a4824 (Sanskrit), i.e. JHora's
//   internal body indices 0..46 (OnInitDialog FUN_004d7e00); the sahama combo the 36
//   sahamas as "<name> (<meaning>)".
//   Special lagna: SpecialLagnaOn = !"Remove", SpecialLagnaPlanet = combo 1003 + 1 (1 Sun ..
//   9 Ketu), SpecialLagnaSpeedFactor = combo 1004 + 1, SpecialLagnaNodesReverse = check
//   1001, SpecialLagnaName = sprintf("%s%d", short name of the planet, speed) with the
//   English (0x8a4684: Su, Mo..) or Sanskrit (0x8a44ec: Sy, Ch..) table per
//   SanskritPlanetNames.
// * FUN_004a70d0 (from the chart computation) fills the user bodies 103 (special point)
//   and 104 (special lagna) - records chart+0x12440 / +0x12470, names chart+0x123fc /
//   +0x12400, symbols +0x12408 / +0x1240c - each normalised by FUN_004c1980 to [0, 360):
//     special point: off = Deg + Min/60 + Sec/3600, negated when "behind";
//       UsePlanet == 1: lon(body PlanetIndex) + off; else UseSaham == 1: lon(sahama
//       SahamIndex) + off; else UseRasi == 1: SignIndex * 30 + off; else UseMidPoint == 1:
//       n360(lon1 + n360(lon2 - lon1) / 2) + off (FUN_004ae540 / FUN_004ae800); otherwise
//       off + off (sic).
//     special lagna FUN_004a7350(planet, n, reverse): FUN_004a1b50 searches backwards from
//       the chart's record (FUN_0049c0d0 -> FUN_0049c130, two bodies: lagna and the
//       planet) for the moment lagna = lon(planet) + c, i.e. the planet rising; c = 0 for
//       SunriseDefinition 0 and 3, else -(semi-diameter = radius km * 6.684578e-9 /
//       distance AU * 57.29578 deg), minus 0.5667 deg more for definition 2 (radii: Sun
//       695500, Moon 1737.4, Mars 3397, Mercury 2439.7, Jupiter 71492, Venus 6051.8,
//       Saturn 60268; the table has no entries for the nodes). The chart is recomputed at
//       that moment (copy); the special lagna is lon(planet in the copy) +
//       (JD(chart) - JD(copy)) * n * 360, or minus that for Rahu/Ketu when reversing.
// * They are shown in the Longitudes table after the 56 bodies (FUN_0042b0b0: rows for
//   bodies 102..104 whose name is not empty) and in every chart (CChartView, the symbol in
//   the sign of the body's varga longitude, colour ColorChartViewSpecialPoint).
import { SE, type Sweph } from '../sweph';
import type { Chart } from './chart';
import { bodyLongitude, type ChakraChart } from './chakras/common';
import { jhoraBodySearch, n360, recordRoundTrip } from './tajaka/search';
import { sahamas, SAHAMAS } from './sahamas';
import { calcFlags, GRAHAS, siderealAscendant, siderealLongitude } from './positions';
import { calcSettingsFromIni } from './settings';
import { jhoraDeltaT } from './deltat';
import { DEFAULTS, type JhoraIni } from '../settings/generated';

/** A user-defined body: 103 the special point, 104 the special lagna. */
export interface UserPoint {
  index: 103 | 104;
  /** Longitudes table label (SpecialPointName / SpecialLagnaName) */
  name: string;
  /** chart label (SpecialPointSymbol / SpecialLagnaName) */
  symbol: string;
  /** sidereal longitude, [0, 360) */
  lon: number;
}

/** The 47 bodies of the special point's body combos (0x8a49bc, English), by internal index. */
export const SPECIAL_POINT_BODIES = [
  'Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Uranus', 'Neptune', 'Pluto',
  'Bhava Lagna', 'Hora Lagna', 'Ghati Lagna', 'Vighati Lagna', 'Pranapada Lagna', 'Sree Lagna', 'Indu Lagna', 'Bhrigu Bindu',
  'Kunda', 'Dhooma', 'Vyatipata', 'Parivesha', 'Indra Chapa', 'Upaketu', 'Kaala', 'Mrityu', 'Artha Prahara', 'Yama Ghantaka',
  'Maandi', 'Gulika', 'Prana Sphuta', 'Deha Sphuta', 'Mrityu Sphuta', 'Sookshma TriSphuta', 'Tithi Sphuta',
  'Yoga Sphuta (Sun-Moon)', 'Rahu Tithi Sphuta', 'Kshetra Sphuta', 'Beeja Sphuta', 'TriSphuta', 'ChatusSphuta',
  'PanchaSphuta', 'Yoga Sphuta', 'Avayoga Sphuta',
];

/** The same list in Sanskrit (0x8a4824), used when SanskritPlanetNames is set. */
export const SPECIAL_POINT_BODIES_SANSKRIT = [
  'Lagna', 'Surya', 'Chandra', 'Mangala', 'Budha', 'Guru', 'Sukra', 'Sani', ...SPECIAL_POINT_BODIES.slice(8),
];

/** Sahama combo 1005: "<name> (<meaning>)". */
export const SPECIAL_POINT_SAHAMAS = SAHAMAS.map((s) => `${s.name} (${s.meaning})`);

/** Short planet names used in the special lagna's name (0x8a4684 English, 0x8a44ec Sanskrit). */
const SHORT_EN = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
const SHORT_SA = ['Lg', 'Sy', 'Ch', 'Ma', 'Bu', 'Gu', 'Sk', 'Sa', 'Ra', 'Ke'];

/** FUN_00406c00: the name a special lagna gets ("%s%d", e.g. "Ju9"). */
export function specialLagnaName(planet: number, speed: number, sanskrit = false): string {
  return `${(sanskrit ? SHORT_SA : SHORT_EN)[planet] ?? '?'}${speed}`;
}

const num = (ini: Partial<JhoraIni>, k: keyof JhoraIni) => Number(ini[k] ?? DEFAULTS[k]);
const str = (ini: Partial<JhoraIni>, k: keyof JhoraIni) => String(ini[k] ?? DEFAULTS[k]).replace(/\^/g, ' ');

/** The special point's offset (FUN_004a70d0): Deg + Min/60 + Sec/3600, negative when "behind". */
export function specialPointOffset(ini: Partial<JhoraIni>): number {
  const off = num(ini, 'SpecialPointMin') * 0.016666666666666666 + num(ini, 'SpecialPointSec') * 0.0002777777777777778 + num(ini, 'SpecialPointDeg');
  return num(ini, 'SpecialPointBehindAfter') === 0 ? -off : off;
}

/**
 * The special point's longitude (FUN_004a70d0). `body(i)` is the longitude of internal body i
 * (0..46), `sahama(i)` that of sahama i (0..35).
 */
export function specialPointLongitude(ini: Partial<JhoraIni>, body: (i: number) => number, sahama: (i: number) => number): number {
  const off = specialPointOffset(ini);
  if (num(ini, 'SpecialPointUsePlanet') === 1) return n360(body(num(ini, 'SpecialPointPlanetIndex')) + off);
  if (num(ini, 'SpecialPointUseSaham') === 1) return n360(sahama(num(ini, 'SpecialPointSahamIndex')) + off);
  if (num(ini, 'SpecialPointUseRasi') === 1) return n360(num(ini, 'SpecialPointSignIndex') * 30 + off);
  if (num(ini, 'SpecialPointUseMidPoint') === 1) {
    const l1 = body(num(ini, 'SpecialPointPlanetIndex1')), l2 = body(num(ini, 'SpecialPointPlanetIndex2'));
    return n360(n360(n360(l2 - l1) * 0.5 + l1) + off);
  }
  return n360(off + off);
}

/** Radii (km) of FUN_004a1b50's table, by body index 0 (lagna) .. 7 (Saturn). */
const RADIUS_KM = [0, 695500, 1737.4, 3397, 2439.7, 71492, 6051.8, 60268];
const SWE_ID = [-1, SE.SUN, SE.MOON, SE.MARS, SE.MERCURY, SE.JUPITER, SE.VENUS, SE.SATURN];

/**
 * FUN_004a1b50's horizon offset c (the search finds lagna = lon(planet) + c): 0 for
 * SunriseDefinition 0 and 3, -semi-diameter for 1, -(semi-diameter + 0.5667) for 2.
 * `distAu` is the planet's distance at the chart's moment (record +0x14e0).
 */
export function risingOffset(planet: number, sunriseDefinition: number, distAu: number): number {
  if (sunriseDefinition === 0 || sunriseDefinition === 3) return 0;
  const r = RADIUS_KM[planet] ?? 0;       // no table entry for the nodes
  let v = distAu > 0 ? ((r * 6.684578082767149e-9) / distAu) * 57.29577951308232 : 0;
  if (sunriseDefinition !== 1) v += 0.5666666666666667;
  return -v;
}

/** FUN_004a7350: the planetary special lagna of `chart` (planet 1 Sun .. 9 Ketu, speed n). */
export function specialLagnaLongitude(swe: Sweph, chart: Chart, planet: number, speed: number, reverse: boolean): number {
  const settings = calcSettingsFromIni(chart.ini);
  const geo = { lat: chart.birth.lat, lon: chart.birth.lon, alt: chart.birth.altitudeM };
  // FUN_0049aaa0 for a JHora body index (0 lagna, 1 Sun .. 9 Ketu) at a UT moment
  const lonAt = (b: number, t: number) => (b === 0 ? siderealAscendant(swe, t, geo, settings) : siderealLongitude(swe, t, GRAHAS[b - 1], settings).lon);
  const t0 = chart.positions.jdUt;
  let dist = 0;
  const def = num(chart.ini, 'SunriseDefinition');
  if ((def === 1 || def === 2) && SWE_ID[planet] > 0) {
    const jdEt = t0 + (jhoraDeltaT(t0) ?? swe.deltaT(t0));
    dist = swe.calcEt(jdEt, SWE_ID[planet], calcFlags(settings)).dist;
  }
  const offset = risingOffset(planet, def, dist);
  // the found moment is stored as a chart record (FUN_0049d250) and read back (FUN_0049d210)
  const found = recordRoundTrip(swe, chart.birth.tzHours, jhoraBodySearch({ lon: lonAt, b1: 0, b2: planet, offset, backward: true }, t0));
  const lonAtRise = lonAt(planet, found);
  const sweep = (t0 - found) * speed * 360;
  return n360(reverse && (planet === 8 || planet === 9) ? lonAtRise - sweep : sweep + lonAtRise);
}

/** The chart's user bodies (FUN_004a70d0), in JHora's order: special point, then special lagna. */
export function userPoints(swe: Sweph, chart: Chart): UserPoint[] {
  const ini = chart.ini;
  const out: UserPoint[] = [];
  if (num(ini, 'SpecialPointOn') !== 0) {
    const sah = sahamas(chart.positions, chart.day.isDay);
    const lon = specialPointLongitude(ini, (i) => bodyLongitude(chart as ChakraChart, i) ?? 0, (i) => sah[i]?.lon ?? 0);
    out.push({ index: 103, name: str(ini, 'SpecialPointName'), symbol: str(ini, 'SpecialPointSymbol'), lon });
  }
  if (num(ini, 'SpecialLagnaOn') !== 0) {
    const planet = num(ini, 'SpecialLagnaPlanet');
    const lon = specialLagnaLongitude(swe, chart, planet, num(ini, 'SpecialLagnaSpeedFactor'), num(ini, 'SpecialLagnaNodesReverse') !== 0);
    const name = str(ini, 'SpecialLagnaName');
    out.push({ index: 104, name, symbol: name, lon });
  }
  return out;
}
