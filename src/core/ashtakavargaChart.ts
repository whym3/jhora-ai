// JHora's drawn Strengths > Ashtakavarga view (CAshtakaVargaView: CRuntimeClass 0x546fd0,
// vtable 0x547248, OnDraw 0x422820, message map 0x546fe8, context menu 106 = 0x4239e0).
//
// jhora.exe facts:
// * View state (globals, kept between windows): chart DAT_00597fac (doc+0x50 natal or the chart
//   on screen, 33117 0x4243c0), varga DAT_00597fb4 (32840 0x4242d0 sets it and the highlight
//   varga), highlight varga DAT_00597fb8 (32841 0x4244c0), draw mode DAT_00597fbc (0 BAVs/SoAV,
//   1 PAV, 2 sodhya pindas, 3 nakshatras & rasis), SoAV flag DAT_00597fc0 (32829 0x423bf0 clears,
//   32830 0x423c90 sets), PAV body DAT_005781e8 (0 Lagna, 1 Sun .. 7 Saturn; 32831..32838,
//   default 1), "Highlight the rasi containing planet" DAT_005781e4 (32839 0x424230 toggles,
//   default on). The lagna shift of 32973 lives in the chart (+0x20544 + varga*4).
// * OnDraw 0x422820: fill the client with "Ashtakavarga background" (DAT_008977b4), then by mode
//   FUN_004228d0 (0, 1), FUN_00422ef0 (2), FUN_00423420 (3). Layout (vtbl+0x108 = 0x422640,
//   zoom 1 here): the 9 BAV boxes are 120 x 120 at (10 + 130 col, 100 + 130 row), box 0 = SAV
//   (view+0x104), box k = BAV of body k-1 (view+0x74 + 16k: As, Su .. Sa); the PAV box is
//   [10, 90, 410, 490] (view+0x114).
// * Mode 0 (FUN_004228d0): "%s of the %s" (0x5783f4: short varga name 0x8a2874[v], chart name
//   chart+0x1698) at (10, 10), font x1.1; then (34 px lower, font x1.2) "%s ashtakavarga (%s) -
//   with reference to %s.\nPositions in %s are highlighted." (0x57837c; without the highlight
//   0x57834c and no second line): "Bhinna"/"BAV" or "Sodhita (reduced)"/"SoAV", the long name
//   (0x8a29ac = 0x8a4188) of the reference sign = (lagna sign in the varga + shift) mod 12 and the
//   highlight varga's short name. Boxes: BAVs (AV object +0x2001*12) or reduced BAVs (+0x20e9*12),
//   labelled by the short body names 0x8a4820 ("As", "Su", ...); SAV box "SAV" (0x57832c) with
//   the SAV (+0x6573*4) or, in SoAV mode, the SAV reduced to 1..12 (FUN_00498570 0x499f8f:
//   mod1(SAV, 12), +0x65ca*4).
// * One South Indian box (FUN_00424c70 -> FUN_00424e60 for ChartStyle 0/1; 1 mirrors the
//   columns): fill "Ashtakavarga box" DAT_008977b8, 4 x 4 cells (col, row) Ar (1,0) .. Pi (0,0);
//   per sign: the cell is filled with DAT_008977cc when highlighting is on and body k (< 8) is in
//   that sign in the highlight varga (chart+0x17d7 + fb8 + k*0x1d: the actual, unshifted
//   positions); the count "%d" centred (DT 0x25) in the cell, colour DAT_008977c8, font x1.2;
//   then the label centred in the middle 2 x 2 cells, colour DAT_008977c4, x1.2; grid
//   FUN_0049fba0 in DAT_008977bc.
// * Mode 1 (PAV, FUN_004260f0 -> FUN_004262e0): "Prastara (spread-out) ashtakavarga or PAV
//   given below belongs to\n%s of the %s. The %s house is used instead of lagna." (0x5781ec,
//   + "\nHighlighting of the rasi occupied by the planet is based on the positions in %s." with
//   the highlight, 0x578264): short varga, chart name, ordinal of the shift (0x8a2718 "1st" ..),
//   highlight varga. Box [10, 90, 410, 490]: per sign the contributors giving a bindu
//   (AV object +0x19884 + (body + varga*8)*0x6c + 12 + sign*8 + k), the n-th one drawn at slot
//   (n & 1, n >> 1) of a 2 x 4 grid: rect (cell + 5 + x*cw/2, cell + 5 + y*ch/4, cw/2, ch/4),
//   top-left, colour DAT_008977c8, the narrow font 0x8a17b8; "PAV" (0x57866c) centred in the top
//   half of the middle and the body's long name (0x8a29b4 = 0x8a4b54) centred in the middle, x1.5.
// * Mode 2 (FUN_00422ef0): "Based on %s of the %s:" (0x578438) at [30, 20, .., 44] x1.5; header
//   row 80..104 "Planet" (left at 30), "Sodhya Pinda" / "Rasi Pinda" / "Graha Pinda" centred in
//   [130, 190] / [230, 290] / [330, 390]; rows of 24 px from 114: long body name, the three pindas
//   (AV object +0x201a4 / +0x1fe04 / +0x1fa64), colour DAT_008977c8.
// * Mode 3 (FUN_00423420): "Based on %s of the %s:" at (5, 5) x1.5; the explanation 0x578450
//   (colour DAT_008977d0) at (5, 40); header row 110..134: "Rasi" at 5, the 8 long body names
//   centred in [65 + 100k, 125 + 100k]; per sign s a 50 px band from 140: short sign name
//   (0x8a2948 = 0x8a2918 "Ar") at 5, then per body n = BAV count (raw) x sodhya pinda, the
//   nakshatra mod1(n, 27) (0x8a40a4 "Aswi") centred in [top, top + 24] and the rasi mod1(n, 12)
//   (0x8a4188 "Aries") 22 px lower.
// * Colours (Preferences > Colors): background 0x8977b4, box 0x8977b8, grid 0x8977bc, captions
//   0x8977c0, labels 0x8977c4, numbers 0x8977c8, highlight 0x8977cc, note 0x8977d0; the port
//   maps them to theme tokens (src/ui/shell/ashtakavarga.css).
// * Not ported: the North and East Indian boxes (FUN_00425340 / FUN_00425a80 and the PAV's
//   FUN_00426a10 / FUN_00427470, ChartStyle 2..4): the South Indian box is drawn for every
//   style; the print layout (DAT_008a4b69).
import type { Chart } from './chart';
import type { Table } from '../engine/protocol';
import { AV_BODIES, ashtakavarga, avOptionsFromIni, pindaNakshatras, prastara, shiftLagna, type AvBody, type SodhyaPinda } from './ashtakavarga';
import { vargaLongitude, type VargaName } from './vargas';
import { vargaColumnLabel, vargasOf } from './vargaOptions';
import { NAKSHATRAS, SIGN_NAMES, SIGNS } from './zodiac';
import { ORDINAL } from './basics';

