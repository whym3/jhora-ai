// "When will this planet change sign in this chart?" (FUN_004427a0 / FUN_00442930):
// how much earlier or later the birth would have to be for a body to leave its
// present division of the zodiac in a varga. Like JHora, the division is taken
// as a 30/n-degree segment of the D-1 longitude (exact for evenly divided vargas),
// Ketu is timed by Rahu, and each boundary is bracketed by stepping (lagna 2 h,
// Moon 3 days, others 10 days) and refined to under a second (1/15 s for lagna).
import type { Sweph } from '../sweph';
import type { Chart } from './chart';
import { birthJdUt } from './jhd';
import { computePositions, type Graha } from './positions';
import { calcSettingsFromIni } from './settings';

const n360 = (x: number) => ((x % 360) + 360) % 360;

export interface SignChange { earlierDays: number; laterDays: number }

export function signChange(swe: Sweph, chart: Chart, body: Graha | 'Lagna', divisions: number): SignChange {
  const b: Graha | 'Lagna' = body === 'Ketu' ? 'Rahu' : body;
  const geo = { lat: chart.birth.lat, lon: chart.birth.lon, alt: chart.birth.altitudeM };
  const settings = calcSettingsFromIni(chart.ini);
  const lonAt = (jd: number) => {
    const p = computePositions(swe, jd, geo, settings);
    return b === 'Lagna' ? p.ascendant : p.grahas[b].lon;
  };
  const t0 = birthJdUt(chart.birth, (y, m, d, h) => swe.julday(y, m, d, h));
  const L = lonAt(t0);
  const seg = 30 / divisions;
  const start = Math.floor(L / seg) * seg, end = start + seg;
  const step = b === 'Lagna' ? 1 / 12 : b === 'Moon' ? 3 : 10;
  const tol = b === 'Lagna' ? 1 / 86400 / 15 : 1 / 86400;

  /** First time from t0 in direction dir at which the body crosses `target`. */
  const cross = (target: number, dir: 1 | -1): number => {
    const f = (t: number) => n360(lonAt(t) - target);
    let a = t0, fa = f(a);
    for (let i = 0; i < 20000; i++) {
      const c = a + dir * step, fc = f(c);
      const jumped = (fa > 240 && fc < 120) || (fa < 120 && fc > 240);
      if (jumped) {
        let lo = a, hi = c, flo = fa;
        while (Math.abs(hi - lo) > tol) {
          const mid = (lo + hi) / 2, fm = f(mid);
          const sameSide = (flo > 180) === (fm > 180);
          if (sameSide) { lo = mid; flo = fm; } else hi = mid;
        }
        return hi;
      }
      a = c; fa = fc;
    }
    return NaN;
  };
  const tb = Math.max(cross(start, -1), cross(end, -1));
  const tf = Math.min(cross(end, 1), cross(start, 1));
  return { earlierDays: t0 - tb, laterDays: tf - t0 };
}

/** FUN_004c1fc0: "%d sec", "%d min %02d sec", "%d hr %02d min %02d sec", "%d day %d hr %02d min %02d sec". */
export function formatSpan(days: number): string {
  let secs = Math.round(days * 86400);
  const s = secs % 60; secs = (secs - s) / 60;
  const m = secs % 60; secs = (secs - m) / 60;
  const h = secs;
  const p2 = (x: number) => String(x).padStart(2, '0');
  if (h === 0 && m === 0) return `${s} sec`;
  if (h === 0) return `${m} min ${p2(s)} sec`;
  if (h < 24) return `${h} hr ${p2(m)} min ${p2(s)} sec`;
  return `${Math.floor(h / 24)} day ${h % 24} hr ${p2(m)} min ${p2(s)} sec`;
}
