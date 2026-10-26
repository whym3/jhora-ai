// Mixed 2-Vargas sub-tab (CMixedChartView, OnDraw 0x45cc40, OnInitialUpdate
// 0x45c6a0, context menu 0x45c8d0 = menu 153, the general chart menu).
//
// * Two vargas of up to two charts are drawn into ONE chart frame:
//     inner = FUN_0045d0b0(.., varga DAT_00579a60, chart A, slot 0xc, lagna)
//     outer = FUN_0045d0b0(.., varga DAT_00579a64, chart B, slot 0xd, lagna)
//   chart A is the natal chart (doc+0x50) when DAT_0065b8d4 != 0, else the
//   document's current chart (doc+0x76d00); chart B likewise via DAT_0065b8d8.
//   `lagna` (house 1 for the North Indian style) is always the INNER chart's
//   lagna sign in the inner varga (chart A + 0x17d7 + varga).
// * OnInitialUpdate defaults: DAT_0065b8d4 = 1 (inner from natal),
//   DAT_0065b8d8 = 0 (outer from the current chart), inner varga 0 (D-1),
//   outer varga = 1 (D-9) when the chart kind doc+0x76d04 is 0 (plain natal),
//   else 0 (D-1 of the transit/Tajaka/... chart being shown). Document setup
//   code (0x402f74, 0x403c7a, 0x405d37, 0x422045, ...) resets the same globals
//   whenever a derived chart is opened. No ini key stores the two vargas.
// * Style = ChartStyle (DAT_0065b930: 0 South Indian regular, 1 South Indian
//   irregular, 2 North Indian, 3 East Indian, 4 East Indian with frame). The
//   whole rect is filled with "Outer chart background in mixed charts"
//   (DAT_008977b0), then an inner rect inset by 1/8 of the size (1/6 for the
//   East styles) with the normal background, outlined with "Inner-outer
//   separator in mixed charts" (DAT_008977ac).
// * South Indian (FUN_0045d1e0): the usual 4x4 grid (Pisces top-left, Aries
//   next, clockwise). Every sign box is split in two half-size sub-boxes: the
//   half towards the centre (inside the separator) holds the inner varga's
//   bodies, the half towards the frame edge holds the outer varga's
//   (quarter-cell offset tables: inner x [1,1,0,0,0,0,1,1,2,2,2,2],
//   y [2,2,2,1,1,0,0,0,0,1,1,2]; outer x [1,1,2,2,2,2,1,1,0,0,0,0],
//   y [0,0,0,1,1,2,2,2,2,1,1,0], indexed by sign Ar..Pi).
//   In a sub-box the bodies are drawn in index order, left/top-aligned
//   (DrawText 0x100) at 2 px plus (tables local_45c / local_4cc, in cells c):
//   the n-th body other than A2..UL (lagna, grahas, special lagnas, Md, Gk, AL)
//   at (MIXED_SLOT_X[n % 9] c/6, MIXED_SLOT_Y[n % 9] 5c/54); the k-th of A2..UL
//   (indices 60..70) at (MIXED_ARUDHA_X[k] c/8, 5c/18 + MIXED_ARUDHA_Y[k] c/9).
// * Centre text: "Outer: %s" (chart name, chart+0x1698; "Natal Chart",
//   0x5743f4, for the natal chart) above the outer varga name and "Inner: %s"
//   above the inner varga name; varga 0/1 print the long name only ("Rasi",
//   "Navamsa", larger font), others the long name plus the short "D-n".
//   No sign names are drawn.
// * Bodies per slot (flags DAT_0065b27c + slot*0x69, set by FUN_0043f030 from
//   the display preferences, all on by default except Uranus..Pluto):
//   0..9 (As, Su..Ke), 14 HL, 15 GL, 17 PP, 18 SL, 20 BB, 31 Md, 32 Gk,
//   59..70 (AL, A2..A11, UL). FUN_0045d1e0 visits the 105 body indices in order
//   and draws those whose flag is set in their sign of the half's varga (chart
//   +0x17d7+varga+b*0x1d, so varga 28 is the Bhava/Chalit chakra); 48..58, 60..70
//   and 71..82 go to the corner slots (one counter for all three groups), the
//   others to the 3x3 slots; Chandra/Surya arudha views (DAT_0065b938[slot] 2/1)
//   draw body 59+k in the sign of 59 + (ref - lagna + k) mod 12, the Chara Karaka
//   view (DAT_0065b230[slot]) labels Su..Ra by FUN_004a4fd0 - i.e. what
//   core/chartBodies.ts chartSigns() gives for the slot's view. Graha arudha
//   views (DAT_0065b240[slot] 3, 4) add the caption "Arudhas of Planets"
//   (0x57afcc) below the varga name.
// * Command 32914 (handler 0x4626c0) stores (clicked sign - inner lagna) mod 12
//   at view+0x88b8/+0x88bc (house reference for the chart menu) and redraws.
// * Message map 0x54ca70 (entries 0x54ca78): WM_CONTEXTMENU 0x45c8d0, command
//   32914 0x4626c0, WM_MOUSEWHEEL 0x48a300; base map 0x547e90 = CChartView's. So
//   every menu-153 command runs CChartView's handler on the slot the menu was
//   opened on, view+0x8ad0: the context menu sets it to 13 (outer) when the
//   click is in the chart rect (view+0x148) and to 12 (inner) when inside the
//   separator square (view+0x8ae0); the clicked sign (FUN_0049efb0 over the 12
//   sign boxes, view+0x8ad4, unchanged when none is hit: 12 after
//   OnInitialUpdate) and body (the slot's label rects of Lagna..Ketu,
//   view+0x178+(slot*10+k)*16; FUN_0045d1e0 stores graha arudha 83+j's rect as
//   planet 1+j's) feed the planet/rasi commands. Before showing the menu it
//   clears the highlights (FUN_004404e0 -> FUN_00440570) like CChartView, checks
//   the view item local_30[DAT_0065b240[slot]] of the table {32803, 32805,
//   32806, 33081, 33107, 33108, 32807, 32894, 33052} - indexed by view kind, in
//   which kind 1 is "Standard view with graha arudhas" (not in menu 153), so
//   every view but the standard one checks the item after its own
//   (MIXED_VIEW_CHECK) - and 32801 "Automatic" when DAT_0065b8a4[slot] = 0, else
//   32802 "Natal chart only". With ChartStyle 2 (North Indian) and a sign hit it
//   inserts "Show chart from this house" (32914) and a separator at the top.
//   The menu goes to the top-level frame (TrackPopupMenu owner: the first
//   non-child parent), whose WM_INITMENUPOPUP runs CChartView's update handlers
//   (FUN_0043b770: "When will lagna change sign in %s" etc., ChartMenu.tsx).
// * Menu-153 commands (src/ui/chakras/MixedVargas.tsx, ChartMenu.tsx): 33076 lagna
//   sign change, 32827 ashtakavarga, the varga items (32777 Rasi, 33009
//   Bhava/Chalit = varga 28, 32778 Navamsa, 32782..32800, 33239, 33063:
//   DisplayVarga[12] / [13] = DAT_00579a60 / DAT_00579a64), 33113 MKS, the
//   relationships (32944..32946: the slot's planets on coloured boxes,
//   view+0x88c4[slot]), the rasi highlights (32808..32819; FUN_0045d1e0's inner
//   pass highlights a sign box when either slot's highlight arrays view+0x871f /
//   view+0x87d3 + slot*12 hold it), the text copies 32985 / 32992 of the half
//   (handlers 0x4326f0 / 0x432790: DisplayVarga[slot] of the slot's chart,
//   core/chartText.ts), the views 32803..33052, the optional bodies
//   33053..33061 (global) and the display mode 32801 / 32802 (DAT_0065b8a4[slot]:
//   1 = the natal chart, 0 = the chart on screen).
import type { ChakraBody, ChakraChart } from './common';
import { bodiesByIndex, bodyLongitude, signOf } from './common';
import { vargaLongitude } from '../vargas';
import { VARGA_INDEX, vargaColumnLabel, vargaSpec } from '../vargaOptions';
import { JHORA_VARGAS, JHORA_VARGA_NAMES } from '../dasas/rasiCommon';
import type { Graha } from '../positions';
import { bhavaArudha } from '../arudhas';
import type { VargaCtx } from '../signStrength';
import { chartSigns, isCornerBody, type ChartView } from '../chartBodies';
import { bhavaShortName } from '../bhavaChart';
import type { JhoraIni } from '../../settings/generated';