/** Menu 106 draw modes, as the Strengths > Ashtakavarga mode labels (src/ui/shell/tabs.ts AV_MODES). */
export const AV_DRAW_MODES = [
  'BAVs and SAV', 'SoAV', 'PAV of Sun', 'PAV of Moon', 'PAV of Mars', 'PAV of Mercury', 'PAV of Jupiter', 'PAV of Venus', 'PAV of Saturn',
  'PAV of Lagna', 'Sodhya pindas', 'Nakshatras & rasis',
] as const;

/** Short body labels of the boxes (0x8a4820[0..7]). */
export const AV_SHORT = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa'];
/** Long body names (0x8a4b54[0..7]). */
export const AV_LONG = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
/** The explanation of mode 3 (0x578450). */
export const AV_PINDA_NOTE = 'By multiplying the sodhya pinda of a planet and the score in its ashtakavarga in a rasi, we get a number. By dividing\r\nit with 27 and 12, we get a nakshatra or rasi. Transit of Jupiter/Saturn in it is good/bad for the matters signified by\r\nthe relevant house from the planet. For example, use Sun\'s sodhya pinda and the 9th from Sun for father.';

/** Everything the view draws, for one chart and varga (the AV object of FUN_00498570). */
export interface AvChartData {
  /** short name of the varga (0x8a2874[v]) and of the highlight varga */
  vargaLabel: string;
  highlightLabel: string;
  /** signs moved on by 32973 */
  shift: number;
  /** reference sign: the varga lagna + shift */
  ref: number;
  /** by AV body (Lagna, Sun .. Saturn), signs Aries first */
  bav: number[][];
  reduced: number[][];
  sav: number[];
  /** SoAV mode's SAV box: mod1(SAV, 12) */
  savMod: number[];
  /** pav[owner][contributor][sign]: 1 = bindu */
  pav: number[][][];
  pindas: SodhyaPinda[];
  /** nakshatra and rasi from the pindas, [body][sign] */
  nakRasi: { nakshatra: number; rasi: number }[][];
  /** sign of each body in the highlight varga (unshifted) */
  positions: number[];
}

