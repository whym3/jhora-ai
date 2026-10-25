// jhora.exe's longitude-crossing search FUN_0049c130 and its station search
// FUN_0049c930, ported step by step so that the moment they return (not the
// exact root) is reproduced.
//
// FUN_0049c130(out, &spec), `this` = the record searched from.  spec (as built by
// FUN_0049c0d0, which clears +0x19/+0x1a and moves its +0x19 to +0x1b):
//   +0x00 body 1, +0x04 body 2 (JHora indices: 0 lagna, 1 Sun ... 7 Saturn, 8 Rahu, 9 Ketu),
//   +0x08 target longitude (one body), +0x10 offset c, +0x18 two bodies,
//   +0x19 comparator 0x49a7b0 (c negated, no swap): f(t) = norm360(lon1 + (lon2 - c))
//   (FUN_004ae5e0; Yoga Pravesha), +0x1a comparator 0x49a7e0 (unused by the ported
//   callers), +0x1b search backwards.
//   Comparator 0x49a780: f(t) = norm360(lon1 - (lon2 + c)) (FUN_004ae540), lon2 = the
//   target for one body.  With two bodies, when rank[b1] > rank[b2] (rank table on the
//   stack: Lagna 0, Sun 4, Moon 1, Mars 5, Mercury 2, Jupiter 6, Venus 3, Saturn 9,
//   Rahu 7, Ketu 8) the bodies are swapped and c negated.  One body: body 2 = 105.
//   t0 = swe_julday(record date, record hour + record zone)
//   step = 1/12 day if a body is the lagna, else 3 if one is the Moon, else 10;
//          negated for a backward search; tolerance 1 s (1/15 s with the lagna)
//   1. from t0, step until f jumps across 0/360: (prev > 240 and cur < 120) or
//      (prev < 120 and cur > 240).  A = previous time, B = current time.
//   2. while |A - B| > tol:
//        X = regula falsi on the unwrapped values (the side with the larger f is
//            taken as f - 360); if FA == FB stop;
//        for k = 10, 4: ta = X + (A - X) / 2^k, tb = X + (B - X) / 2^k; if the jump
//            is not between A and ta but is between ta and tb, (A, B) = (ta, tb), next;
//        otherwise bisect at M = (A + B) / 2, keeping the half with the jump.
//   3. return max(A, B), stored as a record by FUN_0049d250.
// All comparisons are strict, as in the x87 code.  The one-body Sun form (solar
// returns, Sun-longitude dasa clocks FUN_0049dc20 / FUN_0049de30) is jhoraCrossing.

import type { Sweph } from '../../sweph';

/** FUN_004ae800 (and the tails of FUN_004ae540 / FUN_004ae5e0): add or subtract 360 until in [0, 360). */
export const n360 = (x: number) => {
  let d = x;
  if (d < 0) { do d += 360; while (d < 0); }
  if (d >= 360) { do d -= 360; while (d >= 360); }
  return d;
};

export interface SearchOptions {
  /** step in days (signed); JHora: -10 for the Sun searched backwards */
  step: number;
  /** stop when the bracket is at most this many days (JHora: 1 s) */
  tol: number;
}

/**
 * A moment stored as a chart record and read back (FUN_0049d250: swe_revjul(jd + zone/24)
 * -> date and hour; FUN_0049d210 / FUN_0049c130: swe_julday(date, hour - zone)).
 */
export function recordRoundTrip(swe: Pick<Sweph, 'revjul' | 'julday'>, tz: number, jd: number): number {
  const r = swe.revjul(jd + tz * 0.041666666666666664);
  return swe.julday(r.year, r.month, r.day, r.hour - tz);
}

/** 1 s and 1/15 s (the lagna) in days, the tolerances of FUN_0049c130 */
export const SECOND = 1.1574074074074073e-05;
export const LAGNA_TOL = 7.716049382716049e-7;

const jump = (p: number, c: number) => (p > 240 && c < 120) || (p < 120 && c > 240);

/**
 * Steps 1-3 of FUN_0049c130 on a comparator value g(t) in [0, 360):
 * returns the later end of the final bracket.
 */
