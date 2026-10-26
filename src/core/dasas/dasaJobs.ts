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
//    maha dasa - why a pane can show a later 120-year cycle. The buttons stop at the years
//    -5255 / 5255 (format.ts canStepCycle);
//  - tribhagi, nakVarga: the session settings of build.ts (Tribhagi 32971, dialog 2055's varga);
//  - overrides: temporary rasi dasa strengths (overrides.ts);
//  - shift: "Shift dasa dates" (33196) in days (shiftedClock), noted under the title;
//  - narayanaKind, shoolaFromHouse, tithiSeed, rbvVarga, rasiVarga, charaSeed: the Options dialogs' session globals
//    (registry.ts DasaOptions);
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
//  - 'dasas.transit' (33269 "Dasa-Transit Correlation", FUN_00451190 + CDasaSignTransitView 0xa0,
//    FUN_004492c0 / draw FUN_00448a70 / copy FUN_00449b10): the stays of Jupiter, Saturn, Rahu and
//    Ketu in each house from the period's sign (dasaTransits); rows house | sign | planet | from |
//    to ("None" | "" for a planet without a stay), text = JHora's copy text;
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
import { compressDasa, DERIVED_KIND_CODE, NAKSHATRA_SLOTS, slotClock, slotYear, yearClock, YEAR_DEFINITION_NAMES, type DasaTableId } from './yearDefinition';
import type { DasaClock } from './time';
import type { DasaOptions } from './registry';
import type { NarayanaKind } from './narayana';
import type { TithiSeedOptions } from './tithiAshtottari';
import type { CharaSeed } from './charaParasara';

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

function buildOpts(params: Record<string, unknown>, swe: Sweph | undefined, chart: Chart): DasaOptions {
  return {
    tribhagi: !!params.tribhagi,
    nakVarga: Number(params.nakVarga ?? 0) || undefined,
    nakShift: nakShiftOf(swe, chart) || undefined,
    // the session globals of the Options dialogs (registry.ts DasaOptions)
    ...(params.narayanaKind ? { narayanaKind: Number(params.narayanaKind) as NarayanaKind } : {}),
    ...(params.shoolaFromHouse ? { shoolaFromHouse: Number(params.shoolaFromHouse) } : {}),
    ...(params.tithiSeed ? { tithiSeed: params.tithiSeed as TithiSeedOptions } : {}),
    ...(params.rbvVarga ? { rbvVarga: Number(params.rbvVarga) } : {}),
    ...(params.rasiVarga ? { rasiVarga: Number(params.rasiVarga) } : {}),
    ...(params.charaSeed ? { charaSeed: Number(params.charaSeed) as CharaSeed } : {}),
  };
}

// ---------------------------------------------------------------- Shift dasa dates

/**
 * "Shift dasa dates" (33196, FUN_00450e00, dialog 2050 "Enter the dasa shift amount": combo 1003
 * "No shift" / "Add" / "Subtract", Days / Hours / Minutes): per dasa slot DAT_008a1af0[slot] (on)
 * and DAT_008a1898[slot] (days + (hours + minutes / 60) / 24, negative to subtract), session
 * globals cleared for every slot when a chart is opened or recalculated (0x402bec, 0x4037d8).
 * FUN_00401c20 moves the dasa start record (the birth moved back by the first dasa's balance)
 * by that many days (FUN_0049e630, 0x401df7) before the cycle offset; every period is then
 * counted in the slot's years from the moved record. Here: params.shift (days).
 */
export function shiftedClock(swe: Sweph, chart: Chart, def: number, len: number, clock: DasaClock, startYears: number, days: number): DasaClock {
  if (!days) return clock;
  // fixed-length years: every date moves by the shift
  if (def !== 3 && def !== 4 && def !== 5 && def !== 7) return { toJd: (y) => clock.toJd(y) + days };
  // the other years are found from the record's Sun / Moon (FUN_0049dae0 on the moved record)
  const jd = clock.toJd(startYears) + days;
  const s = calcSettingsFromIni(chart.ini);
  const g = chart.positions.grahas;
  const moved: Chart = {
    ...chart,
    positions: {
      ...chart.positions, jdUt: jd,
      grahas: { ...g, Sun: { ...g.Sun, lon: siderealLongitude(swe, jd, 'Sun', s).lon }, Moon: { ...g.Moon, lon: siderealLongitude(swe, jd, 'Moon', s).lon } },
    },
  };
  const anchored = yearClock(swe, moved, def, len);
  return { toJd: (y) => anchored.toJd(y - startYears) };
}

