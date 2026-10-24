// jhora.exe's longitude-crossing search FUN_0049c130, in the one-body form used
// for solar returns and Sun-longitude dasa clocks (FUN_0049dc20 / FUN_0049de30:
// body 1 = Sun, comparator 0x49a780, flags +0x18 = 0, +0x19 = 0, +0x1a = 0,
// +0x1b = 1 "search backwards").  Ported step by step so that the moment it
// returns (not the exact root) is reproduced:
//
//   f(t) = norm360(lon(t) - target)                       (FUN_004ae540)
//   step = 10 days (3 if the Moon is involved, 1/12 day for the lagna), negated
//          for a backward search; tolerance 1 s (1/15 s when the lagna is involved)
//   1. from t0, step until f jumps across 0/360: (prev > 240 and cur < 120) or
//      (prev < 120 and cur > 240).  A = previous time, B = current time.
//   2. while |A - B| > tol:
//        X = regula falsi on the unwrapped values (the side with the larger f is
//            taken as f - 360); if FA == FB stop;
//        for k = 10, 4: ta = X + (A - X) / 2^k, tb = X + (B - X) / 2^k; if the jump
//            is not between A and ta but is between ta and tb, (A, B) = (ta, tb), next;
//        otherwise bisect at M = (A + B) / 2, keeping the half with the jump.
//   3. return max(A, B).
// All comparisons are strict, as in the x87 code.

const n360 = (x: number) => {
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

const jump = (p: number, c: number) => (p > 240 && c < 120) || (p < 120 && c > 240);

/** FUN_0049c130 for a body against a fixed target longitude. `lonAt` gives the body's longitude at a JD (UT). */
export function jhoraCrossing(lonAt: (jd: number) => number, target: number, t0: number, opts: SearchOptions): number {
  const tgt = n360(target);
  const f = (t: number) => n360(lonAt(t) - tgt);
  let B = t0, FB = f(B);
  let A = B, FA = FB;
  for (let i = 0; i < 100000 && !jump(FA, FB); i++) {
    A = B; FA = FB;
    B = B + opts.step;
    FB = f(B);
  }
  while (Math.abs(A - B) > opts.tol) {
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
      const Fta = f(ta);
      // jump between A and ta -> this k fails
      if ((Fta > 240 && FA < 120) || (Fta < 120 && FA > 240)) continue;
      const Ftb = f(tb);
      if ((Ftb > 240 && Fta < 120) || (Ftb < 120 && Fta > 240)) {
        A = ta; FA = Fta; B = tb; FB = Ftb;
        done = true;
        break;
      }
    }
    if (done) continue;
    const M = (A + B) * 0.5;
    const FM = f(M);
    if ((FM > 240 && FA < 120) || (FM < 120 && FA > 240)) { B = M; FB = FM; } else { A = M; FA = FM; }
  }
  return A > B ? A : B;
}

/** JHora's Sun search: backwards in 10-day steps, 1-second bracket. */
export const SUN_SEARCH: SearchOptions = { step: -10, tol: 1.1574074074074073e-05 };
