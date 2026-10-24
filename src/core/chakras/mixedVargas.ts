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
//   59..70 (AL, A2..A11, UL).
// * Command 32914 (handler 0x4626c0) stores (clicked sign - inner lagna) mod 12
//   at view+0x88b8/+0x88bc (house reference for the chart menu) and redraws.
// * No copy-to-clipboard command in this view.
import type { ChakraBody, ChakraChart } from './common';
import { bodiesByIndex, signOf } from './common';
import { ALL_VARGAS, vargaLongitude } from '../vargas';
import { JHORA_VARGAS, JHORA_VARGA_NAMES } from '../dasas/rasiCommon';
import type { Graha } from '../positions';
import { bhavaArudha } from '../arudhas';
import type { VargaCtx } from '../signStrength';

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
    if (b.index > 59 && b.index <= 70) {
      const [x, y] = [MIXED_ARUDHA_X[k % 12], MIXED_ARUDHA_Y[k % 12]];
      k++;
      return [x / 8, 5 / 18 + y / 9];
    }
    const i = n++ % 9;
    return [MIXED_SLOT_X[i] / 6, (MIXED_SLOT_Y[i] * 5) / 54];
  });
}

/** Labels of the arudha bodies 59..70. */
export const ARUDHA_LABELS = ['AL', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'UL'];

export interface MixedSign { sign: number; inner: ChakraBody[]; outer: ChakraBody[] }
export interface MixedVargasData {
  innerVarga: number;
  outerVarga: number;
  /** centre captions: [first line, second line or ''] */
  innerCaption: [string, string];
  outerCaption: [string, string];
  /** inner chart's lagna sign in the inner varga (house 1 of the North Indian style) */
  lagnaSign: number;
  /** index 0 = Aries */
  signs: MixedSign[];
}

export interface MixedVargasOptions {
  /** JHora varga index of the inner chart (default 0 = D-1) */
  inner?: number;
  /** JHora varga index of the outer chart (default 1 = D-9, or 0 when `outerChart` is given) */
  outer?: number;
  /** chart drawn in the outer half (JHora: the displayed transit/derived chart); default the natal chart */
  outerChart?: ChakraChart | null;
  /** include the arudha padas AL..UL (default true) */
  arudhas?: boolean;
  /** chart names for the "Inner: %s" / "Outer: %s" captions (default NATAL_CHART_NAME for the natal chart) */
  innerName?: string;
  outerName?: string;
}

const spec = (v: number) => {
  const name = JHORA_VARGAS[v];
  if (!name) throw new Error(`varga index ${v} not supported`);
  return ALL_VARGAS[name];
};

/** Bodies of one chart in one varga, signs 0..11 (Aries first). */
export function vargaBodies(chart: ChakraChart, vargaIndex: number, transit = false, arudhas = true): { lagna: number; bySign: ChakraBody[][] } {
  const sp = spec(vargaIndex);
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

const caption = (prefix: string, name: string | undefined, v: number): [string, string] => {
  const head = name ? `${prefix}: ${name}` : prefix;
  return v === 0 || v === 1 ? [head, JHORA_VARGA_LONG_NAMES[v]] : [head, `${JHORA_VARGA_LONG_NAMES[v]} (${JHORA_VARGA_NAMES[v]})`];
};

export function mixedVargas(chart: ChakraChart, opts: MixedVargasOptions = {}): MixedVargasData {
  const outerChart = opts.outerChart ?? null;
  const innerVarga = opts.inner ?? 0;
  const outerVarga = opts.outer ?? (outerChart ? 0 : 1);
  const arudhas = opts.arudhas ?? true;
  const inner = vargaBodies(chart, innerVarga, false, arudhas);
  const outer = vargaBodies(outerChart ?? chart, outerVarga, !!outerChart, arudhas);
  return {
    innerVarga, outerVarga,
    innerCaption: caption('Inner', opts.innerName ?? NATAL_CHART_NAME, innerVarga),
    outerCaption: caption('Outer', opts.outerName ?? (outerChart ? undefined : NATAL_CHART_NAME), outerVarga),
    lagnaSign: inner.lagna,
    signs: Array.from({ length: 12 }, (_, s) => ({ sign: s, inner: inner.bySign[s], outer: outer.bySign[s] })),
  };
}

