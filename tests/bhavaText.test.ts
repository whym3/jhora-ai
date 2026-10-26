// "Copy chart as text" of the Bhava/Chalit chakra (core/chartText.ts, varga 28 through the same
// builders FUN_00434c60 / FUN_00435110 / FUN_00435910): body boxes from the varga-28 signs,
// "other varga" captions ("Bhava/Chalit" and the short name 0x8a2874[28]); against JHora's own
// copies (tools/harness/views-bhava-text.json, golden/jhora-bhava-text/<chart>.json) when
// they exist.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { bodySigns } from '../src/core/chartBodies';
import { bhavaSigns } from '../src/core/bhavaChart';
import { chartText, chartTextSne } from '../src/core/chartText';
import { slotChart, slotText } from '../src/ui/shell/ChartPane';

const lines = (s: string) => s.replace(/\r\n/g, '\n').split('\n');
const load = async (name: string) => computeChart(await nodeSweph(), parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));

describe('Bhava/Chalit chakra as text', async () => {
  const chart = await load('Mahatma Gandhi');
  const signs = bhavaSigns(chart);

  it('South Indian: the D-1 copy with the varga-28 signs and captions', () => {
    // with the D-1 signs as the "bhava" signs only the caption lines differ from the D-1 copy
    const d1 = lines(chartText(chart, 'D1', 0));
    const same = lines(chartText(chart, 'D1', 0, {}, { bhavaSigns: bodySigns(chart, 'D1') }));
    const diff = d1.flatMap((l, i) => (l === same[i] ? [] : [i]));
    expect(diff).toEqual([11, 12, 13]);
    // the long name one line up (0x271 - 0x33), "Rasi" gone from the separator line, the short name below
    expect(same[11]).toBe('|           |     Bhava/Chalit      |           |');
    expect(same[12]).toBe('|-----------|                       |-----------|');
    expect(same[13].slice(12)).toBe('|      D-1 (Moon)       |           |');
  });

  it('North Indian: title line with the long and short names, lagna from body 0', () => {
    const t = lines(chartText(chart, 'D1', 2, {}, { bhavaSigns: signs }));
    expect(t[0]).toBe(`Bhava/Chalit${' '.repeat(49 - 12 - 10)}D-1 (Moon)`);
    expect(t).toHaveLength(lines(chartText(chart, 'D1', 2)).length);
  });

  it('every text body sits in its bhava sign box (South)', () => {
    const t = chartText(chart, 'D1', 0, {}, { bhavaSigns: signs });
    const rasi = chartText(chart, 'D1', 0);
    // Gandhi's chart has bodies that change sign in the bhava chart (lagna in the middle of house 1)
    expect(t).not.toBe(rasi);
    const COL = [1, 2, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0], ROW = [0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 1, 0];
    const L = lines(t);
    const box = (s: number) => L.slice(ROW[s] * 6 + 1, ROW[s] * 6 + 6).map((l) => l.slice(COL[s] * 12 + 1, COL[s] * 12 + 12)).join(' ');
    for (const [label, idx] of [['As', 0], ['Su', 1], ['Mo', 2], ['Ma', 3], ['Ju', 5], ['Sa', 7]] as const) {
      expect(box(signs[idx]!)).toMatch(new RegExp(`\\b${label}`));
    }
  });

  it('the slot copy of the chart pane uses the varga-28 signs (no longer disabled)', () => {
    const slot = slotChart(chart, {}, 'Bhava', 'standard', 'Natal Chart')!;
    expect(slot.bhavaSigns).toEqual(signs);
    expect(slotText(slot, 0, false)).toBe(chartText(chart, 'D1', 0, {}, { bhavaSigns: signs }));
    expect(slotText(slot, 0, true)).toBe(chartTextSne(chart, 'D1', {}, { bhavaSigns: signs }));
  });
});

const DIR = 'golden/jhora-bhava-text';
const charts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];

describe.skipIf(!charts.length)('Bhava/Chalit text copies match JHora 8.0', async () => {
  for (const name of charts) {
    const g = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8')) as { texts: { name?: string; lines?: string[] }[] };
    const text = (n: string) => g.texts.find((t) => t.name === n)?.lines;
    describe(name, async () => {
      const chart = await load(name);
      const signs = bhavaSigns(chart);
      it('32985 (South Indian)', () => expect(lines(chartText(chart, 'D1', 0, {}, { bhavaSigns: signs }))).toEqual(text('chart_text')));
      it('32992 south-north-east', () => expect(lines(chartTextSne(chart, 'D1', {}, { bhavaSigns: signs }))).toEqual(text('chart_text_sne')));
    });
  }
});
