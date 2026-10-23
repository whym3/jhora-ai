// Table and text jobs: the registry grows as features are ported. Each table id
// matches a JHora view (the tab/mode it appears in) and its headers match JHora's.
import type { Chart } from '../core/chart';
import { GRAHAS } from '../core/positions';
import { formatLongitude, nakshatraOf, NAKSHATRAS, padaOf, signOf, SIGNS } from '../core/zodiac';
import { ALL_VARGAS, vargaLongitude } from '../core/vargas';
import type { Table } from './protocol';

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
};

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