/** CDasaView's line under the title (0x44a867): "Shift:" " %d days" " %d hrs" " %d min" " (back)" / " (forward)". */
export function shiftNote(days: number): string {
  const a = Math.abs(days);
  const d = Math.trunc(a);
  // FUN_004c1b00 on the hours: whole hours and minutes, a minute within 0.0001" of the next rounded up
  const hours = (a - d) * 24;
  let h = Math.trunc(hours);
  let m = Math.trunc((hours - h) * 60);
  if (60 - ((hours - h) * 60 - m) * 60 < 0.0001) { m += 1; if (m === 60) { m = 0; h += 1; } }
  return `Shift:${d ? ` ${d} days` : ''}${h ? ` ${h} hrs` : ''}${m ? ` ${m} min` : ''}${days < 0 ? ' (back)' : ' (forward)'}`;
}

/** The dasa of a chart whose dasas are not compressed (natal, progressed): YearDefinition[slot] years. */
export function natalPaneDasa(chart: Chart, table: DasaTableId, params: Record<string, unknown>, swe: Sweph): PaneDasa {
  const path = (params.path as number[] | undefined) ?? [];
  const c = withOverrides(chart, params.overrides as StrengthOverrides | undefined);
  const d = buildDasa(c, table, dasaSystem(table, params), path.length + 1, buildOpts(params, swe, chart));
  const shift = Number(params.shift ?? 0);
  const { def, len } = slotYear(chart.ini, d.slot);
  const clock = shiftedClock(swe, chart, def, len, slotClock(swe, chart, d.slot), d.periods[0]?.start ?? 0, shift);
  return {
    slot: d.slot, title: d.title, periods: withCycle(d.periods, Number(params.cycle ?? 0)), drill: d.drill, clock, chart,
    ...(shift ? { notes: [shiftNote(shift)] } : {}),
  };
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
  const shift = Number(params.shift ?? 0);
  const shiftNotes = shift ? [shiftNote(shift)] : [];
  if (!compressed) {
    const { def, len } = slotYear(chart.ini, b.slot);
    const clock = shiftedClock(swe, chart, def, len, slotClock(swe, chart, b.slot), b.periods[0]?.start ?? 0, shift);
    return { slot: b.slot, title: b.title, periods: withCycle(b.periods, cycle), drill: b.drill, clock, chart, ...(shift ? { notes: shiftNotes } : {}) };
  }
  const z = compressDasa(swe, chart, b.slot, b.periods, { periodDays, kindCode: DERIVED_KIND_CODE[d.kind], label: d.label, years });
  // (a shifted compressed dasa: the dates move by the shift, as with fixed-length years)
  const zClock: DasaClock = shift ? { toJd: (y) => z.clock.toJd(y) + shift } : z.clock;
  return {
    slot: b.slot, title: b.title, periods: withCycle(z.periods, cycle), drill: b.drill, clock: zClock, chart,
    notes: [`${d.label}: compressed into ${periodDays.toFixed(2)} days = ${z.F.toFixed(4)} years (${YEAR_DEFINITION_NAMES[z.def] ?? z.def}), maha dasa years x ${z.F.toFixed(4)} / ${z.total}`, ...shiftNotes],
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

/**
 * The sign a period stands for (FUN_00451190): the period record's sign (+0x9f128 = 0, +0x9f12c),
 * or for a planet (+0x9f128 = 1) its D-1 sign (chart+0x17d7 + 0x1d * body); with custom owner
 * names (obj+0x76d48, Tribhagi Vimsottari) FUN_00451000 reads the label's first word instead.
 */
export function periodSign(chart: Chart, p: Period): number {
  const label = p.label ?? '';
  const first = label.split(' ')[0];
  const i = (SIGNS as readonly string[]).indexOf(first);
  if (i >= 0) return i;
  return signOf(chart.positions.grahas[p.lord].lon);
}

/** The planets of FUN_004492c0's table (JHora bodies 5, 7, 8, 9; the second half 1, 3, 4, 6 is unused). */
export const TRANSIT_PLANETS: Graha[] = ['Jupiter', 'Saturn', 'Rahu', 'Ketu'];
/** House names (the CString table 0x8a2718). */
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
/** The level suffixes FUN_0044ed00 appends to the right-clicked row's label (0x5743ac.. 0x574390). */
const LEVEL_SUFFIX = [' MD', ' AD', ' PD', ' SD', ' PAD', ' DAD'];
const SECOND = 1 / 86400;
/** 1/1440 day (0x54a238): FUN_004492c0 restarts the search a minute after an exit. */
const MINUTE = 1 / 1440;

/**
 * FUN_0049eae0(body, sign, backward = 0, &entry, &exit): from the moment t0 the next entry of a
 * body into a sign and its exit from it. The body's sign (FUN_0049aaa0 without the Ketu flip,
 * so Ketu searches Rahu in the 7th sign; FUN_004c1980's sign is floor(longitude / 30)) is
 * tested in steps of 10 days (1/12 day for the lagna, 3 days for the Moon) until it is the sign,
 * then the step is halved down to a second (the entry is t0 itself when the body is there
 * already); the exit is found the same way from the entry. `limit`: the entry search stops (with
 * no result) once a stepped moment outside the sign lies beyond it - JHora searches on, but then
 * finds an entry FUN_004492c0 discards.
 */
export function nextSignTransit(sg: (jd: number) => number, ketu: boolean, sign: number, t0: number, limit = Infinity): { entry: number; exit: number } | null {
  const target = ketu ? (sign + 6) % 12 : sign;
  const STEP = 10;
  let t = t0, prev = t0 - SECOND;
  while (sg(t) !== target) {
    if (t > limit) return null;
    prev = t; t += STEP;
  }
  while (Math.abs(t - prev) > SECOND) {
    const mid = (prev + t) * 0.5;
    if (sg(mid) === target) t = mid; else prev = mid;
  }
  const entry = t;
  while (sg(t) === target) { prev = t; t += STEP; }
  while (Math.abs(t - prev) > SECOND) {
    const mid = (prev + t) * 0.5;
    if (sg(mid) !== target) t = mid; else prev = mid;
  }
  return { entry, exit: t };
}

export interface DasaTransitHouse {
  sign: number;
  /** per TRANSIT_PLANETS: the [entry, exit] moments (UT JD) */
  spans: [number, number][][];
}

/**
 * FUN_004492c0 (run by the view's first OnDraw, FUN_00448a70, under " W A I T "): for the
 * houses 1..12 counted from `sign` (DAT_0071fac8) and Jupiter, Saturn, Rahu, Ketu, the stays
 * found by FUN_0049eae0 from the period start on: each search starts a minute after the
 * previous exit, an entry after the period end ends the list and an exit after it is cut to
 * the period end (an entry before the period start is the start itself). Tables DAT_0065c968 /
 * DAT_00664b68 hold the entry / exit dates (0x68-byte records from FUN_0049d250, 40 per planet),
 * DAT_0065c940 the counts.
 */
export function dasaTransits(swe: Sweph, chart: Chart, sign: number, jd0: number, jd1: number): DasaTransitHouse[] {
  const s = calcSettingsFromIni(chart.ini);
  const rahu = (jd: number) => Math.floor(siderealLongitude(swe, jd, 'Rahu', s).lon / 30);
  const sgOf = (g: Graha) => (g === 'Ketu' ? rahu : (jd: number) => Math.floor(siderealLongitude(swe, jd, g, s).lon / 30));
  return Array.from({ length: 12 }, (_, h) => {
    const house = (sign + h) % 12;
    const spans = TRANSIT_PLANETS.map((g) => {
      const sg = sgOf(g);
      const out: [number, number][] = [];
      let t = jd0;
      for (;;) {
        const r = nextSignTransit(sg, g === 'Ketu', house, t, jd1);
        if (!r || r.entry > jd1) break;
        const exit = Math.min(r.exit, jd1);
        out.push([r.entry, exit]);
        t = exit + MINUTE;
      }
      return out;
    });
    return { sign: house, spans };
  });
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
    // (an exit search runs past the period end: Saturn can stay 2.5 years)
    for (const jd of [jd0, jd1, jd1 + 1000]) await swe.ensureEphemeris(jd);
    const sign = periodSign(d.chart, period);
    const tz = d.chart.birth.tzHours;
    // FUN_0044ed00: the drill-down labels joined by "-", then the clicked row's with its level suffix
    const path = (params.path as number[]) ?? [];
    const label = chain.map(periodLabel).join('-') + (chain.length > path.length ? LEVEL_SUFFIX[path.length] ?? '' : '');
    const houses = dasaTransits(swe, d.chart, sign, jd0, jd1);
    const rows: string[][] = [];
    // FUN_00449b10 (the view's copy text): per house "\nTransits in %s house from %s during %s:\n",
    // per planet "\n  %s\n" and "    From %04d-%02d-%02d to %04d-%02d-%02d\n" or "    None\n"
    const text: string[] = [];
    houses.forEach((h, i) => {
      text.push('', `Transits in ${ORD[i]} house from ${SIGNS[sign]} during ${label}:`);
      TRANSIT_PLANETS.forEach((g, k) => {
        text.push('', `  ${g}`);
        for (const [a, b] of h.spans[k]) {
          rows.push([ORD[i], SIGNS[h.sign], g, ymd(swe, a, tz), ymd(swe, b, tz)]);
          text.push(`    From ${ymd(swe, a, tz)} to ${ymd(swe, b, tz)}`);
        }
        if (!h.spans[k].length) { rows.push([ORD[i], SIGNS[h.sign], g, 'None', '']); text.push('    None'); }
      });
    });
    return { caption: `Transits from ${SIGNS[sign]} during ${label}`, headers: ['House', 'Sign', 'Planet', 'From', 'To'], rows, text };
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
