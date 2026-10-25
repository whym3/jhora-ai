// Strengths > Bar graphs (CStrengthGraphView, RTC 0x54e6b0, vtable 0x54e880, OnDraw
// 0x47d610, OnUpdate 0x47d5f0). Both lay the graphs out with FUN_0047d300 (a grid of
// view+0xde4 graphs in view+0xde8 columns, at least 600x600 px) and OnDraw fills them with
// FUN_0047de30, which only copies strength numbers the chart already holds - the same
// numbers as Strengths > Other strengths - per graph set view+0xde0:
//   0 (default)  Vimsopaka Bala (Dasa), Shadbala (% strength), Ishta Phala, Pancha
//                Vargeeya Bala, Dwadasa Vargeeya Bala, Harsha Bala, Vaiseshikamsa (Dasa),
//                Ashtakavarga Bala (<AV varga>)
//   1            Bhava Bala - Shadbala (rupas), Bhava Bala - SAV (<AV varga>)
//   2            Sthaana, Kaala, DigBala, Cheshta, DrigBala, Naisargika, Shadbala,
//                Shadbala (rupas), Shadbala (% strength)
//   3            Vimsopaka Bala (10), (16), (6), (7)
//   4            Vaiseshikamsa (10), (16), (6), (7)
//   5            Uchcha Rashmi, Cheshta Rashmi, Subha Rashmi, Ishta Phala (of Parasara)
// Each graph: title, bars Sun..Saturn (7), Sun..Ketu (9), Lagna..Saturn (8, Ashtakavarga
// Bala) or the 12 houses, a fixed scale 0..max (view+0x134 etc.) and two flags: +0x138
// (DrigBala only: values may be negative) and +0x139 (integer values). Ashtakavarga Bala is
// each body's bindus in its own sign of its BAV, Bhava Bala - SAV the SAV of the houses from
// the lagna, both in the Ashtakavarga varga (DAT_00597fb4, default D-1). The set names are
// ours (the view's menu was not traced).
import type { Chart } from './chart';
import { GRAHAS } from './positions';
import { computeShadbala, type PlanetBala } from './shadbala';
import { vimsopaka, type VimsopakaScheme } from './vimsopaka';
import { tajakaBalas, vaiseshikamsas } from './otherStrengths';
import { AV_BODIES, ashtakavarga, type AvBody } from './ashtakavarga';
import { vargaLongitude, type VargaName } from './vargas';
import { vargaSpec } from './vargaOptions';

export interface BarGraph {
  title: string;
  labels: string[];
  values: number[];
  /** top of the scale (the bottom is 0, or -max for graphs with negative values) */
  max: number;
  negative: boolean;
  integer: boolean;
}

export const BAR_GRAPH_SETS = ['Summary', 'Bhava balas', 'Shadbala', 'Vimsopaka balas', 'Vaiseshikamsas', 'Rashmis'];

const SEVEN = GRAHAS.slice(0, 7);
const HOUSES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

/** "D-9" for D9 (table 0x8a2874). */
const vargaShort = (v: VargaName) => `D-${v.slice(1)}`;

