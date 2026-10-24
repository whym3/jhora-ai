// Jobs of the Mundane tab (see mundane.ts for the jhora.exe routines).
//
// 'mundane.find' runs on the NATAL chart spec; params:
//   { mode, current?: BirthData (the chart shown, when it is a derived chart), ...mode params }
//   mode 'swearingIn'  { years, days }                         (button 1015)
//        'transit'     { body: 0..9, division: 0..22, after }   (button 1018; combo 1003/1004/1005)
//        'stationary'  { body: 0..6 = Mars..Ketu, after }       (button 1052; combo 1053/1055)
//        'conjunction' { body1, body2: 0..9, aspect: 0..11, after } (button 1021; combo 1009/1012/1036/1010)
//        'eclipse'     { next, type: 0..2, maximum }            (button 1028; combo 1031/1032/1037)
//        'lunarYear' | 'lunarMonth' | 'fortnight' | 'lunarDay' | 'solarYear' | 'solarMonth' | 'ardra'  { next }
//        'lifecycle'   { n: 1..10 }                             (menu 33069/33070)
//   Result: caption = chart name, one row [name, start, end of the period of effect]
//   (eclipses add their contact times), `text[0]` = JSON { birth, label, periodDays }.
// 'mundane.dasa' runs on the natal spec; params { birth, label, periodDays, path }:
//   Vimsottari of the mundane chart compressed into its period (drill-down by path).
import type { Sweph } from '../../sweph';
import { computeChart, type Chart } from '../chart';
import type { BirthData } from '../jhd';
import type { Table } from '../../engine/protocol';
import { formatDasaTime, antarDasaText, mahaDasaText, periodLabel } from '../dasas/format';
import type { Period } from '../dasas/vimsottari';
import { birthAt, type AsyncTableFn } from './common';
import {
  ardraPravesha, aspectMoment, ASPECTS, contactTime, ctxOf, divisionName, eclipse, ECLIPSE_NOTES, fortnight, lifecycleMoment,
  lunarNewMonth, lunarNewYear, BODY_SHORT, MUNDANE_BODIES, mundaneDasa, newLunarDay, solarNewMonth, solarNewYear, lunarSolarOptions,
  recordJd, stationaryChange, swearingInLabel, transitChange, type EclipseType,
} from './mundane';

const STEP = 0.0035;
const num = (x: unknown, d = 0) => (x === undefined || x === null || x === '' ? d : Number(x));
const bool = (x: unknown) => x === true || x === 1 || x === '1' || x === 'true';

interface Found { jd: number; periodDays: number; label: string; rows?: string[][]; notes?: string[] }