/** Long varga names (table at 0x8a4110, by JHora varga index). */
export const JHORA_VARGA_LONG_NAMES = [
  'Rasi', 'Navamsa', 'Hora', 'Drekkana', 'Chaturthamsa', 'Panchamsa', 'Shashthamsa', 'Saptamsa', 'Ashtamsa',
  'Dasamsa', 'Rudramsa', 'Dwadasamsa', 'Shodasamsa', 'Vimsamsa', 'Siddhamsa', 'Nakshatramsa', 'Trimsamsa',
  'Khavedamsa', 'Akshavedamsa', 'Shashtyamsa', 'Navanavamsa', 'Ashtottaramsa', 'Dwadasa-Dwadasamsa', '', '',
  'Nadyamsa', 'Hora', 'Hadda', 'Bhava/Chalit',
];

/** Bodies shown in each half by default (JHora internal indices, drawing order). */
export const MIXED_DEFAULT_BODIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15, 17, 18, 20, 31, 32];
/** JHora's name of the natal chart (0x5743f4), shown in the captions. */
export const NATAL_CHART_NAME = 'Natal Chart';
/** Body slots in a half-size sub-box (see the header): bodies in units c/6, 5c/54. */
export const MIXED_SLOT_X = [1, 0, 2, 0, 1, 0, 2, 1, 2];
export const MIXED_SLOT_Y = [1, 0, 0, 2, 0, 1, 1, 2, 2];
/** A2..UL in units c/8 and c/9 (below 5c/18). */
export const MIXED_ARUDHA_X = [3, 1, 3, 1, 3, 1, 2, 0, 2, 0, 2, 0];
export const MIXED_ARUDHA_Y = [1, 1, 0, 0, -1, -1, 1, 1, 0, 0, -1, -1];

