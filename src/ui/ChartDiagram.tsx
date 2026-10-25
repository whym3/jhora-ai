// JHora's chart diagrams as SVG: South Indian (regular and mirrored), North Indian and East
// Indian (with or without frame), ChartStyle 0..4.
//
// South Indian = jhora.exe FUN_00442de0 (CChartView, per slot; dispatch FUN_00432360 by
// ChartStyle, DAT_0065b930, or ChartStyle2 for odd slots with UseTwoChartStyles): a 4x4 grid,
// Pisces top-left and Aries next (mirrored: Pisces top-right). In a sign box of w x h,
// m = trunc(5h/9) is the main area: the n-th body other than V2..V12 / A2..UL / L1..L12 is drawn
// top-left aligned at (MAIN_X[n % 9] trunc(w/3) + 2, MAIN_Y[n % 9] trunc(m/3) + 2); the k-th of
// those "corner" bodies in a smaller font at (CORNER_X[k] trunc(w/4) + 2, m + CORNER_Y[k]
// trunc((h-m)/2) + 2). Captions in the centre square (DT_CENTER): the chart name ("Natal Chart",
// chart+0x1698, font x1.1) in the top quarter; D-1: "Rasi" (x1.4) in the middle; other vargas:
// the long name (x1.3) in the third quarter and the short name ("D-9", "D-3 (Trd)"; x1.2) below.
// No sign names. Text colours (CChartView colour slots): lagna #c81eaa, planets and graha
// arudhas #b43c3c, special lagnas #8c7050, upagrahas #465f55, AL #7828c8, other arudhas #5078b4,
// captions #0a0a0a. Retrograde bodies are drawn "(Sa)".
//
// "Bhava from %s" (menu 33294, flag DAT_0065b920[slot]): FUN_00442de0 0x444777..0x44487b adds
// it in the lower half of the centre square (x0+w, y0+2h, x0+3w, y0+3h), font x1.1,
// DT_CENTER|DT_VCENTER|DT_SINGLELINE (only the South Indian style draws it).
//
// North Indian = FUN_00437e40 (param_9 = 1: caption band). Band height cap = trunc(1.2 F + 2),
// F = the chart font height (0x8a17a4: Arial Narrow 21, scaled by zoom = side/360 with
// truncation, FUN_004318f0 -> FUN_004ae370); the chart is (cap/2, cap, side - cap/2, side).
// hw = trunc(W/2), hh = trunc(H/2); house k's box = (x0 + trunc(BOX_X[k] hw/2), y0 + trunc(BOX_Y[k]
// hh/2)) of size hw x hh, its region a diamond or one of four triangles (FUN_00437d20, group
// N_GROUP[k]). House of sign s = (s - lagna) mod 12. In a box, q = trunc(hw/6), r = trunc(hh/8):
// the sign number ("%d", DT_CENTER in a q-wide rect, x1.15 in house 1 else x0.85) at
// (trunc(N_NUM[k].x q/4), trunc(N_NUM[k].y r/4)); the n-th main body at (trunc(MAIN[g][n % 9].x q/2)
// + 2, trunc(MAIN[g][n % 9].y r/2) + 2); the k-th corner body (V2..V12, A2..UL, L1..L12) at
// (trunc(CORNER[g][k % 6].x q/4) + 2, trunc(CORNER[g][k % 6].y r/4) + 2), font x0.85 (x1.0 and
// 2 px higher when zoom < 0.85). Captions in the band (font x1.2): the chart name left aligned,
// the varga right aligned ("Rasi" for D-1, else the short name "D-9"). Lines (FUN_0049fba0 style
// 2 -> FUN_0049f400, FUN_0049f8f0): both diagonals, the diamond through the mid-points, the frame
// and two more frames 2 and 3 px outside (the third only when hw >= 90).
//
// East Indian = FUN_00436280 -> FUN_004362d0(.., frame, 1): cap = trunc(1.2 F - 2), the chart is
// (half, cap, side - half, side - 4) with half = trunc((cap + 4)/2); cw = trunc(W/3), ch =
// trunc(H/3); sign s's box = (x0 + BOX_X[s] cw, y0 + BOX_Y[s] ch), its region the square or one
// half of a corner box cut by the diagonal (FUN_00436150, group E_GROUP[s]); q = trunc(cw/6),
// r = trunc(ch/8) and the same main/corner slot rules with East's own tables. No sign numbers.
// Captions (x1.2): the chart name centred in the band; D-1: "Rasi" centred in (x0+cw, y0+cw,
// x0+2cw, y0+2cw); else the long name centred in (x0+cw, y0+cw, x0+2cw, y0+1.5cw) and the short
// name in the whole centre square (JHora uses cw for the heights too). Lines (style 3/4): two
// vertical and two horizontal lines across the chart and the four corner diagonals; East with
// frame (4) adds North's frames. Not ported: the three "special points" (chart+0x12404, e.g.
// Muntha) and the "Arudhas of Planets" / "Planet Arudhas" caption of the graha arudha views
// (South does not draw them either), the relationship box fill (bodyClasses colour the text).
import type { MouseEvent, ReactNode } from 'react';
import type { ChartPoint } from '../core/chartBodies';
import './chart.css';

