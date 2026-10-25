// Chart diagram views (menu 103) and chart styles against JHora 8.0, from the captures of
// tools/harness/views-chartviews.json (skipped while they are absent):
// * golden/jhora-chartviews (ChartStyle=0): for every body view (mode), the labels JHora draws in
//   each sign of the first Many Vargas box (slot 0, D-1) must be those chartSigns() gives for
//   that view, and the clipboard texts must not depend on the view;
// * golden/jhora-chartviews-style<N> (ChartStyle=N): "Copy chart as text (current chart style)"
//   byte for byte.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { chartSigns, CHART_VIEWS } from '../src/core/chartBodies';
import { chartText, chartTextSne } from '../src/core/chartText';

interface GdiEvent { hwnd: number; cls?: string; fn: string; text?: string; rect?: [number, number, number, number]; fmt?: number }
interface Captured {
  ini_overrides?: Record<string, string>;
  texts: { mode?: string | null; name?: string; lines?: string[] }[];
  draws?: { sub: string; mode?: string | null; events: GdiEvent[] }[];
}

const dirs = existsSync('golden') ? readdirSync('golden').filter((d) => /^jhora-chartviews(-style\d)?$/.test(d)) : [];
const lines = (s: string) => s.replace(/\r\n/g, '\n').split('\n');
const DT_CENTER = 0x1, DT_CALCRECT = 0x400;
/** South Indian box cell (col, row) -> sign, Pisces top-left. */
const SOUTH: Record<string, number> = { '1,0': 0, '2,0': 1, '3,0': 2, '3,1': 3, '3,2': 4, '3,3': 5, '2,3': 6, '1,3': 7, '0,3': 8, '0,2': 9, '0,1': 10, '0,0': 11 };

/** Labels per sign in the first chart box of the view's last paint (see chakrasGolden.test.ts). */
function firstBox(events: GdiEvent[]): Map<string, number> {
  const hwnd = events.find((e) => e.cls === 'AfxFrameOrView42s')?.hwnd;
  const own = events.filter((e) => e.hwnd === hwnd && !(e.fn === 'DrawText' && (e.fmt ?? 0) & DT_CALCRECT));
  const out = new Map<string, number>();
  let box: number[] | null = null;
  for (const e of own) {
    if (e.fn === 'ExtTextOut' && !e.text && e.rect && e.rect[0] > 0 && e.rect[2] - e.rect[0] === e.rect[3] - e.rect[1]) {
      if (box) break;
      box = e.rect;
      continue;
    }
    if (!box || e.fn !== 'DrawText' || !e.text?.trim() || !e.rect || (e.fmt ?? 0) & DT_CENTER) continue;
    const c = (box[2] - box[0]) / 4;
    const col = Math.floor(((e.rect[0] + e.rect[2]) / 2 - box[0]) / c), row = Math.floor(((e.rect[1] + e.rect[3]) / 2 - box[1]) / c);
    out.set(e.text.trim().replace(/^\((.+)\)$/, '$1'), SOUTH[`${col},${row}`]);
  }
  return out;
}

describe.skipIf(!dirs.length)('chart views and styles match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const dir of dirs) {
    const style = Number(/style(\d)/.exec(dir)?.[1] ?? 0);
    for (const file of readdirSync(`golden/${dir}`).filter((f) => f.endsWith('.json'))) {
      const name = file.slice(0, -5);
      const g: Captured = JSON.parse(readFileSync(`golden/${dir}/${file}`, 'utf8'));
      describe(`${dir} / ${name}`, async () => {
        const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
        for (const t of g.texts.filter((x) => x.lines && (x.name === 'chart_text' || x.name === 'chart_text_sne'))) {
          it(`${t.name} (${t.mode ?? 'default'})`, () => {
            const ours = t.name === 'chart_text' ? chartText(chart, 'D1', style) : chartTextSne(chart, 'D1');
            expect(lines(ours)).toEqual(t.lines);
          });
        }
        if (style !== 0) return;
        for (const d of (g.draws ?? []).filter((x) => x.sub === 'Many Vargas')) {
          const view = CHART_VIEWS.find((v) => v.label === d.mode)?.view ?? 'standard';
          it(`${d.mode ?? 'Standard view'}: bodies of the D-1 box`, () => {
            const jh = firstBox(d.events);
            const ours = new Map(chartSigns(chart, 'D1', { view }).flatMap((l, s) => l.map((b) => [b.label.trim(), s] as [string, number])));
            ours.delete('');
            expect(Object.fromEntries([...ours].sort())).toEqual(Object.fromEntries([...jh].sort()));
          });
        }
      });
    }
  }
});