/** Top-left of each body's text in its sub-box, in cells (without JHora's 2 px margin). */
export function mixedSlots(bodies: ChakraBody[]): [number, number][] {
  let n = 0, k = 0;
  return bodies.map((b): [number, number] => {
    // the corner bodies V2..V12, A2..UL, L1..L12 share one counter (FUN_0045d1e0 local_4e0)
    if (isCornerBody(b.index)) {
      const [x, y] = [MIXED_ARUDHA_X[k % 12], MIXED_ARUDHA_Y[k % 12]];
      k++;
      return [x / 8, 5 / 18 + y / 9];
    }
    const i = n++ % 9;
    return [MIXED_SLOT_X[i] / 6, (MIXED_SLOT_Y[i] * 5) / 54];
  });
}

/**
 * The view item the menu checks for a slot's view (0x45c8d0: local_30[DAT_0065b240[slot]], see
 * the header): JHora's off-by-one, kept. null = nothing checked (special lagna view, kind 9).
 */
export const MIXED_VIEW_CHECK: Record<ChartView, ChartView | null> = {
  standard: 'standard', standardGrahaArudhas: 'upagraha', upagraha: 'grahaArudha', grahaArudha: 'dualGrahaArudha',
  dualGrahaArudha: 'chandraArudha', chandraArudha: 'suryaArudha', suryaArudha: 'varnada', varnada: 'charaKaraka',
  charaKaraka: 'specialLagna', specialLagna: null,
};

/** Caption below the varga name in the graha arudha views (DAT_0065b240[slot] 3 or 4, 0x57afcc). */
export const ARUDHAS_OF_PLANETS = 'Arudhas of Planets';
/** JHora's varga index of the Bhava/Chalit chakra. */
export const MIXED_BHAVA_VARGA = 28;

