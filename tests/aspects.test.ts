import { describe, expect, it } from 'vitest';
import { aspectPercent, grahaAspects } from '../src/core/aspects';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';

describe('Parasara aspect values (FUN_004b2b00)', () => {
  it('full aspects on the 7th and the special aspects', () => {
    expect(aspectPercent(180, 0, 'Sun')).toBe(100);
    expect(aspectPercent(120, 0, 'Jupiter')).toBe(100);
    expect(aspectPercent(240, 0, 'Jupiter')).toBe(100);
    expect(aspectPercent(90, 0, 'Mars')).toBe(100);
    expect(aspectPercent(200, 0, 'Mars')).toBe(100);
    expect(aspectPercent(60, 0, 'Saturn')).toBe(100);
    expect(aspectPercent(270, 0, 'Saturn')).toBe(100);
  });
  it('base curve and the non-Parasara option', () => {
    expect(aspectPercent(90, 0, 'Sun')).toBeCloseTo(75);
    expect(aspectPercent(10, 0, 'Moon')).toBe(0);
    expect(aspectPercent(320, 0, 'Moon')).toBe(0);
    expect(aspectPercent(90, 0, 'Mars', false)).toBe(100);
    expect(aspectPercent(120, 0, 'Jupiter', false)).toBe(100);
    expect(aspectPercent(130, 0, 'Jupiter', false)).toBeCloseTo(83.333, 2);
  });
  it('graha drishti on signs', () => {
    expect(grahaAspects('Saturn', 0, 2)).toBe(true);
    expect(grahaAspects('Rahu', 0, 1)).toBe(true);
    expect(grahaAspects('Ketu', 0, 6)).toBe(false);
  });
});

describe('aspect views build', async () => {
  const swe = await nodeSweph();
  const chart = goldenV3Charts()[0];
  it('evaluation and table', async () => {
    const c = await computeChart(swe, chart.birth);
    const ev = runTable(c, 'aspects.evaluation', {});
    expect(ev.rows.length).toBe(c.longitudes.length + 10 * 11);
    expect(ev.headers.length).toBe(11);
    const t = runTable(c, 'aspects.table', {});
    expect(t.rows.length).toBe(9);
    expect(t.rows[0].length).toBe(22);
  });
});
