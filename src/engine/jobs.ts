// Table and text jobs: the registry grows as features are ported. Each table id
// matches a JHora view (the tab/mode it appears in) and its headers match JHora's.
import type { Chart } from '../core/chart';
import { GRAHAS } from '../core/positions';
import { formatLongitude, formatVargaLongitude, nakshatraOf, NAKSHATRAS, padaOf, signOf, SIGNS } from '../core/zodiac';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../core/vargas';
import { charaKarakas, equalHousesMiddle, grahaYuddha, isCombust, lordLabel, navaTaras, ORDINAL, SHORT, specialTaras, yogiPoints } from '../core/basics';
import { kpLords } from '../core/kp';
import { varnada } from '../core/bodies';
import { norm360 } from '../core/positions';
import type { NamedBody } from '../core/longitudes';
import type { Table } from './protocol';

const yes = (b: boolean) => (b ? 'Yes' : '-');

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
