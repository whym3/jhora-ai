// Table and text jobs: the registry grows as features are ported. Each table id
// matches a JHora view (the tab/mode it appears in) and its headers match JHora's.
import type { Chart } from '../core/chart';
import { GRAHAS } from '../core/positions';
import { formatLongitude, nakshatraOf, NAKSHATRAS, padaOf, signOf, SIGNS } from '../core/zodiac';
import { ALL_VARGAS, vargaLongitude } from '../core/vargas';
import { charaKarakas, equalHousesMiddle, grahaYuddha, isCombust, lordLabel, navaTaras, ORDINAL, SHORT, specialTaras, yogiPoints } from '../core/basics';
import { kpLords } from '../core/kp';
import type { Table } from './protocol';

const yes = (b: boolean) => (b ? 'Yes' : '-');

type TableFn = (chart: Chart, params: Record<string, unknown>) => Table;
type TextFn = (chart: Chart, params: Record<string, unknown>) => string;

const bodyRows = (chart: Chart) =>
  chart.bodies.map((b) => ({ label: b.id === 'Lagna' ? 'Lagna' : `${b.id}${b.retrograde ? ' (R)' : ''}`, lon: b.lon }));

export const TABLES: Record<string, TableFn> = {
  // Basics > Key Info > "Longitudes & Basic Info" (menu 105 id 32822)
  'basics.longitudes': (chart) => ({
    headers: ['Body', 'Longitude', 'Nakshatra', 'Pada', 'Rasi', 'Navamsa'],
    rows: bodyRows(chart).map(({ label, lon }) => [
      label, formatLongitude(lon), NAKSHATRAS[nakshatraOf(lon)], String(padaOf(lon)),
      SIGNS[signOf(lon)], SIGNS[signOf(vargaLongitude(lon, ALL_VARGAS.D9))],
    ]),
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
