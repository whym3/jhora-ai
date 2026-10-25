// The Dasas tab (CDasaView FUN_0044a330 and its menu 108 / buttons) as engine jobs.
//
// The dasa tables ('dasas.nakshatra' / 'dasas.rasi' / 'dasas.other') take, besides params.system
// and params.path (the drill-down indices):
//  - cycle: the dasa cycle shown (the `<` `|` `>` buttons 3/4/5, FUN_0044bff0 / 0x44c070 /
//    0x44c0e0: DAT_0071fbbc -1 / = 0 / +1). FUN_00401c20 starts the maha dasas at the dasa start
//    moved by cycle x the sum of the maha dasa years (0x401e3f..0x401ea4, through the slot's year
//    clock). JHora keeps one value per dasa (FUN_00408d90 saves DAT_0071fbbc into
//    DAT_00597d30[old slot] and loads the new slot's), for the whole session, and FUN_00401820
//    (Locate an event, the other views' "current dasa") moves it until the moment falls inside a
//    maha dasa - why a pane can show a later 120-year cycle;
//  - tribhagi, nakVarga: the session settings of build.ts (Tribhagi 32971, dialog 2055's varga);
//  - overrides: temporary rasi dasa strengths (overrides.ts);
//  - datesOnly: the text of "Copy to clipboard (only dates)" (33236) instead of 32972's;
//  - derived: the derived chart shown (Tajaka etc., see dasaOf).
// Commands of the pane (ASYNC jobs, params as above plus `table`):
//  - 'dasas.locate' (33125, dialog 2041, FUN_00450aa0 -> FUN_00401820): the periods running at a
//    moment down to a level; text[0] = JSON {cycle, path, index};
//  - 'dasas.entry' (32892 "Entry chart of this period", FUN_004505b0): the chart shown cast for
//    the period's start (doc+0x4f370 = a copy with the period start's record, named by the period,
//    opened as the "Period Entry" window 0x89); text[0] = JSON {birth, label, periodDays};
//  - 'dasas.sumLongitudes' (33389, FUN_00451400): the sum of the longitudes of the lords of the
//    periods down to the selected level;
//  - 'dasas.transit' (33269 "Dasa-Transit Correlation", FUN_00451190 + view 0xa0 FUN_004492c0):
//    the periods Jupiter, Saturn, Rahu and Ketu spend in each house from the period's sign;
//  - 'dasas.quickInfo' (Quick Info button 2, FUN_0044be70): caption and description.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { Table } from '../../engine/protocol';
import type { BirthData } from '../jhd';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { computeChart } from '../chart';
import { nakshatraShift, siderealLongitude } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { vargaLongitude } from '../vargas';
import { vargaSpec } from '../vargaOptions';
import { signOf, SIGNS } from '../zodiac';
import { muntha } from '../tajaka/muntha';
import { tajakaCompression } from '../tajaka/mudda';
import { birthAt, computeTajakaChart, type TajakaSelection, type TajakaVariant } from '../tajaka/annual';
import { angularReturn, type AngularReturnInput } from '../derived/angularReturn';
import { antarDasaText, DASA_LEVEL, formatDasaTime, mahaDasaText, periodLabel } from './format';
import { buildDasa } from './build';
import { OTHER_DASAS, RASI_DASAS, type TajakaDasaSeed } from './registry';
import { withOverrides, type StrengthOverrides } from './overrides';
import { JHORA_VARGAS } from './rasiCommon';
import { DASA_DESCRIPTIONS, PARYAAYA_DESCRIPTIONS, quickInfoCaption } from './descriptions';
import { paryaayaDasa } from './paryaaya';
import { compressDasa, DERIVED_KIND_CODE, NAKSHATRA_SLOTS, slotClock, YEAR_DEFINITION_NAMES, type DasaTableId } from './yearDefinition';
import type { DasaClock } from './time';

type TableFn = (chart: Chart, params: Record<string, unknown>, swe?: Sweph) => Table;
type AsyncTableFn = (chart: Chart, params: Record<string, unknown>, swe: Sweph) => Promise<Table>;

