// Which bodies JHora draws in its chart diagrams (CChartView, menu 103 "Choose a view"), with
// its labels, per sign of any varga.
//
// jhora.exe facts:
// * Every chart slot s (0..14: the Many Vargas charts / the chart pane, DisplayVarga[s]) keeps
//   105 "show this body" flags at DAT_0065b27c + s*0x69, indexed by JHora's internal body
//   index (labels: CString table built at 0x4ef180, see CHART_LABELS), a view kind
//   DAT_0065b240[s] (0 standard, 2 upagraha, 3 graha arudha, 4 dual graha arudha, 5 Chandra
//   arudha, 6 Surya arudha, 7 Varnada, 8 Chara karaka, 9 special lagna), an arudha reference
//   DAT_0065b938[s] (0 lagna, 1 Sun, 2 Moon) and a chara-karaka label flag DAT_0065b230[s].
//   CChartView::OnInitialUpdate (0x431f80) resets every slot to the standard view.
// * The view commands (handlers in the CChartView message map at 0x5488d0..):
//     32803 Standard view               0x43f2b0 -> FUN_0043f030(slot)
//     33211 Standard view with graha arudhas 0x43f330 -> FUN_0043f170 (both slots of a pair
//           when UseTwoChartStyles): as standard, but AL/A2..UL are replaced by 71..82 (L1..L12)
//     32805 Upagraha view               0x43f4f0: As, HL, GL, AL, 22..32 (Dh..Gk)
//     32806 Graha arudha view           0x43f620: As, HL, GL, 83..91 (graha arudhas Su..Ke)
//     33081 Dual graha arudha view      0x43f740: As, HL, GL, 83, 84, 90, 91, 92..101
//     33107 Chandra arudha view         0x43f3d0: standard set, arudhas counted from the Moon (M1..M12)
//     33108 Surya arudha view           0x43f460: standard set, arudhas counted from the Sun (S1..S12)
//     32807 Varnada view                0x43fa10: As..Ke, HL, GL, AL, 47..58 (VL, V2..V12)
//     32894 Chara Karaka view           0x43f8c0: As..Ke, HL, GL, AL, A2..UL; Su..Ra labelled by
//           their karakas (FUN_004a4fd0: every role held, "AK/GK"), label flag 0x65b230 = 1
//     33052 Special lagna view          0x43fb70: As, HL, GL, AL, 16..20 (VG, PP, SL, IL, BB), 47 VL
// * FUN_0043f030 (standard view): bodies 0..7 always, then by the global "optional bodies in
//   standard view" flags DAT_008a1774.. (menu 33053..33061/33268/33270, each handler toggles
//   its flag and re-applies the standard view to every slot of kind 0), loaded from the ini
//   keys at 0x4e3b03 in this order: ShowNodesInCharts (8, 9), ShowOuterPlanetsInCharts
//   (10..12), ShowALInCharts (59), ShowOtherArudhasInCharts (60..70), ShowHLInCharts (14),
//   ShowGLInCharts (15), ShowSLInCharts (18), ShowBBInCharts (20), ShowPPInCharts (17),
//   ShowUserPointsInCharts (31 Maandi!), ShowMandiInCharts (32 Gulika!). Only 11 keys are read
//   and written (the 12th name, ShowGulikaInCharts, is never used), so the Maandi toggle 33060
//   is stored under "ShowUserPointsInCharts" and the Gulika toggle 33061 under "ShowMandiInCharts".
// * Signs (FUN_004a3800, per varga): 59..70 bhava arudhas of houses 1..12 (bhava exceptions);
//   71..82 the same houses' sign counted from their lord (2*house - lord, graha exceptions);
//   83..91 graha arudhas of Su..Ke (FUN_004ad4c0 picks the own sign); 92..96 the arudhas of
//   Ar, Ge, Sg, Ta, Cp from Ma, Me, Ju, Ve, Sa and 97..101 of Sc, Vi, Pi, Li, Aq.
// * Chandra/Surya arudha views (FUN_00442de0): body 59+k is drawn in the sign of body
//   59 + (ref - lagna + k) mod 12 with the label M1..M12 / S1..S12 (tables 0x65b1c8, 0x65b198).
// * In the drawing, bodies are visited in index order; 48..58, 60..70 and 71..82 go to the
//   small "corner" slots of a South Indian box, all others to the 3x3 main slots. Retrograde
//   bodies (chart + idx*0x30 + 0x108: Ma..Sa) are drawn "(Sa)".
import type { ChakraChart } from './chakras/common';
import { bodyLongitude } from './chakras/common';
import { vargaLongitude, type VargaName } from './vargas';
import { vargaSpec } from './vargaOptions';
import { bhavaArudha, grahaArudha, lordOf, signArudha, type ArudhaOptions } from './arudhas';
import { bhavaArudhaOptions, bhavaArudhaSigns } from './arudhaPadas';
import { charaKarakas, KARAKA_NAMES } from './basics';
import { GRAHAS, type Graha } from './positions';
import type { VargaCtx } from './signStrength';
import type { JhoraIni } from '../settings/generated';
import { DEFAULTS } from '../settings/generated';

