// Tripataki chakra (Chakras > Tripataki): CTripatakiChakraView, RTC 0x550658,
// vtbl 0x550780, OnDraw 0x490ff0 (not a Ghidra function; read with capstone) ->
// draw routine FUN_00491150(dc, chart, baseSign).
//
// JHora's Tripataki is a static SIGN chakra - no age/year progression and no
// transit overlay:
// * Coordinates in 144ths of the client rect minus 44 px at the top (title) and
//   24 px at the bottom; cell = 12 units.
// * Lines (pen width 2, traced by emulating 0x491290..0x4918a0): the 3x3 grid
//   x = 42, 72, 102 (y 12..132) and y = 42, 72, 102 (x 12..132); twelve vedha
//   diagonals from the side points (12|132, 42|72|102) to the top/bottom points
//   (42|72|102, 12|132); three pennants ("tri-pataka") on the vertical lines:
//   (x,12)-(x,6), (x,12)-(x-6,9), (x,6)-(x-6,9) for x = 42, 72, 102.
// * 12 sign labels (2-letter names via *(0x8a2948)) at TRIPATAKI_POS[i] holding
//   sign (base + i) mod 12, text box [x, x+12] x [y, y+12], centred: i = 0 top centre,
//   then anticlockwise (top-left, down the left side, along the bottom, up the right
//   side, top-right).
// * Base sign (OnDraw): sign byte chart+varga+b*0x1d+0x17d7 of body b = 0x89678c
//   (bss, 0 = Lagna) in varga 0x89679c (0 = D-1) from the NATAL chart (doc+0x50;
//   0x57c9a0 = 1); flag 0x57f80d (= 1) keeps the sign (0 would use the next sign).
//   Other chart kinds use body 0x896788 / flag 0x57f80c. "Base planet and division"
//   (33255) can set a fixed sign (0x896790 -> 0x896794) or body 0x8967a0 (0x896791).
// * Bodies from the document's CURRENT chart (doc+0x76d00), signs in varga 0x896798
//   (default D-1). Body set = view+0x12c: 0 Planets (bodies 0..9), 1 Trisphuta etc
//   (33..36), 2 Upagrahas (32,31,22..30), 3 Special lagnas (0,14,15,17,18,19,20),
//   4 Sahamas (chart+0x214f0). Menu 152 commands 33091/33092/33095/33096/33093.
// * The k-th body in a sign (k = count mod 12) is drawn at
//   x + 0.75*(XOFF[k]+2), y + 0.75*(YOFF[k]+1) (sahamas: x step 1.5x wider).
//   Label "(%s)" when retrograde, else "%s".
// * Title (0x491c5f): "<set> in <varga>(from <base body> in <base varga>)", e.g.
//   "Planets in D-1(from Lagna in D-1)" - no space before "(from" (0x57f810).
// * No copy-to-clipboard command exists in this view's message map.
import { bodyText, starChakraBodies, type ChakraSlot, type PlacedBody } from './shoola';
import { JHORA_BODIES, signOf, type ChakraBody, type ChakraChart } from './common';
import { SIGNS } from '../zodiac';

export type TripatakiMode = 'planets' | 'trisphuta' | 'upagrahas' | 'specialLagnas' | 'sahamas';
export const TRIPATAKI_MODES: TripatakiMode[] = ['planets', 'trisphuta', 'upagrahas', 'specialLagnas', 'sahamas'];
export const TRIPATAKI_MODE_NAMES: Record<TripatakiMode, string> = {
  planets: 'Planets', trisphuta: 'Trisphuta etc', upagrahas: 'Upagrahas', specialLagnas: 'Special Lagnas', sahamas: 'Sahamas (sahams)',
};

/** Sign label boxes (top-left, 144 units) by position from the base sign. */
export const TRIPATAKI_POS: [number, number][] = [
  [66, -6], [36, -6], [0, 39], [0, 69], [0, 99], [36, 132], [66, 132], [96, 132], [132, 99], [132, 69], [132, 39], [96, -6],
];

export const TRIPATAKI_LINES: [number, number, number, number][] = (() => {
  const l: [number, number, number, number][] = [];
  for (const v of [42, 72, 102]) l.push([v, 12, v, 132]);
  for (const v of [42, 72, 102]) l.push([12, v, 132, v]);
  for (const sx of [12, 132]) {
    l.push([sx, 42, sx === 12 ? 42 : 102, 12], [sx, 42, sx === 12 ? 102 : 42, 132]);
    l.push([sx, 72, 72, 12], [sx, 72, 72, 132]);
    l.push([sx, 102, sx === 12 ? 102 : 42, 12], [sx, 102, sx === 12 ? 42 : 102, 132]);
  }
  for (const x of [42, 72, 102]) l.push([x, 12, x, 6], [x, 12, x - 6, 9], [x, 6, x - 6, 9]);
  return l;
})();

const XOFF = [6, 6, 15, 15, 6, 6, 15, 15, 24, 24, 24, 24];
const YOFF = [6, 12, 6, 12, 18, 24, 18, 24, 6, 12, 18, 24];

export interface TripatakiOptions {
  mode?: TripatakiMode;
  /** internal body index whose natal sign is the base (default 0 = Lagna, 0x89678c) */
  baseBody?: number;
  /** false = start from the sign after the base body's sign (flag 0x57f80d, default true) */
  baseIsSign?: boolean;
  /** fixed base sign 0..11 */
  fixedBaseSign?: number;
  /** chart whose bodies are drawn (doc+0x76d00); defaults to the natal chart */
  current?: ChakraChart | null;
}

export interface TripatakiChakra {
  title: string;
  baseSign: number;
  slots: ChakraSlot[];
  lines: [number, number, number, number][];
  bodies: PlacedBody[];
}

export function tripatakiChakra(chart: ChakraChart, opts: TripatakiOptions = {}): TripatakiChakra {
  const mode = opts.mode ?? 'planets';
  const baseBody = opts.baseBody ?? 0;
  let baseSign: number;
  if (opts.fixedBaseSign !== undefined) baseSign = ((opts.fixedBaseSign % 12) + 12) % 12;
  else {
    const b = starChakraBodies(chart, 'planets').find((x) => x.index === baseBody);
    baseSign = signOf(b?.lon ?? chart.positions.ascendant);
    if (opts.baseIsSign === false) baseSign = (baseSign + 1) % 12;
  }
  const slots: ChakraSlot[] = TRIPATAKI_POS.map(([x, y], pos) => {
    const id = (baseSign + pos) % 12;
    return { pos, id, label: SIGNS[id], x, y };
  });
  const current = opts.current ?? chart;
  const isTransit = !!opts.current && opts.current !== chart;
  const count = new Array<number>(12).fill(0);
  const xScale = mode === 'sahamas' ? 1.125 : 0.75;
  const bodies = starChakraBodies(current, mode, isTransit).map((body: ChakraBody): PlacedBody => {
    const pos = (signOf(body.lon) - baseSign + 12) % 12;
    const k = count[pos]++ % 12;
    const [x, y] = TRIPATAKI_POS[pos];
    return { body, pos, x: x + xScale * (XOFF[k] + 2), y: y + 0.75 * (YOFF[k] + 1), text: bodyText(body) };
  });
  const baseName = JHORA_BODIES[baseBody]?.[0] ?? 'Lagna';
  const title = `${TRIPATAKI_MODE_NAMES[mode]} in D-1(from ${opts.fixedBaseSign !== undefined ? SIGNS[baseSign] : baseName} in D-1)`;
  return { title, baseSign, slots, lines: TRIPATAKI_LINES, bodies };
}
