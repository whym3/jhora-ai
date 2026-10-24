// Special Search: CTransitConjFormView (RTC 0x54fec8, dialog 2024), button 1001
// "Search for Transit" -> 0x48ae30 -> FUN_004203b0.
//
// "Find when <planet 1007> transited exactly <deg 102> <min 103> <sec 104>
//  <behind|ahead of 1008> <natal planet 1009 (radio 201) | natal saham 1010
//  (radio 202) | the beginning of sign 1011 (radio 203)> in <varga 1030>
//  <before|after 1012> the following date and time".
//
//   off = deg + min/60 + sec/3600, negated for "behind"
//   ref = radio 201: the natal body's longitude in the varga chart (the only use
//                    of the varga combo; JHora's list of 47 natal bodies)
//         radio 202: the natal D-1 sahama longitude (36 sahamas, port order)
//         radio 203: sign*30
// The transit planet is always D-1 and searched from the entered moment (natal
// place and zone) with FUN_0049c130 (step 10 d, Moon 3 d, lagna 2 h; 1 s
// bracket, 1/15 s for the lagna; later bracket end) for norm360(lon - (ref+off))
// crossing 0, backward for "before". The result becomes the current chart
// "Transit Search" (doc+0x279e0, type 5) shown by the panes and CTransitView.
// Side effect not ported: DAT_005922b0 (dasa year length) = time to the next
// such crossing.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { birthJdUt } from '../jhd';
import { computePositions, siderealLongitude } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { sahamas } from '../sahamas';
import { ALL_VARGAS, vargaLongitude } from '../vargas';
import { graha, jhoraCrossing, searchStep, searchTol, transitBirth, VARGA_ORDER, type TransitDate } from './common';

/** Varga combo 1030 (has D-81): index = JHora varga index. */
export const SEARCH_VARGAS = ['Rasi', 'Navamsa', ...VARGA_ORDER.slice(2).map((v) => v.replace('D', 'D-'))];

export type SearchRef =
  | { kind: 'planet'; body: string; varga: number }
  | { kind: 'saham'; index: number }
  | { kind: 'sign'; sign: number };

export interface SpecialSearch {
  /** combo 1007: 0 Lagna, 1 Sun .. 9 Ketu (default 5 Jupiter) */
  planet: number;
  deg: number; min: number; sec: number;
  /** combo 1008: false "behind", true "ahead of" */
  ahead: boolean;
  ref: SearchRef;
  /** combo 1012: false "before", true "after" */
  after: boolean;
  date: TransitDate;
}

/** Combo 1009: the first 47 names of JHora's body table (0x8a49bc): Lagna .. Pluto, special lagnas, upagrahas, sphutas. */
export const NATAL_SEARCH_BODIES = [
  'Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Uranus', 'Neptune', 'Pluto',
  'Bhava Lagna', 'Hora Lagna', 'Ghati Lagna', 'Vighati Lagna', 'Pranapada Lagna', 'Sree Lagna', 'Indu Lagna', 'Bhrigu Bindu',
  'Kunda', 'Dhooma', 'Vyatipata', 'Parivesha', 'Indra Chapa', 'Upaketu', 'Kaala', 'Mrityu', 'Artha Prahara', 'Yama Ghantaka',
  'Maandi', 'Gulika', 'Prana Sphuta', 'Deha Sphuta', 'Mrityu Sphuta', 'Sookshma TriSphuta', 'Tithi Sphuta', 'Yoga Sphuta (Sun-Moon)',
  'Rahu Tithi Sphuta', 'Kshetra Sphuta', 'Beeja Sphuta', 'TriSphuta', 'ChatusSphuta', 'PanchaSphuta', 'Yoga Sphuta', 'Avayoga Sphuta',
];

/** Longitude of a named natal body (JHora's first 47 body names: Lagna .. Avayoga Sphuta) in varga index v. */
export function natalBodyLon(natal: Chart, name: string, v: number): number {
  const spec = ALL_VARGAS[VARGA_ORDER[v] ?? 'D1'];
  const outer = natal.positions.outer[name as keyof Chart['positions']['outer']];
  const b = name === 'Lagna' ? { lon: natal.positions.ascendant } : outer ?? natal.longitudes.find((x) => x.name === name);
  if (!b) throw new Error(`unknown natal body ${name}`);
  return vargaLongitude(b.lon, spec);
}

export function searchTarget(natal: Chart, s: SpecialSearch): number {
  const off = (s.deg + s.min / 60 + s.sec / 3600) * (s.ahead ? 1 : -1);
  let ref: number;
  if (s.ref.kind === 'planet') ref = natalBodyLon(natal, s.ref.body, s.ref.varga);
  else if (s.ref.kind === 'saham') ref = sahamas(natal.positions, natal.day.isDay)[s.ref.index].lon;
  else ref = s.ref.sign * 30;
  return ref + off;
}

/** JD (UT) of the searched transit, or NaN when none was found. */
export function specialSearch(swe: Sweph, natal: Chart, s: SpecialSearch): number {
  const settings = calcSettingsFromIni(natal.ini);
  const geo = { lat: natal.birth.lat, lon: natal.birth.lon, alt: natal.birth.altitudeM };
  const lon = s.planet === 0
    ? (jd: number) => computePositions(swe, jd, geo, settings).ascendant
    : (jd: number) => siderealLongitude(swe, jd, graha(s.planet), settings).lon;
  const t0 = birthJdUt(transitBirth(natal.birth, s.date), (y, m, d, h) => swe.julday(y, m, d, h));
  return jhoraCrossing(lon, searchTarget(natal, s), t0, !s.after, searchStep(s.planet), searchTol(s.planet));
}
