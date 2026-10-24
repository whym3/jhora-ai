import { describe, expect, it } from 'vitest';
import { highlightSigns, maranaKarakaSthana, pachakadiOfPlanet, relationCodes } from '../src/core/chartMenu';
import { formatSpan, signChange } from '../src/core/signChange';
import type { Graha } from '../src/core/positions';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';

const at = (m: Partial<Record<Graha, number>>) => (g: Graha) => m[g] ?? 0;

describe('chart right-click commands (CChartView handlers)', () => {
  it('argala and virodhargala swap when Ketu is in the rasi', () => {
    expect(highlightSigns('argala', at({ Ketu: 5 }), null, 0)).toEqual([1, 3, 10, 4]);
    expect(highlightSigns('virodhargala', at({ Ketu: 5 }), null, 0)).toEqual([11, 9, 2, 8]);
    expect(highlightSigns('argala', at({ Ketu: 0 }), null, 0)).toEqual([11, 9, 2, 8]);
  });
  it('relationship codes, incl. the Ketu->Rahu quirk', () => {
    const sign = at({ Sun: 0, Moon: 1, Rahu: 3, Ketu: 9 });
    expect(relationCodes('permanent', 'Sun', sign).slice(0, 3)).toEqual([0, 2, 2]);
    expect(relationCodes('compound', 'Sun', sign)[1]).toBe(1); // Moon: friend + temporary friend
    expect(relationCodes('compound', 'Ketu', sign)[7]).toBe(1); // natural 0 (Rahu's row copied) + 1 (temporary enemy)
  });
  it('marana karaka sthana text', () => {
    const lines = maranaKarakaSthana(0, at({ Sun: 11, Moon: 3, Mars: 0, Mercury: 0, Jupiter: 0, Venus: 0, Saturn: 4, Rahu: 4 }), 'D-1');
    expect(lines).toContain('    Sun in 12th house (owns 5th house)    ');
  });
  it('pachakadi of the Sun', () => {
    const lines = pachakadiOfPlanet('Sun', 0, at({ Sun: 0 }));
    expect(lines[2]).toBe('      Naisargika Pachaka: Saturn    ');
    expect(lines[9]).toMatch(/^ {6}Pachaka sthana: Virgo/);
  });
  it('durations format', () => {
    expect(formatSpan(30 / 86400)).toBe('30 sec');
    expect(formatSpan(0.5)).toBe('12 hr 00 min 00 sec');
    expect(formatSpan(2.25)).toBe('2 day 6 hr 00 min 00 sec');
  });
});

describe('change of sign search', async () => {
  const swe = await nodeSweph();
  it('lagna leaves its sign within about two hours either way', async () => {
    const c = await computeChart(swe, goldenV3Charts()[0].birth);
    const r = signChange(swe, c, 'Lagna', 1);
    expect(r.earlierDays).toBeGreaterThan(0);
    expect(r.laterDays).toBeGreaterThan(0);
    expect(r.earlierDays + r.laterDays).toBeLessThan(0.15);
  });
});