export type ChartStyle = 'south' | 'southMirror' | 'north' | 'east' | 'eastFrame';

/** ChartStyle ini values 0..4 in order (DisplayPreferences ChartStyle / ChartStyle2). */
export const CHART_STYLES: { style: ChartStyle; label: string }[] = [
  { style: 'south', label: 'South Indian' },
  { style: 'southMirror', label: 'South Indian (mirrored)' },
  { style: 'north', label: 'North Indian' },
  { style: 'east', label: 'East Indian' },
  { style: 'eastFrame', label: 'East Indian (with frame)' },
];
export const styleIndex = (s: ChartStyle) => Math.max(0, CHART_STYLES.findIndex((c) => c.style === s));

/** Centre captions: chart name, long varga name, short varga name (null for D-1). */
export interface ChartCaption { name: string; varga: string; short: string | null }

export interface ChartFigureProps {
  /** bodies per sign, index 0 = Aries, in drawing order (core/chartBodies chartSigns) */
  signs: ChartPoint[][];
  lagnaSign: number;
  caption: ChartCaption;
  style: ChartStyle;
  /** side of the square (JHora draws 360 at zoom 1) */
  size?: number;
  /** signs drawn highlighted (right-click menu results) */
  highlights?: number[];
  /** extra CSS class per body id (relationship colours) */
  bodyClasses?: Record<string, string>;
  /** right-click on a sign (body = id of the clicked body, if any) */
  onMenu?: (e: MouseEvent, sign: number, body: string | null) => void;
  /** click on the chart (Many Vargas: select the slot) */
  onSelect?: () => void;
  selected?: boolean;
  /** extra centre line of the South Indian style ("Bhava from Sun", menu 33294) */
  extraCaption?: string;
}

const kindClass = (b: ChartPoint) => `cb cb-${b.kind}${b.corner ? ' cb-corner' : ''}`;
const labelOf = (b: ChartPoint) => (b.retrograde ? `(${b.label.trim()})` : b.label.trim());

function Label({ b, x, y, classes, onMenu }: { b: ChartPoint; x: number; y: number; classes?: Record<string, string>; onMenu?: (e: MouseEvent, body: string) => void }) {
  if (!b.label.trim()) return null;
  return (
    <text x={x} y={y} className={`${kindClass(b)}${classes?.[b.id] ? ` ${classes[b.id]}` : ''}`}
      onContextMenu={onMenu ? (e) => { e.stopPropagation(); onMenu(e, b.id); } : undefined}>
      {labelOf(b)}
    </text>
  );
}

const menuHandlers = (onMenu: ChartFigureProps['onMenu'], sign: number) => onMenu && {
  cell: (e: MouseEvent) => onMenu(e, sign, null),
  body: (e: MouseEvent, body: string) => onMenu(e, sign, body),
};

// ---- South Indian (FUN_00442de0) ----

/** Sign box (col, row) per sign, Aries first (regular: table local_33c[0x2a..], mirrored [0x12..]). */
const SOUTH_COL = [1, 2, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0], SOUTH_ROW = [0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 1, 0];
const MAIN_X = [1, 0, 2, 0, 1, 0, 2, 1, 2], MAIN_Y = [1, 0, 0, 2, 0, 1, 1, 2, 2];
const CORNER_X = [3, 1, 3, 1, 3, 1, 2, 0, 2, 0, 2, 0], CORNER_Y = [1, 1, 0, 0, -1, -1, 1, 1, 0, 0, -1, -1];
/** Baseline below the DrawText top of the main and corner fonts. */
const MAIN_ASCENT = 13, CORNER_ASCENT = 10;

