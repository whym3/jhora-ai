// Table and text jobs: the registry grows as features are ported. Each table id
// matches a JHora view (the tab/mode it appears in) and its headers match JHora's.
import type { Chart } from '../core/chart';
import type { Sweph } from '../sweph';
import type { Period } from '../core/dasas/vimsottari';
import { narayanaDasa } from '../core/dasas/narayana';
import { OTHER_DASAS, RASI_DASAS, type TajakaDasaSeed } from '../core/dasas/registry';
import { dasaClock } from '../core/dasas/time';
import { buildDasa } from '../core/dasas/build';
import { compressDasa, DERIVED_KIND_CODE, NAKSHATRA_SLOTS, slotClock, YEAR_DEFINITION_NAMES, type DasaTableId } from '../core/dasas/yearDefinition';
import { computeChart } from '../core/chart';
import type { BirthData } from '../core/jhd';
import { muntha } from '../core/tajaka/muntha';
import { angularReturn, type AngularReturnInput } from '../core/derived/angularReturn';
import { antarDasaText, formatDasaTime, mahaDasaText, periodLabel } from '../core/dasas/format';
import { GRAHAS } from '../core/positions';
import { formatLongitude, formatVargaLongitude, NAK28, nakshatra28Of, NAKSHATRAS, signOf, SIGNS } from '../core/zodiac';
import { vargaLongitude, type VargaName } from '../core/vargas';
import { vargaColumnLabel, vargasOf } from '../core/vargaOptions';
import { charaKarakas, drekkanaType, grahaYuddha, isCombust, maliciousLordLabel, nakshatraAspects, navaTaras, ORDINAL, SHORT, specialTaras, specialTithis, yogiPoints } from '../core/basics';
import { kpLords } from '../core/kp';
import { houseOptions, houseRows, KP_LEVEL_HEADERS, kpOccupants, kpPoints } from '../core/kpHouses';
import { defaultOtherIsGroom, MATCH_TITLE, matchHoroscopes, nakshatraPada } from '../core/matching';
import { varnada } from '../core/bodies';
import { norm360, type Graha } from '../core/positions';
import type { NamedBody } from '../core/longitudes';
import { bhavaArudha, grahaArudha, signArudha, type ArudhaOptions } from '../core/arudhas';
import { sahamas } from '../core/sahamas';
import { brahmaRudraMaheswara } from '../core/deities';
import { computeShadbala, type Seven } from '../core/shadbala';
import { vimsopaka } from '../core/vimsopaka';
import { AGES, ALERTNESS, avasthaVargaLabel, basicAvasthas, HARSHA_CLASSES, INTENSITY, MOODS, PANCHA_CLASSES, SAYANADI, sayanadiAvasthas, tajakaBalas, VAISESHIKAMSA_GROUPS, vaiseshikamsaCells } from '../core/otherStrengths';
import { AV_BODIES, ashtakavarga, avOptionsFromIni, pindaNakshatras, prastara, shiftLagna, type AvBody } from '../core/ashtakavarga';
import { SEVEN } from '../core/relations';
import { findYogas, giversText, YOGA_MODES } from '../core/yogas';
import { aspectPercent } from '../core/aspects';
import { birthAt, computeTajakaChart, tajakaWindow, type TajakaSelection, type TajakaVariant } from '../core/tajaka/annual';
import { muddaDasa, tajakaCompression } from '../core/tajaka/mudda';
import { formatSpan, signChange } from '../core/signChange';
import { compoundRelation } from '../core/relations';
import { SIGN_LORD } from '../core/lords';
import { DEBILITATION, EXALTATION } from '../core/signStrength';
import { MOOLATRIKONA } from '../core/deities';
import { fromMrityuBhaga, fromPushkaraBhaga, inPushkaramsa, MRITYU_BHAGA, within } from '../core/pushkara';
import type { VargaCtx } from '../core/signStrength';
import { keyInfoText } from '../core/keyInfo';
import { BASICS_JOBS, jhoraBody, keyInfoBodies } from '../core/basicsJobs';
import { CHART_JOBS } from '../core/chartJobs';
import { BODY_GROUPS } from '../core/basics';
import { CALC_TEXTS } from '../core/format/calcsText';
import { cFixed } from '../core/format/cfixed';
import type { Table } from './protocol';
import { MUNDANE_JOBS } from '../core/derived/mundaneJobs';
import { ANGULAR_JOBS, PROGRESSION_JOBS } from '../core/derived/progressionJobs';
import { LAGHU_TABLES, PANCHANGA_JOBS } from '../core/derived/panchangaJobs';
import { PRASNA_JOBS, TP_JOBS } from '../core/derived/tpPrasnaJobs';
import { TRANSIT_JOBS } from '../core/transits/jobs';
import { strengthBarGraphs, type BarGraph } from '../core/strengthGraphs';
import { OPTION_ASYNC_JOBS } from './optionJobs';
import { bhavaArudhaOptions, bhavaArudhaSigns } from '../core/arudhaPadas';
import { applyNodalExaltation } from '../core/signStrength';
import { DASA_ASYNC_JOBS, DASA_TABLES } from '../core/dasas/dasaJobs';

const yes = (b: boolean) => (b ? 'Yes' : '-');

/** Strengths > Ashtakavarga modes (menu 106, 32829-32842). */
const AV_MODES = ['BAVs and SAV', 'SoAV', ...AV_BODIES.slice(1).map((b) => `PAV of ${b}`), 'PAV of Lagna', 'Sodhya pindas', 'Nakshatras & rasis'];

const DASA_LEVEL = ['Maha Dasas', 'Antardasas', 'Pratyantardasas', 'Sookshma-antardasas', 'Prana-antardasas', 'Deha-antardasas'];

