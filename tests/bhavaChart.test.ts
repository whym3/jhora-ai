// The Bhava/Chalit chakra (core/bhavaChart.ts, FUN_004a76b0): properties of both paths, and the
// JHora captures of tools/harness/views-bhava.json (golden/jhora-bhava/<settings>/<chart>.json,
// skipped while absent): the labels JHora draws in each sign of Many Vargas slot 0 after
// 33330 / 33332 / 33344 must be where chartSigns() puts them with bhavaSigns().
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart, type Chart } from '../src/core/chart';
import { bodyLongitude } from '../src/core/chakras/common';
import { bodySigns, chartSigns } from '../src/core/chartBodies';
import { bhavaShortName, bhavaSigns, needsCusps, usesHouseSpans } from '../src/core/bhavaChart';
import { vargaLongitude } from '../src/core/vargas';
import { vargaSpec } from '../src/core/vargaOptions';
import type { JhoraIni } from '../src/settings/generated';

const load = async (name: string, ini: Partial<JhoraIni> = {}) =>
  computeChart(await nodeSweph(), parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), ini);
const norm = (x: number) => ((x % 360) + 360) % 360;

describe('Bhava/Chalit chakra', async () => {
  const chart = await load('Mahatma Gandhi');

  it('captions and paths', () => {
    expect(bhavaShortName({})).toBe('D-1 (Moon)');
    expect(bhavaShortName({ BhavaChartVarga: 1, BhavaChartRef: 0 })).toBe('D-9 (Asc)');
    expect(usesHouseSpans({})).toBe(false);
    expect(usesHouseSpans({ BhavaChartRef: 0 })).toBe(true);
    expect(needsCusps({ BhavaChartRef: 0, HouseTypeWanted: 4 })).toBe(true);
    expect(needsCusps({ BhavaChartRef: 0, HouseTypeWanted: 1 })).toBe(false);
  });

  it('defaults: 30-degree bhavas centred on the Moon', () => {
    const b = bhavaSigns(chart, {});
    const d1 = bodySigns(chart, 'D1');
    expect(b).toHaveLength(105);
    expect(b[2]).toBe(d1[2]);
    const r = chart.positions.grahas.Moon.lon % 30;
    for (let i = 0; i <= 12; i++) {
      const d = bodyLongitude(chart, i)! % 30;
      const shift = r < 15 ? (d >= r + 15 ? 1 : 0) : (d < r - 15 ? -1 : 0);
      expect(b[i]).toBe((d1[i]! + shift + 12) % 12);
    }
  });

  it('reference Lagna in D-1: equal houses (lagna in the middle) from the house spans', () => {
    const b = bhavaSigns(chart, { BhavaChartRef: 0, HouseTypeWanted: 1, HouseCuspsInMiddle: 1 });
    const asc = chart.positions.ascendant, ls = Math.floor(asc / 30);
    expect(b[0]).toBe(ls);
    for (let i = 1; i <= 46; i++) {
      const lon = bodyLongitude(chart, i);
      if (lon === null) continue;
      expect(b[i]).toBe((ls + Math.floor(norm(lon - asc + 15) / 30)) % 12);
    }
    // arudhas have no longitude of their own: JHora reads 0 Aries
    const aries = (ls + Math.floor(norm(-asc + 15) / 30)) % 12;
    for (let i = 59; i <= 70; i++) expect(b[i]).toBe(aries);
  });

  it('house systems needing cusps take them from the ephemeris', async () => {
    const swe = await nodeSweph();
    const placidus = await load('Mahatma Gandhi', { HouseTypeWanted: 4, BhavaChartRef: 0 });
    const b = bhavaSigns(placidus, {}, { swe });
    expect(b[0]).toBe(Math.floor(placidus.positions.ascendant / 30));
    expect(b.slice(0, 10).every((s) => s !== null && s >= 0 && s < 12)).toBe(true);
  });

  it('varga path with the lagna at the start of the first bhava, and from Rahu anti-zodiacally', () => {
    const ini = { BhavaChartVarga: 1, BhavaChartRef: 0, HouseCuspsInMiddle: 0 };
    const spec = vargaSpec('D9', chart.ini);
    const deg = (i: number) => vargaLongitude(bodyLongitude(chart, i)!, spec) % 30;
    const d9 = bodySigns(chart, 'D9');
    const b = bhavaSigns(chart, ini);
    for (let i = 0; i <= 9; i++) expect(b[i]).toBe((d9[i]! + (deg(i) < deg(0) ? 11 : 0)) % 12);
    const n = bhavaSigns(chart, { ...ini, BhavaChartRef: 8, HousesFromNodesReversed: 1 });
    for (let i = 0; i <= 9; i++) expect(n[i]).toBe((d9[i]! + (deg(i) > deg(8) ? 1 : 0)) % 12);
  });

  it('feeds chartSigns', () => {
    const signs = bhavaSigns(chart, {});
    const drawn = chartSigns(chart, 'D1', { signs });
    expect(drawn[signs[0]!].some((p) => p.index === 0)).toBe(true);
  });
});

// ---- JHora captures ----
interface GdiEvent { hwnd: number; cls?: string; fn: string; text?: string; rect?: [number, number, number, number]; fmt?: number }
const ROOT = 'golden/jhora-bhava';
const DT_CENTER = 0x1, DT_CALCRECT = 0x400;
const SOUTH: Record<string, number> = { '1,0': 0, '2,0': 1, '3,0': 2, '3,1': 3, '3,2': 4, '3,3': 5, '2,3': 6, '1,3': 7, '0,3': 8, '0,2': 9, '0,1': 10, '0,0': 11 };
const MODE_VARGA: Record<string, number> = { 'Bhava D-1': 0, 'Bhava D-9': 1, 'Bhava D-10': 9 };

/** Labels per sign in the first chart box (as tests/chartViewsGolden.test.ts). */
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

const dirs = existsSync(ROOT) ? readdirSync(ROOT).filter((d) => !d.includes('.')) : [];
describe.skipIf(!dirs.length)('Bhava/Chalit chakra matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const dir of dirs) {
    for (const file of readdirSync(`${ROOT}/${dir}`).filter((f) => f.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${dir}/${file}`, 'utf8')) as { ini_overrides?: Record<string, string>; draws?: { mode?: string; events: GdiEvent[] }[] };
      const ini = Object.fromEntries(Object.entries(g.ini_overrides ?? {}).map(([k, v]) => [k, Number(v)])) as Partial<JhoraIni>;
      describe(`${dir} / ${file}`, async () => {
        const chart: Chart = await load(file.slice(0, -5), ini);
        for (const d of g.draws ?? []) {
          const v = MODE_VARGA[d.mode ?? ''];
          if (v === undefined) continue;
          it(`${d.mode}: bodies of the slot-0 box`, () => {
            const signs = bhavaSigns(chart, { BhavaChartVarga: v }, { swe });
            const ours = new Map(chartSigns(chart, 'D1', { signs }).flatMap((l, s) => l.map((b) => [b.label.trim(), s] as [string, number])));
            ours.delete('');
            expect(Object.fromEntries([...ours].sort())).toEqual(Object.fromEntries([...firstBox(d.events)].sort()));
          });
        }
      });
    }
  }
});