function SouthCaptions({ caption, w, size }: { caption: ChartCaption; w: number; size: number }) {
  const cx = size / 2;
  return (
    <>
      <text x={cx} y={w + w / 4 + 5} textAnchor="middle" className="cb-caption cb-name">{caption.name}</text>
      {caption.short === null
        ? <text x={cx} y={size / 2 + 7} textAnchor="middle" className="cb-caption cb-varga1">{caption.varga}</text>
        : <>
          <text x={cx} y={w * 1.75 + 6} textAnchor="middle" className="cb-caption cb-varga">{caption.varga}</text>
          <text x={cx} y={w * 2 + 15} textAnchor="middle" className="cb-caption cb-short">{caption.short}</text>
        </>}
    </>
  );
}

function South({ signs, lagnaSign, caption, style, size = 360, highlights, bodyClasses, onMenu, extraCaption }: ChartFigureProps) {
  const w = Math.trunc(size / 4), h = w, m = Math.trunc((h * 5) / 9);
  const sw = Math.trunc(w / 3), sh = Math.trunc(m / 3), aw = Math.trunc(w / 4), ah = Math.trunc((h - m) / 2);
  const mirror = style === 'southMirror';
  return (
    <>
      {signs.map((list, sign) => {
        const x0 = (mirror ? 3 - SOUTH_COL[sign] : SOUTH_COL[sign]) * w, y0 = SOUTH_ROW[sign] * h;
        const hd = menuHandlers(onMenu, sign);
        let n = 0, k = 0;
        return (
          <g key={sign} onContextMenu={hd?.cell}>
            <rect x={x0} y={y0} width={w} height={h}
              className={`cell${sign === lagnaSign ? ' lagna-cell' : ''}${highlights?.includes(sign) ? ' hl-cell' : ''}`} />
            {list.map((b) => {
              if (b.corner) {
                const j = k++ % 12;
                return <Label key={b.index} b={b} x={x0 + CORNER_X[j] * aw + 2} y={y0 + m + CORNER_Y[j] * ah + 2 + CORNER_ASCENT} classes={bodyClasses} onMenu={hd?.body} />;
              }
              const j = n++ % 9;
              return <Label key={b.index} b={b} x={x0 + MAIN_X[j] * sw + 2} y={y0 + MAIN_Y[j] * sh + 2 + MAIN_ASCENT} classes={bodyClasses} onMenu={hd?.body} />;
            })}
          </g>
        );
      })}
      <rect x={w} y={h} width={2 * w} height={2 * h} className="center" />
      <SouthCaptions caption={caption} w={w} size={4 * w} />
      {extraCaption && <text x={2 * w} y={h * 2.5 + 5} textAnchor="middle" className="cb-caption cb-name">{extraCaption}</text>}
    </>
  );
}

// ---- North and East Indian (FUN_00437e40, FUN_004362d0) ----

type Pt = [number, number];
const tdiv = (a: number, b: number) => Math.trunc(a / b);
/** The chart font height at a zoom (0x8a17a4 = 21 at zoom 1, truncated by FUN_004ae370). */
const fontHeight = (zoom: number) => Math.trunc(21 * zoom);
/** Box column / row (in box units) per house (North) or sign (East): tables local_51c / local_558. */
const BOX_X = [1, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2], BOX_Y = [0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0];

