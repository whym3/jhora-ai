import { describe, expect, it } from 'vitest';
import type { ChakraChart } from '../../src/core/chakras/common';
import { sudarsanaChakra, SUDARSANA_MODE_BODIES } from '../../src/core/chakras/sudarsana';
import type { Positions, Graha } from '../../src/core/positions';

function fixture(asc: number, lons: Partial<Record<Graha, number>>, retro: Graha[] = []): ChakraChart {
  const base: Record<Graha, number> = { Sun: 100, Moon: 200, Mars: 15, Mercury: 110, Jupiter: 250, Venus: 80, Saturn: 300, Rahu: 40, Ketu: 220, ...lons };
  const grahas = Object.fromEntries(Object.entries(base).map(([g, lon]) => [g, { lon, lat: 0, speed: retro.includes(g as Graha) ? -0.1 : 1, retrograde: retro.includes(g as Graha) }])) as Positions['grahas'];
  const outer = { Uranus: { lon: 0, lat: 0, speed: 0, retrograde: false }, Neptune: { lon: 0, lat: 0, speed: 0, retrograde: false }, Pluto: { lon: 0, lat: 0, speed: 0, retrograde: false } };
  return { positions: { jdUt: 0, jdEt: 0, ayanamsa: 0, ayanamsaMean: 0, ascendant: asc, grahas, outer }, bodies: [] };
}

describe('Sudarsana chakra', () => {
  const chart = fixture(5, {}, ['Saturn']);
  const d = sudarsanaChakra(chart);

  it('has three rings (Lagna, Moon, Sun inner to outer) of 12 consecutive signs', () => {
    expect(d.rings.map((r) => r.ref)).toEqual(['Lagna', 'Moon', 'Sun']);
    expect(d.rings.map((r) => r.startSign)).toEqual([0, 6, 3]);
    for (const r of d.rings) {
      expect(r.houses).toHaveLength(12);
      r.houses.forEach((h, i) => { expect(h.house).toBe(i + 1); expect(h.sign).toBe((r.startSign + i) % 12); });
    }
  });

  it('places every body of the set once per ring, in the house of its sign', () => {
    for (const r of d.rings) {
      const all = r.houses.flatMap((h) => h.bodies);
      expect(all.map((b) => b.index).sort((a, b) => a - b)).toEqual(SUDARSANA_MODE_BODIES[0]);
      for (const h of r.houses) for (const b of h.bodies) expect(Math.floor(b.lon / 30)).toBe(h.sign);
    }
    expect(d.rings[1].houses[0].bodies.map((b) => b.label)).toEqual(['Mo']);
    expect(d.rings[0].houses[0].bodies.map((b) => b.label)).toEqual(['As', 'Ma']);
    expect(d.title).toBe('Planets in D-1');
  });

  it('marks only grahas retrograde and uses natal rings with transit bodies', () => {
    const sat = d.rings[0].houses.flatMap((h) => h.bodies).find((b) => b.index === 7)!;
    expect(sat.retrograde).toBe(true);
    const tr = sudarsanaChakra(chart, { transit: fixture(95, { Moon: 10 }) });
    expect(tr.rings.map((r) => r.startSign)).toEqual([0, 6, 3]);
    const moon = tr.rings[0].houses[0].bodies.find((b) => b.index === 2)!;
    expect(moon.transit).toBe(true);
  });

  it('supports the D-9 and the special-lagna set (skipping bodies without longitudes)', () => {
    const d9 = sudarsanaChakra(chart, { vargaIndex: 1 });
    expect(d9.title).toBe('Planets in D-9');
    const sl = sudarsanaChakra(chart, { mode: 3 });
    expect(sl.title).toBe('Special Lagnas in D-1');
    expect(sl.rings[0].houses.flatMap((h) => h.bodies).map((b) => b.index)).toEqual([0]);
  });
});