/** The derived chart a doc shows (store.ts DerivedChart), passed to the Dasas jobs as params.derived. */
export interface DerivedDasaParams {
  kind: 'tajaka' | 'tithiPravesha' | 'angularReturn' | 'prasna' | 'progression' | 'mundane' | 'entry';
  label: string;
  birth: BirthData;
  /** the form input (Tajaka: selection and variant; others: periodDays = DAT_005922b0) */
  params: Record<string, unknown>;
}


const DASA_DEFAULT: Record<DasaTableId, string> = { 'dasas.nakshatra': 'Vimsottari', 'dasas.rasi': 'Narayana', 'dasas.other': 'Moola' };
export function dasaSystem(table: DasaTableId, params: Record<string, unknown>): string {
  const s = String(params.system ?? DASA_DEFAULT[table]);
  const known = table === 'dasas.nakshatra' ? (NAKSHATRA_SLOTS as readonly string[]).includes(s) : s in (table === 'dasas.rasi' ? RASI_DASAS : OTHER_DASAS);
  return known ? s : DASA_DEFAULT[table];
}

/** A dasa built and timed for the pane: maha dasas (cycle applied), the clock and the chart timed from. */
export interface PaneDasa {
  slot: number;
  title: string;
  periods: Period[];
  drill: boolean;
  clock: DasaClock;
  /** the chart the dasa is built on and timed from (obj+0x77410) */
  chart: Chart;
  notes?: string[];
}

/** Shift period times by `dt` dasa years, recursively. */
function shifted(ps: Period[], dt: number): Period[] {
  return dt ? ps.map((p) => ({ ...p, start: p.start + dt, end: p.end + dt, children: p.children && shifted(p.children, dt) })) : ps;
}

/** FUN_00401c20's cycle offset: cycle x the sum of the maha dasa years. */
export function withCycle(periods: Period[], cycle: number): Period[] {
  if (!cycle) return periods;
  const total = periods.reduce((a, p) => a + (p.end - p.start), 0);
  return shifted(periods, cycle * total);
}

const nakShiftOf = (swe: Sweph | undefined, c: Chart) => (swe ? nakshatraShift(swe, c.positions.jdUt, calcSettingsFromIni(c.ini)) : 0);

function buildOpts(params: Record<string, unknown>, swe: Sweph | undefined, chart: Chart) {
  return {
    tribhagi: !!params.tribhagi,
    nakVarga: Number(params.nakVarga ?? 0) || undefined,
    nakShift: nakShiftOf(swe, chart) || undefined,
  };
}

/** The dasa of a chart whose dasas are not compressed (natal, progressed): YearDefinition[slot] years. */
export function natalPaneDasa(chart: Chart, table: DasaTableId, params: Record<string, unknown>, swe: Sweph): PaneDasa {
  const path = (params.path as number[] | undefined) ?? [];
  const c = withOverrides(chart, params.overrides as StrengthOverrides | undefined);
  const d = buildDasa(c, table, dasaSystem(table, params), path.length + 1, buildOpts(params, swe, chart));
  return { slot: d.slot, title: d.title, periods: withCycle(d.periods, Number(params.cycle ?? 0)), drill: d.drill, clock: slotClock(swe, chart, d.slot), chart };
}

/**
 * The dasa with a derived chart shown; the job runs on the NATAL chart (FUN_00408d90):
 *  - progressed charts (kind 4, and the transit kind 3) and the period entry chart show the
 *    natal chart's dasas, uncompressed (doc+0x76d00 is pointed back at doc+0x50 around the builder);
 *  - Tajaka (1), Tithi Pravesha (2), mundane / angular return (5) and prasna charts with
 *    "Compress dasas" (6) build every dasa on the derived chart (Tajaka seeds per build.ts /
 *    registry.ts) and compress it into the chart's period (yearDefinition.ts compressDasa), timed
 *    from the derived chart with the compressed year definition.
 */