/** JHora's short body labels by internal index (0x4ef180; note the trailing blanks of HL, GL, SL, AL). */
export const CHART_LABELS: string[] = [
  'As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke', 'Ur', 'Ne', 'Pl', 'BL', 'HL ', 'GL ', 'VG', 'PP', 'SL ', 'IL',
  'BB', 'Ku', 'Dh', 'Vy', 'PV', 'IC', 'UK', 'Kl', 'Mri', 'AP', 'YG', 'Md', 'Gk', 'PS', 'DS', 'MS', 'STS', 'TS', 'YS', 'RTS',
  'KS', 'BS', 'TS', 'CS', 'PS', 'YO', 'AY', 'VL', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12', 'AL ',
  'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'UL', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9',
  'L10', 'L11', 'L12', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke', 'Ma1', 'Me3', 'Ju9', 'Ve2', 'Sa10', 'Ma8', 'Me6',
  'Ju12', 'Ve7', 'Sa11',
];
export const BODY_COUNT = 105;

export type ChartView =
  | 'standard' | 'standardGrahaArudhas' | 'upagraha' | 'grahaArudha' | 'dualGrahaArudha'
  | 'chandraArudha' | 'suryaArudha' | 'varnada' | 'charaKaraka' | 'specialLagna';

/** Menu 103 "Choose a view (which bodies to show)", in menu order. */
export const CHART_VIEWS: { view: ChartView; cmd: number; label: string }[] = [
  { view: 'standard', cmd: 32803, label: 'Standard view' },
  { view: 'standardGrahaArudhas', cmd: 33211, label: 'Standard view with graha arudhas' },
  { view: 'upagraha', cmd: 32805, label: 'Upagraha view' },
  { view: 'grahaArudha', cmd: 32806, label: 'Graha arudha view' },
  { view: 'dualGrahaArudha', cmd: 33081, label: 'Dual graha arudha view' },
  { view: 'chandraArudha', cmd: 33107, label: 'Chandra arudha view (from Moon)' },
  { view: 'suryaArudha', cmd: 33108, label: 'Surya arudha view (from Sun)' },
  { view: 'varnada', cmd: 32807, label: 'Varnada view' },
  { view: 'charaKaraka', cmd: 32894, label: 'Chara Karaka view' },
  { view: 'specialLagna', cmd: 33052, label: 'Special lagna view' },
];

/** "Optional bodies in standard view" (menu 103): command, label, the ini key holding the flag. */
export const OPTIONAL_BODIES: { cmd: number; label: string; key: keyof JhoraIni }[] = [
  { cmd: 33053, label: 'Nodes (Rahu and Ketu)', key: 'ShowNodesInCharts' },
  { cmd: 33054, label: 'Uranus, Neptune and Pluto', key: 'ShowOuterPlanetsInCharts' },
  { cmd: 33055, label: 'Arudha Lagna', key: 'ShowALInCharts' },
  { cmd: 33056, label: 'Other Arudhas', key: 'ShowOtherArudhasInCharts' },
  { cmd: 33057, label: 'Hora Lagna', key: 'ShowHLInCharts' },
  { cmd: 33058, label: 'Ghati Lagna (Ghatika Lagna)', key: 'ShowGLInCharts' },
  { cmd: 33059, label: 'Sree Lagna', key: 'ShowSLInCharts' },
  { cmd: 33268, label: 'Bhrigu Bindu', key: 'ShowBBInCharts' },
  { cmd: 33270, label: 'Pranapada Lagna', key: 'ShowPPInCharts' },
  { cmd: 33060, label: 'Maandi', key: 'ShowUserPointsInCharts' },
  { cmd: 33061, label: 'Gulika', key: 'ShowMandiInCharts' },
];

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const on = (ini: Partial<JhoraIni>, k: keyof JhoraIni) => ((ini[k] ?? DEFAULTS[k]) as number) !== 0;