export interface AvChartOptions {
  varga?: VargaName;
  /** highlight varga (32841); default the varga */
  highlightVarga?: VargaName;
  lagnaShift?: number;
}

const mod1 = (x: number, n: number) => { const r = x % n; return r === 0 ? n : r; };

export function avChartData(chart: Chart, o: AvChartOptions = {}): AvChartData {
  const varga = o.varga ?? 'D1';
  const hv = o.highlightVarga ?? varga;
  const shift = (((o.lagnaShift ?? 0) % 12) + 12) % 12;
  const vargas = vargasOf(chart.ini);
  const lonOf = (b: AvBody) => (b === 'Lagna' ? chart.positions.ascendant : chart.positions.grahas[b].lon);
  const signIn = (v: VargaName) => (b: AvBody) => Math.floor(vargaLongitude(lonOf(b), vargas[v]) / 30) % 12;
  const actual = signIn(varga);
  const sign = shiftLagna(actual, shift);
  const avo = avOptionsFromIni(chart.ini);
  const av = ashtakavarga(sign, avo);
  const nr = pindaNakshatras(av);
  return {
    vargaLabel: vargaColumnLabel(varga, chart.ini), highlightLabel: vargaColumnLabel(hv, chart.ini),
    shift, ref: sign('Lagna'),
    bav: AV_BODIES.map((b) => av.bav[b]), reduced: AV_BODIES.map((b) => av.reduced[b]),
    sav: av.sav, savMod: av.sav.map((x) => mod1(x, 12)),
    pav: AV_BODIES.map((owner) => { const p = prastara(owner, sign, avo); return AV_BODIES.map((c) => p[c]); }),
    pindas: AV_BODIES.map((b) => av.pindas[b]),
    nakRasi: AV_BODIES.map((b) => nr[b]),
    positions: AV_BODIES.map(signIn(hv)),
  };
}

/** Worker job: the view's data as JSON (text[0]); params varga, highlightVarga, lagnaShift. */
export const AV_CHART_JOBS: Record<string, (chart: Chart, params: Record<string, unknown>) => Table> = {
  'strengths.ashtakavargaChart': (chart, params) => ({
    headers: [], rows: [],
    text: [JSON.stringify(avChartData(chart, {
      varga: (params.varga as VargaName | undefined) ?? 'D1',
      highlightVarga: params.highlightVarga as VargaName | undefined,
      lagnaShift: Number(params.lagnaShift) || 0,
    }))],
  }),
};

// ---- drawing ----

/** Colour roles: captions 0x8977c0, labels 0x8977c4, numbers 0x8977c8, note 0x8977d0. */
export type AvTextRole = 'caption' | 'label' | 'number' | 'note';
export interface AvText {
  /** JHora's DrawText rect (left-aligned texts extend past it, DT_NOCLIP) */
  x: number; y: number; w: number; h: number;
  text: string;
  /** 'center' = DT_CENTER | DT_VCENTER | DT_SINGLELINE (0x25 / 0x101), 'left' = top-left (0x100) */
  align: 'left' | 'center';
  role: AvTextRole;
  /** font size relative to JHora's 18 px chart font (FUN_004ae370 factors) */
  scale: number;
  bold?: boolean;
  /** the PAV's narrow font (0x8a17b8) */
  narrow?: boolean;
}
export interface AvRect { x: number; y: number; w: number; h: number; role: 'box' | 'hl' }
export interface AvLine { x1: number; y1: number; x2: number; y2: number }
export interface AvDrawing { width: number; height: number; rects: AvRect[]; lines: AvLine[]; texts: AvText[] }

export interface AvDrawOptions {
  /** chart+0x1698: "Natal Chart", "Tajaka annual", ... */
  chartName: string;
  /** 32839 (default on) */
  highlight?: boolean;
  /** ChartStyle 1: South Indian with the columns mirrored */
  mirrored?: boolean;
}

/** FUN_00424e60: South Indian cell (col, row) per sign, Aries first. */
const SOUTH_COL = [1, 2, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0];
const SOUTH_ROW = [0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 1, 0];