// North (FUN_00437e40): group per house (0 diamond, 1 top, 2 left, 3 bottom, 4 right triangles),
// sign-number position per house, main slots (9 per group) and corner slots (6 per group).
const N_GROUP = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1];
const N_NUM: Pt[] = [[10, 28], [10, 12], [8, 14], [20, 14], [8, 14], [10, 17], [10, 1], [10, 17], [13, 14], [1, 14], [13, 14], [10, 12]];
const N_MAIN: Pt[][] = [
  [[6, 6], [5, 2], [3, 4], [2, 6], [6, 4], [8, 6], [4, 6], [4, 8], [6, 8]],
  [[5, 2], [3, 0], [7, 0], [5, 0], [3, 2], [7, 2], [1, 0], [9, 0], [4, 4]],
  [[0, 6], [0, 8], [0, 4], [0, 2], [2, 6], [2, 8], [2, 4], [4, 6], [4, 8]],
  [[3, 12], [7, 12], [5, 10], [5, 12], [3, 14], [1, 14], [5, 8], [7, 10], [5, 14]],
  [[10, 6], [10, 8], [10, 4], [10, 2], [8, 6], [8, 8], [8, 4], [6, 6], [6, 8]],
];
const N_CORNER: Pt[][] = [
  [[12, 24], [8, 24], [12, 20], [8, 20], [4, 18], [16, 18]],
  [[12, 8], [8, 8], [11, 12], [18, 0], [2, 0], [14, 4]],
  [[0, 20], [0, 24], [4, 20], [0, 27], [8, 13], [8, 16]],
  [[14, 28], [17, 28], [20, 29], [11, 28], [18, 25], [10, 17]],
  [[20, 20], [20, 24], [16, 20], [20, 27], [12, 13], [12, 16]],
];
// East (FUN_004362d0): group per sign (0 square, 1/2 upper-right / lower-left half of a corner box
// cut from top-left to bottom-right, 3/4 upper-left / lower-right half cut from top-right).
const E_GROUP = [0, 1, 2, 0, 3, 4, 0, 2, 1, 0, 4, 3];
const E_MAIN: Pt[][] = [
  [[4, 6], [8, 3], [4, 3], [8, 6], [4, 9], [8, 9], [1, 3], [1, 6], [1, 9]],
  [[6, 3], [9, 3], [6, 0], [3, 0], [9, 0], [3, 3], [6, 6], [9, 6], [1, 0]],
  [[0, 7], [0, 4], [0, 10], [0, 2], [3, 10], [3, 7], [0, 1], [0, 13], [2, 4]],
  [[3, 3], [0, 3], [3, 0], [6, 0], [0, 0], [6, 3], [3, 6], [0, 6], [8, 0]],
  [[9, 7], [9, 4], [9, 10], [9, 2], [6, 10], [6, 7], [9, 1], [9, 13], [7, 4]],
];
const E_CORNER: Pt[][] = [
  [[16, 28], [8, 28], [2, 28], [16, 23], [8, 23], [2, 23]],
  [[20, 20], [20, 16], [16, 16], [20, 24], [16, 19], [20, 12]],
  [[16, 28], [8, 28], [0, 28], [12, 28], [4, 28], [20, 28]],
  [[0, 20], [0, 16], [4, 16], [0, 24], [4, 19], [0, 12]],
  [[4, 28], [12, 28], [20, 28], [8, 28], [16, 28], [1, 28]],
];

/** The chart rectangle of a North/East diagram, its boxes and slot units. */
export interface DiagramGeometry {
  kind: 'north' | 'east';
  /** caption band height */
  cap: number;
  x0: number; y0: number; x1: number; y1: number;
  /** box size (North: half the chart, East: a third) */
  cw: number; ch: number;
  /** slot units q = trunc(cw/6), r = trunc(ch/8) */
  q: number; r: number;
  zoom: number;
}

/**
 * North Indian geometry for a square of `size` (JHora's zoom = size/360), or for the chart rect
 * (x0, y0, x1, y1) JHora filled when `rect` is given (tests).
 */
export function northGeometry(size = 360, rect?: [number, number, number, number], zoom = size / 360): DiagramGeometry {
  const cap = Math.trunc(fontHeight(zoom) * 1.2 + 2);
  const [x0, y0, x1, y1] = rect ?? [tdiv(cap, 2), cap, size - tdiv(cap, 2), size];
  const cw = tdiv(x1 - x0, 2), ch = tdiv(y1 - y0, 2);
  return { kind: 'north', cap, x0, y0, x1, y1, cw, ch, q: tdiv(cw, 6), r: tdiv(ch, 8), zoom };
}

/** East Indian geometry (see northGeometry). */
export function eastGeometry(size = 360, rect?: [number, number, number, number], zoom = size / 360): DiagramGeometry {
  const cap = Math.trunc(fontHeight(zoom) * 1.2 - 2), half = tdiv(cap + 4, 2);
  const [x0, y0, x1, y1] = rect ?? [half, cap, size - half, size - 4];
  const cw = tdiv(x1 - x0, 3), ch = tdiv(y1 - y0, 3);
  return { kind: 'east', cap, x0, y0, x1, y1, cw, ch, q: tdiv(cw, 6), r: tdiv(ch, 8), zoom };
}

/** Top-left of the box of North house / East sign `i`. */
function boxOf(g: DiagramGeometry, i: number): Pt {
  return g.kind === 'north'
    ? [g.x0 + tdiv(BOX_X[i] * g.cw, 2), g.y0 + tdiv(BOX_Y[i] * g.ch, 2)]
    : [g.x0 + BOX_X[i] * g.cw, g.y0 + BOX_Y[i] * g.ch];
}