async function find(natal: Chart, params: Record<string, unknown>, swe: Sweph): Promise<Found> {
  const mode = String(params.mode ?? 'transit');
  // the chart shown: searches that step from it move 0.0035 day when it is a derived chart
  const current = params.current ? await computeChart(swe, params.current as BirthData, natal.ini) : natal;
  const derived = !!params.current;
  const after = bool(params.after), next = bool(params.next);
  const c = ctxOf(swe, current);
  // FUN_00409780 / FUN_004099b0 / FUN_0040aae0 store the moved moment as a record (FUN_0049d250)
  const base = derived ? recordJd(c, current.positions.jdUt + (after ? STEP : -STEP)) : current.positions.jdUt;
  switch (mode) {
    case 'swearingIn': {
      const periodDays = num(params.years) * 365.24219 + num(params.days);
      return { jd: current.positions.jdUt, periodDays, label: swearingInLabel(periodDays) };
    }
    case 'transit': {
      const body = num(params.body), division = num(params.division);
      const r = transitChange(c, body, division, base, after);
      return { ...r, label: `${divisionName(division)} change (${BODY_SHORT[body]})` };
    }
    case 'stationary': {
      const body = num(params.body) + 3;
      if (body >= 8 && !c.settings.trueNodes) throw new Error('Stationary transit cannot occur with mean nodes');
      const r = stationaryChange(c, body, base, after);
      return { ...r, label: `Retro change (${BODY_SHORT[body]})` };
    }
    case 'conjunction': {
      const p1 = num(params.body1, 1), p2 = num(params.body2, 2);
      if ((p1 === 8 && p2 === 9) || (p1 === 9 && p2 === 8)) throw new Error('Did you forget that Rahu and Ketu will never conjoin?');
      if (p1 === p2) throw new Error('Please select two different planets.');
      const angle = ASPECTS[num(params.aspect)][1];
      const r = aspectMoment(c, p1, p2, angle, base, after);
      return { ...r, label: `${BODY_SHORT[p1]}-${BODY_SHORT[p2]} ${angle === 180 ? 'Opp' : 'Conj'}` };
    }
    case 'eclipse': {
      const type = num(params.type) as EclipseType;
      const e = eclipse(c, type, current.positions.jdUt, next, bool(params.maximum));
      const tz = natal.birth.tzHours;
      return {
        ...e,
        rows: e.contacts.map(([name, jd]) => [name.replace(/: $/, ''), contactTime(swe, jd, tz), '']),
        notes: [`${e.label}: Contact Times`, ECLIPSE_NOTES[type]],
      };
    }
    case 'lunarYear': return lunarNewYear(swe, natal, next);
    case 'lunarMonth': return lunarNewMonth(swe, natal, next);
    case 'fortnight': return fortnight(swe, natal, next);
    case 'lunarDay': return newLunarDay(swe, natal, next);
    case 'solarYear': return solarNewYear(swe, natal, next);
    case 'solarMonth': return solarNewMonth(swe, natal, next, lunarSolarOptions(natal.ini).solarYrTrop);
    case 'ardra': return ardraPravesha(swe, natal, next);
    case 'lifecycle': {
      const n = Math.max(1, Math.min(10, Math.trunc(num(params.n, 1))));
      await swe.ensureEphemeris(natal.positions.jdUt + n * 144 * 365.25);
      return { jd: lifecycleMoment(swe, natal, n), periodDays: 0, label: `Lifecycle chart ${n}` };
    }
    default: throw new Error(`unknown mundane mode: ${mode}`);
  }
}

const DASA_LEVEL = ['Maha Dasas', 'Antardasas', 'Pratyantardasas', 'Sookshma-antardasas', 'Prana-antardasas', 'Deha-antardasas'];

export const MUNDANE_JOBS: Record<string, AsyncTableFn> = {
  'mundane.find': async (natal, params, swe) => {
    await swe.ensureEphemeris(natal.positions.jdUt);
    const f = await find(natal, params, swe);
    const birth = birthAt(swe, natal, f.jd);
    const when = (jd: number) => formatDasaTime(jd, natal.birth.tzHours, (x) => swe.revjul(x));
    const rows = [[f.label, when(f.jd), f.periodDays ? when(f.jd + f.periodDays) : ''], ...(f.rows ?? [])];
    return {
      caption: f.label, headers: ['Chart', 'Start', 'End'], rows, notes: f.notes,
      text: [JSON.stringify({ birth, label: f.label, periodDays: f.periodDays })],
    } satisfies Table;
  },
  'mundane.dasa': async (natal, params, swe) => {
    const path = (params.path as number[] | undefined) ?? [];
    const chart = await computeChart(swe, params.birth as BirthData, natal.ini);
    const d = mundaneDasa(swe, chart, num(params.periodDays), String(params.label ?? ''), path.length + 1);
    const ctx = { clock: d.clock, tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
    let list: Period[] = d.periods; let parent: Period | null = null;
    for (const i of path) { parent = list[i]; list = parent.children ?? []; }
    const when = (y: number) => formatDasaTime(ctx.clock.toJd(y), ctx.tz, ctx.revjul);
    return {
      caption: parent ? `${periodLabel(parent)}: ${when(parent.start)} - ${when(parent.end)}` : `${d.title} (compressed into ${num(params.periodDays).toFixed(2)} days)`,
      headers: [DASA_LEVEL[path.length] ?? 'Periods', 'Start', 'End'],
      rows: list.map((q) => [periodLabel(q), when(q.start), when(q.end)]),
      text: !parent ? mahaDasaText(d.title, d.periods, ctx) : path.length === 1 ? antarDasaText(d.title, parent, ctx) : undefined,
      drill: true,
    };
  },
};
