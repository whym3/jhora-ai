// Transit murthis (FUN_004a5ba0 for Sun..Rahu, FUN_004a5d70 for one body).
//
// For a planet in sign s of the transit chart, JHora searches backwards
// (FUN_0049c0d0 -> FUN_0049c130, backward flag) for the last moment its D-1
// longitude equalled s*30 (direct entry) and, separately, s*30 + 29.9998
// (retrograde entry), keeps the later moment, and takes the Moon's sign then.
// The murthi is MURTHI_BY_HOUSE[(thatMoonSign - natalMoonSign) mod 12], with the
// natal Moon in varga DAT_008a4b84 (default D-1). Ketu is timed as Rahu
// (FUN_004a5ba0 copies slot 8 into slot 9; FUN_004a5d70 maps body 9 to 8).
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { siderealLongitude, type Graha } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { signOf } from '../zodiac';
import { jhoraCrossing, MURTHI_BY_HOUSE, searchStep } from './common';
import { GRAHAS } from '../positions';

/** Moment (JD UT) of the last sign ingress of `g` before `jdUt`, as FUN_004a5ba0 finds it. */
export function lastIngress(swe: Sweph, chart: Chart, g: Graha, jdUt = chart.positions.jdUt): number {
  const body: Graha = g === 'Ketu' ? 'Rahu' : g;
  const s = calcSettingsFromIni(chart.ini);
  const lon = (jd: number) => siderealLongitude(swe, jd, body, s).lon;
  const sign = signOf(lon(jdUt));
  const b = GRAHAS.indexOf(body) + 1;
  const step = searchStep(b);
  const t1 = jhoraCrossing(lon, sign * 30, jdUt, true, step);
  const t2 = jhoraCrossing(lon, sign * 30 + 29.9998, jdUt, true, step);
  if (Number.isNaN(t1)) return t2;
  if (Number.isNaN(t2)) return t1;
  return Math.max(t1, t2);
}

/** Murthi index (0 Swarna, 1 Rajata, 2 Taamra, 3 Loha) of `g` in the chart, against the natal Moon's sign. */
export function murthiOf(swe: Sweph, chart: Chart, g: Graha, natalMoonSign: number, jdUt = chart.positions.jdUt): number {
  const t = lastIngress(swe, chart, g, jdUt);
  const moonSign = signOf(siderealLongitude(swe, t, 'Moon', calcSettingsFromIni(chart.ini)).lon);
  return MURTHI_BY_HOUSE[(moonSign - natalMoonSign + 12) % 12];
}

/** Murthis of body indices 1..9 (index 0 unused); Ketu = Rahu. */
export function murthis(swe: Sweph, chart: Chart, natalMoonSign: number): number[] {
  const out = [0];
  for (let b = 1; b <= 8; b++) out.push(murthiOf(swe, chart, GRAHAS[b - 1], natalMoonSign));
  out.push(out[8]);
  return out;
}
