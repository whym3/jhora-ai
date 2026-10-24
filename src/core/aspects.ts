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

/** x + y as hi + lo, exactly (Knuth's two-sum). */
function twoSum(x: number, y: number): [number, number] {
  const s = x + y, b = s - x;
  return [s, (x - (s - b)) + (y - b)];
}

/**
 * lonTarget - lonAspector reduced to [0, 360) the way FUN_004b2b00 does it on the x87:
 * in 80-bit precision, where the difference of two doubles and the +-360 steps are
 * exact. Kept as hi + lo so a target exactly on a boundary (the "Nth from" rows add
 * whole signs) lands on the same side as in JHora, which prints "-" only for exactly 0.
 */
function angle(lonTarget: number, lonAspector: number): [number, number] {
  let [hi, lo] = twoSum(lonTarget, -lonAspector);
  const add = (k: number) => {
    const [s, e] = twoSum(hi, k);
    const t = s + (lo + e);
    lo = (lo + e) - (t - s);
    hi = t;
  };
  while (hi < 0 || (hi === 0 && lo < 0)) add(360);
  while (hi > 360 || (hi === 360 && lo >= 0)) add(-360);
  return [hi, lo];
}
const SPECIAL_WINDOWS: Partial<Record<Graha, [number, number, number]>> = { Mars: [90, 210, 15], Jupiter: [120, 240, 30], Saturn: [60, 270, 45] };

/**
 * Parasara's sputa drishti of `planet` at `lonAspector` on the point
 * `lonTarget`, in percent (FUN_004b2b00). The base curve gives 0..60 virupas;
 * with AspectEvalAsPerParasara (the default) Mars, Jupiter and Saturn use the
 * BPHS formulas for their special aspects, otherwise they get a flat bonus in
 * whole-sign windows. Rahu and Ketu have the base curve only.
 */
export function aspectPercent(lonTarget: number, lonAspector: number, planet: Graha, parasara = true): number {
  const [hi, lo] = angle(lonTarget, lonAspector);
  const ge = (c: number) => hi > c || (hi === c && lo >= 0);
  const from = (c: number) => (hi - c) + lo;   // d - c, exact near c
  let v: number;
  if (ge(300)) v = 0;
  else if (ge(180)) v = -from(300) * 0.5;
  else if (ge(150)) v = from(150) * 2;
  else if (ge(120)) v = -from(150);
  else if (ge(90)) v = -from(120) * 0.5 + 30;
  else if (ge(60)) v = from(60) + 15;
  else if (ge(30)) v = from(30) * 0.5;
  else v = 0;
  // the special-aspect formulas work on the angle rounded to a double (local_b0)
  const d = hi + lo;
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
