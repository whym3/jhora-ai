import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { ASYNC_TABLES } from '../src/engine/jobs';
import type { BirthData } from '../src/core/jhd';

describe('Tajaka jobs', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, goldenCharts()[0].birth);
  const selection = { year: natal.birth.year + 30 };
  it('finds the annual chart moment and returns its birth data', async () => {
    const t = await ASYNC_TABLES['tajaka.find'](natal, { selection, variant: 'exact' }, swe);
    const { birth, label } = JSON.parse(t.text![0]) as { birth: BirthData; label: string };
    expect(label).toBe('Tajaka annual');
    expect(birth.year).toBe(selection.year);
    expect(birth.lat).toBe(natal.birth.lat);
    const c = await computeChart(swe, birth);
    const d = ((c.positions.grahas.Sun.lon - natal.positions.grahas.Sun.lon + 540) % 360) - 180;
    expect(Math.abs(d)).toBeLessThan(1e-4);
  });
  it('Mudda dasa covers the year', async () => {
    const t = await ASYNC_TABLES['tajaka.mudda'](natal, { selection, variant: 'exact' }, swe);
    expect(t.rows.length).toBeGreaterThanOrEqual(9);
    expect(t.text?.[0]).toMatch(/^Mudda/);
  });
});
