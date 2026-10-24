import { describe, expect, it } from 'vitest';
import type { ChakraChart } from '../../src/core/chakras/common';
import { GRAHAS, type Positions } from '../../src/core/positions';
import { kotaChakra, KOTA_PALA, kotaZone } from '../../src/core/chakras/kota';

function fixture(lons: number[], asc = 10): ChakraChart {
  const grahas = Object.fromEntries(GRAHAS.map((g, i) => [g, { lon: lons[i], lat: 0, speed: g === 'Saturn' ? -0.01 : 1, retrograde: g === 'Saturn' }])) as Positions['grahas'];
  const outer = { Uranus: { lon: 0, lat: 0, speed: 0, retrograde: false }, Neptune: { lon: 0, lat: 0, speed: 0, retrograde: false }, Pluto: { lon: 0, lat: 0, speed: 0, retrograde: false } };
  return { positions: { jdUt: 0, jdEt: 0, ayanamsa: 0, ayanamsaMean: 0, ascendant: asc, grahas, outer }, bodies: [] };
}
// Su Mo Ma Me Ju Ve Sa Ra Ke
const chart = fixture([100, 45, 200, 110, 300, 80, 250, 15, 195]);

describe('Kota chakra', () => {
  const k = kotaChakra(chart);
  it('places each of the 28 stars exactly once, from the natal Moon star', () => {
    expect(k.stars).toHaveLength(28);
    expect(new Set(k.stars.map((s) => s.star)).size).toBe(28);
    expect(k.baseStar).toBe(3); // Moon 45 deg = Rohini
    expect(k.stars[0]).toMatchObject({ row: 0, col: 0, zone: 'Bahya', label: 'Rohi' });
    expect(new Set(k.stars.map((s) => `${s.row},${s.col}`)).size).toBe(28);
  });
  it('has 4 pillar stars and 8 stars in each other zone, 7 per direction', () => {
    const count = (z: string) => k.stars.filter((s) => s.zone === z).length;
    expect([count('Stambha'), count('Durgantara'), count('Praakaara'), count('Bahya')]).toEqual([4, 8, 8, 8]);
    for (let d = 0; d < 4; d++) {
      expect(k.stars.slice(7 * d, 7 * d + 7).map((s) => s.zone)).toEqual(['Bahya', 'Praakaara', 'Durgantara', 'Stambha', 'Durgantara', 'Praakaara', 'Bahya']);
    }
    expect(kotaZone(4, 4)).toBe('Stambha');
  });
  it('places Sun..Ketu (no lagna) and computes swami/pala', () => {
    expect(k.stars.flatMap((s) => s.bodies).map((b) => b.label).sort()).toEqual(['Ju', 'Ke', 'Ma', 'Me', 'Mo', 'Ra', 'Sa', 'Su', 'Ve']);
    expect(k.stars[0].bodies.map((b) => b.label)).toEqual(['Mo']);
    expect(k.stars.flatMap((s) => s.bodies).find((b) => b.label === 'Sa')?.retrograde).toBe(true);
    expect(k.swami.name).toBe('Venus'); // Moon in Taurus
    expect(KOTA_PALA).toHaveLength(108);
    expect(k.palaText).toMatch(/^Kota Pala \(fort guard\): /);
  });
  it('uses transit bodies when given', () => {
    const t = kotaChakra(chart, fixture([0, 0, 0, 0, 0, 0, 0, 0, 180]));
    expect(t.baseStar).toBe(3);
    expect(t.stars.flatMap((s) => s.bodies).every((b) => b.transit)).toBe(true);
  });
});
