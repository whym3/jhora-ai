// Chakras top tab against what JHora 8.0 draws (golden/jhora-misc/<chart>.json, key "draws":
// the GDI calls JHora made while painting each Chakras sub-tab, recorded by
// tools/harness/gditrace.py via capture.py record_draw()).
//
// For every chakra sub-tab with a view in CHAKRA_VIEWS:
// * the drawn strings (JHora's DrawText/ExtTextOut/TextOut, our SVG <text>) are the same
//   multiset after trimming;
// * positions: per chakra one scale + offset per axis is fitted (least squares) from the
//   strings drawn once on both sides, then every JHora string needs an unused string of
//   ours within POS_TOL cells of it (text centres; widths estimated from the character count);
// * colours: JHora's text colour and our class must map one-to-one over the matched strings
//   (our colours are theme tokens, so only the grouping is compared).
// Many Vargas (the chart pane): the sign of Lagna and Su..Ke in each of JHora's 12 chart boxes
// against signsInVarga() for the varga named in the box.
//
// CHAKRA_DIR overrides the directory; CHAKRA_DUMP=1 prints both sides' strings.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart, signsInVarga, type Chart } from '../src/core/chart';
import { CHAKRA_VIEWS, type ChakraSubTab } from '../src/ui/chakras/index';
import type { ChakraViewProps } from '../src/ui/chakras/common';
import type { VargaName } from '../src/core/vargas';

interface GdiEvent {
  hwnd: number; cls?: string; fn: string; text?: string; x?: number; y?: number;
  rect?: [number, number, number, number]; fmt?: number; opts?: number; color?: number; bk?: number; brush?: number; pts?: number[];
}
interface Draw { top: string; sub: string; events: GdiEvent[] }
interface Captured { draws?: Draw[] }

const DIR = process.env.CHAKRA_DIR ?? 'golden/jhora-misc';
const DUMP = !!process.env.CHAKRA_DUMP;
const charts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];

type Align = 'start' | 'middle' | 'end';
/**
 * A drawn string: centre point (x estimated from the character count), the x it is aligned on
 * (`ax`, `align`) and its colour (JHora COLORREF hex / our class).
 */
interface Item { s: string; x: number; ax: number; align: Align; y: number; color: string }

/** Position tolerance, in cells of the chakra (JHora px per cell below). */
const POS_TOL = 0.2;
const CELL: Record<ChakraSubTab, number> = {
  'Mixed 2-Vargas': 100, Kalachakra: 66, Sarvatobhadra: 88, 'Kota Chakra': 88, 'Surya Kalanala': 77,
  'Chandra Kalanala': 66, Sudarsana: 66, Shoola: 66, Tripataki: 66,
};
/** JHora x right of which strings belong to a separately laid-out block (see placeChakra). */
const SPLIT: Partial<Record<ChakraSubTab, number>> = { Sarvatobhadra: 830 };

// ---- JHora side ----

const DT_CENTER = 0x1, DT_RIGHT = 0x2, DT_VCENTER = 0x4, DT_BOTTOM = 0x8, DT_SINGLELINE = 0x20, DT_CALCRECT = 0x400;
/** JHora's chakra fonts: ~16 px line, ~8 px per character. */
const J_LINE = 16, J_CHAR = 8;

/**
 * The events of the view that drew the chakra, from its last complete paint. The view is the
 * first AfxFrameOrView42s window to paint (another view of the document may repaint after it,
 * e.g. an Ashtakavarga chart under Mixed 2-Vargas); helper windows (status bar, Day/Min spin
 * controls, toolbars) are other classes. JHora may paint twice: a paint starts with the same
 * event as the first one (the background fill).
 */
function viewEvents(events: GdiEvent[]): GdiEvent[] {
  const hwnd = events.find((e) => e.cls === 'AfxFrameOrView42s')?.hwnd;
  const own = events.filter((e) => e.hwnd === hwnd && !(e.fn === 'DrawText' && (e.fmt ?? 0) & DT_CALCRECT));
  const key = (e: GdiEvent) => JSON.stringify([e.fn, e.text, e.rect, e.x, e.y]);
  const starts = own.flatMap((e, i) => (key(e) === key(own[0]) ? [i] : []));
  const paints = starts.map((s, k) => own.slice(s, starts[k + 1] ?? own.length));
  return paints.reduce((a, b) => (b.length >= a.length ? b : a), [] as GdiEvent[]);
}

const hex = (c: number | undefined) => (c ?? 0).toString(16).padStart(6, '0');

