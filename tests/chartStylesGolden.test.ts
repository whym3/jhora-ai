// North and East Indian chart geometry (ChartDiagram.tsx: FUN_00437e40, FUN_004362d0) against
// JHora 8.0, from the GDI draws of tools/harness/views-chartstyles.json (golden/jhora-chartstyle<N>)
// or views-chartviews.json (golden/jhora-chartviews-style<N>), N = 2 North, 3 East, 4 East with
// frame; skipped while those captures are absent. In the first Many Vargas box (slot 0, D-1,
// standard view) every body and sign number JHora draws (DrawText rect left/top) must be where
// placeTexts() puts it, with the chart rectangle taken from JHora's background fill.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { chartSigns } from '../src/core/chartBodies';
import { eastGeometry, northGeometry, placeTexts, type DiagramGeometry } from '../src/ui/ChartDiagram';

interface GdiEvent { hwnd: number; cls?: string; fn: string; text?: string; rect?: [number, number, number, number]; fmt?: number }
interface Captured { draws?: { sub: string; mode?: string | null; events: GdiEvent[] }[] }

const DT_CALCRECT = 0x400, DT_VCENTER = 0x4, DT_SINGLELINE = 0x20;
const dirs = existsSync('golden')
  ? readdirSync('golden').filter((d) => /^jhora-chart(style|views-style)[234]$/.test(d))
  : [];

/** The first chart box: JHora's background fill and the texts drawn until the next box. */
function firstBox(events: GdiEvent[]) {
  const hwnd = events.find((e) => e.cls === 'AfxFrameOrView42s')?.hwnd;
  const own = events.filter((e) => e.hwnd === hwnd && !(e.fn === 'DrawText' && (e.fmt ?? 0) & DT_CALCRECT));
  const isFill = (e: GdiEvent) => e.fn === 'ExtTextOut' && !e.text && !!e.rect && e.rect[0] > 0
    && e.rect[2] - e.rect[0] > 100 && Math.abs((e.rect[2] - e.rect[0]) - (e.rect[3] - e.rect[1])) < 40;
  const start = own.findIndex(isFill);
  if (start < 0) return null;
  const end = own.findIndex((e, i) => i > start && isFill(e));
  return { fill: own[start].rect!, texts: own.slice(start + 1, end < 0 ? undefined : end).filter((e) => e.fn === 'DrawText' && e.text?.trim() && e.rect) };
}

/** Our geometry for JHora's fill rect (North and East with frame fill the chart rect, plain East the whole slot). */
function geometryOf(style: number, fill: [number, number, number, number]): DiagramGeometry {
  const [l, t, r, b] = fill, W = r - l, H = b - t;
  if (style === 3) {
    const g = eastGeometry(W);
    return eastGeometry(W, [l + g.x0, t + g.y0, l + g.x1, t + g.y1]);
  }
  const make = style === 2 ? northGeometry : eastGeometry;
  for (let s = W; s < W + 60; s++) {
    const g = make(s);
    if (g.x1 - g.x0 === W && g.y1 - g.y0 === H) return make(s, fill);
  }
  return make(W + 26, fill);
}

describe.skipIf(!dirs.length)('North and East Indian charts match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const dir of dirs) {
    const style = Number(/(\d)$/.exec(dir)![1]);
    for (const file of readdirSync(`golden/${dir}`).filter((f) => f.endsWith('.json'))) {
      const name = file.slice(0, -5);
      const g: Captured = JSON.parse(readFileSync(`golden/${dir}/${file}`, 'utf8'));
      const draw = (g.draws ?? []).find((d) => d.sub === 'Many Vargas' && (d.mode ?? 'Standard view') === 'Standard view');
      if (!draw) continue;
      it(`${dir} / ${name}: bodies and sign numbers of the D-1 box`, async () => {
        const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
        const box = firstBox(draw.events);
        expect(box).not.toBeNull();
        const geo = geometryOf(style, box!.fill);
        const signs = chartSigns(chart, 'D1', { view: 'standard' });
        const lagna = signs.findIndex((l) => l.some((p) => p.index === 0));
        const ours = placeTexts(geo, signs, lagna).map((p) => `${p.text.trim()}@${p.left},${p.top}`).sort();
        const jh = box!.texts
          .filter((e) => e.rect![1] >= geo.y0 && !((e.fmt ?? 0) & (DT_VCENTER | DT_SINGLELINE)))
          .map((e) => `${e.text!.trim()}@${e.rect![0]},${e.rect![1]}`).sort();
        expect(ours).toEqual(jh);
      });
    }
  }
});

describe('North and East Indian geometry', () => {
  it('JHora sizes at zoom 1 (font 21: bands 27 and 23)', () => {
    expect(northGeometry(360)).toMatchObject({ cap: 27, x0: 13, y0: 27, x1: 347, y1: 360, cw: 167, ch: 166, q: 27, r: 20 });
    expect(eastGeometry(360)).toMatchObject({ cap: 23, x0: 13, y0: 23, x1: 347, y1: 356, cw: 111, ch: 111, q: 18, r: 13 });
  });
  it('every text stays inside the chart', () => {
    const body = (index: number, corner = false) => ({ index, id: `b${index}`, label: `B${index}`, retrograde: false, kind: 'planet' as const, corner });
    const signs = Array.from({ length: 12 }, (_, s) => [
      ...Array.from({ length: 9 }, (_, i) => body(s * 20 + i)), ...Array.from({ length: 6 }, (_, i) => body(s * 20 + 9 + i, true)),
    ]);
    for (const g of [northGeometry(360), eastGeometry(360)]) {
      for (const t of placeTexts(g, signs, 3)) {
        expect(t.left).toBeGreaterThanOrEqual(g.x0);
        expect(t.left).toBeLessThan(g.x1);
        expect(t.top).toBeGreaterThanOrEqual(g.y0);
        expect(t.top).toBeLessThan(g.y1);
      }
    }
  });
});