export async function paneDasa(natal: Chart, table: DasaTableId, params: Record<string, unknown>, swe: Sweph): Promise<PaneDasa> {
  const d = params.derived as DerivedDasaParams | undefined;
  if (!d || d.kind === 'progression' || d.kind === 'entry') return natalPaneDasa(natal, table, params, swe);
  const path = (params.path as number[] | undefined) ?? [];
  const system = dasaSystem(table, params);
  let chart: Chart, periodDays: number, years: number | undefined;
  let tajaka: TajakaDasaSeed | undefined;
  if (d.kind === 'tajaka') {
    const p = d.params as { selection: TajakaSelection; variant?: TajakaVariant };
    const t = await computeTajakaChart(swe, natal, p.selection, p.variant ?? 'exact');
    chart = t.chart;
    periodDays = t.end - t.start;
    years = tajakaCompression(swe, t);
    tajaka = { natal, years: t.period.years, munthaIn: muntha(natal, t.period).signIn };
  } else {
    chart = await computeChart(swe, d.birth, natal.ini);
    periodDays = Number(d.params.periodDays ?? 0);
    if (d.kind === 'angularReturn' && !periodDays) {
      const r = angularReturn(swe, natal, d.params as unknown as AngularReturnInput);
      periodDays = r.end - r.start;
    }
  }
  const compressed = periodDays > 0;
  const c = withOverrides(chart, params.overrides as StrengthOverrides | undefined);
  const b = buildDasa(c, table, system, path.length + 1, { compressed, tajaka, ...buildOpts(params, swe, chart), natalNakShift: tajaka ? nakShiftOf(swe, natal) || undefined : undefined });
  const cycle = Number(params.cycle ?? 0);
  if (!compressed) return { slot: b.slot, title: b.title, periods: withCycle(b.periods, cycle), drill: b.drill, clock: slotClock(swe, chart, b.slot), chart };
  const z = compressDasa(swe, chart, b.slot, b.periods, { periodDays, kindCode: DERIVED_KIND_CODE[d.kind], label: d.label, years });
  return {
    slot: b.slot, title: b.title, periods: withCycle(z.periods, cycle), drill: b.drill, clock: z.clock, chart,
    notes: [`${d.label}: compressed into ${periodDays.toFixed(2)} days = ${z.F.toFixed(4)} years (${YEAR_DEFINITION_NAMES[z.def] ?? z.def}), maha dasa years x ${z.F.toFixed(4)} / ${z.total}`],
  };
}

/** The periods under `path` and the parent period. */
export function periodsAt(mds: Period[], path: number[]): { list: Period[]; parents: Period[] } {
  let list = mds; const parents: Period[] = [];
  for (const i of path) { const p = list[i]; if (!p) break; parents.push(p); list = p.children ?? []; }
  return { list, parents };
}

