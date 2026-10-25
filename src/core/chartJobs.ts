// Worker jobs of the chart right-click menu (CChartView, menu 103) that need the ephemeris.
//
//   'chart.moveLagna'  { varga, dir: 'prev' | 'next', natal: BirthData }
//       "Change birthtime to move lagna to > The previous sign / The next sign" (33187 / 33186,
//       vtbl+0x114 0x4414a0 / vtbl+0x118 0x4415b0). Runs on the slot's chart (natal, or the
//       derived chart on screen with "Automatic"): FUN_00442930(chart, 0 = lagna, &earlier,
//       &later) times the lagna's exit from its division of the slot's varga (core/signChange.ts),
//       then the NATAL birth moment (doc+0x50, FUN_0049d210) becomes
//         prev: natal JD - earlier - 5e-6 day      next: natal JD + later + 5e-6 day
//       (0x549990 = 5e-6), converted back to a clock date in the natal zone (FUN_0049d250) and
//       pushed on the undo stack (0x65b978[0x65c91c], at most 500; see ui/shell/ChartPane.tsx).
//       text[0] = JSON { birth, jd } of the new natal birth.
//   'chart.bhavaSigns' {}
//       The Bhava/Chalit chakra's body signs (core/bhavaChart.ts) when its house spans need the
//       Swiss Ephemeris cusps (house systems other than 0..2). text[0] = JSON (number | null)[].
import type { Chart } from './chart';
import type { Sweph } from '../sweph';
import type { Table } from '../engine/protocol';
import { birthJdUt, type BirthData } from './jhd';
import { signChange } from './signChange';
import { bhavaSigns } from './bhavaChart';
import { VARGA_INDEX, VARGA_PARTS } from './vargaOptions';
import type { VargaName } from './vargas';

type TableFn = (chart: Chart, params: Record<string, unknown>, swe?: Sweph) => Table;

/** 0x549990: the step past the sign boundary (days). */
export const LAGNA_MOVE_EPS = 5e-6;

/** Divisions of a varga as FUN_00442930 takes them (0x591ed4; 1 where the name has none). */
export function vargaDivisions(varga: VargaName): number {
  const i = VARGA_INDEX.indexOf(varga);
  if (i >= 0 && VARGA_PARTS[i]) return VARGA_PARTS[i];
  return Number(varga.match(/^D(\d+)$/)?.[1] ?? 1);
}

/** The natal birth record moved so that the lagna leaves its division (see the header). */
export function movedLagnaBirth(swe: Sweph, slotChart: Chart, natal: BirthData, varga: VargaName, dir: 'prev' | 'next'): { birth: BirthData; jd: number } {
  const r = signChange(swe, slotChart, 'Lagna', vargaDivisions(varga));
  const jd0 = birthJdUt(natal, (y, m, d, h) => swe.julday(y, m, d, h));
  const jd = dir === 'prev' ? jd0 - r.earlierDays - LAGNA_MOVE_EPS : jd0 + r.laterDays + LAGNA_MOVE_EPS;
  return { birth: birthAtJd(swe, natal, jd), jd };
}

/** FUN_0049d250: the clock date and time of `jdUt` in the record's zone. */
export function birthAtJd(swe: Sweph, b: BirthData, jdUt: number): BirthData {
  const r = swe.revjul(jdUt + b.tzHours / 24);
  return { ...b, year: r.year, month: r.month, day: r.day, hour: r.hour, castAt: null, legacy: null };
}

export const CHART_JOBS: Record<string, TableFn> = {
  'chart.moveLagna': (chart, params, swe) => {
    if (!swe) throw new Error('needs the ephemeris');
    const varga = String(params.varga ?? 'D1') as VargaName;
    const dir = params.dir === 'prev' ? 'prev' : 'next';
    const natal = (params.natal as BirthData | undefined) ?? chart.birth;
    const moved = movedLagnaBirth(swe, chart, natal, varga, dir);
    return { caption: dir === 'prev' ? 'The previous sign' : 'The next sign', headers: [], rows: [], text: [JSON.stringify(moved)] };
  },
  'chart.bhavaSigns': (chart, _params, swe) => ({
    headers: [], rows: [], text: [JSON.stringify(bhavaSigns(chart, chart.ini, { swe }))],
  }),
};