/** Drawn strings (multi-line DrawText text joined with '\n'). */
function jhoraItems(events: GdiEvent[]): Item[] {
  const out: Item[] = [];
  for (const e of events) {
    if (!['DrawText', 'ExtTextOut', 'TextOut'].includes(e.fn) || !e.text?.trim()) continue;
    const s = e.text.split(/\r?\n/).map((l) => l.trim()).join('\n');
    const w = Math.max(...s.split('\n').map((l) => l.length)) * J_CHAR;
    let x: number, ax: number, align: Align, y: number;
    if (e.fn === 'DrawText' && e.rect) {
      const [l, t, r, b] = e.rect, fmt = e.fmt ?? 0, single = fmt & DT_SINGLELINE;
      [x, ax, align] = fmt & DT_CENTER ? [(l + r) / 2, (l + r) / 2, 'middle'] : fmt & DT_RIGHT ? [r - Math.min(w, r - l) / 2, r, 'end'] : [l + Math.min(w, r - l) / 2, l, 'start'];
      y = single && fmt & DT_VCENTER ? (t + b) / 2 : single && fmt & DT_BOTTOM ? b - J_LINE / 2 : t + J_LINE / 2;
    } else {
      // TA_LEFT | TA_TOP (the DC default)
      [x, ax, align] = [(e.x ?? 0) + w / 2, e.x ?? 0, 'start'];
      y = (e.y ?? 0) + J_LINE / 2;
    }
    out.push({ s, x, ax, align, y, color: hex(e.color) });
  }
  return out;
}

