// Patyayini dasa (FUN_00410710), a Tajaka dasa; JHora builds it for whatever
// chart is open, so for a natal chart it is computed from the birth positions:
//  - lagna and Sun..Saturn ordered by their degrees inside their (rasi) signs,
//    smallest first (insertion sort, ties keep lagna, Sun, ... order);
//  - lengths: the first body's degrees, then the differences of consecutive
//    degrees, scaled so that the eight add up to 120 dasa years (in a Tajaka
//    chart the year definition turns these into one year); from birth;
//  - nine maha dasas are listed (the eight plus the first again);
//  - antardasas from the dasa lord round the same order, in proportion.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { PLANETS } from '../signStrength';
import { bodyPeriod, expandDasa, yearFractions } from './otherCommon';

export const PATYAYINI_TITLE = 'Patyayini Dasa (useful in Tajaka charts)';

export function patyayiniDasa(chart: Chart, levels = 2): Period[] {
  const p = chart.positions;
  const deg = [p.ascendant % 30, ...PLANETS.slice(0, 7).map((g) => p.grahas[g].lon % 30)];
  const order: number[] = [0];
  for (let id = 1; id < 8; id++) {
    const k = order.findIndex((x) => deg[id] < deg[x]);
    if (k < 0) order.push(id); else order.splice(k, 0, id);
  }
  const lens = order.map((id, i) => (i === 0 ? deg[id] : deg[id] - deg[order[i - 1]]));
  const total = lens.reduce((a, x) => a + x, 0);
  const eight = order.map((id, i) => ({ id, years: (lens[i] * 120) / total }));
  const mds = [...eight, eight[0]];
  const frac = yearFractions(eight, 8);
  const subs = (id: number) => {
    const u = order.indexOf(id);
    return order.map((_, j) => ({ id: order[(u + j) % 8], frac: frac(order[(u + j) % 8]) }));
  };
  return expandDasa({ mds, subs, make: bodyPeriod }, levels);
}