export function strengthBarGraphs(chart: Chart, set: number, avVarga: VargaName = 'D1'): BarGraph[] {
  const graph = (title: string, labels: string[], values: number[], max: number, integer = false, negative = false): BarGraph =>
    ({ title, labels, values, max, integer, negative });
  const sb = () => computeShadbala(chart).planets;
  const planets = (title: string, max: number, f: (b: PlanetBala) => number, b = sb()) => graph(title, SEVEN, SEVEN.map((g) => f(b[g as keyof typeof b])), max);
  const vimso = (title: string, scheme: VimsopakaScheme, vb = vimsopaka(chart)) => graph(title, [...GRAHAS], GRAHAS.map((g) => vb[g][scheme]), 20);
  // VAISESHIKAMSA_GROUPS order: Dasa (10), Shodasa (16), Sapta (7), Shad (6)
  const vaisesh = (title: string, group: number, max: number, vs = vaiseshikamsas(chart)) => graph(title, [...GRAHAS], GRAHAS.map((g) => vs[g][group].count), max, true);
  const av = () => {
    const lonOf = (b: AvBody) => (b === 'Lagna' ? chart.positions.ascendant : chart.positions.grahas[b].lon);
    const sign = (b: AvBody) => Math.floor(vargaLongitude(lonOf(b), vargaSpec(avVarga, chart.ini)) / 30) % 12;
    return { a: ashtakavarga(sign), lagna: sign('Lagna'), sign };
  };
  switch (set) {
    case 1: {
      const bh = computeShadbala(chart).bhavas;
      const { a, lagna } = av();
      return [
        graph('Bhava Bala - Shadbala', HOUSES, bh.map((h) => h.rupas), 12),
        graph(`Bhava Bala - SAV (${vargaShort(avVarga)})`, HOUSES, HOUSES.map((_, i) => a.sav[(lagna + i) % 12]), 50, true),
      ];
    }
    case 2: {
      const b = sb();
      return [
        planets('Sthaana Bala', 300, (x) => x.sthana, b), planets('Kaala Bala', 300, (x) => x.kaala, b),
        planets('DigBala', 80, (x) => x.dig, b), planets('Cheshta Bala', 80, (x) => x.cheshta, b),
        { ...planets('DrigBala', 60, (x) => x.drig, b), negative: true }, planets('Naisargika Bala', 60, (x) => x.naisargika, b),
        planets('Shadbala', 900, (x) => x.total, b), planets('Shadbala (rupas)', 12, (x) => x.rupas, b),
        planets('Shadbala (% strength)', 200, (x) => x.percent, b),
      ];
    }
    case 3: {
      const vb = vimsopaka(chart);
      return [vimso('Vimsopaka Bala (10)', 'dasa', vb), vimso('Vimsopaka Bala (16)', 'shodasa', vb), vimso('Vimsopaka Bala (6)', 'shad', vb), vimso('Vimsopaka Bala (7)', 'sapta', vb)];
    }
    case 4: {
      const vs = vaiseshikamsas(chart);
      return [vaisesh('Vaiseshikamsa (10)', 0, 10, vs), vaisesh('Vaiseshikamsa (16)', 1, 16, vs), vaisesh('Vaiseshikamsa (6)', 3, 6, vs), vaisesh('Vaiseshikamsa (7)', 2, 7, vs)];
    }
    case 5: {
      const b = sb();
      return [
        planets('Uchcha Rashmi', 14, (x) => x.uchchaRashmi, b), planets('Cheshta Rashmi', 14, (x) => x.cheshtaRashmi, b),
        planets('Subha Rashmi', 8, (x) => x.subhaRashmi, b), planets('Ishta Phala (of Parasara)', 60, (x) => x.ishtaParasara, b),
      ];
    }
    default: {
      const b = sb();
      const t = tajakaBalas(chart);
      const { a, sign } = av();
      return [
        vimso('Vimsopaka Bala (Dasa)', 'dasa'),
        planets('Shadbala (% strength)', 200, (x) => x.percent, b),
        planets('Ishta Phala', 60, (x) => x.ishta, b),
        graph('Pancha Vargeeya Bala', SEVEN, SEVEN.map((g) => t[g].pancha), 20),
        graph('Dwadasa Vargeeya Bala', SEVEN, SEVEN.map((g) => t[g].dwadasa), 12, true),
        graph('Harsha Bala', SEVEN, SEVEN.map((g) => t[g].harsha), 25, true),
        vaisesh('Vaiseshikamsa (Dasa)', 0, 10),
        graph(`Ashtakavarga Bala (${vargaShort(avVarga)})`, [...AV_BODIES], AV_BODIES.map((x) => a.bav[x][sign(x)]), 8, true),
      ];
    }
  }
}