// ---- our side ----

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'", nbsp: ' ' };
const decode = (s: string) => s.replace(/&(#?\w+);/g, (m, k: string) => ENTITIES[k] ?? m);
const attrs = (s: string) => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
/** Our fonts: ~12 user units high, ~6.5 per character. */
const O_CHAR = 6.5, O_HALF_LINE = 4;

/** <text> items of a static SVG; tspans with their own x/y/dy start a new line. */
function svgItems(svg: string): Item[] {
  const out: Item[] = [];
  const shift: [number, number][] = [[0, 0]];
  let cur: { x: number; y: number; anchor: Align; cls: string; lines: string[] } | null = null;
  for (const m of svg.matchAll(/<(\/?)([\w-]+)([^>]*?)(\/?)>|([^<]+)/g)) {
    const [, close, tag, rest, selfClose, text] = m;
    if (text !== undefined) {
      if (cur) cur.lines[cur.lines.length - 1] += decode(text);
      continue;
    }
    const a = attrs(rest ?? '');
    if (tag === 'g' && !close) {
      const [dx, dy] = shift[shift.length - 1];
      const t = a.transform ? /^translate\(([-\d.]+)[ ,]+([-\d.]+)\)$/.exec(a.transform) : ['', '0', '0'];
      if (!t) throw new Error(`unsupported transform ${a.transform}`);
      if (!selfClose) shift.push([dx + +t[1], dy + +t[2]]);
    } else if (tag === 'g') shift.pop();
    else if (tag === 'text' && !close) {
      const [dx, dy] = shift[shift.length - 1];
      cur = { x: +(a.x ?? 0) + dx, y: +(a.y ?? 0) + dy, anchor: (a['text-anchor'] ?? 'start') as Align, cls: a.class ?? '', lines: [''] };
    } else if (tag === 'tspan' && !close && cur && (a.x || a.y || a.dy) && cur.lines[cur.lines.length - 1]) cur.lines.push('');
    else if (tag === 'text' && close && cur) {
      const s = cur.lines.map((l) => l.trim()).join('\n');
      if (s) {
        const w = Math.max(...s.split('\n').map((l) => l.length)) * O_CHAR;
        const x = cur.anchor === 'middle' ? cur.x : cur.anchor === 'end' ? cur.x - w / 2 : cur.x + w / 2;
        out.push({ s, x, ax: cur.x, align: cur.anchor, y: cur.y - O_HALF_LINE, color: cur.cls });
      }
      cur = null;
    }
  }
  return out;
}

// ---- comparison ----

/** Least-squares a, b with y = a x + b. */
function fit(pairs: [number, number][]): [number, number] {
  const n = pairs.length, sx = pairs.reduce((s, p) => s + p[0], 0), sy = pairs.reduce((s, p) => s + p[1], 0);
  const sxx = pairs.reduce((s, p) => s + p[0] * p[0], 0), sxy = pairs.reduce((s, p) => s + p[0] * p[1], 0);
  const a = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return [a, (sy - a * sx) / n];
}

const counts = (items: Item[]) => items.reduce((m, i) => m.set(i.s, (m.get(i.s) ?? 0) + 1), new Map<string, number>());
const show = (s: string) => JSON.stringify(s);

/** Strings in one multiset but not the other ("JHora only" / "ours only"). */
function multisetDiff(jh: Item[], ours: Item[]): string[] {
  const a = counts(jh), b = counts(ours), out: string[] = [];
  for (const s of new Set([...a.keys(), ...b.keys()])) {
    const d = (a.get(s) ?? 0) - (b.get(s) ?? 0);
    if (d > 0) out.push(`JHora only: ${show(s)} x${d}`);
    if (d < 0) out.push(`ours only: ${show(s)} x${-d}`);
  }
  return out;
}

type Fit = [number, number, number, number];   // x = f0 * x + f1, y = f2 * y + f3
const apply = (f: Fit, o: Item): Item => ({ ...o, x: f[0] * o.x + f[1], ax: f[0] * o.ax + f[1], y: f[2] * o.y + f[3] });
/** The x two items are compared on: the alignment x when both align alike, else the centres. */
const xs = (j: Item, o: Item): [number, number] => (j.align === o.align ? [j.ax, o.ax] : [j.x, o.x]);
const dist = (j: Item, o: Item) => { const [a, b] = xs(j, o); return Math.hypot(a - b, j.y - o.y); };
const spread = (v: number[]) => Math.max(...v) - Math.min(...v);

/** Same-string pairs (JHora index, our index), closest first, each item used once. */
function assign(jh: Item[], mapped: Item[], tol: number): Map<number, number> {
  const cand: [number, number, number][] = [];
  jh.forEach((j, ji) => mapped.forEach((o, oi) => {
    if (o.s === j.s) cand.push([dist(j, o), ji, oi]);
  }));
  cand.sort((p, q) => p[0] - q[0]);
  const used = new Map<number, number>(), oUsed = new Set<number>();
  for (const [d, ji, oi] of cand) {
    if (d > tol || used.has(ji) || oUsed.has(oi)) continue;
    used.set(ji, oi);
    oUsed.add(oi);
  }
  return used;
}

/**
 * Map our coordinates onto JHora's: least squares on the strings drawn once on both sides
 * (when they span the drawing), else the bounding boxes of the shared strings; then refined
 * on all same-string pairs within a cell (views where every body is drawn several times,
 * e.g. Sudarsana's three rings, have few unique strings).
 */
function fitOurs(jh: Item[], ours: Item[], cell: number): Fit {
  const a = counts(jh), b = counts(ours);
  const anchors = jh.filter((j) => a.get(j.s) === 1 && b.get(j.s) === 1).map((j) => [j, ours.find((o) => o.s === j.s)!] as [Item, Item]);
  const lsq = (pairs: [Item, Item][]): Fit | null => {
    if (pairs.length < 3 || spread(pairs.map(([j]) => j.x)) < cell || spread(pairs.map(([j]) => j.y)) < cell) return null;
    return [...fit(pairs.map(([j, o]) => { const [a, b] = xs(j, o); return [b, a]; })), ...fit(pairs.map(([j, o]) => [o.y, j.y]))] as Fit;
  };
  let f = lsq(anchors);
  if (!f) {
    const sj = jh.filter((j) => b.has(j.s)), so = ours.filter((o) => a.has(o.s));
    const box = (v: Item[], k: 'x' | 'y') => [Math.min(...v.map((i) => i[k])), Math.max(...v.map((i) => i[k]))];
    const [jx0, jx1] = box(sj, 'x'), [ox0, ox1] = box(so, 'x'), [jy0, jy1] = box(sj, 'y'), [oy0, oy1] = box(so, 'y');
    f = [(jx1 - jx0) / (ox1 - ox0), 0, (jy1 - jy0) / (oy1 - oy0), 0];
    f[1] = jx0 - f[0] * ox0;
    f[3] = jy0 - f[2] * oy0;
  }
  for (let pass = 0; pass < 3; pass++) {
    const mapped = ours.map((o) => apply(f!, o));
    const next = lsq([...assign(jh, mapped, cell)].map(([ji, oi]) => [jh[ji], ours[oi]]));
    if (!next) break;
    f = next;
  }
  return f;
}

interface Placement { mismatches: string[]; pairs: [Item, Item][] }

/** Pair every JHora string with one of ours (already mapped) within `tol` px. */
function place(jh: Item[], ours: Item[], mapped: Item[], tol: number): Placement {
  const used = assign(jh, mapped, tol), oUsed = new Set(used.values());
  const pt = (i: Item) => `(${(i.align === 'middle' ? i.x : i.ax).toFixed(0)}, ${i.y.toFixed(0)})${i.align === 'middle' ? '' : ` ${i.align}`}`;
  const mismatches: string[] = [];
  jh.forEach((j, ji) => {
    if (used.has(ji)) return;
    const near = mapped.filter((o, oi) => o.s === j.s && !oUsed.has(oi)).sort((p, q) => dist(j, p) - dist(j, q))[0];
    mismatches.push(`${show(j.s)} at JHora ${pt(j)}: ${near ? `our nearest ${pt(near)}, ${dist(j, near).toFixed(0)} px off` : 'none of ours left'}`);
  });
  return { mismatches, pairs: [...used].map(([ji, oi]) => [jh[ji], ours[oi]]) };
}

/**
 * Fit and pair one chakra. Strings JHora draws right of x = `split` (Sarvatobhadra's table, laid
 * out in fixed pixels next to a grid that scales with the window) get a fit of their own.
 */
function placeChakra(jh: Item[], ours: Item[], cell: number, split?: number): Placement {
  const tol = POS_TOL * cell;
  const jMain = split === undefined ? jh : jh.filter((j) => j.x < split);
  const f = fitOurs(jMain, ours, cell);
  if (split === undefined) return place(jh, ours, ours.map((o) => apply(f, o)), tol);
  const right = ours.map((o) => apply(f, o).x >= split);
  const oMain = ours.filter((_, i) => !right[i]), oSide = ours.filter((_, i) => right[i]);
  const jSide = jh.filter((j) => j.x >= split);
  const fs = fitOurs(jSide, oSide, cell);
  const a = place(jMain, oMain, oMain.map((o) => apply(f, o)), tol), b = place(jSide, oSide, oSide.map((o) => apply(fs, o)), tol);
  return { mismatches: [...a.mismatches, ...b.mismatches], pairs: [...a.pairs, ...b.pairs] };
}

/**
 * Each of our colour classes must stand for one JHora text colour over the matched strings
 * (we never colour alike what JHora tells apart). The converse is not required: our theme
 * also marks the lagna, the base star and the headings.
 */
function colourMismatches(pairs: [Item, Item][]): string[] {
  const groups = new Map<string, Map<string, string[]>>();
  for (const [j, o] of pairs) {
    const g = groups.get(o.color) ?? new Map<string, string[]>();
    g.set(j.color, [...(g.get(j.color) ?? []), j.s]);
    groups.set(o.color, g);
  }
  return [...groups].filter(([, g]) => g.size > 1)
    .map(([c, g]) => `our class ${show(c)} -> JHora ${[...g].map(([o, ss]) => `${o} [${ss.slice(0, 6).join(' ')}${ss.length > 6 ? ' ...' : ''}]`).join(' / ')}`);
}

// ---- Many Vargas ----

/** South Indian box cell (col, row) -> sign, Pisces top-left. */
const SOUTH: Record<string, number> = { '1,0': 0, '2,0': 1, '3,0': 2, '3,1': 3, '3,2': 4, '3,3': 5, '2,3': 6, '1,3': 7, '0,3': 8, '0,2': 9, '0,1': 10, '0,0': 11 };
const GRAHA_LABELS = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];

interface VargaBox { caption: string[]; varga: VargaName | null; bySign: Map<string, number> }

/** JHora's chart boxes: an ETO_OPAQUE fill, then the bodies (DrawText) and the centred captions. */
function vargaBoxes(events: GdiEvent[]): VargaBox[] {
  const boxes: (VargaBox & { rect: number[] })[] = [];
  for (const e of events) {
    if (e.fn === 'ExtTextOut' && !e.text && e.rect && e.rect[0] > 0 && e.rect[2] - e.rect[0] === e.rect[3] - e.rect[1]) {
      boxes.push({ rect: e.rect, caption: [], varga: null, bySign: new Map() });
      continue;
    }
    const box = boxes[boxes.length - 1];
    if (!box || e.fn !== 'DrawText' || !e.text?.trim() || !e.rect) continue;
    const s = e.text.trim();
    if ((e.fmt ?? 0) & DT_CENTER) box.caption.push(s);
    else if (GRAHA_LABELS.includes(s)) {
      const c = (box.rect[2] - box.rect[0]) / 4;
      const col = Math.floor(((e.rect[0] + e.rect[2]) / 2 - box.rect[0]) / c), row = Math.floor(((e.rect[1] + e.rect[3]) / 2 - box.rect[1]) / c);
      box.bySign.set(s, SOUTH[`${col},${row}`]);
    }
  }
  for (const b of boxes) {
    const d = b.caption.map((c) => /^D-(\d+)\b/.exec(c)).find(Boolean);
    b.varga = d ? (`D${d[1]}` as VargaName) : b.caption.includes('Rasi') ? 'D1' : null;
  }
  return boxes;
}

// ---- fills ----
// Only Sudarsana's ring fills are literal JHora colours in our CSS; the other views fill with theme
// tokens (and JHora draws no cell highlights in the default state captured).

/** Outer, middle, inner ring classes (src/ui/chakras/sudarsana.css). */
const SUD_RING_CLASSES = ['sud-outer', 'sud-middle', 'sud-inner'];
/** COLORREF 0x00BBGGRR -> '#rrggbb'. */
const cssHex = (c: number | undefined) => `#${[0, 8, 16].map((s) => (((c ?? 0) >> s) & 255).toString(16).padStart(2, '0')).join('')}`;
/** Light-theme fill of `.<cls>` (its first rule, before any dark-mode override). */
function cssFill(file: string, cls: string): string | undefined {
  return new RegExp(`\\.${cls}\\s*\\{[^}]*fill:\\s*(#[0-9a-f]{6})`, 'i').exec(readFileSync(file, 'utf8'))?.[1].toLowerCase();
}

// ---- tests ----

function viewOf(sub: string): ComponentType<ChakraViewProps> | undefined {
  return (CHAKRA_VIEWS as Record<string, ComponentType<ChakraViewProps>>)[sub];
}

describe.skipIf(!charts.length)('Chakras match what JHora 8.0 draws', async () => {
  const swe = await nodeSweph();
  for (const name of charts) {
    const g: Captured = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'));
    const draws = (g.draws ?? []).filter((d) => d.top === 'Chakras');
    if (!draws.length) continue;
    describe(name, async () => {
      const chart: Chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      for (const d of draws) {
        const View = viewOf(d.sub);
        if (!View) continue;
        const sub = d.sub as ChakraSubTab;
        describe(sub, () => {
          const jh = jhoraItems(viewEvents(d.events));
          const ours = svgItems(renderToStaticMarkup(createElement(View, { chart })));
          if (DUMP) {
            const line = (i: Item) => `${show(i.s)} ${i.x.toFixed(0)},${i.y.toFixed(0)} ${i.align} ${i.ax.toFixed(0)} ${i.color}`;
            console.log(`== ${name} / ${sub}\n-- JHora\n${jh.map(line).join('\n')}\n-- ours\n${ours.map(line).join('\n')}`);
          }
          it('draws the same strings', () => {
            const diff = multisetDiff(jh, ours);
            expect(diff, diff.join('\n')).toEqual([]);
          });
          const placed = placeChakra(jh, ours, CELL[sub], SPLIT[sub]);
          it('places them where JHora does', () => {
            expect(placed.mismatches, placed.mismatches.join('\n')).toEqual([]);
          });
          it('colours them consistently', () => {
            const diff = colourMismatches(placed.pairs);
            expect(diff, diff.join('\n')).toEqual([]);
          });
          if (sub === 'Sudarsana') {
            it("fills the rings with JHora's colours", () => {
              const rings = viewEvents(d.events).filter((e) => e.fn === 'Ellipse' && e.pts)
                .sort((a, b) => (b.pts![2] - b.pts![0]) - (a.pts![2] - a.pts![0])).map((e) => cssHex(e.brush));
              expect(rings).toEqual(SUD_RING_CLASSES.map((c) => cssFill('src/ui/chakras/sudarsana.css', c)));
            });
          }
        });
      }
      const many = draws.find((d) => d.sub === 'Many Vargas');
      if (many) {
        it('Many Vargas: Lagna and Su..Ke in the same sign of every chart box', () => {
          const boxes = vargaBoxes(viewEvents(many.events));
          const diff: string[] = [];
          for (const b of boxes) {
            if (!b.varga) { diff.push(`box without a varga caption: ${b.caption.join(' | ')}`); continue; }
            const signs = signsInVarga(chart, b.varga);
            for (const [label, sign] of b.bySign) {
              const ours = signs.findIndex((list) => list.some((x) => x.label === label));
              if (ours !== sign) diff.push(`${b.caption.join(' ')}: ${label} JHora sign ${sign + 1}, ours ${ours + 1}`);
            }
            if (b.bySign.size !== GRAHA_LABELS.length) diff.push(`${b.caption.join(' ')}: JHora box has ${[...b.bySign.keys()].join(' ')}`);
          }
          expect(boxes.length).toBeGreaterThan(0);
          expect(diff, diff.join('\n')).toEqual([]);
        });
      }
    });
  }
});