/** Labels of the arudha bodies 59..70. */
export const ARUDHA_LABELS = ['AL', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'UL'];

export interface MixedSign { sign: number; inner: ChakraBody[]; outer: ChakraBody[] }
export interface MixedVargasData {
  innerVarga: number;
  outerVarga: number;
  /** centre captions: ["Inner: <chart name>", long varga name] */
  innerCaption: [string, string];
  outerCaption: [string, string];
  /** the short varga name drawn below the long one (0x8a2874[v]: "D-3", "D-1 (Moon)"); '' for D-1 and D-9 */
  innerShort: string;
  outerShort: string;
  /** "Arudhas of Planets" in the graha arudha views, else '' */
  innerNote: string;
  outerNote: string;
  /** inner chart's lagna sign in the inner varga (house 1 of the North Indian style) */
  lagnaSign: number;
  /** index 0 = Aries */
  signs: MixedSign[];
}

export interface MixedVargasOptions {
  /** JHora varga index of the inner chart (default 0 = D-1; 28 = the Bhava/Chalit chakra) */
  inner?: number;
  /** JHora varga index of the outer chart (default 1 = D-9, or 0 when `outerChart` is given) */
  outer?: number;
  /** chart drawn in the outer half (JHora: the displayed transit/derived chart); default the natal chart */
  outerChart?: ChakraChart | null;
  /** chart drawn in the inner half instead of `chart` (display mode "Automatic" with a derived chart on screen) */
  innerChart?: ChakraChart | null;
  /** include the arudha padas AL..UL (default true) */
  arudhas?: boolean;
  /** chart names for the "Inner: %s" / "Outer: %s" captions (default NATAL_CHART_NAME for the natal chart) */
  innerName?: string;
  outerName?: string;
  /** body views of the halves (menu 153 "Choose a view"); when given the bodies follow chartSigns() */
  innerView?: ChartView;
  outerView?: ChartView;
  /** preferences of the views (optional bodies, varga and arudha options) */
  ini?: Partial<JhoraIni>;
  /** sign of every body index in each half's Bhava/Chalit chakra (core/bhavaChart.ts), for varga 28 */
  innerBhavaSigns?: (number | null)[] | null;
  outerBhavaSigns?: (number | null)[] | null;
}

const spec = (v: number, ini?: ChakraChart['ini']) => {
  const name = JHORA_VARGAS[v];
  if (!name) throw new Error(`varga index ${v} not supported`);
  return vargaSpec(name, ini);
};

/** Bodies of one chart in one varga, signs 0..11 (Aries first). */
export function vargaBodies(chart: ChakraChart, vargaIndex: number, transit = false, arudhas = true): { lagna: number; bySign: ChakraBody[][] } {
  const sp = spec(vargaIndex, chart.ini);
  const vs = (lon: number) => signOf(vargaLongitude(lon, sp));
  const bySign: ChakraBody[][] = Array.from({ length: 12 }, () => []);
  for (const b of bodiesByIndex(chart, MIXED_DEFAULT_BODIES, transit)) bySign[vs(b.lon)].push(b);
  const lagna = vs(chart.positions.ascendant);
  if (arudhas) {
    const g = chart.positions.grahas;
    const ctx: VargaCtx = { sign: (p: Graha) => vs(g[p].lon), degree: (p: Graha) => g[p].lon % 30 };
    ARUDHA_LABELS.forEach((label, h) => {
      const s = bhavaArudha((lagna + h) % 12, ctx);
      bySign[s].push({ index: 59 + h, label, lon: s * 30, retrograde: false, transit });
    });
  }
  return { lagna, bySign };
}