/** A dasa level as a table: the periods under `path`, with JHora's copy text for the top two levels. */
function dasaTable(chart: Chart, swe: Sweph, title: string, mds: Period[], path: number[], drill = true, clock = dasaClock(swe, chart)): Table {
  const ctx = { clock, tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
  let list = mds; let parent: Period | null = null;
  for (const i of path) { parent = list[i]; list = parent.children ?? []; }
  const when = (y: number) => formatDasaTime(ctx.clock.toJd(y), ctx.tz, ctx.revjul);
  return {
    caption: parent ? `${periodLabel(parent)}: ${when(parent.start)} - ${when(parent.end)}` : title,
    headers: [DASA_LEVEL[path.length] ?? 'Periods', 'Start', 'End'],
    rows: list.map((q) => [periodLabel(q), when(q.start), when(q.end)]),
    text: !parent ? mahaDasaText(title, mds, ctx) : path.length === 1 ? antarDasaText(title, parent, ctx) : undefined,
    drill,
  };
}

const DASA_DEFAULT: Record<DasaTableId, string> = { 'dasas.nakshatra': 'Vimsottari', 'dasas.rasi': 'Narayana', 'dasas.other': 'Moola' };
function dasaSystem(table: DasaTableId, params: Record<string, unknown>): string {
  const s = String(params.system ?? DASA_DEFAULT[table]);
  const known = table === 'dasas.nakshatra' ? (NAKSHATRA_SLOTS as readonly string[]).includes(s) : s in (table === 'dasas.rasi' ? RASI_DASAS : OTHER_DASAS);
  return known ? s : DASA_DEFAULT[table];
}

/** The Dasas tab on a chart whose dasas are not compressed (natal, progressed): YearDefinition[slot] years. */
function natalDasaJob(table: DasaTableId): TableFn {
  return (chart, params, swe) => {
    if (!swe) throw new Error('dasa tables need the ephemeris');
    const path = (params.path as number[] | undefined) ?? [];
    const d = buildDasa(chart, table, dasaSystem(table, params), path.length + 1);
    return dasaTable(chart, swe, d.title, d.periods, path, d.drill, slotClock(swe, chart, d.slot));
  };
}

/** The derived chart a doc shows (store.ts DerivedChart), passed to the Dasas jobs as params.derived. */
export interface DerivedDasaParams {
  kind: 'tajaka' | 'tithiPravesha' | 'angularReturn' | 'prasna' | 'progression' | 'mundane';
  label: string;
  birth: BirthData;
  /** the form input (Tajaka: selection and variant; others: periodDays = DAT_005922b0) */
  params: Record<string, unknown>;
}

/**
 * The Dasas tab with a derived chart shown; the job runs on the NATAL chart (FUN_00408d90):
 *  - progressed charts (kind 4, and the transit kind 3) show the natal chart's dasas,
 *    uncompressed (doc+0x76d00 is pointed back at doc+0x50 around the builder);
 *  - Tajaka (1), Tithi Pravesha (2), mundane / angular return (5) and prasna charts with
 *    "Compress dasas" (6) build every dasa on the derived chart (Tajaka seeds per
 *    build.ts / registry.ts) and compress it into the chart's period (yearDefinition.ts
 *    compressDasa), timed from the derived chart with the compressed year definition.
 */
function derivedDasaJob(table: DasaTableId) {
  return async (natal: Chart, params: Record<string, unknown>, swe: Sweph): Promise<Table> => {
    const d = params.derived as DerivedDasaParams | undefined;
    if (!d || d.kind === 'progression') return runTable(natal, table, params, swe);
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
    const b = buildDasa(chart, table, system, path.length + 1, { compressed, tajaka });
    if (!compressed) return dasaTable(chart, swe, b.title, b.periods, path, b.drill, slotClock(swe, chart, b.slot));
    const c = compressDasa(swe, chart, b.slot, b.periods, { periodDays, kindCode: DERIVED_KIND_CODE[d.kind], label: d.label, years });
    return {
      ...dasaTable(chart, swe, b.title, c.periods, path, b.drill, c.clock),
      notes: [`${d.label}: compressed into ${periodDays.toFixed(2)} days = ${c.F.toFixed(4)} years (${YEAR_DEFINITION_NAMES[c.def] ?? c.def}), maha dasa years x ${c.F.toFixed(4)} / ${c.total}`],
    };
  };
}

/** JHora prints strengths with "%.2f" */
const f2 = (x: number) => cFixed(Object.is(x, -0) ? 0 : x, 2);   // MSVC printf rounding (src/core/format/cfixed.ts)
function shadbalaRows(chart: Chart, headers: string[], cols: (b: ReturnType<typeof computeShadbala>['planets'][Seven]) => number[]): Table {
  const sb = computeShadbala(chart);
  return { headers, rows: SEVEN.map((g) => [g, ...cols(sb.planets[g]).map(f2)]) };
}

/** Rows of the pushkara / mrityu bhaga / drekkana tables: grahas, Maandi, lagna and the 11 other cusps. */
function bhagaBodies(chart: Chart): [string, number][] {
  const p = chart.positions;
  return [
    ...GRAHAS.map((g): [string, number] => [g, p.grahas[g].lon]),
    ['Maandi', chart.longitudes.find((b) => b.name === 'Maandi')!.lon],
    ['Lagna', p.ascendant],
    ...ORDINAL.slice(1).map((o, i): [string, number] => [`${o} house`, norm360(p.ascendant + 30 * (i + 1))]),
  ];
}

/** Columns of JHora's "Rasis occupied in all vargas" table. */
const RASI_COLUMNS: [string, VargaName][] = [
  ['D-1', 'D1'], ['D-9', 'D9'], ['D-2 (US)', 'D2'], ['D-3 (Trd)', 'D3'], ['D-4', 'D4'], ['D-5', 'D5'], ['D-6', 'D6'],
  ['D-7 (Trd)', 'D7'], ['D-8', 'D8'], ['D-10 (Trd)', 'D10'], ['D-11', 'D11'], ['D-12 (Trd)', 'D12'], ['D-16 (Trd)', 'D16'],
  ['D-20 (Trd)', 'D20'], ['D-24 (Trd)', 'D24'], ['D-27 (Trd)', 'D27'], ['D-30', 'D30'], ['D-40', 'D40'], ['D-45', 'D45'],
  ['D-60 (Trd)', 'D60'], ['D-81', 'D81'], ['D-108', 'D108'], ['D-144', 'D144'],
];
/** The ten "P's S Arudha" rows in JHora's order. */
const SIGN_ARUDHA_ROWS: [Graha, number][] = [
  ['Mars', 0], ['Mercury', 2], ['Jupiter', 8], ['Venus', 1], ['Saturn', 9],
  ['Mars', 7], ['Mercury', 5], ['Jupiter', 11], ['Venus', 6], ['Saturn', 10],
];

/** Columns of JHora's "All Divisional Longitudes" table (default varga variants; D-0 is an empty research slot). */
const DIV_COLUMNS: [string, VargaName | null][] = [
  ['D-1', 'D1'], ['D-9', 'D9'], ['D-10 (Trd)', 'D10'], ['D-2 (US)', 'D2'], ['D-3 (Trd)', 'D3'], ['D-4', 'D4'],
  ['D-7 (Trd)', 'D7'], ['D-12 (Trd)', 'D12'], ['D-16 (Trd)', 'D16'], ['D-20 (Trd)', 'D20'], ['D-24 (Trd)', 'D24'],
  ['D-27 (Trd)', 'D27'], ['D-30', 'D30'], ['D-40', 'D40'], ['D-45', 'D45'], ['D-60 (Trd)', 'D60'],
  ['D-10 x D-9', 'D10xD9'], ['D-0', 'D0'], ['D-5', 'D5'], ['D-6', 'D6'], ['D-8', 'D8'], ['D-11', 'D11'],
  ['D-81', 'D81'], ['D-108', 'D108'], ['D-144', 'D144'],
];

type TableFn = (chart: Chart, params: Record<string, unknown>, swe?: Sweph) => Table;
type TextFn = (chart: Chart, params: Record<string, unknown>, swe?: Sweph) => string;

/**
 * A body's longitude in a varga. Varnadas are recomputed inside the varga (from the
 * varga's lagna and hora lagna) rather than mapped from D-1, as JHora does.
 */
function bodyInVarga(chart: Chart, body: NamedBody, v: VargaName): number {
  const spec = vargasOf(chart.ini)[v];
  const house = body.name === 'Varnada Lagna' ? 1 : /^V(\d+)$/.test(body.name) ? Number(body.name.slice(1)) : 0;
  if (house) {
    if (v === 'D10xD9') return 0;   // JHora leaves varnadas blank (0 Ar 00) in the sub-divisional chart
    // sign: varnada counting on the varga's lagna and hora lagna; degrees: the D-1
    // varnada mapped through the varga (so even-sign reversal shows up, as in JHora)
    const lagna = vargaLongitude(chart.positions.ascendant, spec);
    const hl = vargaLongitude(chart.longitudes.find((b) => b.name === 'Hora Lagna')!.lon, spec);
    const sign = signOf(varnada(norm360(lagna + 30 * (house - 1)), norm360(hl + 30 * (house - 1))));
    return sign * 30 + (vargaLongitude(body.lon, spec) % 30);
  }
  return vargaLongitude(body.lon, spec);
}

export const TABLES: Record<string, TableFn> = {
  // Basics > Key Info > "All Divisional Longitudes" (33265); rows per the body selection (32821)
  'basics.allDivisionalLongitudes': (chart) => ({
    headers: ['Body', ...DIV_COLUMNS.map(([, v]) => vargaColumnLabel(v!, chart.ini))],
    rows: keyInfoBodies(chart).map((b) => [b.name, ...DIV_COLUMNS.map(([, v]) => formatVargaLongitude(bodyInVarga(chart, b, v!)))]),
  }),
  // Basics > Key Info > "Rasis occupied in all vargas" (32823): 56 bodies + arudhas, per varga
  'basics.rasisInVargas': (chart) => {
    const opt: ArudhaOptions = {
      bhavaExceptions: chart.ini.ExceptionsInBhavaArudhas !== 0,
      grahaExceptions: chart.ini.ExceptionsInGrahaArudhas !== 0,
      nodesAsLords: chart.ini.NodesInArudhas !== 0,
    };
    const rows: string[][] = [];
    const cols = RASI_COLUMNS.map(([, v]) => v);
    const V = vargasOf(chart.ini);
    const ctxFor = (v: VargaName): VargaCtx => {
      const spec = V[v];
      return {
        sign: (g) => signOf(vargaLongitude(chart.positions.grahas[g].lon, spec)),
        degree: (g) => chart.positions.grahas[g].lon % 30,
      };
    };
    const ctxs = cols.map(ctxFor);
    const lagnas = cols.map((v) => signOf(vargaLongitude(chart.positions.ascendant, V[v])));
    const put = (name: string, f: (ctx: VargaCtx, i: number) => number) => rows.push([name, ...ctxs.map((c, i) => SIGNS[f(c, i)])]);
    // LongitudeBasedBhavaArudhas (dialog 2059): AL..UL from exact longitudes (arudhaPadas.ts)
    const byLon = bhavaArudhaOptions(chart.ini).longitudeBased ? cols.map((v) => bhavaArudhaSigns(chart, v)) : null;
    // the body groups in JHora's order (BodiesToShow), the three arudha groups included
    for (const [key, , from, to] of BODY_GROUPS) {
      if (Number((chart.ini as unknown as Record<string, unknown>)[key] ?? (key === 'BodyTypeOuterPlanet' ? 0 : 1)) === 0) continue;
      if (key === 'BodyTypeArudhaLagna') put('AL', (c, k) => (byLon ? byLon[k][0] : bhavaArudha(lagnas[k], c, opt)));
      else if (key === 'BodyTypeBhavaArudha') {
        for (let h = 2; h <= 12; h++) put(h === 12 ? 'UL' : `A${h}`, (c, k) => (byLon ? byLon[k][h - 1] : bhavaArudha((lagnas[k] + h - 1) % 12, c, opt)));
      } else if (key === 'BodyTypeGrahaArudha') {
        for (const g of GRAHAS) put(`${g}'s Arudha`, (c) => grahaArudha(g, c, opt));
        for (const [g, s] of SIGN_ARUDHA_ROWS) put(`${g}'s ${SIGNS[s]} Arudha`, (c) => signArudha(s, g, c, opt));
      } else {
        for (let i = from; i <= to; i++) {
          const b = jhoraBody(chart, i);
          rows.push([`${b.name}${b.retrograde ? ' (R)' : ''}`, ...cols.map((v) => SIGNS[signOf(bodyInVarga(chart, b, v))])]);
        }
      }
    }
    for (const r of rows) r[cols.length] = '';   // JHora fills the varga columns up to D-108 only: D-144 stays empty
    // FUN_0042cd20 sets view+0x48 to 30 columns (24 exist): the copy repeats the last header
    return { headers: ['Body', ...RASI_COLUMNS.map(([, v]) => vargaColumnLabel(v, chart.ini))], rows, copyColumns: 30 };
  },
  'basics.sahamas': (chart) => ({
    headers: ['Sahama name', 'Position', 'Nakshatra', 'Meaning of sahama'],
    rows: sahamas(chart.positions, chart.day.isDay).map((s) => [s.name, formatLongitude(s.lon), NAK28[nakshatra28Of(s.lon)], s.meaning]),
  }),
  'basics.deities': (chart) => {
    const p = chart.positions;
    const ctx: VargaCtx = { sign: (g) => signOf(p.grahas[g].lon), degree: (g) => p.grahas[g].lon % 30 };
    const ak = charaKarakas(p)[0].planet;
    const d = brahmaRudraMaheswara(signOf(p.ascendant), ak, ctx);
    return { headers: ['Special Deity', 'Planet in this chart'], rows: [['Brahma', d.brahma], ['Rudra', d.rudra], ['Maheswara', d.maheswara]] };
  },
  // Dasas > Nakshatra / Rasi / Other dasas: params.system (a NAKSHATRA_SLOTS / RASI_DASAS / OTHER_DASAS
  // key), params.path (drill-down indices); timed with the system's YearDefinition slot. A derived chart
  // (params.derived, see ASYNC_TABLES) is handled by derivedDasaJob.
  'dasas.nakshatra': natalDasaJob('dasas.nakshatra'),
  'dasas.rasi': natalDasaJob('dasas.rasi'),
  'dasas.other': natalDasaJob('dasas.other'),
  // Strengths > Other strengths (menu modes 0..10 of CStrengthsView)
  'strengths.shadbalaSummary': (chart) => shadbalaRows(chart, ['Planet', 'Shadbala', 'In rupas', '% Strength', 'IshtaPhala', 'KashtaPhala'], (b) => [b.total, b.rupas, b.percent, b.ishta, b.kashta]),
  'strengths.shadbalaBreakup': (chart) => shadbalaRows(chart, ['Planet', 'Shadbala Rupas', 'Sthana Bala', 'Kala Bala', 'DigBala', 'Cheshta Bala', 'DrigBala', 'Naisargika Bala'], (b) => [b.rupas, b.sthana, b.kaala, b.dig, b.cheshta, b.drig, b.naisargika]),
  'strengths.sthana': (chart) => shadbalaRows(chart, ['Planet', 'Sthana Bala', 'In rupas', 'Uchcha', 'Saptavargaja', 'Oja Yugma', 'Kendra', 'Drekkana'], (b) => [b.sthana, b.sthana / 60, b.uchcha, b.saptavargaja, b.ojayugma, b.kendra, b.drekkana]),
  'strengths.kaala': (chart) => shadbalaRows(chart, ['Planet', 'Kaala Bala', 'In rupas', 'Natonnata', 'Paksha', 'Tribhaga', 'Abda', 'Maasa', 'Vaara', 'Hora', 'Ayana', 'Yuddha'], (b) => [b.kaala, b.kaala / 60, b.natonnata, b.paksha, b.tribhaga, b.abda, b.maasa, b.vaara, b.hora, b.ayana, b.yuddha]),
  'strengths.dig': (chart) => shadbalaRows(chart, ['Planet', 'DigBala', 'In rupas'], (b) => [b.dig, b.dig / 60]),
  'strengths.cheshta': (chart) => shadbalaRows(chart, ['Planet', 'Cheshta Bala', 'In rupas'], (b) => [b.cheshta, b.cheshta / 60]),
  'strengths.drig': (chart) => shadbalaRows(chart, ['Planet', 'DrigBala', 'In rupas'], (b) => [b.drig, b.drig / 60]),
  'strengths.naisargika': (chart) => shadbalaRows(chart, ['Planet', 'Naisargika Bala', 'In rupas'], (b) => [b.naisargika, b.naisargika / 60]),
  'strengths.bhava': (chart) => ({
    headers: ['House', 'Bhava Bala', 'In rupas', "Lord's bala", 'DigBala', 'DrigBala'],
    rows: computeShadbala(chart).bhavas.map((b, i) => [ORDINAL[i], f2(b.total), f2(b.rupas), f2(b.lord), f2(b.dig), f2(b.drig)]),
  }),
  'strengths.ishtaKashta': (chart) => shadbalaRows(chart, ['Planet', 'Ishta Phala', 'Kashta Phala', 'Shadbala'], (b) => [b.ishta, b.kashta, b.rupas]),
  'strengths.rashmis': (chart) => shadbalaRows(chart, ['Planet', 'Uchcha Rashmi', 'Cheshta Rashmi', 'Subha Rashmi', 'Asubha Rashmi', 'Ishta (Parasara)', 'Kashta (Parasara)'], (b) => [b.uchchaRashmi, b.cheshtaRashmi, b.subhaRashmi, b.asubhaRashmi, b.ishtaParasara, b.kashtaParasara]),
  // Strengths > Ashtakavarga (menu 106): params.mode is one of AV_MODES, params.varga a varga name,
  // params.lagnaShift the signs the lagna is moved on (32973 "Recompute taking another sign as
  // lagna"; 33097 resets it); dialog 165's options come from the ini (ashtakavarga.ts)
  'strengths.ashtakavarga': (chart, params) => {
    const varga = (String(params.varga ?? 'D1')) as VargaName;
    const mode = String(params.mode ?? AV_MODES[0]);
    const spec = vargasOf(chart.ini)[varga];
    const lonOf = (b: AvBody) => (b === 'Lagna' ? chart.positions.ascendant : chart.positions.grahas[b].lon);
    const sign = shiftLagna((b: AvBody) => Math.floor(vargaLongitude(lonOf(b), spec) / 30) % 12, (((Number(params.lagnaShift) || 0) % 12) + 12) % 12);
    const avo = avOptionsFromIni(chart.ini);
    const av = ashtakavarga(sign, avo);
    const short = (b: AvBody) => (b === 'Lagna' ? 'As' : SHORT[b]);
    const mark = (b: AvBody, row: number[]) => row.map((x, s) => `${x}${s === sign(b) ? '*' : ''}`);
    const caption = `Ashtakavarga of ${varga === 'D1' ? 'Rasi Chart' : varga}`;
    const signCols = ['', ...SIGNS.map((x) => x.slice(0, 2))];
    if (mode === 'Sodhya pindas') {
      return { caption, headers: ['', 'Sodhya Pinda', 'Rasi Pinda', 'Graha Pinda'], rows: AV_BODIES.map((b) => [short(b), String(av.pindas[b].total), String(av.pindas[b].rasi), String(av.pindas[b].graha)]) };
    }
    if (mode === 'Nakshatras & rasis') {
      // FUN_00423420 (draw mode 3): sign rows, a nakshatra and a rasi per body
      const nr = pindaNakshatras(av);
      return {
        caption: `Based on ${varga === 'D1' ? 'Rasi' : varga} of the chart`,
        headers: ['', ...AV_BODIES.map(short)],
        rows: SIGNS.map((x, s) => [x, ...AV_BODIES.map((b) => `${NAKSHATRAS[nr[b][s].nakshatra]} ${SIGNS[nr[b][s].rasi]}`)]),
      };
    }
    if (mode.startsWith('PAV of ')) {
      const owner = mode.slice(7) as AvBody;
      const pav = prastara(owner, sign, avo);
      const rows = AV_BODIES.map((c) => [short(c), ...pav[c].map((x, s) => (x ? 'x' : '') + (s === sign(c) ? '*' : ''))]);
      rows.push(['Total', ...av.bav[owner].map(String)]);
      return { caption: `Prastara ashtakavarga of ${owner} (${caption})`, headers: signCols, rows };
    }
    const table = mode === 'SoAV' ? av.reduced : av.bav;
    const rows = AV_BODIES.map((b) => [short(b), ...mark(b, table[b])]);
    if (mode !== 'SoAV') rows.push(['SAV', ...av.sav.map(String)]);
    return { caption: mode === 'SoAV' ? `Sodhita (reduced) ${caption}` : caption, headers: signCols, rows };
  },
  // Strengths > Other strengths, vimsopaka pane modes
  'strengths.amsaBalas': (chart) => {
    const v = vaiseshikamsaCells(chart);   // JHora's labels are padded (they show in its copy)
    return { headers: ['Vaiseshikamsas', ...VAISESHIKAMSA_GROUPS.map((g) => g.name)], rows: GRAHAS.map((g) => [g, ...v[g]]) };
  },
  // params.varga: JHora varga index of alertness and mood (menu 129, 33046)
  'strengths.basicAvasthas': (chart, params) => {
    const v = Number(params.varga) || 0;
    const a = basicAvasthas(chart, v);
    return { headers: ['Planet', 'Age', `Alertness (${avasthaVargaLabel(v)})`, `Mood (${avasthaVargaLabel(v)})`], rows: GRAHAS.map((g) => [g, AGES[a[g].age], ALERTNESS[a[g].alertness], a[g].moods.map((m) => MOODS[m]).join(', ')]) };
  },
  'strengths.sayanadi': (chart) => {
    const a = sayanadiAvasthas(chart);
    return { headers: ['Planet', 'Activity', ...[1, 2, 3, 4, 5].map((i) => `Intensity ${i}`)], rows: GRAHAS.map((g) => [g, SAYANADI[a[g].avastha], ...a[g].intensities.map((i) => INTENSITY[i])]) };
  },
  'strengths.panchaVargeeya': (chart) => {
    const t = tajakaBalas(chart);
    return { headers: ['Planet', 'Pancha-vargeeya', 'Classification'], rows: SEVEN.map((g) => [g, f2(t[g].pancha), PANCHA_CLASSES[t[g].panchaClass]]) };
  },
  'strengths.dwadasaVargeeya': (chart) => {
    const t = tajakaBalas(chart);
    return { headers: ['Planet', 'Dwadasa-vargeeya'], rows: SEVEN.map((g) => [g, `${t[g].dwadasa} (out of 12)`]) };
  },
  'strengths.harsha': (chart) => {
    const t = tajakaBalas(chart);
    return { headers: ['Planet', 'Harsha Bala', 'Strength'], rows: SEVEN.map((g) => [g, String(t[g].harsha), HARSHA_CLASSES[t[g].harsha / 5]]) };
  },
  // When will this planet change sign in this chart? (menu 33160)
  'chart.signChange': (chart, params, swe) => {
    if (!swe) throw new Error('needs the ephemeris');
    const body = String(params.body ?? 'Lagna') as Graha | 'Lagna';
    const varga = String(params.varga ?? 'D1') as VargaName;
    const n = Number(varga.match(/^D(\d+)$/)?.[1] ?? 1);
    const r = signChange(swe, chart, body, n);
    const vn = varga.replace('D', 'D-');
    return {
      caption: `When will ${body} change in this ${vn} chart?`, headers: [], rows: [],
      text: [`${body} changes sign in ${vn} chart, if the birthtime is    `, '', `	${formatSpan(r.earlierDays)} earlier`, '', 'or if the birthtime is    ', '', `	${formatSpan(r.laterDays)} later.`],
    };
  },
  // Planetary Aspect Evaluation (menu 33296, FUN_0042bac0): Parasara's aspect of each planet on every body
  'aspects.evaluation': (chart, params) => {
    const av = vargasOf(chart.ini)[String(params.aspectedVarga ?? 'D1') as VargaName];
    const pv = vargasOf(chart.ini)[String(params.aspectingVarga ?? 'D1') as VargaName];
    const from = GRAHAS.map((q) => vargaLongitude(chart.positions.grahas[q].lon, pv));
    const cells = (lon: number) => GRAHAS.map((q, k) => { const x = aspectPercent(lon, from[k], q); return x === 0 ? '-' : `${cFixed(x, 2).padStart(5)}%`; });
    const rows: string[][] = [];
    keyInfoBodies(chart).forEach((b) => {
      const lon = vargaLongitude(b.lon, av);
      rows.push([`${b.name}${b.retrograde ? ' (R) ' : ' '}`, formatLongitude(lon), ...cells(lon)]);   // "%s%s": name, " (R) " or " "
      if (b.index > 9) return;
      const step = b.name === 'Rahu' || b.name === 'Ketu' ? -30 : 30;
      for (let h = 1; h < 12; h++) {
        // JHora passes the unreduced lon + 30h to FUN_004b2b00 (it matters on exact boundaries)
        rows.push([`${ORDINAL[h]} from ${b.name}`, formatLongitude(norm360(lon + h * step)), ...cells(lon + h * step)]);
      }
    });
    const vname = (v: VargaName) => v.replace('D', 'D-');
    return { headers: ['Aspected Body', `Longitude (in ${vname(String(params.aspectedVarga ?? 'D1') as VargaName)})`, ...GRAHAS], rows };
  },
  // Aspect Table with Relationships (menu 33387, CAspectTableView FUN_004286c0)
  'aspects.table': (chart, params) => {
    const varga = String(params.varga ?? 'D1') as VargaName;
    const spec = vargasOf(chart.ini)[varga];
    const maxValue = Number(params.max ?? chart.ini.AspectValueMax ?? 60);   // AspectValueMax (menu 163: 33382 = 60, 33383 = 100)
    const lonOf = (g: Graha) => vargaLongitude(chart.positions.grahas[g].lon, spec);
    const signOfG = (g: Graha) => signOf(lonOf(g));
    const rel = (p: Graha, q: Graha) => (p === q ? 'own' : `rel${3 - compoundRelation(p, q, signOfG)}`);
    const value = (target: number, p: Graha) => String(Math.trunc(aspectPercent(target, lonOf(p), p) * maxValue * 0.01 + 0.5));
    const lagna = vargaLongitude(chart.positions.ascendant, spec);
    const houses = Array.from({ length: 12 }, (_, h) => norm360(lagna + 30 * h));
    const sun = lonOf('Sun');
    const combust = (g: Graha) => {
      if (!['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(g)) return false;
      const r = chart.positions.grahas[g].retrograde;
      if ((g === 'Mercury' && r) || (g === 'Venus' && !r)) return false;
      return norm360(lonOf(g) - sun) <= 6 || norm360(sun - lonOf(g)) <= 6;
    };
    const rows: string[][] = [], cellClasses: (string | undefined)[][] = [];
    for (const p of GRAHAS) {
      const s = signOfG(p), lord = SIGN_LORD[s];
      const marks = [EXALTATION[p] === s ? '↑' : '', DEBILITATION[p] === s ? '↓' : '', MOOLATRIKONA[p] === s ? '△' : '', '⌂', combust(p) ? '●' : ''].join('');
      rows.push([`${p} ${marks}`, ...GRAHAS.map((q) => (q === p ? '' : value(lonOf(q), p))), ...houses.map((x) => value(x, p))]);
      cellClasses.push([rel(p, lord), ...GRAHAS.map((q) => (q === p ? undefined : rel(p, q))), ...houses.map((x) => rel(p, SIGN_LORD[signOf(x)]))]);
    }
    return {
      caption: `Chart used: ${varga === 'D1' ? 'Rasi' : varga.replace('D', 'D-')}`,
      headers: ['Aspecting planet', ...GRAHAS, ...ORDINAL],
      rows, cellClasses,
      notes: [
        `Full aspect value: ${Math.trunc(maxValue)}`, 'Houses from: Lagna',
        '↑ Uchcha (exalted)  ↓ Neecha (debilitated)  △ Moolatrikona  ⌂ house of the sign lord (coloured by relationship)  ● Asta (combust)',
        'Aspect Legend (color code): Swagriha (own house) Blue, Adhimitra (best friend) Bold Italic Green, Mitra (friend) Green, Sama (neutral) Black, Satru (enemy) Red, Adhisatru (worst enemy) Bold Italic Red',
      ],
    };
  },
  'strengths.yogas': (chart, params) => {
    const varga = (String(params.varga ?? 'D1')) as VargaName;
    const mode = String(params.mode ?? YOGA_MODES[0][0]);
    const cat = (YOGA_MODES.find(([label]) => label === mode) ?? YOGA_MODES[0])[1];
    const vl = `D-${varga.slice(1)}`;
    return {
      headers: ['Yoga', 'Varga', 'Yoga givers', 'Results ascribed to yoga', 'Brief definition of yoga'],
      rows: findYogas(chart, cat, varga).map((r) => [r.name, vl, giversText(r), r.result, r.definition]),
    };
  },
  // Strengths > Bar graphs (src/core/strengthGraphs.ts). params: set (0..5), varga (AV varga, default D1).
  // text[0] carries the graphs as JSON for the SVG view; the rows are the same numbers.
  'strengths.barGraphs': (chart, params) => {
    const graphs = strengthBarGraphs(chart, Number(params.set ?? 0), String(params.varga ?? 'D1') as VargaName);
    const num = (g: BarGraph, x: number) => (g.integer ? String(x) : f2(x));
    return {
      headers: ['Graph', 'Values'],
      rows: graphs.map((g) => [g.title, g.labels.map((l, i) => `${l} ${num(g, g.values[i])}`).join(', ')]),
      text: [JSON.stringify(graphs)],
    };
  },
  'strengths.vimsopaka': (chart) => {
    const vb = vimsopaka(chart);
    const cell = (x: number) => `${f2(x)}  (${f2(x * 5)}%)`;
    return {
      headers: ['Vimsopaka', 'Dasa Varga (10)', 'Shodasa Varga (16)', 'Sapta Varga (7)', 'Shad Varga (6)'],
      rows: GRAHAS.map((g) => [g, cell(vb[g].dasa), cell(vb[g].shodasa), cell(vb[g].sapta), cell(vb[g].shad)]),
    };
  },
  'basics.drekkanas': (chart) => ({
    headers: ['Body', 'Drekkana occupied'],
    copyColumns: 7,   // FUN_0043030f inserts 2 columns but sets view+0x48 to 7 (see listCopy.ts)
    rows: bhagaBodies(chart).map(([name, lon]) => [name, drekkanaType(lon)]),
  }),
  'basics.nakshatraAspects': (chart) => ({
    headers: ['Planet', 'Latta on', 'Occupied Star', 'Aspected Stars'],
    rows: nakshatraAspects(chart.positions).map((r) => [r.planet, r.latta, r.star, r.aspected.map((s) => s + '    ').join('')]),
  }),
  'basics.specialTithis': (chart) => ({
    headers: ['Special Tithi', 'Seed', 'Name', '% left', 'Lord', 'Deity', 'Index', 'Index in paksha'],
    rows: specialTithis(chart.positions).map((r) => [
      r.name, r.seed, r.tithi.name, `${Math.round(r.tithi.left * 100)}%`, r.tithi.lord, r.tithi.deity, `${r.tithi.index}th`,
      `${((r.tithi.index - 1) % 15) + 1}th in ${r.tithi.index <= 15 ? 'Brighter' : 'Darker'} half`,
    ]),
  }),
  'basics.pushkara': (chart) => ({
    headers: ['Body', 'In Pushkaramsa?', 'In Pushkara Bhaga?', 'From Pushkara Bhaga Center'],
    rows: bhagaBodies(chart).map(([name, lon]) => {
      const d = fromPushkaraBhaga(lon, chart.ini.PushkaraBhagaJP !== 0);   // Preferences 33392
      return [name, yes(inPushkaramsa(lon)), yes(within(d)), `${Math.abs(d).toFixed(4)} deg`];
    }),
  }),
  'basics.mrityuBhaga': (chart) => ({
    headers: ['Body', 'From Mrityu Bhaga Center', 'Within the Trimsamsa (degree)?'],
    rows: bhagaBodies(chart).map(([name, lon]) => {
      const key = /house$/.test(name) ? 'Lagna' : (name as keyof typeof MRITYU_BHAGA);
      const d = fromMrityuBhaga(key, lon, { table: chart.ini.MBTablePreference, location: chart.ini.MBLocationPreference });   // 33079
      return [name, `${Math.abs(d).toFixed(4)} deg`, yes(within(d))];
    }),
  }),
  // Basics > Houses (menu 145): house system and lagna-in-middle from the ini (HouseTypeWanted,
  // HouseCuspsInMiddle; default equal houses, lagna in the middle). See src/core/kpHouses.ts.
  // params.ref: reference body of 33248 (0 Lagna, 1..9 Sun..Ketu; a session setting in JHora)
  'basics.houses': (chart, params, swe) => ({
    headers: ['House', 'Start', 'Cusp', 'End', 'Planets in it'],
    rows: houseRows(chart, houseOptions(chart, Number(params.ref) || 0), swe).map((h, i) => [ORDINAL[i], formatLongitude(h.start), formatLongitude(h.cusp), formatLongitude(h.end), h.bodies.join(', ')]),
  }),
  // Basics > KP (menu 146 id 33011); house rows follow the Houses settings (Placidus = KP cusps)
  'basics.kp': (chart, params, swe) => ({
    headers: ['Body/Cusp', 'Nakshatra lord', 'Sub lord', 'Prati-sub', 'Sookshma-sub', 'Praana-sub', 'Deha-sub'],
    rows: kpPoints(chart, houseOptions(chart, Number(params.ref) || 0), swe).map((pt) => [pt.label, ...kpLords(pt.lon, 6).map((g) => SHORT[g])]),
  }),
  // Basics > KP, "Planets occupying each planet's nakshatra / sub / ..." (33012, 33014..33018): params.level 0..5
  'basics.kpOccupants': (chart, params, swe) => {
    const level = Math.max(0, Math.min(5, Number(params.level ?? 0)));
    const occ = kpOccupants(chart, level, houseOptions(chart, Number(params.ref) || 0), swe);
    return { headers: ['Planet', KP_LEVEL_HEADERS[level]], rows: GRAHAS.map((g) => [SHORT[g], occ[g].join(', ')]) };
  },
  // Horoscope matching (command 33320, FUN_004e8db0): the native's Moon against another
  // person's nakshatra and 0-based pada (params.otherNak, params.otherPada); params.otherIsGroom
  // defaults to "Bridegroom" for a female native. JHora shows only its message (`text`).
  'matching.result': (chart, params) => {
    const native = nakshatraPada(chart.positions.grahas.Moon.lon);
    const other = { nak: Number(params.otherNak ?? 0), pada: Number(params.otherPada ?? 0) };
    const otherIsGroom = params.otherIsGroom === undefined ? defaultOtherIsGroom(chart.birth.field18) : Boolean(params.otherIsGroom);
    const m = matchHoroscopes({ native, other, otherIsGroom });
    return { caption: MATCH_TITLE, text: m.text, headers: ['Result'], rows: m.text.filter((l) => l.trim()).map((l) => [l]) };
  },
  'basics.charaKarakas': (chart) => ({
    headers: ['Chara karaka', 'Planet', 'Meaning of portfolio'],
    rows: charaKarakas(chart.positions).map((k) => [k.karaka, k.planet, k.meaning]),
  }),
  'basics.navaTarasMoon': (chart) => navaTarasTable(chart.positions.grahas.Moon.lon, 'Moon'),
  'basics.navaTarasLagna': (chart) => navaTarasTable(chart.positions.ascendant, 'Lagna'),
  'basics.specialTarasMoon': (chart) => specialTarasTable(chart.positions.grahas.Moon.lon, 'Moon'),
  'basics.specialTarasLagna': (chart) => specialTarasTable(chart.positions.ascendant, 'lagna'),   // JHora's header is lower case here
  'basics.yogi': (chart) => {
    const y = yogiPoints(chart.positions);
    return {
      headers: ['Title', 'Planet in this chart', 'Longitude'],
      rows: [['Yogi', y.yogi, formatLongitude(y.yogaSphuta)], ['Sahayogi', y.sahayogi, '-'], ['Avayogi', y.avayogi, formatLongitude(y.avayogaSphuta)]],
    };
  },
  'basics.combustion': (chart) => ({
    headers: ['Planet', 'Combust?'],
    rows: (['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const).map((g) => [g, yes(isCombust(chart.positions, g, chart.ini.CombustionSpecialRuleVenusMercury !== 0))]),
  }),
  'basics.grahaYuddha': (chart) => {
    const war = grahaYuddha(chart.positions);
    return { headers: ['Planet', 'Wins?', 'Loses?'], rows: GRAHAS.map((g) => [g, yes(war[g].wins.length > 0), yes(war[g].loses.length > 0)]) };
  },
  // "Lords of 64th navamsa and 22nd drekkana" (33159, routine at 0x430700): the chosen D-9 and
  // every D-3 variant; rows in JHora's list order (it inserts the Jagannatha rows at fixed
  // indices, so the lagna's ends up last)
  'basics.malicious': (chart) => {
    const p = chart.positions;
    const d9 = vargasOf(chart.ini).D9;
    const d3 = (pref: number) => vargasOf({ ...chart.ini, D3Preference: pref }).D3;
    // JHora spells the lagna row "Pararsara" and the Moon row "Parasara".
    const names = (parasara: string) => [parasara, 'Parivritti traya', 'Somanatha', 'Jagannatha', 'Uma-Shambhu'];
    const block = (from: string, lon: number, parasara: string, prefs: number[]) => [
      [`The 64th navamsa${from}`, maliciousLordLabel(lon, d9)],
      ...prefs.map((k) => [`The 22nd ${names(parasara)[k]} drekkana${from}`, maliciousLordLabel(lon, d3(k))]),
    ];
    const rows = [
      ...block('', p.ascendant, 'Pararsara', [0, 1, 2, 4]),
      ...block(' from Moon', p.grahas.Moon.lon, 'Parasara', [0, 1, 2, 4, 3]),
      [`The 22nd Jagannatha drekkana`, maliciousLordLabel(p.ascendant, d3(3))],
    ];
    return { headers: ['Malicious Division', 'Lord'], rows };
  },
  // Miscellany > Laghu Parasari (src/core/derived/laghuParasari.ts)
  ...LAGHU_TABLES,
  // Key Info longitudes / natal tables / coordinates, Amsa rulers, supported yogas (src/core/basicsJobs.ts)
  ...BASICS_JOBS,
  // chart right-click menu (src/core/chartJobs.ts)
  ...CHART_JOBS,
  // Dasas tab (src/core/dasas/dasaJobs.ts): replaces the 'dasas.*' entries above (cycle, Tribhagi, varga, options)
  ...DASA_TABLES,
};

function navaTarasTable(lon: number, from: string): Table {
  return {
    headers: [`Tara (${from})`, 'Meaning', 'Lord', 'Nakshatra 1', 'Nakshatra 2', 'Nakshatra 3'],
    rows: navaTaras(lon).map((t) => [t.tara, t.meaning, t.lord, ...t.naks]),
  };
}
function specialTarasTable(lon: number, from: string): Table {
  return {
    headers: [`Special tara (${from})`, 'Meaning', 'Nakshatra', 'Lord'],
    rows: specialTaras(lon).map((t) => [t.tara, t.meaning, t.nak, t.lord]),
  };
}

export const TEXTS: Record<number, TextFn> = {
  // Basics > Key Info (cmd 32974): JHora's copied text without the chart-file line, CRLF-joined
  32974: (chart, _params, swe) => {
    if (!swe) throw new Error('Key Info needs the ephemeris');
    return keyInfoText(swe, chart).join('\r\n');
  },
  // Edit > Copy basic / complete calculations (src/core/format/calcsText.ts)
  ...CALC_TEXTS,
};

/**
 * Tables that need more than the one chart (e.g. the natal chart behind a Tajaka
 * chart); they compute it themselves, so they are asynchronous.
 */
export const ASYNC_TABLES: Record<string, (chart: Chart, params: Record<string, unknown>, swe: Sweph) => Promise<Table>> = {
  // Tajaka tab, "Find Tajaka Chart" / "Find Tajaka Sunrise Chart" (buttons 1000/1014): the chart's moment.
  // The job runs on the natal chart; `text` holds the Tajaka chart's birth data as JSON.
  'tajaka.find': async (natal, params, swe) => {
    const sel = params.selection as TajakaSelection;
    const variant = (params.variant ?? 'exact') as TajakaVariant;
    await swe.ensureEphemeris(natal.positions.jdUt + (sel.year - natal.birth.year) * 365.25);
    const w = tajakaWindow(swe, natal, sel, variant);
    const when = (jd: number) => formatDasaTime(jd, natal.birth.tzHours, (x) => swe.revjul(x));
    return {
      caption: w.label, headers: ['', 'Start', 'End'], rows: [[w.label, when(w.start), when(w.end)]],
      text: [JSON.stringify({ birth: birthAt(swe, natal, w.start), label: w.label })],
    };
  },
  // Tajaka tab, "Mudda" (button 1008): Vimsottari compressed into the Tajaka period, runs on the natal chart
  'tajaka.mudda': async (natal, params, swe) => {
    const path = (params.path as number[] | undefined) ?? [];
    const t = await computeTajakaChart(swe, natal, params.selection as TajakaSelection, (params.variant ?? 'exact') as TajakaVariant);
    const m = muddaDasa(swe, t, { levels: path.length + 1 });
    return dasaTable(t.chart, swe, m.title, m.periods, path, true, m.clock);
  },
  // Dasas tab with a derived chart shown (params.derived); without it the TABLES jobs run
  'dasas.nakshatra': derivedDasaJob('dasas.nakshatra'),
  'dasas.rasi': derivedDasaJob('dasas.rasi'),
  'dasas.other': derivedDasaJob('dasas.other'),
  // Derived-chart tabs (src/core/derived): Tithi Pravesha, Mundane, Miscellany sub-tabs
  ...TP_JOBS,
  ...MUNDANE_JOBS,
  ...PROGRESSION_JOBS,
  ...ANGULAR_JOBS,
  ...PRASNA_JOBS,
  ...PANCHANGA_JOBS,
  // Transits tab (src/core/transits): basic results, calendar, special search, longitude correlation
  ...TRANSIT_JOBS,
  // Dasas tab and its commands (src/core/dasas/dasaJobs.ts)
  ...DASA_ASYNC_JOBS,
  // calculation options ported from jhora.exe (Nisheka chart, ...)
  ...OPTION_ASYNC_JOBS,
};

export function runTable(chart: Chart, table: string, params: Record<string, unknown>, swe?: Sweph): Table {
  // NodalExaltationParasara patches shared tables (signStrength.ts): re-apply the chart's setting
  applyNodalExaltation((chart.ini?.NodalExaltationParasara ?? 0) !== 0);
  const fn = TABLES[table];
  if (!fn) throw new Error(`table not implemented: ${table}`);
  return fn(chart, params, swe);
}

export function runText(chart: Chart, cmd: number, params: Record<string, unknown>, swe?: Sweph): string {
  applyNodalExaltation((chart.ini?.NodalExaltationParasara ?? 0) !== 0);
  const fn = TEXTS[cmd];
  if (!fn) throw new Error(`text command not implemented: ${cmd}`);
  return fn(chart, params, swe);
}
