// Miscellany > Angular Return (CAngRetFormView, dialog 2061, message map 0x546d68).
//
// Form (DDX 0x421ed0): combo 1011 planet A (+0xc4) and combo 1012 planet B (+0xc8),
// each Lagna, Sun..Ketu; combo 1006 before/after (+0x8c, index 0 = before);
// date: combo 1007 month (+0x94), edit 102 day (+0x98), edit 103 year (+0x90);
// time: edits 1008/1009/1010 h/m/s (+0x9c/+0xa0/+0xa8 double); time zone:
// edits 1020/1021 hours/minutes (+0xb0/+0xb8) and combo 1079 East/West (+0xc0).
//
// "Find Angular Return Chart" (button 1004, handler 0x422040) copies the date into
// the global date struct 0x896720 and calls FUN_004075e0(A, B, before, &date)
// (message "Please select two DIFFERENT planets..." at 0x5780f8 when A == B):
//   angle0 = FUN_004ae540(lon[A], lon[B]) = norm360(lon[A] - lon[B]) in the natal chart
//   start  = FUN_0049c130: the moment before/after the entered date when the angle
//            between A and B (same order) equals angle0
//   end    = the next such moment searched forward from start + 0.0035 days
//   DAT_005922b0 = end - start (span used for dasa compression, like Tajaka)
//   label  = "Ang Ret %s-%s" (string 0x5747f0) with the body names of A and B;
//   chart kind doc+0x76d04 = 5; the chart keeps the natal place and zone.
//   (struct: +0 A, +4 B, +0x10 angle0, +0x18 two bodies, +0x1b before; tajaka/search.ts
//   jhoraBodySearch); the entered date is first stored as a record in the natal zone.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { norm360, siderealAscendant } from '../positions';
import type { Settings } from '../settings';
import { jhoraBodySearch } from '../tajaka/search';
import { birthAt } from './common';
import { BODY_SHORT, bodyLon, ctxOf, recordJd } from './mundane';
import type { BirthData } from '../jhd';

export const ANGRET_BODIES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
export type AngRetBody = (typeof ANGRET_BODIES)[number];

export interface AngularReturnInput {
  /** combo 1011 / 1012 indices (0 = Lagna, 1 = Sun ... 9 = Ketu) */
  a: number;
  b: number;
  /** combo 1006: true = "before" (index 0) */
  before: boolean;
  /** local date/time of the search start in zone `tzHours` (east positive) */
  year: number; month: number; day: number; hour: number;
  tzHours: number;
}

export interface AngularReturn {
  label: string;
  /** natal angle lon[A] - lon[B], 0..360 */
  angle: number;
  start: number;
  end: number;
  birth: BirthData;
}

/** Sidereal lagna at jd for the natal place (as computePositions does it). */
export function lagnaAt(swe: Sweph, jd: number, geo: { lat: number; lon: number }, s: Settings): number {
  return siderealAscendant(swe, jd, geo, s);
}

/** FUN_004075e0: the angular return chart of bodies A and B. */
export function angularReturn(swe: Sweph, natal: Chart, inp: AngularReturnInput): AngularReturn {
  if (inp.a === inp.b) throw new Error('Please select two DIFFERENT planets and then try to find the angular return chart.');
  const A = ANGRET_BODIES[inp.a], B = ANGRET_BODIES[inp.b];
  if ((A === 'Rahu' && B === 'Ketu') || (A === 'Ketu' && B === 'Rahu')) throw new Error('Rahu and Ketu are always 180 degrees apart: no angular return.');
  const c = ctxOf(swe, natal);
  const lon = (b: number, jd: number) => bodyLon(c, b, jd);
  const angle = norm360(lon(inp.a, natal.positions.jdUt) - lon(inp.b, natal.positions.jdUt));
  const spec = { lon, b1: inp.a, b2: inp.b, offset: angle };
  // the entered moment is stored as a record in the natal zone, then searched from
  const from = recordJd(c, swe.julday(inp.year, inp.month, inp.day, inp.hour - inp.tzHours));
  const start = recordJd(c, jhoraBodySearch({ ...spec, backward: inp.before }, from));
  const end = recordJd(c, jhoraBodySearch({ ...spec, backward: false }, recordJd(c, start + 0.0035)));
  return { label: `Ang Ret ${BODY_SHORT[inp.a]}-${BODY_SHORT[inp.b]}`, angle, start, end, birth: birthAt(swe, natal, start) };
}
