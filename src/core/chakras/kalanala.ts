// Surya Kalanala and Chandra Kalanala chakras (Chakras > "Surya Kalanala",
// "Chandra Kalanala").
//
// jhora.exe:
// * CSKChakraView: OnDraw 0x47a920 -> draw routine 0x47aa50; layout 0x47a650.
//   CCKChakraView: OnDraw 0x444c20 -> draw routine 0x444d50; layout 0x478210.
//   Drawing area: view side s (<= 800 px), W = 7s/6 (SK) or s (CK), H = s - 48,
//   a 24 px heading band above ("Planets:", drawn at left, width W/3).
//   Both views share menu 152 (handlers 0x47c950.. / 0x446a50..): the body set
//   mode at view+0x12c (ctor 0x444b29 / 0x47a559 sets 0 = "Planets"),
//   "Fully customize base nakshatra" (0x47cd10 / 0x446e10), "Divisional chart
//   to be used for planets" (0x47ce90 / 0x447000, globals 0x884888 / 0x65c92c,
//   default 0 = D-1) and "Base planet and division" (0x47cf70 / 0x4470e0).
// * Base star (OnDraw): the 28-star nakshatra byte (chart+0x1705+body) of body
//   0x57e39c / 0x57c14c (= 1, Sun) in the natal chart (0x57c9a0 = 1); when the
//   displayed chart's kind (doc+0x76d04) is 1, 2 or 5 (Tajaka / Tithi Pravesha
//   charts) the lagna's star (body 0x88487c / 0x65c920 = 0) of the displayed
//   chart. The option bytes 0x57e3a0/1, 0x57c150/1 are 1, so no "+1". A custom
//   fixed star (0x884880/0x884884, 0x65c924/0x65c928) or a custom base body in
//   a chosen varga (0x884881 + 0x88488c varga / 0x884890 body; 0x65c925 +
//   0x65c930 / 0x65c934) override it. Dialog text: "Star of Sun is taken as the
//   base in natal charts and the star of lagna in Tajaka/TP charts. It is
//   placed in the eastern corner."
// * Bodies come from the displayed chart (doc+0x76d00; 0x8846d4 = 0), i.e. the
//   natal chart unless JHora is showing another chart. There is no separate
//   transit overlay; `opts.transit` emulates "displayed chart = transit chart"
//   (bodies from it, base star still from the natal Sun).
// * Geometry is in a 144 x 144 unit box (x scaled by the drawing width W,
//   y by the height H, each integer-divided by 0x90): star k (k = 0..27 counted
//   from the base star) is drawn centred (DT_CENTER) in the 12 x 12 unit box at
//   STAR_XY[k]; tables built on the stack at 0x47b0xx (SK) and 0x4452xx (CK).
//   Lines recovered by emulating the MoveTo/LineTo sequence.
// * Body labels: the n-th body in a star's box (n mod 8) is placed at
//   star + ((DX[n] + 2) * cellW >> 4, (DY[n] + 1) * cellH >> 4) with
//   cellW = W/12, cellH = H/12 (12 units), DX = 6 6 0 0 6 6 0 0,
//   DY = 6 12 6 12 18 24 18 24. "Yogini & Mrityu" uses (DX, DY + 2) and
//   Sahamas (DX, DY) with cellW * 1.5. Planets print "%s", or "(%s)" when the
//   body's retrograde byte (chart+0x108+0x30*b) is set; names come from the
//   short-name table 0x8a4684 ("As", "Su", ...); star names from 0x8a3fc8
//   (NAK28: "Aswi" .. "USha", "Abhi", "Srav" .. "Reva").
// * Body sets (mode): 0 Planets = bodies 0..9; 1 Yogini & Mrityu = chart
//   +0x2752c "Yogini (vara)", +0x27534 "Mrityu", +0x27530 "" (used directly as
//   a box index, not relative to the base); 2 Trisphuta = 33..36;
//   3 Upagrahas = 32, 31, 22..30; 4 Special lagnas = 0, 14, 15, 17..20;
//   5 Sahamas = the 36 sahamas (chart+0x214f0, names 0x8a2088).
import { sahamas } from '../sahamas';
import { bodiesByIndex, type ChakraBody, type ChakraChart, nakshatra28Of, yoginiMrityu } from './common';

