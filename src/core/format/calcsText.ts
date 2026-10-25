// Edit > "Copy basic calculations" (32982, FUN_004e6750) and "Copy complete calculations"
// (32983, FUN_004e6820). Both call FUN_00418ee0(complete) to refresh the per-view text blocks
// and concatenate them:
//   basic:    0x65c93c (Key Info) 0x65b174 (Longitudes) 0x65b96c (Rasi chart) 0x71fbb4 (Vimsottari)
//   complete: 0x65c93c 0x65b178 (Longitudes) 0x65b170 (Chara Karakas) 0x597fa8 (Ashtakavarga)
//             0x597fa4 (Sodhya pindas) 0x884858 (Shadbala summary) 0x884894 (strengths pane)
//             0x65b970 (23 charts) 0x71fbb8 (six dasas)
// * Key Info: the chart-file path (without ".jhd"), "\n\n", the Key Info lines, "\n\n" (as 32974).
// * Longitudes / Chara Karakas (FUN_0042b000: modes 0 and 13), Shadbala summary (FUN_00475f37),
//   strengths pane (FUN_00480f20: Amsa Balas with 3 columns, Vimsopaka 5, Basic Avasthas 4,
//   Sayanadi 2; Tajaka / TP charts add three more): list copies, FUN_004b9d30 (listCopy.ts).
// * Ashtakavarga (FUN_004249f0): "Ashtakavarga of Rasi Chart:\r\n\r\n", the sign header, per body
//   As..Sa the label, " " and "  %1d%c" per sign ('*' on the body's own sign), "\r\n"; "\r\n".
//   Pindas: "      Sodhya Pinda  Rasi Pinda  Graha Pinda\r\n", label + " " +
//   "          %3d         %3d          %3d" + "\r\n" per body, "\r\n".
// * Charts (FUN_00432610): FUN_00434ac0 (chartText.ts, current ChartStyle) for varga indices 0..22
//   (complete) or the Rasi chart alone (basic).
// * Dasas (FUN_0044ce70 / FUN_0044d1a0): Vimsottari (both), then Moola, Ashtottari, Kalachakra,
//   Narayana and Sudasa (complete). Each: name " (" description "):\n"; per maha dasa (count / 2
//   when over 12) "\n" label "  ", then its antardasas "label yyyy-mm-dd  ", three to a line
//   (continuation "\n  " plus as many blanks as the label is long); "\n\n" at the end.
import type { Chart } from '../chart';
import type { Sweph } from '../../sweph';
import { keyInfoText } from '../keyInfo';
import { listCopyLines, type ListCopySource } from './listCopy';
import { cFixed } from './cfixed';
import { BASICS_JOBS } from '../basicsJobs';
import { charaKarakas, SHORT } from '../basics';
import { AV_BODIES, ashtakavarga, type AvBody } from '../ashtakavarga';
import { vargaLongitude, type VargaName } from '../vargas';
import { VARGA_INDEX, vargasOf } from '../vargaOptions';
import { computeShadbala } from '../shadbala';
import { SEVEN } from '../relations';
import { GRAHAS } from '../positions';
import { AGES, ALERTNESS, basicAvasthas, MOODS, SAYANADI, sayanadiAvasthas, vaiseshikamsaCells, VAISESHIKAMSA_GROUPS } from '../otherStrengths';
import { vimsopaka } from '../vimsopaka';
import { chartText } from '../chartText';
import { buildDasa } from '../dasas/build';
import { slotClock, type DasaTableId } from '../dasas/yearDefinition';
import { formatDasaTime, periodLabel } from '../dasas/format';
import type { Period } from '../dasas/vimsottari';

const f2 = (x: number) => cFixed(Object.is(x, -0) ? 0 : x, 2);
const list = (t: ListCopySource) => listCopyLines(t).join('\n');

/** The Key Info block (0x65c93c): file line, blank, Key Info, blank. */
function keyInfoBlock(swe: Sweph, chart: Chart, file: string): string {
  return `${file}\n\n${keyInfoText(swe, chart).join('\n')}\n\n`;
}

/** FUN_004249f0: Rasi chart ashtakavarga and sodhya pindas (two blocks). */
function ashtakavargaBlocks(chart: Chart): [string, string] {
  const spec = vargasOf(chart.ini).D1;
  const lonOf = (b: AvBody) => (b === 'Lagna' ? chart.positions.ascendant : chart.positions.grahas[b].lon);
  const sign = (b: AvBody) => Math.floor(vargaLongitude(lonOf(b), spec) / 30) % 12;
  const av = ashtakavarga(sign);
  const label = (b: AvBody) => (b === 'Lagna' ? 'As' : SHORT[b]);
  let a = 'Ashtakavarga of Rasi Chart:\r\n\r\n      Ar  Ta  Ge  Cn  Le  Vi  Li  Sc  Sg  Cp  Aq  Pi\r\n';
  for (const b of AV_BODIES) {
    a += `${label(b)} `;
    av.bav[b].forEach((x, s) => { a += `  ${x}${s === sign(b) ? '*' : ' '}`; });
    a += '\r\n';
  }
  a += '\r\n';
  let p = '      Sodhya Pinda  Rasi Pinda  Graha Pinda\r\n';
  const d3 = (x: number) => String(x).padStart(3);
  for (const b of AV_BODIES) {
    const q = av.pindas[b];
    p += `${label(b)} ${' '.repeat(10)}${d3(q.total)}${' '.repeat(9)}${d3(q.rasi)}${' '.repeat(10)}${d3(q.graha)}\r\n`;
  }
  p += '\r\n';
  return [a, p];
}

