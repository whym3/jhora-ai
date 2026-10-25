// Transit murthis (FUN_004a5ba0 for Sun..Rahu, FUN_004a5d70 for one body).
//
// For a planet in sign s of the transit chart, JHora searches backwards
// (FUN_0049c0d0 -> FUN_0049c130, tajaka/search.ts: one body against the target,
// c = 0, 10-day steps (Moon 3), 1 s bracket, later end) from the transit record for
// the last moment its D-1 longitude equalled s*30 (direct entry) and, separately,
// s*30 + 29.9998 (0x551798, retrograde entry), keeps the later of the two found
// records (the first when equal), and takes that record's Moon sign (record+0x148).
// The murthi is MURTHI_BY_HOUSE[(thatMoonSign - natalMoonSign) mod 12], with the
// natal Moon in varga DAT_008a4b84 (default D-1). Ketu is timed as Rahu
// (FUN_004a5ba0 copies slot 8 into slot 9; FUN_004a5d70 maps body 9 to 8).
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import { signOf } from '../zodiac';
import { MURTHI_BY_HOUSE } from './common';
import { GRAHAS } from '../positions';
import { bodyLon, ctxOf, recordSearch } from '../derived/mundane';

/** Moment (JD UT, a record) of the last sign ingress of `g` before `jdUt`, as FUN_004a5ba0 finds it. */
export function lastIngress(swe: Sweph, chart: Chart, g: Graha, jdUt = chart.positions.jdUt): number {
  const body: Graha = g === 'Ketu' ? 'Rahu' : g;
  const c = ctxOf(swe, chart);
  const b = GRAHAS.indexOf(body) + 1;
  const sign = signOf(bodyLon(c, b, jdUt));
  const t1 = recordSearch(c, { b1: b, target: sign * 30, backward: true }, jdUt);
  const t2 = recordSearch(c, { b1: b, target: sign * 30 + 29.9998, backward: true }, jdUt);
  return t1 < t2 ? t2 : t1;
}

/** Murthi index (0 Swarna, 1 Rajata, 2 Taamra, 3 Loha) of `g` in the chart, against the natal Moon's sign. */
export function murthiOf(swe: Sweph, chart: Chart, g: Graha, natalMoonSign: number, jdUt = chart.positions.jdUt): number {
  const t = lastIngress(swe, chart, g, jdUt);
  const moonSign = signOf(bodyLon(ctxOf(swe, chart), 2, t));
  return MURTHI_BY_HOUSE[(moonSign - natalMoonSign + 12) % 12];
}

/** Murthis of body indices 1..9 (index 0 unused); Ketu = Rahu. */
export function murthis(swe: Sweph, chart: Chart, natalMoonSign: number): number[] {
  const out = [0];
  for (let b = 1; b <= 8; b++) out.push(murthiOf(swe, chart, GRAHAS[b - 1], natalMoonSign));
  out.push(out[8]);
  return out;
}