/** Bodies of one chart in one varga as a body view draws them (chartSigns), signs 0..11 (Aries first). */
export function viewVargaBodies(chart: ChakraChart, vargaIndex: number, view: ChartView, opts: {
  transit?: boolean; arudhas?: boolean; ini?: Partial<JhoraIni>; bhavaSigns?: (number | null)[] | null;
} = {}): { lagna: number; bySign: ChakraBody[][] } {
  const bhava = vargaIndex === MIXED_BHAVA_VARGA;
  if (bhava && !opts.bhavaSigns) throw new Error('the Bhava/Chalit chakra needs its signs');
  const varga = bhava ? 'D1' : VARGA_INDEX[vargaIndex];
  if (!varga) throw new Error(`varga index ${vargaIndex} not supported`);
  const points = chartSigns(chart, varga, { view, ini: opts.ini, signs: bhava ? opts.bhavaSigns! : undefined });
  const arudhas = opts.arudhas ?? true;
  const bySign = points.map((list, s) => list
    .filter((b) => arudhas || b.index < 59 || b.index > 70)
    .map((b): ChakraBody => ({
      index: b.index, label: b.label.trim(), lon: (b.index <= 58 ? bodyLongitude(chart, b.index) : null) ?? s * 30,
      retrograde: b.retrograde, transit: !!opts.transit,
    })));
  return { lagna: points.findIndex((l) => l.some((b) => b.index === 0)), bySign };
}

/**
 * A half's centre captions: "Inner: %s" / "Outer: %s" (chart+0x1698), the long varga name
 * (0x8a29a8[v]) and, for vargas other than D-1 and D-9, the short one (0x8a2874[v]).
 */
export function mixedCaption(prefix: string, name: string | undefined, v: number, ini: Partial<JhoraIni> = {}): { caption: [string, string]; short: string } {
  const head = name ? `${prefix}: ${name}` : prefix;
  const short = v === 0 || v === 1 ? ''
    : v === MIXED_BHAVA_VARGA ? bhavaShortName(ini)
    : VARGA_INDEX[v] ? vargaColumnLabel(VARGA_INDEX[v], ini) : JHORA_VARGA_NAMES[v];
  return { caption: [head, JHORA_VARGA_LONG_NAMES[v]], short };
}

const noteOf = (view: ChartView | undefined) => (view === 'grahaArudha' || view === 'dualGrahaArudha' ? ARUDHAS_OF_PLANETS : '');

export function mixedVargas(chart: ChakraChart, opts: MixedVargasOptions = {}): MixedVargasData {
  const outerChart = opts.outerChart ?? null;
  const innerChart = opts.innerChart ?? chart;
  const innerVarga = opts.inner ?? 0;
  const outerVarga = opts.outer ?? (outerChart ? 0 : 1);
  const arudhas = opts.arudhas ?? true;
  const ini = opts.ini ?? {};
  const half = (c: ChakraChart, v: number, transit: boolean, view: ChartView | undefined, bhavaSigns: (number | null)[] | null | undefined) =>
    view || v === MIXED_BHAVA_VARGA
      ? viewVargaBodies(c, v, view ?? 'standard', { transit, arudhas, ini, bhavaSigns })
      : vargaBodies(c, v, transit, arudhas);
  const inner = half(innerChart, innerVarga, !!opts.innerChart, opts.innerView, opts.innerBhavaSigns);
  const outer = half(outerChart ?? chart, outerVarga, !!outerChart, opts.outerView, opts.outerBhavaSigns);
  const iniOf = (c: ChakraChart) => ({ ...(c.ini ?? {}), ...ini });
  const ic = mixedCaption('Inner', opts.innerName ?? (opts.innerChart ? undefined : NATAL_CHART_NAME), innerVarga, iniOf(innerChart));
  const oc = mixedCaption('Outer', opts.outerName ?? (outerChart ? undefined : NATAL_CHART_NAME), outerVarga, iniOf(outerChart ?? chart));
  return {
    innerVarga, outerVarga,
    innerCaption: ic.caption, outerCaption: oc.caption, innerShort: ic.short, outerShort: oc.short,
    innerNote: noteOf(opts.innerView), outerNote: noteOf(opts.outerView),
    lagnaSign: inner.lagna,
    signs: Array.from({ length: 12 }, (_, s) => ({ sign: s, inner: inner.bySign[s], outer: outer.bySign[s] })),
  };
}
