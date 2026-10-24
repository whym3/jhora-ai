// Table and text jobs: the registry grows as features are ported. Each table id
// matches a JHora view (the tab/mode it appears in) and its headers match JHora's.
import type { Chart } from '../core/chart';
import { GRAHAS } from '../core/positions';
import { formatLongitude, formatVargaLongitude, NAK28, nakshatra28Of, nakshatraOf, NAKSHATRAS, padaOf, signOf, SIGNS } from '../core/zodiac';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../core/vargas';
import { charaKarakas, drekkanaType, equalHousesMiddle, grahaYuddha, isCombust, lordLabel, nakshatraAspects, navaTaras, ORDINAL, SHORT, specialTaras, specialTithis, yogiPoints } from '../core/basics';
import { kpLords } from '../core/kp';
import { varnada } from '../core/bodies';
import { norm360, type Graha } from '../core/positions';
import type { NamedBody } from '../core/longitudes';
import { bhavaArudha, grahaArudha, signArudha, type ArudhaOptions } from '../core/arudhas';
import { sahamas } from '../core/sahamas';
import { brahmaRudraMaheswara } from '../core/deities';
import { amsaRuler } from '../core/amsaRulers';
import { computeShadbala, type Seven } from '../core/shadbala';
import { vimsopaka } from '../core/vimsopaka';
import { SEVEN } from '../core/relations';
import { fromMrityuBhaga, fromPushkaraBhaga, inPushkaramsa, MRITYU_BHAGA, within } from '../core/pushkara';
import type { VargaCtx } from '../core/signStrength';
import type { Table } from './protocol';

const yes = (b: boolean) => (b ? 'Yes' : '-');

const AMSA_RULER_ROWS = [
  'Lagna', ...GRAHAS, 'Bhava Lagna', 'Hora Lagna', 'Ghati Lagna', 'Vighati Lagna', 'Pranapada Lagna', 'Sree Lagna', 'Indu Lagna',
  'Bhrigu Bindu', 'Kunda', 'Dhooma', 'Vyatipata', 'Parivesha', 'Indra Chapa', 'Upaketu', 'Kaala', 'Mrityu', 'Artha Prahara',
  'Yama Ghantaka', 'Maandi', 'Gulika', 'Prana Sphuta', 'Deha Sphuta', 'Mrityu Sphuta', 'Sookshma TriSphuta', 'Tithi Sphuta',
  'Yoga Sphuta (Sun-Moon)', 'Rahu Tithi Sphuta', 'Kshetra Sphuta', 'Beeja Sphuta', 'TriSphuta', 'ChatusSphuta', 'PanchaSphuta',
  'Yoga Sphuta', 'Avayoga Sphuta', 'Varnada Lagna', ...Array.from({ length: 11 }, (_, i) => `V${i + 2}`),
];

/** JHora prints strengths with "%.2f" */
const f2 = (x: number) => (Object.is(x, -0) ? 0 : x).toFixed(2);
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

type TableFn = (chart: Chart, params: Record<string, unknown>) => Table;
type TextFn = (chart: Chart, params: Record<string, unknown>) => string;

/**
 * A body's longitude in a varga. Varnadas are recomputed inside the varga (from the
 * varga's lagna and hora lagna) rather than mapped from D-1, as JHora does.
 */
