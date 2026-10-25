// Special Search: CTransitConjFormView (RTC 0x54fec8, dialog 2024), button 1001
// "Search for Transit" -> 0x48ae30 -> FUN_004203b0.
//
// "Find when <planet 1007> transited exactly <deg 102> <min 103> <sec 104>
//  <behind|ahead of 1008> <natal planet 1009 (radio 201) | natal saham 1010
//  (radio 202) | the beginning of sign 1011 (radio 203)> in <varga 1030>
//  <before|after 1012> the following date and time".
//
//   off = (sec/3600 + min/60) + deg (multiplied by the constants 1/3600, 1/60),
//         negated for "behind"
//   ref = radio 201: the natal body's longitude in the varga chart (the only use
//                    of the varga combo; JHora's list of 47 natal bodies)
//         radio 202: the natal D-1 sahama longitude (36 sahamas, port order)
//         radio 203: sign*30
// FUN_004203b0(date..., body, ref, off, after): the start record is the natal record
// with the entered clock date/time (natal place and zone); the transit planet is
// always D-1 and searched from it with FUN_0049c0d0 -> FUN_0049c130 (tajaka/search.ts:
// one body against the target ref, offset c = off, i.e. norm360(lon - (ref + off));
// step 10 d, Moon 3 d, lagna 1/12 d; 1 s bracket, 1/15 s for the lagna; later bracket
// end), backward for "before". The found record becomes the current chart "Transit
// Search" (doc+0x279e0, kind 5, file name "NULL") shown by the panes and CTransitView,
// with compressed dasas (DAT_008a4b68 = 1): its period of effect DAT_005922b0 is the
// time to the next such crossing, searched forward from the found record.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { birthJdUt } from '../jhd';
import { sahamas } from '../sahamas';
import { ALL_VARGAS, vargaLongitude } from '../vargas';
import { ctxOf, recordSearch } from '../derived/mundane';
import { transitBirth, VARGA_ORDER, type TransitDate } from './common';

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

/** The offset of combos 102..104 / 1008 as FUN_0048ae30 computes it. */
export function searchOffset(s: SpecialSearch): number {
  const off = (s.sec * 0.0002777777777777778 + s.min * 0.016666666666666666) + s.deg;
  return s.ahead ? off : -off;
}

/** The reference longitude of radios 201..203. */
export function searchRef(natal: Chart, s: SpecialSearch): number {
  if (s.ref.kind === 'planet') return natalBodyLon(natal, s.ref.body, s.ref.varga);
  if (s.ref.kind === 'saham') return sahamas(natal.positions, natal.day.isDay)[s.ref.index].lon;
  return s.ref.sign * 30;
}

/** The longitude the transit planet is searched for (ref + off). */
export function searchTarget(natal: Chart, s: SpecialSearch): number {
  return searchRef(natal, s) + searchOffset(s);
}

export interface SpecialSearchResult {
  /** JD (UT) of the found record */
  jd: number;
  /** DAT_005922b0: days to the next crossing searched forward from it */
  periodDays: number;
}

/** FUN_004203b0: the searched transit (a record) and its period of effect. */
export function specialSearch(swe: Sweph, natal: Chart, s: SpecialSearch): SpecialSearchResult {
  const c = ctxOf(swe, natal);
  const spec = { b1: s.planet, target: searchRef(natal, s), offset: searchOffset(s) };
  const t0 = birthJdUt(transitBirth(natal.birth, s.date), (y, m, d, h) => swe.julday(y, m, d, h));
  const jd = recordSearch(c, { ...spec, backward: !s.after }, t0);
  const next = recordSearch(c, { ...spec, backward: false }, jd);
  return { jd, periodDays: next - jd };
}