/** FUN_0049fba0: the South Indian grid of a box. */
function southGrid(x: number, y: number, size: number): AvLine[] {
  const c = size / 4, l = (x1: number, y1: number, x2: number, y2: number): AvLine => ({ x1, y1, x2, y2 });
  return [
    l(x, y, x + size, y), l(x, y + size, x + size, y + size), l(x, y, x, y + size), l(x + size, y, x + size, y + size),
    l(x + c, y, x + c, y + size), l(x + 3 * c, y, x + 3 * c, y + size), l(x, y + c, x + size, y + c), l(x, y + 3 * c, x + size, y + 3 * c),
    l(x + 2 * c, y, x + 2 * c, y + c), l(x + 2 * c, y + 3 * c, x + 2 * c, y + size), l(x, y + 2 * c, x + c, y + 2 * c), l(x + 3 * c, y + 2 * c, x + size, y + 2 * c),
  ];
}

const cellOf = (s: number, mirrored: boolean) => [mirrored ? 3 - SOUTH_COL[s] : SOUTH_COL[s], SOUTH_ROW[s]];

function highlightCell(d: AvDrawing, x: number, y: number, size: number, sign: number, mirrored: boolean) {
  const c = size / 4, [col, row] = cellOf(sign, mirrored);
  d.rects.push({ x: x + col * c, y: y + row * c, w: c, h: c, role: 'hl' });
}

/** One BAV/SAV box (FUN_00424e60); `hlSign` = the body's sign to highlight, null for none (the SAV). */
function avBox(d: AvDrawing, x: number, y: number, size: number, counts: number[], label: string, hlSign: number | null, mirrored: boolean) {
  const c = size / 4;
  d.rects.push({ x, y, w: size, h: size, role: 'box' });
  if (hlSign !== null) highlightCell(d, x, y, size, hlSign, mirrored);
  counts.forEach((n, s) => {
    const [col, row] = cellOf(s, mirrored);
    d.texts.push({ x: x + col * c, y: y + row * c, w: c, h: c, text: String(n), align: 'center', role: 'number', scale: 1.2 });
  });
  d.texts.push({ x: x + c, y: y + c, w: 2 * c, h: 2 * c, text: label, align: 'center', role: 'label', scale: 1.2 });
  d.lines.push(...southGrid(x, y, size));
}

