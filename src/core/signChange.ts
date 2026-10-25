// "When will this planet change sign in this chart?" (FUN_004427a0 / FUN_00442930):
// how much earlier or later the birth would have to be for a body to leave its
// present division of the zodiac in a varga. Like JHora, the division is taken
// as a 30/n-degree segment of the D-1 longitude (exact for evenly divided vargas)
// and Ketu is timed by Rahu. FUN_00442930(record, body, &earlier, &later):
//   seg = 30 / n, start = ftol(lon * n * (1/30)) * seg, end = start + seg
//   (lon = the record's longitude of the body), then four FUN_0049c0d0 ->
//   FUN_0049c130 searches from the record (tajaka/search.ts: one body against the
//   target, c = 0; lagna steps 1/12 day and 1/15 s bracket, Moon 3 days, others 10
//   days and 1 s; later bracket end): start and end backwards, keeping the later
//   found record (the first when equal), end and start forwards, keeping the earlier
//   (the first when equal); earlier = t0 - backward, later = forward - t0.
import type { Sweph } from '../sweph';
import type { Chart } from './chart';
import { birthJdUt } from './jhd';
import { GRAHAS, type Graha } from './positions';
import { bodyLon, ctxOf, recordSearch } from './derived/mundane';

export interface SignChange { earlierDays: number; laterDays: number }

export function signChange(swe: Sweph, chart: Chart, body: Graha | 'Lagna', divisions: number): SignChange {
  const b = body === 'Lagna' ? 0 : body === 'Ketu' ? 8 : GRAHAS.indexOf(body) + 1;
  const c = ctxOf(swe, chart);
  const t0 = birthJdUt(chart.birth, (y, m, d, h) => swe.julday(y, m, d, h));
  const seg = 30 / divisions;
  const start = Math.trunc(bodyLon(c, b, t0) * divisions * 0.03333333333333333) * seg, end = start + seg;
  const cross = (target: number, backward: boolean) => recordSearch(c, { b1: b, target, backward }, t0);
  const b1 = cross(start, true), b2 = cross(end, true);
  const f1 = cross(end, false), f2 = cross(start, false);
  const tb = b2 > b1 ? b2 : b1;
  const tf = f2 < f1 ? f2 : f1;
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