/** A dasa level as a table: the periods under `path`, with JHora's copy text for the top two levels. */
export function dasaTable(d: PaneDasa, path: number[], swe: Sweph, datesOnly = false): Table {
  const ctx = { clock: d.clock, tz: d.chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
  const { list, parents } = periodsAt(d.periods, path);
  const parent = parents[parents.length - 1] ?? null;
  const when = (y: number) => formatDasaTime(ctx.clock.toJd(y), ctx.tz, ctx.revjul);
  return {
    caption: parent ? `${periodLabel(parent)}: ${when(parent.start)} - ${when(parent.end)}` : d.title,
    headers: [DASA_LEVEL[path.length] ?? 'Periods', 'Start', 'End'],
    rows: list.map((q) => [periodLabel(q), when(q.start), when(q.end)]),
    text: !parent ? mahaDasaText(d.title, d.periods, ctx, datesOnly) : path.length === 1 ? antarDasaText(d.title, parent, ctx, datesOnly) : undefined,
    drill: d.drill,
    ...(d.notes ? { notes: d.notes } : {}),
  };
}

/** Load the ephemeris over the periods shown (the cycle can move them far from the chart). */
async function ensurePeriods(swe: Sweph, d: PaneDasa) {
  const first = d.periods[0], last = d.periods[d.periods.length - 1];
  if (!first) return;
  for (const y of [first.start, last.end]) await swe.ensureEphemeris(d.chart.positions.jdUt + y * 365.25);
}

/** The synchronous dasa tables (no derived chart; the worker runs the async ones first). */
function syncDasaTable(table: DasaTableId): TableFn {
  return (chart, params, swe) => {
    if (!swe) throw new Error('dasa tables need the ephemeris');
    if (params.derived) throw new Error('a derived chart needs the asynchronous dasa job');
    return dasaTable(natalPaneDasa(chart, table, params, swe), (params.path as number[] | undefined) ?? [], swe, !!params.datesOnly);
  };
}

function asyncDasaTable(table: DasaTableId): AsyncTableFn {
  return async (natal, params, swe) => {
    const d = await paneDasa(natal, table, params, swe);
    // the clock is only read when the table is formatted
    if (params.cycle) await ensurePeriods(swe, d);
    return dasaTable(d, (params.path as number[] | undefined) ?? [], swe, !!params.datesOnly);
  };
}

export const DASA_TABLES: Record<string, TableFn> = {
  'dasas.nakshatra': syncDasaTable('dasas.nakshatra'),
  'dasas.rasi': syncDasaTable('dasas.rasi'),
  'dasas.other': syncDasaTable('dasas.other'),
};

// ---------------------------------------------------------------- commands

const tableOf = (params: Record<string, unknown>): DasaTableId => {
  const t = String(params.table ?? 'dasas.nakshatra');
  if (t !== 'dasas.nakshatra' && t !== 'dasas.rasi' && t !== 'dasas.other') throw new Error(`unknown dasa table ${t}`);
  return t;
};

/** The selected period: the row `index` of the list under `path` (else the last parent). */
function selected(d: PaneDasa, path: number[], index?: number): { period: Period; chain: Period[] } {
  const { list, parents } = periodsAt(d.periods, path);
  const row = index !== undefined ? list[index] : undefined;
  const chain = row ? [...parents, row] : parents;
  const period = chain[chain.length - 1];
  if (!period) throw new Error('select a period first');
  return { period, chain };
}

export interface LocateInput {
  /** the event's date and local time (hours) in time zone tz (hours east) */
  year: number; month: number; day: number; hour: number; tz: number;
  /** 0 = maha dasa .. levels below */
  level: number;
}

/**
 * FUN_00401820(moment, level): for each level the period holding the moment (FUN_004b27d0:
 * start <= moment < end); when no maha dasa holds it, the cycle moves one step towards it
 * (moment before the first maha dasa: DAT_0071fbbc - 1, else + 1) and the search restarts.
 */
export async function locateEvent(natal: Chart, table: DasaTableId, params: Record<string, unknown>, swe: Sweph, at: LocateInput) {
  const jd = swe.julday(at.year, at.month, at.day, at.hour - at.tz);
  let cycle = Number(params.cycle ?? 0);
  const level = Math.max(0, Math.min(5, at.level));
  for (let tries = 0; tries < 200; tries++) {
    const d = await paneDasa(natal, table, { ...params, cycle, path: new Array(level).fill(0) }, swe);
    await ensurePeriods(swe, d);
    const t = (y: number) => d.clock.toJd(y);
    const i = d.periods.findIndex((p) => t(p.start) <= jd && jd < t(p.end));
    if (i < 0) {
      if (!d.periods.length) break;
      cycle += jd < t(d.periods[0].start) ? -1 : 1;
      continue;
    }
    // the sub-periods down to `level` were built with the maha dasas
    const indices = [i];
    for (let k = 1; k <= level; k++) {
      const { list } = periodsAt(d.periods, indices);
      const j = list.findIndex((p) => t(p.start) <= jd && jd < t(p.end));
      if (j < 0) break;
      indices.push(j);
    }
    return { cycle, path: indices.slice(0, -1), index: indices[indices.length - 1], indices, dasa: d };
  }
  throw new Error('the moment is outside the dasa cycles');
}

/** FUN_004c1980-style "%2d %s %02d' %05.2f\"" of a longitude. */
export function sumLongitudeText(lon: number): string {
  const x = ((lon % 360) + 360) % 360;
  const sign = Math.floor(x / 30);
  let r = x - sign * 30;
  const d = Math.floor(r); r = (r - d) * 60;
  const m = Math.floor(r);
  const s = (r - m) * 60;
  return `${String(d).padStart(2)} ${SIGNS[sign]} ${String(m).padStart(2, '0')}' ${s.toFixed(2).padStart(5, '0')}"`;
}

/**
 * FUN_00451400: in a dasa of planets (obj+0x76d49) the longitudes of the lords of the drill-down
 * path (doc+0xa12f4) and of the clicked period, taken from FUN_004a1260(DAT_00597ed8) (the nakshatra
 * dasa varga), with 360 - longitude for Rahu and Ketu (owners >= 8), are added up.
 */
export function sumOfLongitudes(chart: Chart, lords: Graha[], nakVarga = 0): number {
  const name = nakVarga ? JHORA_VARGAS[nakVarga] : null;
  const spec = name ? vargaSpec(name, chart.ini) : null;
  return lords.reduce((a, g) => {
    const lon = spec ? vargaLongitude(chart.positions.grahas[g].lon, spec) : chart.positions.grahas[g].lon;
    return a + (g === 'Rahu' || g === 'Ketu' ? 360 - lon : lon);
  }, 0);
}

export const SUM_UNAVAILABLE = 'Available only in dasas of planets, such as Vimsottari dasa, Ashtottari dasa, Yogini dasa etc.';

/** The sign a period stands for (FUN_00451190): its rasi, or its lord's D-1 sign. */
export function periodSign(chart: Chart, p: Period): number {
  const label = p.label ?? '';
  const first = label.split(' ')[0];
  const i = (SIGNS as readonly string[]).indexOf(first);
  if (i >= 0) return i;
  return signOf(chart.positions.grahas[p.lord].lon);
}

const TRANSIT_PLANETS: Graha[] = ['Jupiter', 'Saturn', 'Rahu', 'Ketu'];
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

/** Sign changes of a body within [jd0, jd1]: daily steps refined to a minute. */
function signIntervals(swe: Sweph, chart: Chart, body: Graha, jd0: number, jd1: number): { sign: number; from: number; to: number }[] {
  const s = calcSettingsFromIni(chart.ini);
  const sg = (jd: number) => Math.floor(siderealLongitude(swe, jd, body, s).lon / 30);
  const out: { sign: number; from: number; to: number }[] = [];
  let a = jd0, cur = sg(jd0), start = jd0;
  for (let jd = jd0 + 1; ; jd = Math.min(jd + 1, jd1)) {
    const now = sg(jd);
    if (now !== cur) {
      let lo = a, hi = jd;
      while (hi - lo > 1 / 1440) { const mid = (lo + hi) / 2; if (sg(mid) === cur) lo = mid; else hi = mid; }
      out.push({ sign: cur, from: start, to: hi });
      cur = now; start = hi;
    }
    a = jd;
    if (jd >= jd1) break;
  }
  out.push({ sign: cur, from: start, to: jd1 });
  return out;
}

function ymd(swe: Sweph, jd: number, tz: number) {
  const r = swe.revjul(jd + tz / 24);
  return `${String(r.year).padStart(4, '0')}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
}

export const DASA_ASYNC_JOBS: Record<string, AsyncTableFn> = {
  'dasas.nakshatra': asyncDasaTable('dasas.nakshatra'),
  'dasas.rasi': asyncDasaTable('dasas.rasi'),
  'dasas.other': asyncDasaTable('dasas.other'),

  'dasas.locate': async (natal, params, swe) => {
    const r = await locateEvent(natal, tableOf(params), params, swe, params.at as LocateInput);
    const d = await paneDasa(natal, tableOf(params), { ...params, cycle: r.cycle, path: r.indices.slice(0, -1) }, swe);
    const ctx = { tz: d.chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
    let list = d.periods;
    const rows = r.indices.map((i, k) => {
      const p = list[i]; list = p.children ?? [];
      return [DASA_LEVEL[k], periodLabel(p), formatDasaTime(d.clock.toJd(p.start), ctx.tz, ctx.revjul), formatDasaTime(d.clock.toJd(p.end), ctx.tz, ctx.revjul)];
    });
    return { caption: d.title, headers: ['Level', 'Period', 'Start', 'End'], rows, text: [JSON.stringify({ cycle: r.cycle, path: r.path, index: r.index })] };
  },

  'dasas.entry': async (natal, params, swe) => {
    const d = await paneDasa(natal, tableOf(params), params, swe);
    const { period, chain } = selected(d, (params.path as number[]) ?? [], params.index as number | undefined);
    const start = d.clock.toJd(period.start), end = d.clock.toJd(period.end);
    const label = chain.map(periodLabel).join('/');
    const birth = birthAt(swe, d.chart, start);
    const when = (jd: number) => formatDasaTime(jd, d.chart.birth.tzHours, (x) => swe.revjul(x));
    return {
      caption: `Period Entry: ${label}`, headers: ['Period', 'Start', 'End'], rows: [[label, when(start), when(end)]],
      text: [JSON.stringify({ birth, label: `Period Entry: ${label}`, periodDays: end - start })],
    };
  },

  'dasas.sumLongitudes': async (natal, params, swe) => {
    const d = await paneDasa(natal, tableOf(params), params, swe);
    const planets = tableOf(params) !== 'dasas.rasi' && d.periods.every((p) => p.label === undefined || !!params.tribhagi);
    if (!planets) return { caption: 'Sum of Longitudes', headers: [''], rows: [[SUM_UNAVAILABLE]], text: [SUM_UNAVAILABLE] };
    const { chain } = selected(d, (params.path as number[]) ?? [], params.index as number | undefined);
    const lon = sumOfLongitudes(d.chart, chain.map((p) => p.lord), Number(params.nakVarga ?? 0));
    const msg = `Sum of longitudes of planets upto selected level is ${sumLongitudeText(lon)}.`;
    return { caption: 'Sum of Longitudes', headers: [''], rows: [[msg]], text: [msg] };
  },

  'dasas.transit': async (natal, params, swe) => {
    const d = await paneDasa(natal, tableOf(params), params, swe);
    const { period, chain } = selected(d, (params.path as number[]) ?? [], params.index as number | undefined);
    const jd0 = d.clock.toJd(period.start), jd1 = d.clock.toJd(period.end);
    await swe.ensureEphemeris(jd0); await swe.ensureEphemeris(jd1);
    const sign = periodSign(d.chart, period);
    const tz = d.chart.birth.tzHours;
    const label = chain.map(periodLabel).join('/');
    const spans = TRANSIT_PLANETS.map((g) => signIntervals(swe, d.chart, g, jd0, jd1));
    const rows: string[][] = [];
    for (let h = 0; h < 12; h++) {
      const s = (sign + h) % 12;
      TRANSIT_PLANETS.forEach((g, k) => {
        for (const iv of spans[k].filter((x) => x.sign === s)) rows.push([ORD[h], SIGNS[s], g, ymd(swe, iv.from, tz), ymd(swe, iv.to, tz)]);
      });
    }
    return {
      caption: `Transits from ${SIGNS[sign]} during ${label}: From ${ymd(swe, jd0, tz)} to ${ymd(swe, jd1, tz)}`,
      headers: ['House', 'Sign', 'Planet', 'From', 'To'], rows,
    };
  },

  'dasas.quickInfo': async (natal, params, swe) => {
    const table = tableOf(params);
    const d = await paneDasa(natal, table, { ...params, path: [] }, swe);
    let text = DASA_DESCRIPTIONS[d.slot] ?? '';
    if (d.slot === 37) {
      const kind = paryaayaDasa(d.chart, 1, d.chart.ini.ParyaayaDasaChart ?? 6).kind;
      text = PARYAAYA_DESCRIPTIONS[kind === 'Ubhaya' ? 0 : kind === 'Sthira' ? 1 : 2];
    }
    const caption = quickInfoCaption(d.title);
    return { caption, headers: [''], rows: [[text]], text: [caption, text] };
  },
};
