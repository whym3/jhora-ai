// Jobs of the Tithi Pravesha tab and Miscellany > Prasna (see tithiPravesha.ts / prasna.ts).
//
// 'tithiPravesha.find' (natal spec) params { mode: 'year', selection: TPYearSelection }
//                                       or { mode: 'date', selection: TPDateSelection }
//   -> caption = chart name ("Annual TP" ...), one row [name, start, end], text[0] = JSON
//      { birth, label, periodDays } (periodDays = DAT_005922b0, end - start).
// 'tithiPravesha.dasa' (natal spec) params { birth, label, periodDays, path }: Vimsottari of the
//   TP chart compressed into its period. FUN_004093f0 uses tithi years (YearDefinition 4) when
//   SpecialYearForTP=1 (default; dialog 2043), maha dasas scaled by F/120 (FUN_00408d90 tail).
//   Unverified against JHora: seed = the TP chart's own Moon, dasa sesham kept.
// 'prasna.find' (natal spec) params PrasnaInput { mode: '108'|'249'|'nadi', n, replace?, compress? }
//   -> rows: Prasna Lagna longitude / nakshatra / navamsa; text[0] = JSON { birth, label,
//      periodDays } where birth = natal birth (+ override.ascendant when the lagna is replaced).
// 'prasna.dasa' params { birth, label, periodDays, path }: Vimsottari compressed into the span
//   with the user's YearDefinition (no special year for kind 6).
import type { Sweph } from '../../sweph';
import { computeChart, type Chart } from '../chart';
import type { BirthData } from '../jhd';
import type { Table } from '../../engine/protocol';
import { formatDasaTime, antarDasaText, mahaDasaText, periodLabel } from '../dasas/format';
import { vimsottari, type Period } from '../dasas/vimsottari';
import { compressPeriods } from '../tajaka/mudda';
import { formatLongitude, NAKSHATRAS, nakshatraOf, padaOf, SIGNS, signOf } from '../zodiac';
import { vargaLongitude } from '../vargas';
import { vargaSpec } from '../vargaOptions';
import { DEFAULTS } from '../../settings/generated';
import { birthAt, whenText, type AsyncTableFn } from './common';
import { mundaneClock, periodInYears, mundaneDasa } from './mundane';
import { tpDateChart, tpYearChart, type TPDateSelection, type TPYearSelection } from './tithiPravesha';
import { prasnaLagna, prasnaSpanDays, PRASNA_LABEL, type PrasnaInput } from './prasna';

const DASA_LEVEL = ['Maha Dasas', 'Antardasas', 'Pratyantardasas', 'Sookshma-antardasas', 'Prana-antardasas', 'Deha-antardasas'];

