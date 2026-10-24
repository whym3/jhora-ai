// Graha and rasi drishti as jhora.exe evaluates them on sign positions.
import type { Graha } from './positions';
import { rasiAspects } from './signStrength';

export { rasiAspects };

/**
 * Graha drishti of planet `p` from sign `from` on sign `to` (FUN_004ae450):
 * every planet aspects the 7th; Mars also the 4th and 8th, Jupiter the 5th and
 * 9th, Saturn the 3rd and 10th, Rahu the 5th, 9th and 2nd; Ketu has none.
 */
export function grahaAspects(p: Graha, from: number, to: number): boolean {
  if (p === 'Ketu') return false;
  const d = (((to - from) % 12) + 12) % 12;
  if (d === 6) return true;
  if (p === 'Mars') return d === 3 || d === 7;
  if (p === 'Jupiter') return d === 4 || d === 8;
  if (p === 'Saturn') return d === 2 || d === 9;
  if (p === 'Rahu') return d === 4 || d === 8 || d === 1;
  return false;
}

const n360 = (x: number) => ((x % 360) + 360) % 360;
const SPECIAL_WINDOWS: Partial<Record<Graha, [number, number, number]>> = { Mars: [90, 210, 15], Jupiter: [120, 240, 30], Saturn: [60, 270, 45] };

/**
 * Parasara's sputa drishti of `planet` at `lonAspector` on the point
 * `lonTarget`, in percent (FUN_004b2b00). The base curve gives 0..60 virupas;
 * with AspectEvalAsPerParasara (the default) Mars, Jupiter and Saturn use the
 * BPHS formulas for their special aspects, otherwise they get a flat bonus in
 * whole-sign windows. Rahu and Ketu have the base curve only.
 */
export function aspectPercent(lonTarget: number, lonAspector: number, planet: Graha, parasara = true): number {
  const d = n360(lonTarget - lonAspector);
  let v: number;
  if (d >= 300) v = 0;
  else if (d >= 180) v = (300 - d) * 0.5;
  else if (d >= 150) v = (d - 150) * 2;
  else if (d >= 120) v = 150 - d;
  else if (d >= 90) v = (120 - d) * 0.5 + 30;
  else if (d >= 60) v = d - 60 + 15;
  else if (d >= 30) v = (d - 30) * 0.5;
  else v = 0;
  if (!parasara) {
    const w = SPECIAL_WINDOWS[planet];
    if (w) for (const s of [w[0], w[1]]) if (d >= s && d < s + 30) v += w[2];
  } else if (planet === 'Jupiter') {
    if (d >= 90 && d < 120) v = (d - 90) * 0.5 + 45;
    else if (d >= 120 && d < 150) v = 60 - 2 * (d - 120);
    else if (d >= 210 && d < 240) v = (d - 210) * 0.5 + 45;
    else if (d >= 240 && d < 270) v = 60 - (d - 240) * 1.5;
  } else if (planet === 'Mars') {
    if (d >= 60 && d < 90) v = (d - 60) * 1.5 + 15;
    else if (d >= 90 && d < 120) v = 60 - (d - 90);
    else if (d >= 180 && d < 210) return 100;
    else if (d >= 210 && d < 240) v = 60 - (d - 210);
  } else if (planet === 'Saturn') {
    if (d >= 30 && d < 60) v = 2 * (d - 30);
    else if (d >= 60 && d < 90) v = 60 - (d - 60) * 0.5;
    else if (d >= 240 && d < 270) v = d - 240 + 30;
    else if (d >= 270 && d < 300) v = 2 * (300 - d);
  }
  return Math.min(v, 60) * (5 / 3);
}