/** A sign's region (FUN_00437d20 North, FUN_00436150 East). */
export function signRegion(g: DiagramGeometry, sign: number, lagnaSign: number): Pt[] {
  const i = g.kind === 'north' ? (sign - lagnaSign + 12) % 12 : sign;
  const [l, t] = boxOf(g, i), r = l + g.cw, b = t + g.ch;
  if (g.kind === 'north') {
    const cx = tdiv(l + r, 2), cy = tdiv(t + b, 2);
    return ([
      [[cx, t], [r, cy], [cx, b], [l, cy]], [[l, t], [r, t], [cx, cy]], [[l, t], [l, b], [cx, cy]],
      [[l, b], [r, b], [cx, cy]], [[r, t], [r, b], [cx, cy]],
    ] as Pt[][])[N_GROUP[i]];
  }
  return ([
    [[l, t], [r, t], [r, b], [l, b]], [[l, t], [r, t], [r, b]], [[l, t], [r, b], [l, b]],
    [[l, t], [r, t], [l, b]], [[r, t], [r, b], [l, b]],
  ] as Pt[][])[E_GROUP[i]];
}

/** One text of a North/East chart: its DrawText rect left/top (DT_LEFT; sign numbers DT_CENTER in `width`). */
export interface PlacedText { sign: number; text: string; left: number; top: number; width: number; kind: 'main' | 'corner' | 'number'; body?: ChartPoint }

/** Every body (and North's sign numbers) where FUN_00437e40 / FUN_004362d0 draw them. */
export function placeTexts(g: DiagramGeometry, signs: ChartPoint[][], lagnaSign: number): PlacedText[] {
  const out: PlacedText[] = [];
  const { q, r } = g;
  signs.forEach((list, sign) => {
    const i = g.kind === 'north' ? (sign - lagnaSign + 12) % 12 : sign;
    const grp = (g.kind === 'north' ? N_GROUP : E_GROUP)[i];
    const main = (g.kind === 'north' ? N_MAIN : E_MAIN)[grp], corner = (g.kind === 'north' ? N_CORNER : E_CORNER)[grp];
    const [bx, by] = boxOf(g, i);
    if (g.kind === 'north') {
      const [nx, ny] = N_NUM[i];
      out.push({ sign, text: String(sign + 1), left: bx + tdiv(nx * q, 4), top: by + tdiv(ny * r, 4), width: q, kind: 'number' });
    }
    let n = 0, k = 0;
    for (const b of list) {
      if (!b.label.trim()) continue;
      if (b.corner) {
        const [cx, cy] = corner[k++ % 6];
        // x0.85 font; below zoom 0.85 JHora uses x1.0 and draws 2 px higher
        out.push({ sign, text: labelOf(b), left: bx + tdiv(cx * q, 4) + 2, top: by + tdiv(cy * r, 4) + (g.zoom < 0.85 ? 0 : 2), width: q, kind: 'corner', body: b });
      } else {
        const [mx, my] = main[n++ % 9];
        out.push({ sign, text: labelOf(b), left: bx + tdiv(mx * q, 2) + 2, top: by + tdiv(my * r, 2) + 2, width: q, kind: 'main', body: b });
      }
    }
  });
  return out;
}

/** JHora's frame (FUN_0049f8f0): the rectangle and two more 2 and 3 px outside (the last when the box is >= 90). */
function Frames({ g }: { g: DiagramGeometry }) {
  return (
    <>
      {[0, 2, ...(g.cw >= 90 ? [3] : [])].map((d) => (
        <rect key={d} x={g.x0 - d} y={g.y0 - d} width={g.x1 - g.x0 + 2 * d} height={g.y1 - g.y0 + 2 * d} className="north-frame" />
      ))}
    </>
  );
}

const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ');

/** Regions (highlights, right-click) and texts of a North/East diagram. */
function Signs({ g, signs, lagnaSign, highlights, bodyClasses, onMenu }: ChartFigureProps & { g: DiagramGeometry }) {
  const texts = placeTexts(g, signs, lagnaSign);
  return (
    <>
      {signs.map((_, sign) => {
        const hd = menuHandlers(onMenu, sign);
        return (
          <g key={sign} onContextMenu={hd?.cell}>
            <polygon points={pts(signRegion(g, sign, lagnaSign))} className={highlights?.includes(sign) ? 'north-house hl-cell' : 'north-house'} />
            {texts.filter((t) => t.sign === sign).map((t) => (t.kind === 'number'
              ? <text key={`n${sign}`} x={t.left + t.width / 2} y={t.top + (sign === lagnaSign ? 13 : 10)} textAnchor="middle"
                className={sign === lagnaSign ? 'cb-signnum cb-signnum1' : 'cb-signnum'}>{t.text}</text>
              : <Label key={t.body!.index} b={t.body!} x={t.left} y={t.top + (t.kind === 'corner' ? CORNER_ASCENT : MAIN_ASCENT)}
                classes={bodyClasses} onMenu={hd?.body} />))}
          </g>
        );
      })}
    </>
  );
}