export function jhoraRefine(g: (jd: number) => number, t0: number, step: number, tol: number): number {
  let B = t0, FB = g(B);
  let A = B, FA = FB;
  for (let i = 0; i < 100000 && !jump(FA, FB); i++) {
    A = B; FA = FB;
    B = B + step;
    FB = g(B);
  }
  while (Math.abs(A - B) > tol) {
    let X: number;
    if (FA > FB) {
      const a = 360 - FA;
      X = (A * FB + B * a) / (FB + a);
    } else if (FA < FB) {
      const a = 360 - FB;
      X = (B * FA + A * a) / (FA + a);
    } else break;
    const d1 = A - X, d2 = B - X;
    let done = false;
    for (let k = 10; k >= 4; k -= 6) {
      const s = 2 ** k;
      const ta = X + d1 / s, tb = X + d2 / s;
      const Fta = g(ta);
      // jump between A and ta -> this k fails
      if ((Fta > 240 && FA < 120) || (Fta < 120 && FA > 240)) continue;
      const Ftb = g(tb);
      if ((Ftb > 240 && Fta < 120) || (Ftb < 120 && Fta > 240)) {
        A = ta; FA = Fta; B = tb; FB = Ftb;
        done = true;
        break;
      }
    }
    if (done) continue;
    const M = (A + B) * 0.5;
    const FM = g(M);
    if ((FM > 240 && FA < 120) || (FM < 120 && FA > 240)) { B = M; FB = FM; } else { A = M; FA = FM; }
  }
  return A > B ? A : B;
}

/** FUN_0049c130 for a body against a fixed target longitude. `lonAt` gives the body's longitude at a JD (UT). */
export function jhoraCrossing(lonAt: (jd: number) => number, target: number, t0: number, opts: SearchOptions): number {
  const tgt = n360(target);
  return jhoraRefine((t) => n360(lonAt(t) - tgt), t0, opts.step, opts.tol);
}

/** JHora's Sun search: backwards in 10-day steps, 1-second bracket. */
export const SUN_SEARCH: SearchOptions = { step: -10, tol: SECOND };

/** The spec of FUN_0049c130 as the FUN_0049c0d0 callers fill it (comparator 0x49a780). */
export interface BodySearch {
  /** FUN_0049aaa0: longitude of a JHora body index (0 lagna, 1 Sun ... 9 Ketu) at a JD (UT) */
  lon: (body: number, jd: number) => number;
  b1: number;
  /** second body (+0x18 set); without it `target` is the fixed second longitude */
  b2?: number;
  target?: number;
  /** +0x10 */
  offset?: number;
  /** +0x19: comparator 0x49a7b0, the sum of the two longitudes (Yoga Pravesha) */
  sum?: boolean;
  backward: boolean;
}

/** Ranks of the bodies on FUN_0049c130's stack; the lower-ranked body goes first. */
const RANK = [0, 4, 1, 5, 2, 6, 3, 9, 7, 8];

/** FUN_0049c130 from `t0` (the JD of the record searched from). */
export function jhoraBodySearch(s: BodySearch, t0: number): number {
  let b1 = s.b1, b2 = s.b2 ?? 105, c = s.offset ?? 0;
  const two = s.b2 !== undefined;
  if (s.sum) c = -c;
  else if (two && RANK[b1] > RANK[b2]) { [b1, b2] = [b2, b1]; c = -c; }
  const lagna = b1 === 0 || b2 === 0;
  const step = lagna ? 1 / 12 : b1 === 2 || b2 === 2 ? 3 : 10;
  const target = s.target ?? 0;
  const g = s.sum
    ? (t: number) => n360(s.lon(b1, t) + (s.lon(b2, t) + c))
    : two
      ? (t: number) => n360(s.lon(b1, t) - (s.lon(b2, t) + c))
      : (t: number) => n360(s.lon(b1, t) - (target + c));
  return jhoraRefine(g, t0, s.backward ? -step : step, lagna ? LAGNA_TOL : SECOND);
}

/**
 * FUN_0049c930(out, body, forward, &state), `this` = the record searched from: the
 * first change of the body's retrograde state (FUN_0049aaa0's flag; for Rahu the
 * sign of the speed it stores at record+0x1570) from t0.  Steps of 20 days
 * (backward: -20) until the state differs, then bisection (keeping the half whose
 * ends differ) until the bracket is at most 1 s; returns the bracket end on the
 * changed side (the later end searching forward, the earlier one backward).
 */
export function jhoraStation(retro: (jd: number) => boolean, t0: number, forward: boolean): number {
  let A = t0, sa = retro(A), B: number, sb: boolean;
  for (let i = 0; ; i++) {
    B = (forward ? 1 : -1) * 20 + A;
    sb = retro(B);
    if (sb !== sa || i > 100000) break;
    A = B;
  }
  while (Math.abs(A - B) > SECOND) {
    const M = (A + B) * 0.5;
    if (retro(M) === sa) A = M; else B = M;
  }
  return B;
}
