// Delta-T (TT - UT) as computed by JHora 8.0's Swiss Ephemeris DLL (2.02.01).
// Sampled from the DLL by tools/harness/dump_deltat.py: monthly 1600-2200,
// yearly -5400..5400. Values in between use 4-point Lagrange interpolation,
// which reproduces the DLL to well under 0.01 s.
import table from './data/deltat-jhora.json';

interface Grid { startJd: number; stepDays: number; values: number[] }

function interpolate(g: Grid, jd: number): number | null {
  const x = (jd - g.startJd) / g.stepDays;
  const i = Math.floor(x);
  if (i < 1 || i + 2 >= g.values.length) return null;
  const t = x - i;
  const [p0, p1, p2, p3] = [g.values[i - 1], g.values[i], g.values[i + 1], g.values[i + 2]];
  return (
    p0 * (-t * (t - 1) * (t - 2)) / 6 +
    p1 * ((t + 1) * (t - 1) * (t - 2)) / 2 +
    p2 * (-(t + 1) * t * (t - 2)) / 2 +
    p3 * ((t + 1) * t * (t - 1)) / 6
  );
}

/** Delta-T in days for a UT Julian day, or null outside -5400..5400. */
export function jhoraDeltaT(jdUt: number): number | null {
  const s = interpolate(table.fine as Grid, jdUt) ?? interpolate(table.coarse as Grid, jdUt);
  return s === null ? null : s / 86400;
}