/** The indices a slot shows in `view` (FUN_0043f030 / FUN_0043f170 and the view handlers). */
export function viewBodies(view: ChartView, ini: Partial<JhoraIni> = {}): number[] {
  const out = new Set<number>(range(0, 7));
  if (view === 'standard' || view === 'standardGrahaArudhas' || view === 'chandraArudha' || view === 'suryaArudha') {
    const ar = view === 'standardGrahaArudhas' ? 71 : 59;
    if (on(ini, 'ShowNodesInCharts')) { out.add(8); out.add(9); }
    if (on(ini, 'ShowOuterPlanetsInCharts')) range(10, 12).forEach((i) => out.add(i));
    if (on(ini, 'ShowALInCharts')) out.add(ar);
    if (on(ini, 'ShowOtherArudhasInCharts')) range(ar + 1, ar + 11).forEach((i) => out.add(i));
    if (on(ini, 'ShowHLInCharts')) out.add(14);
    if (on(ini, 'ShowGLInCharts')) out.add(15);
    if (on(ini, 'ShowSLInCharts')) out.add(18);
    if (on(ini, 'ShowBBInCharts')) out.add(20);
    if (on(ini, 'ShowPPInCharts')) out.add(17);
    if (on(ini, 'ShowUserPointsInCharts')) out.add(31);
    if (on(ini, 'ShowMandiInCharts')) out.add(32);
    return [...out].sort((a, b) => a - b);
  }
  out.clear();
  const add = (...xs: number[]) => xs.forEach((i) => out.add(i));
  add(0, 14, 15);
  switch (view) {
    case 'upagraha': add(59, ...range(22, 32)); break;
    case 'grahaArudha': add(...range(83, 91)); break;
    case 'dualGrahaArudha': add(83, 84, 90, 91, ...range(92, 101)); break;
    case 'varnada': add(59, ...range(1, 9), ...range(47, 58)); break;
    case 'charaKaraka': add(59, ...range(1, 9), ...range(59, 70)); break;
    case 'specialLagna': add(59, 16, 17, 18, 19, 20, 47); break;
  }
  return [...out].sort((a, b) => a - b);
}

/** Colour group of a body (JHora's chart text colours, see ChartDiagram). */
export type BodyKind = 'lagna' | 'planet' | 'special' | 'upagraha' | 'sphuta' | 'al' | 'arudha' | 'user';
export function bodyKind(index: number): BodyKind {
  if (index === 0) return 'lagna';
  if (index <= 12 || (index >= 83 && index <= 101)) return 'planet';
  if (index <= 20 || index === 47) return 'special';
  if (index <= 32) return 'upagraha';
  if (index <= 46) return 'sphuta';
  if (index === 59) return 'al';
  return 'arudha';
}

/** Bodies JHora puts in the small corner slots of a South Indian box (V2..V12, A2..UL, L1..L12). */
export const isCornerBody = (index: number) => (index >= 48 && index <= 58) || (index >= 60 && index <= 70) || (index >= 71 && index <= 82);

/** One body as drawn in a chart. `id` is the graha name for 1..9, 'Lagna' for 0, else the label. */
export interface ChartPoint {
  index: number;
  id: string;
  /** JHora's label (trailing blanks kept: they matter in the text copies) */
  label: string;
  retrograde: boolean;
  kind: BodyKind;
  corner: boolean;
}

export function arudhaOptionsOf(ini: Partial<JhoraIni>): ArudhaOptions {
  return {
    bhavaExceptions: on(ini, 'ExceptionsInBhavaArudhas'),
    grahaExceptions: on(ini, 'ExceptionsInGrahaArudhas'),
    nodesAsLords: on(ini, 'NodesInArudhas'),
  };
}

const DUAL_SIGNS_A = [0, 2, 8, 1, 9], DUAL_SIGNS_B = [7, 5, 11, 6, 10];
const DUAL_PLANETS: Graha[] = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

/**
 * Sign (0 = Aries) of every body index in a varga, null where the chart data lacks it
 * (a worker ChartResult has no ini: arudha options then come from `ini`).
 */
