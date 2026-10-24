// Jobs of the Transits tab (all asynchronous: they cast extra charts with the ephemeris).
//
// All run on the NATAL chart spec. Dates are TransitDate { year, month, day, hour }
// in natal-zone clock time unless stated.
//   'transits.basic'       { date?, mode 0..8, ref 'Moon'|'Lagna'|'AL', refVarga, avNatalVarga, avTransitVarga }
//                          CTransitView list; without `date` the current chart is the natal chart (as in JHora
//                          before "Show Transit Calculations").
//   'transits.calendar'    { start, stepDays, rows, natalVarga, transitVarga, items: boolean[6] }
//   'transits.search'      SpecialSearch (search.ts); one row [label, found date/time]; text[0] = JSON { date }
//   'transits.correlation' { date, tz (form zone, east positive hours), mode 0..3, minPercent, orbAspect, orbQuadrant, orbTrine }
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { Table } from '../../engine/protocol';
import type { AsyncTableFn } from '../derived/common';
import { birthJdUt } from '../jhd';
import { formatDasaTime } from '../dasas/format';
import { birthAt } from '../tajaka/annual';
import { computeChart } from '../chart';
import { basicTransitTable, type BasicOptions } from './basic';
import { calendarTable, transitCalendar } from './calendar';
import { correlationTable, longitudeCorrelation, type CorrelationOptions } from './correlation';
import { murthis } from './murthi';
import { specialSearch, type SpecialSearch } from './search';
import { bodySign, computeTransitChart, transitBirth, type NatalRef, type TransitDate } from './common';

const num = (x: unknown, d = 0) => (x === undefined || x === null || x === '' ? d : Number(x));

async function prepare(swe: Sweph, natal: Chart, d: TransitDate): Promise<number> {
  const jd = birthJdUt(transitBirth(natal.birth, d), (y, m, dd, h) => swe.julday(y, m, dd, h));
  await swe.ensureEphemeris(jd);
  await swe.ensureEphemeris(jd - 11000);   // murthi ingress searches go back up to ~30 years (Saturn)
  return jd;
}

export const TRANSIT_JOBS: Record<string, AsyncTableFn> = {
  'transits.basic': async (natal, params, swe) => {
    const date = params.date as TransitDate | undefined;
    if (date) await prepare(swe, natal, date);
    const transit = date ? await computeTransitChart(swe, natal, date) : natal;
    const mode = num(params.mode);
    const opts: BasicOptions = {
      ref: (params.ref as NatalRef | undefined) ?? 'Moon', refVarga: num(params.refVarga),
      avNatalVarga: num(params.avNatalVarga), avTransitVarga: num(params.avTransitVarga),
    };
    if (mode === 0) {
      if (!date) await swe.ensureEphemeris(natal.positions.jdUt - 11000);
      opts.murthis = murthis(swe, transit, bodySign(natal.positions, 2, 0));
    }
    return { ...basicTransitTable(natal, transit, mode, opts), caption: date ? `Transit: ${formatDate(date)}` : 'Transit chart not computed yet: natal chart shown' };
  },
  'transits.calendar': async (natal, params, swe) => {
    const start = params.start as TransitDate;
    await prepare(swe, natal, start);
    const rows = num(params.rows, 15), step = num(params.stepDays, 1);
    await swe.ensureEphemeris(natal.positions.jdUt - 11000);
    const end = birthJdUt(transitBirth(natal.birth, start), (y, m, d, h) => swe.julday(y, m, d, h)) + rows * step;
    await swe.ensureEphemeris(end);
    const cal = transitCalendar(swe, natal, {
      start, stepDays: step, rows, natalVarga: num(params.natalVarga), transitVarga: num(params.transitVarga),
    });
    return calendarTable(cal, (params.items as boolean[] | undefined) ?? [true, true, true, true, true, true]);
  },
  'transits.search': async (natal, params, swe) => {
    const s = params as unknown as SpecialSearch;
    const jd0 = await prepare(swe, natal, s.date);
    await swe.ensureEphemeris(s.after ? jd0 + 11000 : jd0 - 11000);
    const jd = specialSearch(swe, natal, s);
    if (Number.isNaN(jd)) throw new Error('no such transit found');
    const b = birthAt(swe, natal, jd);
    const date: TransitDate = { year: b.year, month: b.month, day: b.day, hour: b.hour };
    return {
      caption: 'Transit Search', headers: ['', 'Date and time'],
      rows: [['Transit Search', formatDasaTime(jd, natal.birth.tzHours, (x) => swe.revjul(x))]],
      text: [JSON.stringify({ date })],
    };
  },
  'transits.correlation': async (natal, params, swe): Promise<Table> => {
    const d = params.date as TransitDate;
    const tz = num(params.tz, natal.birth.tzHours);
    const jd = swe.julday(d.year, d.month, d.day, d.hour) - tz / 24;
    await swe.ensureEphemeris(jd);
    const transit = await computeChart(swe, birthAt(swe, natal, jd), natal.ini);
    const opts: CorrelationOptions = {
      mode: num(params.mode), minPercent: num(params.minPercent, 80), orbAspect: num(params.orbAspect, 4),
      orbQuadrant: num(params.orbQuadrant, 4), orbTrine: num(params.orbTrine, 4),
    };
    return correlationTable(longitudeCorrelation(natal, transit, opts), opts.mode);
  },
};

function formatDate(d: TransitDate): string {
  const h = Math.floor(d.hour), mf = (d.hour - h) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60);
  const p2 = (x: number) => String(x).padStart(2, '0');
  return `${d.year}-${p2(d.month)}-${p2(d.day)} ${p2(h)}:${p2(m)}:${p2(Math.min(s, 59))}`;
}