/** FUN_00480f20: the strengths pane's lists as the complete calculations copy them. */
function strengthsPane(chart: Chart): string {
  const v = vaiseshikamsaCells(chart);
  const vb = vimsopaka(chart);
  const cell = (x: number) => `${f2(x)}  (${f2(x * 5)}%)`;
  const ba = basicAvasthas(chart);
  const sa = sayanadiAvasthas(chart);
  return [
    list({ headers: ['Vaiseshikamsas', ...VAISESHIKAMSA_GROUPS.slice(0, 2).map((g) => g.name)], rows: GRAHAS.map((g) => [g, ...v[g].slice(0, 2)]) }),
    list({
      headers: ['Vimsopaka', 'Dasa Varga (10)', 'Shodasa Varga (16)', 'Sapta Varga (7)', 'Shad Varga (6)'],
      rows: GRAHAS.map((g) => [g, cell(vb[g].dasa), cell(vb[g].shodasa), cell(vb[g].sapta), cell(vb[g].shad)]),
    }),
    list({
      headers: ['Planet', 'Age', 'Alertness (D-1)', 'Mood (D-1)'],
      rows: GRAHAS.map((g) => [g, AGES[ba[g].age], ALERTNESS[ba[g].alertness], ba[g].moods.map((m) => MOODS[m]).join(', ')]),
    }),
    list({ headers: ['Planet', 'Activity'], rows: GRAHAS.map((g) => [g, SAYANADI[sa[g].avastha]]) }),
  ].join('');
}

/** FUN_0044d1a0: one dasa with its antardasas (start dates). */
function dasaBlock(swe: Sweph, chart: Chart, table: DasaTableId, system: string): string {
  const d = buildDasa(chart, table, system, 2);
  const clock = slotClock(swe, chart, d.slot);
  const date = (p: Period) => formatDasaTime(clock.toJd(p.start), chart.birth.tzHours, (jd) => swe.revjul(jd)).slice(0, 10);
  // JHora's title is name " (" description ")"; Vimsottari's description is empty
  let out = `${d.title.includes('(') ? d.title : `${d.title} ()`}:\n`;
  const n = d.periods.length > 12 ? d.periods.length >> 1 : d.periods.length;
  for (const md of d.periods.slice(0, n)) {
    const label = periodLabel(md);
    out += `\n${label}  `;
    (md.children ?? []).forEach((ad, j) => {
      if (j % 3 === 0 && j) out += `\n  ${' '.repeat(label.length)}`;
      out += `${periodLabel(ad)} ${date(ad)}  `;
    });
  }
  return `${out}\n\n`;
}

const COMPLETE_DASAS: [DasaTableId, string][] = [
  ['dasas.nakshatra', 'Vimsottari'], ['dasas.other', 'Moola'], ['dasas.nakshatra', 'Ashtottari'],
  ['dasas.nakshatra', 'Kalachakra'], ['dasas.rasi', 'Narayana'], ['dasas.rasi', 'Sudasa'],
];

/** The chart file line (JHora: the .jhd path without the extension); params.file. */
const fileLine = (_chart: Chart, params: Record<string, unknown>) => String(params.file ?? '');
const chartStyle = (chart: Chart) => Number(chart.ini.ChartStyle ?? 0);

/** 32982: Key Info, Longitudes, the Rasi chart and Vimsottari dasa (lines of the clipboard text). */
export function basicCalculations(swe: Sweph, chart: Chart, params: Record<string, unknown> = {}): string[] {
  const text = keyInfoBlock(swe, chart, fileLine(chart, params))
    + list(BASICS_JOBS['basics.longitudes'](chart, {}, swe))
    + chartText(chart, 'D1', chartStyle(chart)).replace(/\r\n/g, '\n')
    + dasaBlock(swe, chart, 'dasas.nakshatra', 'Vimsottari');
  return text.replace(/\r\n/g, '\n').split('\n');
}

/** 32983: everything above plus karakas, ashtakavarga, strengths, 23 charts and six dasas. */
export function completeCalculations(swe: Sweph, chart: Chart, params: Record<string, unknown> = {}): string[] {
  const sb = computeShadbala(chart);
  const [av, pindas] = ashtakavargaBlocks(chart);
  let text = keyInfoBlock(swe, chart, fileLine(chart, params))
    + list(BASICS_JOBS['basics.longitudes'](chart, {}, swe))
    + list({ headers: ['Chara karaka', 'Planet', 'Meaning of portfolio'], rows: charaKarakas(chart.positions).map((k) => [k.karaka, k.planet, k.meaning]) })
    + av + pindas
    + list({
      headers: ['Planet', 'Shadbala', 'In rupas', '% Strength', 'IshtaPhala', 'KashtaPhala'],
      rows: SEVEN.map((g) => { const b = sb.planets[g as keyof typeof sb.planets]; return [g, f2(b.total), f2(b.rupas), f2(b.percent), f2(b.ishta), f2(b.kashta)]; }),
    })
    + strengthsPane(chart);
  for (const v of VARGA_INDEX as VargaName[]) text += chartText(chart, v, chartStyle(chart));
  for (const [table, system] of COMPLETE_DASAS) text += dasaBlock(swe, chart, table, system);
  return text.replace(/\r\n/g, '\n').split('\n');
}

export const CALC_TEXTS: Record<number, (chart: Chart, params: Record<string, unknown>, swe?: Sweph) => string> = {
  // Edit > Copy basic calculations / Copy complete calculations (params.file: the chart-file line)
  32982: (chart, params, swe) => {
    if (!swe) throw new Error('needs the ephemeris');
    return basicCalculations(swe, chart, params).join('\r\n');
  },
  32983: (chart, params, swe) => {
    if (!swe) throw new Error('needs the ephemeris');
    return completeCalculations(swe, chart, params).join('\r\n');
  },
};