function dasaTable(swe: Sweph, chart: Chart, title: string, periods: Period[], clock: { toJd(y: number): number }, path: number[], periodDays: number): Table {
  const ctx = { clock, tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
  let list = periods; let parent: Period | null = null;
  for (const i of path) { parent = list[i]; list = parent.children ?? []; }
  const when = (y: number) => formatDasaTime(clock.toJd(y), ctx.tz, ctx.revjul);
  return {
    caption: parent ? `${periodLabel(parent)}: ${when(parent.start)} - ${when(parent.end)}` : `${title} (compressed into ${periodDays.toFixed(2)} days)`,
    headers: [DASA_LEVEL[path.length] ?? 'Periods', 'Start', 'End'],
    rows: list.map((q) => [periodLabel(q), when(q.start), when(q.end)]),
    text: !parent ? mahaDasaText(title, periods, ctx) : path.length === 1 ? antarDasaText(title, parent, ctx) : undefined,
    drill: path.length < 5,
  };
}

/** Compressed Vimsottari of a TP chart (tithi years with SpecialYearForTP). */
export function tpDasa(swe: Sweph, chart: Chart, periodDays: number, levels = 2) {
  const ini = { ...DEFAULTS, ...chart.ini };
  const def = ini.SpecialYearForTP ? 4 : (ini.YearDefinition?.[0] ?? 3);
  const F = periodInYears(swe, chart, periodDays, def);
  return { title: 'Vimsottari Dasa', periods: compressPeriods(vimsottari(chart.positions.grahas.Moon.lon, levels), F / 120), clock: mundaneClock(swe, chart, def), compression: F, yearDefinition: def };
}

export const TP_JOBS: Record<string, AsyncTableFn> = {
  'tithiPravesha.find': async (natal, params, swe) => {
    const sel = params.selection as TPYearSelection | TPDateSelection;
    const year = sel.year ?? natal.birth.year;
    await swe.ensureEphemeris(natal.positions.jdUt + (year - natal.birth.year) * 365.25);
    await swe.ensureEphemeris(natal.positions.jdUt + (year + 2 - natal.birth.year) * 365.25);
    const r = params.mode === 'date' ? tpDateChart(swe, natal, sel as TPDateSelection) : tpYearChart(swe, natal, sel as TPYearSelection);
    const birth = birthAt(swe, natal, r.start);
    const periodDays = r.end - r.start;
    return {
      caption: r.label, headers: ['', 'Start', 'End'],
      rows: [[r.label, whenText(swe, natal, r.start), whenText(swe, natal, r.end)]],
      text: [JSON.stringify({ birth, label: r.label, periodDays })],
    };
  },
  'tithiPravesha.dasa': async (natal, params, swe) => {
    const path = (params.path as number[] | undefined) ?? [];
    const chart = await computeChart(swe, params.birth as BirthData, natal.ini);
    const days = Number(params.periodDays ?? 0);
    const d = tpDasa(swe, chart, days, path.length + 1);
    return dasaTable(swe, chart, d.title, d.periods, d.clock, path, days);
  },
};

export const PRASNA_JOBS: Record<string, AsyncTableFn> = {
  'prasna.find': async (natal, params) => {
    const inp = params as unknown as PrasnaInput;
    const n = Number(inp.n);
    const plag = prasnaLagna(inp.mode, n, natal.ini.D150Preference);
    const replace = inp.replace ?? natal.ini.ReplaceLagnaInPrasna !== 0;
    const label = PRASNA_LABEL[inp.mode](n);
    const birth: BirthData = { ...natal.birth, legacy: null, override: replace ? { ascendant: plag, afterBodies: true } : { prasnaLagna: plag } };
    const periodDays = inp.compress ? prasnaSpanDays(inp.compress) : 0;
    const row = (name: string, lon: number) => [name, formatLongitude(lon), NAKSHATRAS[nakshatraOf(lon)], String(padaOf(lon)), SIGNS[signOf(lon)], SIGNS[signOf(vargaLongitude(lon, vargaSpec('D9', natal.ini)))]];
    return {
      caption: label,
      headers: ['Body', 'Longitude', 'Nakshatra', 'Pada', 'Rasi', 'Navamsa'],
      rows: [row('Prasna Lagna', plag), row(replace ? 'Lagna (natal)' : 'Lagna', natal.positions.ascendant)],
      notes: [replace ? 'Lagna replaced with Prasna Lagna (ReplaceLagnaInPrasna=1).' : 'Prasna Lagna (PLag) shown as a separate body; lagna left as it is.'],
      text: [JSON.stringify({ birth, label, periodDays, plag })],
    };
  },
  'prasna.dasa': async (natal, params, swe) => {
    const path = (params.path as number[] | undefined) ?? [];
    const chart = await computeChart(swe, params.birth as BirthData, natal.ini);
    const days = Number(params.periodDays ?? 0);
    const d = mundaneDasa(swe, chart, days, String(params.label ?? ''), path.length + 1);
    return dasaTable(swe, chart, d.title, d.periods, d.clock, path, days);
  },
};