export type KalanalaKind = 'surya' | 'chandra';
/** Menu 152 body sets, in the order of view+0x12c. */
export const KALANALA_MODES = ['Planets', 'Yogini & Mrityu', 'Trisphuta etc', 'Upagrahas', 'Special Lagnas', 'Sahamas'] as const;
/** Heading drawn above the chakra (DrawText without DT_NOPREFIX, so "&&" shows as "&"). */
export const KALANALA_MODE_TITLES = ['Planets:', 'Yogini & Mrityu:', 'Trisphuta etc:', 'Upagrahas:', 'Special Lagnas:', 'Sahamas (sahams):'];
const MODE_BODIES: Record<number, number[]> = {
  0: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  2: [33, 34, 35, 36],
  3: [32, 31, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  4: [0, 14, 15, 17, 18, 19, 20],
};

/** Top-left of each star's 12 x 12 box, k = 0..27 from the base star. */
export const SURYA_STAR_XY: [number, number][] = zip(
  [66, 36, 18, 0, 0, 0, 0, 0, 0, 16, 26, 36, 46, 56, 66, 76, 86, 96, 106, 116, 132, 132, 132, 132, 132, 132, 114, 96],
  [132, 132, 132, 120, 93, 75, 57, 28, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 28, 57, 75, 93, 120, 132, 132],
);
export const CHANDRA_STAR_XY: [number, number][] = zip(
  [66, 51, 51, 59, 42, 27, 0, 0, 0, 27, 42, 59, 46, 51, 66, 81, 86, 73, 90, 106, 132, 132, 132, 106, 90, 73, 81, 81],
  [2, 2, 27, 46, 56, 54, 54, 69, 84, 84, 74, 86, 111, 132, 132, 132, 111, 86, 74, 84, 84, 69, 54, 54, 56, 46, 27, 2],
);
function zip(xs: number[], ys: number[]): [number, number][] { return xs.map((x, i) => [x, ys[i]]); }

export type Segment = [number, number, number, number];
/** Surya Kalanala: a trident with three prongs (0x47ab7d..0x47b270). */
export const SURYA_LINES: Segment[] = [
  [72, 12, 72, 132], [42, 12, 42, 132], [102, 12, 102, 132],
  [62, 12, 72, 28], [82, 12, 72, 28], [32, 12, 42, 28], [52, 12, 42, 28], [92, 12, 102, 28], [112, 12, 102, 28],
  [12, 60, 132, 60], [12, 78, 132, 78], [12, 96, 132, 96],
  [12, 12, 42, 60], [22, 12, 42, 44], [12, 28, 32, 60], [132, 12, 102, 60], [122, 12, 102, 44], [132, 28, 112, 60],
  [12, 120, 30, 96], [24, 132, 42, 108], [132, 120, 114, 96], [120, 132, 102, 108],
];
/** Chandra Kalanala: circle (Ellipse 37..107) with four tridents and two diagonals (0x444e7e..0x445400). */
export const CHANDRA_LINES: Segment[] = [
  [72, 12, 72, 132], [57, 12, 57, 27], [87, 12, 87, 27], [57, 27, 87, 27],
  [57, 132, 57, 117], [87, 132, 87, 117], [57, 117, 87, 117],
  [12, 72, 132, 72], [12, 57, 27, 57], [12, 87, 27, 87], [27, 57, 27, 87],
  [132, 57, 117, 57], [132, 87, 117, 87], [117, 57, 117, 87],
  [47.25, 47.25, 96.75, 96.75], [47.25, 96.75, 96.75, 47.25],
];
export const CHANDRA_ELLIPSE = { x0: 37, y0: 37, x1: 107, y1: 107 };

const DX = [6, 6, 0, 0, 6, 6, 0, 0];
const DY = [6, 12, 6, 12, 18, 24, 18, 24];

export interface KalanalaLabel {
  /** the body (sahamas and Yogini/Mrityu use index -1) */
  body: ChakraBody;
  /** text as JHora draws it, e.g. "Su", "(Sa)", "Punya" */
  text: string;
  /** top-left of the text, 144-unit space */
  x: number;
  y: number;
}
export interface KalanalaSlot {
  /** position 0..27 counted from the base star */
  pos: number;
  /** NAK28 index of the star drawn here */
  star: number;
  /** top-left of the 12 x 12 star box */
  x: number;
  y: number;
  labels: KalanalaLabel[];
}
export interface KalanalaOptions {
  /** body set (view+0x12c), default 0 = Planets */
  mode?: number;
  /** fixed custom base star (NAK28 index), "Fully customize base nakshatra" */
  baseStar?: number;
  /** base body (JHORA_BODIES index) instead of the Sun ("Base planet and division") */
  baseBody?: number;
  /** displayed chart is a Tajaka / Tithi Pravesha chart: base = its lagna's star */
  tajaka?: boolean;
  /** chart shown instead of the natal one (transits): bodies come from it */
  transit?: ChakraChart | null;
  /** raw chart+0x2752c / +0x27534 / +0x27530 values for mode 1 (box indices); default: common.ts yoginiMrityu */
  yoginiMrityu?: [number, number, number];
}
export interface Kalanala {
  kind: KalanalaKind;
  mode: number;
  title: string;
  baseStar: number;
  slots: KalanalaSlot[];
  lines: Segment[];
  ellipse?: typeof CHANDRA_ELLIPSE;
}

function build(kind: KalanalaKind, chart: ChakraChart, opts: KalanalaOptions = {}): Kalanala {
  const mode = opts.mode ?? 0;
  const shown = opts.transit ?? chart;
  let baseStar: number;
  if (opts.baseStar !== undefined) baseStar = ((opts.baseStar % 28) + 28) % 28;
  else if (opts.tajaka) baseStar = nakshatra28Of(shown.positions.ascendant);
  else {
    const b = bodiesByIndex(opts.baseBody !== undefined ? shown : chart, [opts.baseBody ?? 1])[0];
    baseStar = b ? nakshatra28Of(b.lon) : 0;
  }
  const xy = kind === 'surya' ? SURYA_STAR_XY : CHANDRA_STAR_XY;
  const slots: KalanalaSlot[] = xy.map(([x, y], pos) => ({ pos, star: (baseStar + pos) % 28, x, y, labels: [] }));
  const count = new Array(28).fill(0);
  const place = (pos: number, body: ChakraBody, text: string) => {
    const n = count[pos]++ % 8, s = slots[pos];
    let x: number, y: number;
    if (mode === 1) { x = s.x + (DX[n] * 12) / 16; y = s.y + ((DY[n] + 2) * 12) / 16; }
    else if (mode === 5) { x = s.x + (DX[n] * 18) / 16; y = s.y + (DY[n] * 12) / 16; }
    else { x = s.x + ((DX[n] + 2) * 12) / 16; y = s.y + ((DY[n] + 1) * 12) / 16; }
    s.labels.push({ body, text, x, y });
  };
  const rel = (lon: number) => (nakshatra28Of(lon) - baseStar + 28) % 28;
  if (MODE_BODIES[mode]) {
    for (const b of bodiesByIndex(shown, MODE_BODIES[mode], !!opts.transit)) {
      const text = mode === 0 && b.retrograde ? `(${b.label})` : b.label;
      place(rel(b.lon), b, text);
    }
  } else if (mode === 1) {
    const ym = opts.yoginiMrityu ?? yoginiMrityu(shown);
    // drawn in this order: +0x2752c, +0x27534, +0x27530
    if (ym) (['Yogini (vara)', 'Mrityu', ''] as const).forEach((text, i) =>
      place(((ym[i] % 28) + 28) % 28, { index: -1, label: text, lon: 0, retrograde: false }, text));
  } else if (mode === 5 && shown.day) {
    for (const s of sahamas(shown.positions, shown.day.isDay)) {
      const name = s.name.replace(/ Sahama$/, '');
      place(rel(s.lon), { index: -1, label: name, lon: s.lon, retrograde: false, transit: !!opts.transit }, name);
    }
  }
  return {
    kind, mode, title: KALANALA_MODE_TITLES[mode] ?? '', baseStar, slots,
    lines: kind === 'surya' ? SURYA_LINES : CHANDRA_LINES,
    ...(kind === 'chandra' ? { ellipse: CHANDRA_ELLIPSE } : {}),
  };
}

/** Surya Kalanala chakra (CSKChakraView, OnDraw 0x47a920). */
export const suryaKalanala = (chart: ChakraChart, opts?: KalanalaOptions) => build('surya', chart, opts);
/** Chandra Kalanala chakra (CCKChakraView, OnDraw 0x444c20). */
export const chandraKalanala = (chart: ChakraChart, opts?: KalanalaOptions) => build('chandra', chart, opts);