/** The view's drawing in JHora pixels (zoom 1) for one menu 106 mode. */
export function avDrawing(data: AvChartData, mode: string, o: AvDrawOptions): AvDrawing {
  const hl = o.highlight ?? true, mirrored = !!o.mirrored;
  const d: AvDrawing = { width: 0, height: 0, rects: [], lines: [], texts: [] };
  const left = (x: number, y: number, text: string, role: AvTextRole, scale: number, extra: Partial<AvText> = {}): AvText =>
    ({ x, y, w: 0, h: 0, text, align: 'left', role, scale, ...extra });
  if (mode === 'BAVs and SAV' || mode === 'SoAV') {
    const so = mode === 'SoAV';
    d.texts.push(left(10, 10, `${data.vargaLabel} of the ${o.chartName}`, 'caption', 1.1, { bold: true }));
    const what = so ? ['Sodhita (reduced)', 'SoAV'] : ['Bhinna', 'BAV'];
    const ref = SIGN_NAMES[data.ref];
    d.texts.push(left(10, 44, hl
      ? `${what[0]} ashtakavarga (${what[1]}) - with reference to ${ref}.\nPositions in ${data.highlightLabel} are highlighted.`
      : `${what[0]} ashtakavarga (${what[1]}) - with reference to ${ref}.`, 'caption', 1.2));
    const boxes: [number[], string, number][] = [[so ? data.savMod : data.sav, 'SAV', -1], ...(so ? data.reduced : data.bav).map((v, k): [number[], string, number] => [v, AV_SHORT[k], k])];
    // the boxes in drawing order: the 8 BAVs, then the SAV (FUN_004228d0)
    [...boxes.slice(1), boxes[0]].forEach(([counts, label, body]) => {
      const k = body < 0 ? 0 : body + 1;
      avBox(d, 10 + 130 * (k % 3), 100 + 130 * Math.floor(k / 3), 120, counts, label, hl && body >= 0 ? data.positions[body] : null, mirrored);
    });
    d.width = 620;
    d.height = 490;
    return d;
  }
  if (mode.startsWith('PAV of ')) {
    const body = AV_LONG.indexOf(mode.slice(7));
    d.texts.push(left(10, 10, `Prastara (spread-out) ashtakavarga or PAV given below belongs to\n${data.vargaLabel} of the ${o.chartName}. The ${ORDINAL[data.shift]} house is used instead of lagna.`
      + (hl ? `\nHighlighting of the rasi occupied by the planet is based on the positions in ${data.highlightLabel}.` : ''), 'caption', 1.2));
    const x0 = 10, y0 = 90, size = 400, c = 100;
    d.rects.push({ x: x0, y: y0, w: size, h: size, role: 'box' });
    if (hl && body >= 0) highlightCell(d, x0, y0, size, data.positions[body], mirrored);
    for (let s = 0; s < 12; s++) {
      const [col, row] = cellOf(s, mirrored);
      let n = 0;
      for (let k = 0; k < 8; k++) {
        if (!data.pav[body][k][s]) continue;
        d.texts.push({ x: x0 + col * c + 5 + (n & 1) * (c / 2), y: y0 + row * c + 5 + (n >> 1) * (c / 4), w: c / 2, h: c / 4, text: AV_SHORT[k], align: 'left', role: 'number', scale: 1, narrow: true });
        n++;
      }
    }
    d.texts.push({ x: x0 + c, y: y0 + c, w: 2 * c, h: c, text: 'PAV', align: 'center', role: 'label', scale: 1.2 });
    d.texts.push({ x: x0 + c, y: y0 + c, w: 2 * c, h: 2 * c, text: AV_LONG[body], align: 'center', role: 'label', scale: 1.5 });
    d.lines.push(...southGrid(x0, y0, size));
    d.width = 900;
    d.height = 500;
    return d;
  }
  if (mode === 'Sodhya pindas') {
    d.texts.push({ x: 30, y: 20, w: 60, h: 24, text: `Based on ${data.vargaLabel} of the ${o.chartName}:`, align: 'left', role: 'label', scale: 1.5 });
    const cols: [number, number][] = [[130, 190], [230, 290], [330, 390]];
    d.texts.push({ x: 30, y: 80, w: 60, h: 24, text: 'Planet', align: 'left', role: 'label', scale: 1 });
    ['Sodhya Pinda', 'Rasi Pinda', 'Graha Pinda'].forEach((t, i) => d.texts.push({ x: cols[i][0], y: 80, w: 60, h: 24, text: t, align: 'center', role: 'label', scale: 1 }));
    data.pindas.forEach((p, k) => {
      const y = 114 + 24 * k;
      d.texts.push({ x: 30, y, w: 60, h: 24, text: AV_LONG[k], align: 'left', role: 'label', scale: 1 });
      [p.total, p.rasi, p.graha].forEach((v, i) => d.texts.push({ x: cols[i][0], y, w: 60, h: 24, text: String(v), align: 'center', role: 'number', scale: 1 }));
    });
    d.width = 420;
    d.height = 320;
    return d;
  }
  if (mode === 'Nakshatras & rasis') {
    d.texts.push({ x: 5, y: 5, w: 60, h: 30, text: `Based on ${data.vargaLabel} of the ${o.chartName}:`, align: 'left', role: 'label', scale: 1.5 });
    d.texts.push({ x: 5, y: 40, w: 60, h: 72, text: AV_PINDA_NOTE.replace(/\r\n/g, '\n'), align: 'left', role: 'note', scale: 1 });
    d.texts.push({ x: 5, y: 110, w: 60, h: 24, text: 'Rasi', align: 'left', role: 'label', scale: 1, bold: true });
    AV_LONG.forEach((n, k) => d.texts.push({ x: 65 + 100 * k, y: 110, w: 60, h: 24, text: n, align: 'center', role: 'label', scale: 1, bold: true }));
    for (let s = 0; s < 12; s++) {
      const y = 140 + 50 * s;
      d.texts.push({ x: 5, y, w: 60, h: 24, text: SIGNS[s], align: 'left', role: 'label', scale: 1, bold: true });
      data.nakRasi.forEach((cells, k) => {
        const x = 65 + 100 * k;
        d.texts.push({ x, y, w: 60, h: 24, text: NAKSHATRAS[cells[s].nakshatra], align: 'center', role: 'number', scale: 1 });
        d.texts.push({ x, y: y + 22, w: 60, h: 24, text: SIGN_NAMES[cells[s].rasi], align: 'center', role: 'number', scale: 1 });
      });
    }
    d.width = 880;
    d.height = 750;
    return d;
  }
  throw new Error(`unknown ashtakavarga mode ${mode}`);
}