export function bodySigns(chart: ChakraChart, varga: VargaName, ini: Partial<JhoraIni> = chart.ini ?? {}): (number | null)[] {
  const spec = vargaSpec(varga, ini);
  const vs = (lon: number) => Math.floor(vargaLongitude(lon, spec) / 30) % 12;
  const out: (number | null)[] = Array.from({ length: BODY_COUNT }, (_, i) => {
    if (i > 58) return null;
    const lon = bodyLongitude(chart, i);
    return lon === null ? null : vs(lon);
  });
  const g = chart.positions.grahas;
  const ctx: VargaCtx = { sign: (p: Graha) => vs(g[p].lon), degree: (p: Graha) => g[p].lon % 30 };
  const opt = arudhaOptionsOf(ini);
  const lagna = out[0]!;
  // LongitudeBasedBhavaArudhas (dialog 2059): AL..UL from exact longitudes (arudhaPadas.ts)
  const byLon = bhavaArudhaOptions(ini).longitudeBased ? bhavaArudhaSigns(chart, varga, ini) : null;
  for (let k = 0; k < 12; k++) {
    const house = (lagna + k) % 12;
    out[59 + k] = byLon ? byLon[k] : bhavaArudha(house, ctx, opt);
    out[71 + k] = signArudha(house, lordOf(house, ctx, opt), ctx, opt);
  }
  GRAHAS.forEach((p, j) => { out[83 + j] = grahaArudha(p, ctx, opt); });
  DUAL_PLANETS.forEach((p, j) => {
    out[92 + j] = signArudha(DUAL_SIGNS_A[j], p, ctx, opt);
    out[97 + j] = signArudha(DUAL_SIGNS_B[j], p, ctx, opt);
  });
  return out;
}

/** Chara karaka roles of Su..Ra as FUN_004a4fd0 labels them ("AK", or "AmK/PiK" for several). */
function karakaLabels(chart: ChakraChart, ini: Partial<JhoraIni>): Partial<Record<Graha, string>> {
  const scheme = (ini.CharaKarakaDefinition ?? DEFAULTS.CharaKarakaDefinition) === 0 ? 8 : 7;
  const out: Partial<Record<Graha, string>> = {};
  for (const k of charaKarakas(chart.positions, scheme)) out[k.planet] = out[k.planet] ? `${out[k.planet]}/${k.karaka}` : k.karaka;
  return out;
}

export interface ChartSignsOptions {
  view?: ChartView;
  ini?: Partial<JhoraIni>;
  /** explicit body indices instead of a view's set (used by the text copies) */
  indices?: number[];
  /** sign of every body index instead of bodySigns() (the Bhava/Chalit chakra, core/bhavaChart.ts) */
  signs?: (number | null)[];
}

/** The bodies a chart diagram draws in each sign (index 0 = Aries), in JHora's drawing order. */
export function chartSigns(chart: ChakraChart, varga: VargaName, opts: ChartSignsOptions = {}): ChartPoint[][] {
  const view = opts.view ?? 'standard';
  const ini = { ...(chart.ini ?? {}), ...(opts.ini ?? {}) };
  const signs = opts.signs ?? bodySigns(chart, varga, ini);
  const shown = opts.indices ?? viewBodies(view, ini);
  const lagna = signs[0]!;
  const ref = view === 'chandraArudha' ? signs[2] : view === 'suryaArudha' ? signs[1] : null;
  const karakas = view === 'charaKaraka' ? karakaLabels(chart, ini) : null;
  const out: ChartPoint[][] = Array.from({ length: 12 }, () => []);
  for (const i of shown) {
    let src = i, label = CHART_LABELS[i];
    if (ref !== null && ref !== undefined && i >= 59 && i <= 70) {
      src = 59 + (((ref - lagna + 12) % 12) + (i - 59)) % 12;
      label = `${view === 'chandraArudha' ? 'M' : 'S'}${i - 58}`;
    }
    if (karakas && i >= 1 && i <= 8) label = karakas[GRAHAS[i - 1]] ?? '';
    const s = signs[src];
    if (s === null || s === undefined) continue;
    const graha = i >= 1 && i <= 9 ? chart.positions.grahas[GRAHAS[i - 1]] : null;
    out[s].push({
      index: i, id: i === 0 ? 'Lagna' : graha ? GRAHAS[i - 1] : label.trim(), label,
      retrograde: i >= 3 && i <= 7 && !!graha?.retrograde && !karakas, kind: bodyKind(i), corner: isCornerBody(i),
    });
  }
  // the user bodies 103/104 (special point, planetary special lagna: core/userPoints.ts) follow
  // in every chart, labelled with their symbol, in the sign of their varga longitude
  if (!opts.indices && !opts.signs) {
    const spec = vargaSpec(varga, ini);
    for (const u of chart.userPoints ?? []) {
      const s = Math.floor(vargaLongitude(u.lon, spec) / 30) % 12;
      out[s].push({ index: u.index, id: u.symbol, label: u.symbol, retrograde: false, kind: 'user', corner: false });
    }
  }
  return out;
}
