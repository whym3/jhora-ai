// Jobs for Miscellany > Panchanga and Miscellany > Laghu Parasari. The lead spreads
// PANCHANGA_JOBS into engine/jobs.ts ASYNC_TABLES and LAGHU_TABLES into TABLES.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { Table } from '../../engine/protocol';
import type { AsyncTableFn } from './common';
import { TITHI_NAMES, KI_NAKSHATRAS, YOGAS, KARANAS, WEEKDAYS } from '../keyInfo';
import { dayText, monthlyText, panchangaDays, timeText, PANCHANGA_SIGNS, type PanchangaDay, type Track } from './panchanga';
import { laghuParasari, LAGHU_LAGNAS, type LaghuOptions } from './laghuParasari';

const lines = (s: string) => s.split('\n');

function trackCell(tr: Track, names: string[], k: number): string {
  if (tr.count === 0) return `${names[tr.items[0].index]} (whole day)`;
  return tr.items.slice(0, tr.count).map((e) => `${names[e.index]} till ${timeText(e.end, 0, k)}`).join(', ');
}

function dayRow(d: PanchangaDay): string[] {
  const k = d.counter;
  const t2 = (m: PanchangaDay['sunrise'] | null) => timeText(m, 2, k);
  return [
    `${d.date.year}-${String(d.date.month).padStart(2, '0')}-${String(d.date.day).padStart(2, '0')}`, WEEKDAYS[d.weekday],
    trackCell(d.tithi, TITHI_NAMES, k), trackCell(d.nakshatra, KI_NAKSHATRAS, k), trackCell(d.yoga, YOGAS, k), trackCell(d.karana, KARANAS, k),
    t2(d.sunrise), t2(d.sunset), t2(d.moonrise), t2(d.moonset), trackCell(d.moonSign, PANCHANGA_SIGNS, k),
    `${t2(d.rahu.start)} - ${t2(d.rahu.end)}`, d.varjya.map((v) => `${t2(v.start)} - ${t2(v.end)}`).join(', '),
    d.durmuhurta.map((v) => `${t2(v.start)} - ${t2(v.end)}`).join(', '),
  ];
}
const DAY_HEADERS = ['Date', 'Weekday', 'Tithi', 'Nakshatra', 'Yoga', 'Karana', 'Sunrise', 'Sunset', 'Moonrise', 'Moonset', 'Moon', 'Rahu Kaalam', 'Varjya', 'Durmuhurta'];

function ym(chart: Chart, params: Record<string, unknown>) {
  return { year: Number(params.year ?? chart.birth.year), month: Number(params.month ?? chart.birth.month) };
}

export const PANCHANGA_JOBS: Record<string, AsyncTableFn> = {
  // "Copy monthly panchanga" (menu 150, id 33085): 31 days from day 1 of the chart's month. params { year?, month? }
  'panchanga.monthly': async (chart, params, swe) => {
    const { year, month } = ym(chart, params);
    const days = await panchangaDays(chart, swe, 31, year, month);
    return { caption: `Monthly Panchanga: ${year}-${month}`, headers: DAY_HEADERS, rows: days.map(dayRow), text: lines(monthlyText(days)) };
  },
  // The Panchanga pane itself (FUN_004649b0 via FUN_004665f0(2)): the chart's day and the next, with horas and choghadiyas
  'panchanga.daily': async (chart, _params, swe) => {
    const days = await panchangaDays(chart, swe, 2);
    return { caption: 'Panchanga', headers: DAY_HEADERS, rows: days.map(dayRow), text: lines(days.map((d) => dayText(d, true)).join('')) };
  },
  // Same table as LAGHU_TABLES['laghuParasari.table'], but loads the ephemeris for the
  // solar-return dates (up to 120 years after the chart) first. params: LaghuOptions
  'laghuParasari.table': async (chart, params, swe) => {
    await swe.ensureEphemeris(chart.positions.jdUt + 121 * 365.25);
    return laghuParasari(chart, params as Partial<LaghuOptions>, swe);
  },
};

/** Synchronous tables (spread into engine/jobs.ts TABLES). */
export const LAGHU_TABLES: Record<string, (chart: Chart, params: Record<string, unknown>, swe?: Sweph) => Table> = {
  // Miscellany > Laghu Parasari (CLaghuParasariView, menu 159). params: LaghuOptions
  'laghuParasari.table': (chart, params, swe) => laghuParasari(chart, params as Partial<LaghuOptions>, swe),
};

export { LAGHU_LAGNAS };