function North(props: ChartFigureProps) {
  const { caption, size = 360 } = props;
  const g = northGeometry(size), { x0, y0, x1, y1, cw, ch } = g;
  return (
    <>
      <Signs {...props} g={g} />
      <path d={`M${x0 + cw} ${y0} L${x1} ${y0 + ch} L${x0 + cw} ${y1} L${x0} ${y0 + ch} Z M${x0} ${y0} L${x1} ${y1} M${x1} ${y0} L${x0} ${y1}`} className="north-lines" />
      <Frames g={g} />
      {/* the caption band (font x1.2): chart name left, varga right ("Rasi" for D-1) */}
      <text x={x0} y={y0 - g.cap + 16} className="cb-caption cb-short">{caption.name}</text>
      <text x={x1} y={y0 - g.cap + 16} textAnchor="end" className="cb-caption cb-short">{caption.short ?? caption.varga}</text>
    </>
  );
}

function East(props: ChartFigureProps) {
  const { caption, style, size = 360 } = props;
  const g = eastGeometry(size), { x0, y0, x1, y1, cw, ch } = g;
  const mid = x0 + cw + cw / 2;
  return (
    <>
      <Signs {...props} g={g} />
      <path d={`M${x0 + cw} ${y0} V${y1} M${x0 + 2 * cw} ${y0} V${y1} M${x0} ${y0 + ch} H${x1} M${x0} ${y0 + 2 * ch} H${x1}`
        + ` M${x0} ${y0} L${x0 + cw} ${y0 + ch} M${x0} ${y1} L${x0 + cw} ${y0 + 2 * ch}`
        + ` M${x1} ${y0} L${x0 + 2 * cw} ${y0 + ch} M${x1} ${y1} L${x0 + 2 * cw} ${y0 + 2 * ch}`} className="north-lines" />
      {style === 'eastFrame' && <Frames g={g} />}
      {/* the chart name centred in the band (from 4 px above the slot); varga names centred (DT_VCENTER) in the centre square */}
      <text x={size / 2} y={y0 - g.cap - 4 + 16} textAnchor="middle" className="cb-caption cb-short">{caption.name}</text>
      {caption.short === null
        ? <text x={mid} y={y0 + 1.5 * cw + 6} textAnchor="middle" className="cb-caption cb-short">{caption.varga}</text>
        : <>
          <text x={mid} y={y0 + 1.25 * cw + 6} textAnchor="middle" className="cb-caption cb-short">{caption.varga}</text>
          <text x={mid} y={y0 + 1.5 * cw + 6} textAnchor="middle" className="cb-caption cb-short">{caption.short}</text>
        </>}
    </>
  );
}

/** One chart drawn into a <g> (for grids); `x`, `y` place its top-left corner. */
export function ChartFigure(props: ChartFigureProps & { x?: number; y?: number }) {
  const { x = 0, y = 0, style, onSelect, selected, size = 360 } = props;
  let body: ReactNode;
  if (style === 'north') body = <North {...props} />;
  else if (style === 'east' || style === 'eastFrame') body = <East {...props} />;
  else body = <South {...props} />;
  return (
    <g transform={`translate(${x},${y})`} className={selected ? 'cb-chart cb-selected' : 'cb-chart'} onClick={onSelect}>
      {body}
      {selected && <rect x={-3} y={-3} width={size + 6} height={size + 6} className="cb-selbox" />}
    </g>
  );
}

/** Extra room below a chart for captions: none, every style draws its captions inside the square. */
export const captionBand = (_style: ChartStyle) => 0;

export function ChartDiagram(props: ChartFigureProps) {
  const size = props.size ?? 360;
  return (
    <svg viewBox={`-4 -4 ${size + 8} ${size + 8 + captionBand(props.style)}`} className="chart" role="img"
      aria-label={`${props.caption.varga} chart`}>
      <ChartFigure {...props} />
    </svg>
  );
}
