// The drawn Ashtakavarga view's other modes (src/core/ashtakavargaChart.ts) and its job; the
// BAVs-and-SAV mode is compared with JHora's own paint in ashtakavargaChartGolden.test.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { AV_DRAW_MODES, avChartData, avDrawing } from '../src/core/ashtakavargaChart';
import { AV_MODES } from '../src/ui/shell/tabs';

describe('drawn Ashtakavarga view', async () => {
  const swe = await nodeSweph();
  const chart = await computeChart(swe, parseJhd(readFileSync('golden/charts/Mahatma Gandhi.jhd', 'latin1')));
  const data = avChartData(chart);
  const o = { chartName: 'Natal Chart' };

  it('has a drawing for every menu 106 mode', () => {
    expect([...AV_DRAW_MODES]).toEqual([...AV_MODES]);
    for (const m of AV_DRAW_MODES) expect(avDrawing(data, m, o).texts.length).toBeGreaterThan(0);
  });

  it('SoAV: reduced BAVs and the SAV reduced to 1..12 (0x499f8f)', () => {
    const d = avDrawing(data, 'SoAV', o);
    expect(d.texts[1].text).toBe('Sodhita (reduced) ashtakavarga (SoAV) - with reference to Libra.\nPositions in D-1 are highlighted.');
    const sav = d.texts.slice(-13, -1).map((t) => Number(t.text));
    expect(sav).toEqual(data.sav.map((x) => x % 12 || 12));
    expect(d.texts.at(-1)!.text).toBe('SAV');
  });

  it('PAV: one label per bindu, the owner in the middle, its sign highlighted', () => {
    const d = avDrawing(data, 'PAV of Jupiter', o);
    expect(d.texts[0].text).toBe('Prastara (spread-out) ashtakavarga or PAV given below belongs to\nD-1 of the Natal Chart. The 1st house is used instead of lagna.\nHighlighting of the rasi occupied by the planet is based on the positions in D-1.');
    const bindus = data.pav[5].flat().reduce((a, x) => a + x, 0);
    expect(d.texts.filter((t) => t.narrow)).toHaveLength(bindus);
    expect(bindus).toBe(data.bav[5].reduce((a, x) => a + x, 0));
    expect(d.texts.slice(-2).map((t) => t.text)).toEqual(['PAV', 'Jupiter']);
    expect(d.rects.filter((r) => r.role === 'hl')).toEqual([{ x: 110, y: 90, w: 100, h: 100, role: 'hl' }]);   // Jupiter in Aries (cell 1, 0)
    expect(avDrawing(data, 'PAV of Jupiter', { ...o, highlight: false }).rects.filter((r) => r.role === 'hl')).toEqual([]);
  });

  it('sodhya pindas and nakshatras use the job table values', () => {
    const p = avDrawing(data, 'Sodhya pindas', o);
    expect(p.texts[0].text).toBe('Based on D-1 of the Natal Chart:');
    expect(p.texts.filter((t) => t.role === 'number').map((t) => Number(t.text))).toEqual(data.pindas.flatMap((x) => [x.total, x.rasi, x.graha]));
    const n = avDrawing(data, 'Nakshatras & rasis', o);
    expect(n.texts.filter((t) => t.role === 'number')).toHaveLength(12 * 8 * 2);
  });

  it('a lagna shift moves the reference sign and the PAV caption', () => {
    const s = avChartData(chart, { lagnaShift: 3 });
    expect(avDrawing(s, 'BAVs and SAV', o).texts[1].text).toMatch(/with reference to Capricorn\./);
    expect(avDrawing(s, 'PAV of Sun', o).texts[0].text).toMatch(/The 4th house is used instead of lagna\./);
  });
});
