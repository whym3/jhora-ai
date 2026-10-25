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
// North and East Indian place the bodies in the slots of JHora's text copies (FUN_00435110,
// FUN_00435910; see TEXT_LAYOUT in core/chartText.ts) scaled onto the square; the graphic
// routines (FUN_00437e40 North, FUN_00436280 East) are not ported slot for slot.
import type { MouseEvent, ReactNode } from 'react';
import type { ChartPoint } from '../core/chartBodies';
import { TEXT_LAYOUT } from '../core/chartText';
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

function South({ signs, lagnaSign, caption, style, size = 360, highlights, bodyClasses, onMenu }: ChartFigureProps) {
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
    </>
  );
}

// ---- North and East Indian (slots of the text copies) ----

/** Bodies of one house/sign at text slots (line, column): main bodies first, then the corner ones. */
function TextSlots({ list, slot, scaleX, scaleY, classes, onMenu }: {
  list: ChartPoint[]; slot: (k: number) => [number, number]; scaleX: number; scaleY: number;
  classes?: Record<string, string>; onMenu?: (e: MouseEvent, body: string) => void;
}) {
  const ordered = [...list.filter((b) => !b.corner), ...list.filter((b) => b.corner)];
  return (
    <>
      {ordered.map((b, k) => {
        const [line, col] = slot(k % 10);
        return <Label key={b.index} b={b} x={col * scaleX} y={(line + 0.75 + Math.floor(k / 10) * 0.5) * scaleY} classes={classes} onMenu={onMenu} />;
      })}
    </>
  );
}

// Triangles/diamonds of the 12 houses (fractions of the square), for highlights and hit areas.
const NORTH_SHAPES: [number, number][][] = [
  [[0.5, 0], [0.75, 0.25], [0.5, 0.5], [0.25, 0.25]], [[0, 0], [0.5, 0], [0.25, 0.25]], [[0, 0], [0.25, 0.25], [0, 0.5]],
  [[0, 0.5], [0.25, 0.25], [0.5, 0.5], [0.25, 0.75]], [[0, 0.5], [0.25, 0.75], [0, 1]], [[0, 1], [0.25, 0.75], [0.5, 1]],
  [[0.5, 1], [0.25, 0.75], [0.5, 0.5], [0.75, 0.75]], [[0.5, 1], [0.75, 0.75], [1, 1]], [[1, 1], [0.75, 0.75], [1, 0.5]],
  [[1, 0.5], [0.75, 0.75], [0.5, 0.5], [0.75, 0.25]], [[1, 0.5], [0.75, 0.25], [1, 0]], [[1, 0], [0.75, 0.25], [0.5, 0]],
];
const NORTH_SIGN_POS: [number, number][] = [
  [0.5, 0.45], [0.25, 0.2], [0.2, 0.25], [0.45, 0.5], [0.2, 0.75], [0.25, 0.8],
  [0.5, 0.55], [0.75, 0.8], [0.8, 0.75], [0.55, 0.5], [0.8, 0.25], [0.75, 0.2],
];

function North({ signs, lagnaSign, caption, size = 360, highlights, bodyClasses, onMenu }: ChartFigureProps) {
  const s = size, L = TEXT_LAYOUT.north;
  // the text copy's box: 49 columns (0 and 48 the frame) by 25 lines (1 and 25 the frame)
  const sx = s / 48, sy = s / 24;
  return (
    <>
      <rect x={0} y={0} width={s} height={s} className="cell" />
      {NORTH_SHAPES.map((shape, house) => {
        const sign = (lagnaSign + house) % 12;
        const [nx, ny] = NORTH_SIGN_POS[house];
        const hd = menuHandlers(onMenu, sign);
        const g = L.group[house];
        return (
          <g key={house} onContextMenu={hd?.cell}>
            <polygon points={shape.map(([x, y]) => `${x * s},${y * s}`).join(' ')}
              className={highlights?.includes(sign) ? 'north-house hl-cell' : 'north-house'} />
            <text x={nx * s} y={ny * s + 4} className="cb-signnum" textAnchor="middle">{sign + 1}</text>
            <TextSlots list={signs[sign]} scaleX={sx} scaleY={sy} classes={bodyClasses} onMenu={hd?.body}
              slot={(k) => [L.row[house] * 6 + L.slotRow[g][k] + 1, L.col[house] * 12 + L.slotCol[g][k]]} />
          </g>
        );
      })}
      <path d={`M0 0 L${s} ${s} M${s} 0 L0 ${s} M${s / 2} 0 L${s} ${s / 2} L${s / 2} ${s} L0 ${s / 2} Z`} className="north-lines" />
      <text x={s / 2} y={s + 18} textAnchor="middle" className="cb-caption cb-short">
        {caption.short === null ? caption.varga : `${caption.varga} (${caption.short})`}
      </text>
    </>
  );
}