function bodyInVarga(chart: Chart, body: NamedBody, v: VargaName): number {
  const spec = ALL_VARGAS[v];
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

/** Row labels of the Longitudes table: planets carry "(R)" and their chara karaka, like "Saturn (R) - AmK". */
function longitudeLabels(chart: Chart): string[] {
  const karaka = new Map(charaKarakas(chart.positions).map((k) => [k.planet as string, k.karaka]));
  return chart.longitudes.map((b) => {
    const g = chart.positions.grahas[b.name as keyof typeof chart.positions.grahas];
    if (!g) return b.name;
    const retro = g.retrograde && b.name !== 'Rahu' && b.name !== 'Ketu' ? ' (R)' : '';
    const k = karaka.get(b.name);
    return k ? `${b.name}${retro} - ${k}` : `${b.name}${retro}`;
  });
}

export const TABLES: Record<string, TableFn> = {
  // Basics > Key Info > "Longitudes & Basic Info" (menu 105 id 32822): all 56 bodies
  'basics.longitudes': (chart) => {
    const labels = longitudeLabels(chart);
    return {
      headers: ['Body', 'Longitude', 'Nakshatra', 'Pada', 'Rasi', 'Navamsa'],
      rows: chart.longitudes.map((b, i) => [
        labels[i], formatLongitude(b.lon), NAKSHATRAS[nakshatraOf(b.lon)], String(padaOf(b.lon)),
        SIGNS[signOf(b.lon)], SIGNS[signOf(vargaLongitude(b.lon, ALL_VARGAS.D9))],
      ]),
    };
  },
  // Basics > Key Info > "All Divisional Longitudes" (33265)
  'basics.allDivisionalLongitudes': (chart) => {
    const labels = longitudeLabels(chart).map((l) => l.replace(/ - \w+$/, '').replace(' (R)', ''));
    return {
      headers: ['Body', ...DIV_COLUMNS.map((c) => c[0])],
      rows: chart.longitudes.map((b, i) => [
        labels[i], ...DIV_COLUMNS.map(([, v]) => formatVargaLongitude(bodyInVarga(chart, b, v!))),
      ]),
    };
  },
  // Basics > Key Info > "Rasis occupied in all vargas" (32823): 56 bodies + arudhas, per varga
  'basics.rasisInVargas': (chart) => {
    const labels = longitudeLabels(chart).map((l) => l.replace(/ - \w+$/, ''));   // keeps "(R)", drops the karaka
    const opt: ArudhaOptions = {
      bhavaExceptions: chart.ini.ExceptionsInBhavaArudhas !== 0,
      grahaExceptions: chart.ini.ExceptionsInGrahaArudhas !== 0,
      nodesAsLords: chart.ini.NodesInArudhas !== 0,
    };
    const rows: string[][] = [];
    const cols = RASI_COLUMNS.map(([, v]) => v);
    const ctxFor = (v: VargaName): VargaCtx => {
      const spec = ALL_VARGAS[v];
      return {
        sign: (g) => signOf(vargaLongitude(chart.positions.grahas[g].lon, spec)),
        degree: (g) => chart.positions.grahas[g].lon % 30,
      };
    };
    const ctxs = cols.map(ctxFor);
    const lagnas = cols.map((v) => signOf(vargaLongitude(chart.positions.ascendant, ALL_VARGAS[v])));
    const put = (name: string, f: (ctx: VargaCtx, i: number) => number) => rows.push([name, ...ctxs.map((c, i) => SIGNS[f(c, i)])]);
    chart.longitudes.forEach((b, i) => {
      if (b.name === 'V2') {
        // the arudha block sits before the varnadas
        for (let h = 1; h <= 12; h++) put(h === 1 ? 'AL' : h === 12 ? 'UL' : `A${h}`, (c, k) => bhavaArudha((lagnas[k] + h - 1) % 12, c, opt));
        for (const g of GRAHAS) put(`${g}'s Arudha`, (c) => grahaArudha(g, c, opt));
        for (const [g, s] of SIGN_ARUDHA_ROWS) put(`${g}'s ${SIGNS[s]} Arudha`, (c) => signArudha(s, g, c, opt));
      }
      rows.push([labels[i], ...cols.map((v) => SIGNS[signOf(bodyInVarga(chart, b, v))])]);
    });
    return { headers: ['Body', ...RASI_COLUMNS.map((c) => c[0])], rows };
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
  // Basics > Amsa rulers (D-150 nadiamsas); JHora's row order differs from the Longitudes table
  'basics.amsaRulers': (chart) => {
    const labels = new Map(chart.longitudes.map((b, i) => [b.name, longitudeLabels(chart)[i].replace(/ - \w+$/, '')]));
    const byName = new Map(chart.longitudes.map((b) => [b.name, b.lon]));
    byName.set('Lagna', chart.positions.ascendant);
    return {
      headers: ['Body', 'Division', 'Index', 'In whose amsa in D-150'],
      rows: AMSA_RULER_ROWS.map((name) => {
        const r = amsaRuler(byName.get(name)!);
        return [labels.get(name) ?? name, String(r.division + 1), String(r.index + 1), r.name];
      }),
    };
  },
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
    rows: bhagaBodies(chart).map(([name, lon]) => [name, yes(inPushkaramsa(lon)), yes(within(fromPushkaraBhaga(lon))), `${Math.abs(fromPushkaraBhaga(lon)).toFixed(4)} deg`]),
  }),
  'basics.mrityuBhaga': (chart) => ({
    headers: ['Body', 'From Mrityu Bhaga Center', 'Within the Trimsamsa (degree)?'],
    rows: bhagaBodies(chart).map(([name, lon]) => {
      const key = /house$/.test(name) ? 'Lagna' : (name as keyof typeof MRITYU_BHAGA);
      const d = fromMrityuBhaga(key, lon);
      return [name, `${Math.abs(d).toFixed(4)} deg`, yes(within(d))];
    }),
  }),
  // Basics > Key Info > "Coordinates" (33071)
  'basics.coordinates': (chart) => ({
    headers: ['Planet', 'Longitude', 'Lon Speed', 'Latitude', 'Lat Speed'],
    rows: GRAHAS.filter((g) => g !== 'Ketu').map((g) => {
      const p = chart.positions.grahas[g];
      return [g, `${p.lon.toFixed(3)} deg`, `${p.speed.toFixed(3)} deg/day`, `${p.lat.toFixed(3)} deg`, ''];
    }),
  }),
  // Basics > Houses (menu 145; default equal houses, lagna in the middle)
  'basics.houses': (chart) => ({
    headers: ['House', 'Start', 'Cusp', 'End', 'Planets in it'],
    rows: equalHousesMiddle(chart.positions).map((h, i) => [ORDINAL[i], formatLongitude(h.start), formatLongitude(h.cusp), formatLongitude(h.end), h.bodies.join(', ')]),
  }),
  // Basics > KP (menu 146 id 33011)
  'basics.kp': (chart) => {
    const p = chart.positions;
    const houses = equalHousesMiddle(p);
    const rows: [string, number][] = [
      ['As', p.ascendant],
      ...GRAHAS.map((g): [string, number] => [SHORT[g], p.grahas[g].lon]),
      ...(['Uranus', 'Neptune', 'Pluto'] as const).map((o): [string, number] => [SHORT[o], p.outer[o].lon]),
      ...houses.map((h, i): [string, number] => [`${ORDINAL[i]} house`, h.cusp]),
    ];
    return {
      headers: ['Body/Cusp', 'Nakshatra lord', 'Sub lord', 'Prati-sub', 'Sookshma-sub', 'Praana-sub', 'Deha-sub'],
      rows: rows.map(([label, lon]) => [label, ...kpLords(lon, 6).map((g) => SHORT[g])]),
    };
  },
  'basics.charaKarakas': (chart) => ({
    headers: ['Chara karaka', 'Planet', 'Meaning of portfolio'],
    rows: charaKarakas(chart.positions).map((k) => [k.karaka, k.planet, k.meaning]),
  }),
  'basics.navaTarasMoon': (chart) => navaTarasTable(chart.positions.grahas.Moon.lon, 'Moon'),
  'basics.navaTarasLagna': (chart) => navaTarasTable(chart.positions.ascendant, 'Lagna'),
  'basics.specialTarasMoon': (chart) => specialTarasTable(chart.positions.grahas.Moon.lon, 'Moon'),
  'basics.specialTarasLagna': (chart) => specialTarasTable(chart.positions.ascendant, 'Lagna'),
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
  // "Lords of 64th navamsa and 22nd drekkana" (33159)
  'basics.malicious': (chart) => {
    const p = chart.positions;
    const V = ALL_VARGAS;
    const rows: string[][] = [];
    // JHora spells the lagna row "Pararsara" and the Moon row "Parasara".
    for (const [from, lon, parasara] of [['', p.ascendant, 'Pararsara'], [' from Moon', p.grahas.Moon.lon, 'Parasara']] as const) {
      rows.push([`The 64th navamsa${from}`, lordLabel(lon, V.D9, 64, 9)]);
      rows.push([`The 22nd ${parasara} drekkana${from}`, lordLabel(lon, V.D3, 22, 3)]);
    }
    return { headers: ['Malicious Division', 'Lord'], rows };
  },
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

export const TEXTS: Record<number, TextFn> = {};

export function runTable(chart: Chart, table: string, params: Record<string, unknown>): Table {
  const fn = TABLES[table];
  if (!fn) throw new Error(`table not implemented: ${table}`);
  return fn(chart, params);
}

export function runText(chart: Chart, cmd: number, params: Record<string, unknown>): string {
  const fn = TEXTS[cmd];
  if (!fn) throw new Error(`text command not implemented: ${cmd}`);
  return fn(chart, params);
}
