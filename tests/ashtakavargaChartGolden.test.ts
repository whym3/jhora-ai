// Strengths > Ashtakavarga drawn as JHora 8.0 draws it (CAshtakaVargaView, src/core/ashtakavargaChart.ts)
// against the GDI calls JHora made (tools/harness/gditrace.py):
// * golden/jhora-misc/<chart>.json: the "Mixed 2-Vargas" draws also hold a paint of the AV view
//   (a second AfxFrameOrView42s window): BAVs and SAV of the natal D-1, highlighting on;
// * golden/jhora-av/<chart>.json (tools/harness/views-ashtakavarga.json): every menu 106 mode,
//   skipped while absent.
// The layout is in JHora pixels (zoom 1), so the comparison is exact: every DrawText string at
// the same rect (centred texts) or top-left corner (left-aligned texts), each of our colour roles
// standing for one JHora text colour, the boxes (ETO_OPAQUE fills in the box colour) and the
// highlighted cells at the same rects.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart, type Chart } from '../src/core/chart';
import { avChartData, avDrawing, type AvDrawing } from '../src/core/ashtakavargaChart';
import { AvChartSvg } from '../src/ui/shell/AshtakavargaChart';

interface GdiEvent { hwnd: number; cls?: string; fn: string; text?: string; rect?: [number, number, number, number]; fmt?: number; color?: number; bk?: number }
interface Draw { top: string; sub: string | null; mode?: string | null; events: GdiEvent[] }
interface Captured { draws?: Draw[] }

const DT_CENTER = 0x1;
const BOX = 0xe6e6e6, HL = 0xd2d2d2;

const files = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : []);
const norm = (s: string) => s.replace(/\r\n/g, '\n');

/** The AV view's events (the window that drew `marker`), from its last complete paint. */
function avEvents(events: GdiEvent[], marker: (e: GdiEvent) => boolean): GdiEvent[] {
  const hwnd = events.find((e) => e.cls === 'AfxFrameOrView42s' && e.fn === 'DrawText' && marker(e))?.hwnd;
  if (hwnd === undefined) return [];
  const own = events.filter((e) => e.hwnd === hwnd && !(e.fn === 'DrawText' && (e.fmt ?? 0) & 0x400));
  const key = (e: GdiEvent) => JSON.stringify([e.fn, e.text, e.rect]);
  const starts = own.flatMap((e, i) => (key(e) === key(own[0]) ? [i] : []));
  return own.slice(starts[starts.length - 1]);
}

/** Differences between JHora's paint and our drawing. */
function compare(ev: GdiEvent[], d: AvDrawing): string[] {
  const out: string[] = [];
  const jt = ev.filter((e) => e.fn === 'DrawText' && e.text?.trim() && e.rect);
  const ours = d.texts.map((t) => ({ ...t, used: false }));
  const colours = new Map<string, Set<number>>(), roles = new Map<number, Set<string>>();
  for (const e of jt) {
    const s = norm(e.text!), [l, t, r, b] = e.rect!, centred = ((e.fmt ?? 0) & DT_CENTER) !== 0;
    const hit = ours.find((o) => !o.used && o.text === s && o.x === l && o.y === t && (!centred || (o.align === 'center' && o.x + o.w === r && o.y + o.h === b)));
    if (!hit) { out.push(`JHora ${JSON.stringify(s)} at [${e.rect!.join(', ')}]${centred ? ' centred' : ''}: not drawn there by us`); continue; }
    hit.used = true;
    colours.set(hit.role, (colours.get(hit.role) ?? new Set()).add(e.color ?? 0));
    roles.set(e.color ?? 0, (roles.get(e.color ?? 0) ?? new Set()).add(hit.role));
  }
  for (const o of ours) if (!o.used) out.push(`ours only: ${JSON.stringify(o.text)} at (${o.x}, ${o.y})`);
  for (const [role, c] of colours) if (c.size > 1) out.push(`role ${role} -> JHora colours ${[...c].map((x) => x.toString(16)).join(' ')}`);
  for (const [c, r] of roles) if (r.size > 1) out.push(`JHora colour ${c.toString(16)} -> roles ${[...r].join(' ')}`);
  // fills: ETO_OPAQUE rects in the box and highlight colours (the client background excluded)
  const fills = (bk: number) => ev.filter((e) => e.fn === 'ExtTextOut' && !e.text && e.rect && e.bk === bk).map((e) => e.rect!.join(',')).sort();
  const rects = (role: 'box' | 'hl') => d.rects.filter((r) => r.role === role).map((r) => [r.x, r.y, r.x + r.w, r.y + r.h].join(',')).sort();
  const cmp = (what: string, j: string[], o: string[]) => { if (JSON.stringify(j) !== JSON.stringify(o)) out.push(`${what}: JHora ${j.join(' | ')}; ours ${o.join(' | ')}`); };
  cmp('boxes', fills(BOX), rects('box'));
  cmp('highlighted cells', fills(HL), rects('hl'));
  return out;
}

/** Our SVG draws every string of the drawing. */
function svgStrings(d: AvDrawing): string[] {
  const svg = renderToStaticMarkup(createElement(AvChartSvg, { drawing: d, title: 'AV' }));
  return [...svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)].map((m) => m[1].replace(/<tspan[^>]*>/g, '').replace(/<\/tspan>/g, '\n').replace(/\n$/, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&'));
}

const charts = files('golden/jhora-misc');
const isAv = (e: GdiEvent) => / of the /.test(e.text ?? '') || /^(Prastara|Based on)/.test(e.text ?? '');

describe.skipIf(!charts.length)('Ashtakavarga view as JHora draws it (BAVs and SAV under Mixed 2-Vargas)', async () => {
  const swe = await nodeSweph();
  for (const name of charts) {
    const g: Captured = JSON.parse(readFileSync(`golden/jhora-misc/${name}.json`, 'utf8'));
    const draw = (g.draws ?? []).find((d) => d.sub === 'Mixed 2-Vargas');
    const ev = draw ? avEvents(draw.events, (e) => e.text === 'SAV') : [];
    it.skipIf(!ev.length)(name, async () => {
      const chart: Chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      const d = avDrawing(avChartData(chart), 'BAVs and SAV', { chartName: 'Natal Chart' });
      const diff = compare(ev, d);
      expect(diff, diff.join('\n')).toEqual([]);
      expect(svgStrings(d).sort()).toEqual(d.texts.map((t) => t.text).sort());
    });
  }
});

const AV_DIR = 'golden/jhora-av';
const avCharts = files(AV_DIR);

describe.skipIf(!avCharts.length)('Ashtakavarga view: every menu 106 mode (golden/jhora-av)', async () => {
  const swe = await nodeSweph();
  for (const name of avCharts) {
    const g: Captured = JSON.parse(readFileSync(`${AV_DIR}/${name}.json`, 'utf8'));
    describe(name, async () => {
      const chart: Chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      const data = avChartData(chart);
      for (const draw of (g.draws ?? []).filter((d) => d.top === 'Strengths' && d.sub === 'Ashtakavarga' && d.mode)) {
        const mode = draw.mode!.replace(/ again$/, '').replace(/, (no highlight|highlight back on)$/, '');
        const highlight = !/no highlight$/.test(draw.mode!);
        it(draw.mode!, () => {
          const ev = avEvents(draw.events, isAv);
          expect(ev.length).toBeGreaterThan(0);
          const diff = compare(ev, avDrawing(data, mode, { chartName: 'Natal Chart', highlight }));
          expect(diff, diff.join('\n')).toEqual([]);
        });
      }
    });
  }
});