/** East Indian regions per sign (fractions): Aries top middle, then anticlockwise. */
const T = 1 / 3, T2 = 2 / 3;
const EAST_SHAPES: [number, number][][] = [
  [[T, 0], [T2, 0], [T2, T], [T, T]], [[0, 0], [T, 0], [T, T]], [[0, 0], [T, T], [0, T]],
  [[0, T], [T, T], [T, T2], [0, T2]], [[0, T2], [T, T2], [0, 1]], [[T, T2], [T, 1], [0, 1]],
  [[T, T2], [T2, T2], [T2, 1], [T, 1]], [[T2, T2], [1, 1], [T2, 1]], [[T2, T2], [1, T2], [1, 1]],
  [[T2, T], [1, T], [1, T2], [T2, T2]], [[1, 0], [1, T], [T2, T]], [[T2, 0], [1, 0], [T2, T]],
];

function East({ signs, caption, style, size = 360, highlights, bodyClasses, onMenu }: ChartFigureProps) {
  const s = size, L = TEXT_LAYOUT.east;
  const sx = s / 48, sy = s / 24;
  const w = s / 4;
  return (
    <>
      {EAST_SHAPES.map((shape, sign) => {
        const hd = menuHandlers(onMenu, sign);
        const g = L.group[sign];
        return (
          <g key={sign} onContextMenu={hd?.cell}>
            <polygon points={shape.map(([x, y]) => `${x * s},${y * s}`).join(' ')}
              className={highlights?.includes(sign) ? 'north-house hl-cell' : 'north-house'} />
            <TextSlots list={signs[sign]} scaleX={sx} scaleY={sy} classes={bodyClasses} onMenu={hd?.body}
              slot={(k) => [L.row[sign] * 8 + L.slotRow[g][k] + 1, L.col[sign] * 16 + L.slotCol[g][k]]} />
          </g>
        );
      })}
      <path d={`M${s * T} 0 V${s} M${s * T2} 0 V${s} M0 ${s * T} H${s} M0 ${s * T2} H${s} M0 0 L${s * T} ${s * T} M${s} 0 L${s * T2} ${s * T}`
        + ` M0 ${s} L${s * T} ${s * T2} M${s} ${s} L${s * T2} ${s * T2}`} className="north-lines" />
      {style === 'eastFrame' && <rect x={0} y={0} width={s} height={s} className="cb-frame" />}
      {/* the South Indian captions, scaled from its centre square (2w) onto the East one (s/3) */}
      <g transform={`translate(${s / 6},${s / 6}) scale(${2 / 3})`}>
        <SouthCaptions caption={caption} w={w} size={4 * w} />
      </g>
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

/** Extra room below a chart for the North Indian caption line. */
export const captionBand = (style: ChartStyle) => (style === 'north' ? 26 : 0);

export function ChartDiagram(props: ChartFigureProps) {
  const size = props.size ?? 360;
  return (
    <svg viewBox={`-4 -4 ${size + 8} ${size + 8 + captionBand(props.style)}`} className="chart" role="img"
      aria-label={`${props.caption.varga} chart`}>
      <ChartFigure {...props} />
    </svg>
  );
}
