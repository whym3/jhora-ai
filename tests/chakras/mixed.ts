import { describe, expect, it } from 'vitest';
import type { ChakraChart } from '../../src/core/chakras/common';
import { mixedVargas } from '../../src/core/chakras/mixedVargas';
import type { Positions, Graha } from '../../src/core/positions';

function fixture(asc: number, lons: Partial<Record<Graha, number>> = {}): ChakraChart {
  const base: Record<Graha, number> = { Sun: 100, Moon: 200, Mars: 15, Mercury: 110, Jupiter: 250, Venus: 80, Saturn: 300, Rahu: 40, Ketu: 220, ...lons };
  const grahas = Object.fromEntries(Object.entries(base).map(([g, lon]) => [g, { lon, lat: 0, speed: 1, retrograde: false }])) as Positions['grahas'];
  const outer = { Uranus: { lon: 0, lat: 0, speed: 0, retrograde: false }, Neptune: { lon: 0, lat: 0, speed: 0, retrograde: false }, Pluto: { lon: 0, lat: 0, speed: 0, retrograde: false } };
  return { positions: { jdUt: 0, jdEt: 0, ayanamsa: 0, ayanamsaMean: 0, ascendant: asc, grahas, outer }, bodies: [] };
}

describe('Mixed 2-Vargas', () => {
  const chart = fixture(5);

  it('defaults to Rasi inside and Navamsa outside', () => {
    const d = mixedVargas(chart);
    expect([d.innerVarga, d.outerVarga]).toEqual([0, 1]);
    expect(d.innerCaption).toEqual(['Inner', 'Rasi']);
    expect(d.outerCaption).toEqual(['Outer', 'Navamsa']);
    expect(d.signs).toHaveLength(12);
    expect(d.lagnaSign).toBe(0);
  });

  it('places lagna, 9 grahas and 12 arudhas in each half', () => {
    const d = mixedVargas(chart);
    const inner = d.signs.flatMap((s) => s.inner), outer = d.signs.flatMap((s) => s.outer);
    expect(inner).toHaveLength(22);
    expect(outer).toHaveLength(22);
    expect(inner.filter((b) => b.index <= 9).map((b) => b.index).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // rasi signs of the inner half
    for (const s of d.signs) for (const b of s.inner) if (b.index <= 9) expect(Math.floor(b.lon / 30)).toBe(s.sign);
    // navamsa of Mars at 15 Ar = 5th navamsa from Aries = Leo
    expect(d.signs[4].outer.some((b) => b.index === 3)).toBe(true);
    expect(inner.filter((b) => b.index >= 59).map((b) => b.label)).toHaveLength(12);
  });

  it('draws a transit chart outside in its D-1 by default', () => {
    const d = mixedVargas(chart, { outerChart: fixture(95, { Moon: 10 }), arudhas: false });
    expect(d.outerVarga).toBe(0);
    expect(d.signs[0].outer.find((b) => b.index === 2)?.transit).toBe(true);
    expect(d.signs.flatMap((s) => s.outer)).toHaveLength(10);
  });
});
