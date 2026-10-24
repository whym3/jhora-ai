import { describe, expect, it } from 'vitest';
import type { ChakraChart } from '../../src/core/chakras/common';
import { GRAHAS, type Positions } from '../../src/core/positions';
import { kalachakraChakra, KC_STAR_X, KC_STAR_Y } from '../../src/core/chakras/kalachakra';

function fixture(lons: number[], asc = 10): ChakraChart {
  const grahas = Object.fromEntries(GRAHAS.map((g, i) => [g, { lon: lons[i], lat: 0, speed: 1, retrograde: false }])) as Positions['grahas'];
  const outer = { Uranus: { lon: 0, lat: 0, speed: 0, retrograde: false }, Neptune: { lon: 0, lat: 0, speed: 0, retrograde: false }, Pluto: { lon: 0, lat: 0, speed: 0, retrograde: false } };
  return { positions: { jdUt: 0, jdEt: 0, ayanamsa: 0, ayanamsaMean: 0, ascendant: asc, grahas, outer }, bodies: [] };
}
const chart = fixture([278, 45, 200, 110, 300, 80, 250, 15, 195]);

describe('Kalachakra chakra', () => {
  const kc = kalachakraChakra(chart);
  it('starts from the natal Sun star (28-star scheme) and has 28 distinct stars/cells', () => {
    expect(kc.baseStar).toBe(21); // Sun 278 deg = Abhijit
    expect(kc.stars[0].label).toBe('Abhi');
    expect(new Set(kc.stars.map((s) => s.star)).size).toBe(28);
    expect(new Set(KC_STAR_X.map((x, i) => `${x},${KC_STAR_Y[i]}`)).size).toBe(28);
    expect(kc.stars.filter((s) => s.dir === 'E')).toHaveLength(4);
    expect(kc.stars.filter((s) => s.dir === 'NE')).toHaveLength(3);
  });
  it('has 8 dikpalas with East at the top', () => {
    expect(kc.dikpalas).toHaveLength(8);
    expect(kc.dikpalas[0]).toMatchObject({ text: 'EAST: Indra (power)', y: 0 });
  });
  it('places Sun..Ketu in planets mode', () => {
    expect(kc.title).toBe('Planets:');
    expect(kc.stars.flatMap((s) => s.bodies)).toHaveLength(9);
    expect(kc.stars[0].bodies.map((b) => b.label)).toEqual(['Su']);
    expect(kc.complete).toBe(true);
  });
  it('reports incomplete modes when chart data lacks longitudes', () => {
    expect(kalachakraChakra(chart, null, { mode: 'upagrahas' }).complete).toBe(false);
    expect(kalachakraChakra(chart, null, { mode: 'yogini' }).complete).toBe(false);
  });
});
