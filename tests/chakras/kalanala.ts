import { describe, expect, it } from 'vitest';
import { chandraKalanala, suryaKalanala, CHANDRA_STAR_XY, SURYA_STAR_XY } from '../../src/core/chakras/kalanala';
import type { ChakraChart } from '../../src/core/chakras/common';
import { GRAHAS, type Graha, type Positions } from '../../src/core/positions';
import { NAK28, nakshatra28Of } from '../../src/core/zodiac';

function fixture(lons: Partial<Record<Graha | 'Lagna', number>>, retro: Graha[] = []): ChakraChart {
  const body = (lon: number, r = false) => ({ lon, lat: 0, speed: r ? -0.1 : 1, retrograde: r });
  const grahas = Object.fromEntries(GRAHAS.map((g, i) => [g, body(lons[g] ?? i * 37 + 5, retro.includes(g))])) as Positions['grahas'];
  const positions: Positions = {
    jdUt: 2451545, jdEt: 2451545, ayanamsa: 23.85, ayanamsaMean: 23.85, ascendant: lons.Lagna ?? 100, grahas,
    outer: { Uranus: body(10), Neptune: body(20), Pluto: body(30) },
  };
  return { positions, bodies: [] };
}

describe.each([['surya', suryaKalanala, SURYA_STAR_XY], ['chandra', chandraKalanala, CHANDRA_STAR_XY]] as const)('%s kalanala', (_k, build, xy) => {
  const chart = fixture({ Sun: 200, Moon: 15, Saturn: 201, Lagna: 278 }, ['Saturn']);
  const k = build(chart);

  it('has 28 slots with every NAK28 star exactly once', () => {
    expect(k.slots).toHaveLength(28);
    expect(new Set(k.slots.map((s) => s.star)).size).toBe(28);
    expect(k.slots.map((s) => NAK28[s.star]).sort()).toEqual([...NAK28].sort());
    expect(new Set(xy.map(([x, y]) => `${x},${y}`)).size).toBe(28);
    for (const [x, y] of xy) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(132); expect(y).toBeLessThanOrEqual(132); }
  });

  it("starts from the Sun's 28-star nakshatra (no +1)", () => {
    expect(k.baseStar).toBe(nakshatra28Of(200));
    expect(k.slots[0].star).toBe(nakshatra28Of(200));
    expect(k.slots[1].star).toBe((nakshatra28Of(200) + 1) % 28);
  });

  it('places the ten planet-set bodies by nakshatra28, retrograde in parentheses', () => {
    const labels = k.slots.flatMap((s) => s.labels.map((l) => ({ ...l, star: s.star })));
    expect(labels).toHaveLength(10);
    for (const l of labels) expect(l.star).toBe(nakshatra28Of(l.body.lon));
    const sun = k.slots[0].labels.map((l) => l.text);
    expect(sun).toEqual(['Su', '(Sa)']);
    // second body in a box sits 4.5 units lower than the first
    expect(k.slots[0].labels[1].y - k.slots[0].labels[0].y).toBeCloseTo(4.5);
    const lagna = labels.find((l) => l.text === 'As')!;
    expect(NAK28[lagna.star]).toBe('Abhi'); // 278 = 8 Cp: Abhijit (6 40 - 10 00 Cp)
  });

  it('honours a custom base star and the Tajaka lagna base', () => {
    expect(build(chart, { baseStar: 21 }).slots[0].star).toBe(21);
    expect(build(chart, { tajaka: true }).baseStar).toBe(nakshatra28Of(278));
  });

  it('takes bodies from the transit chart, base star from the natal Sun', () => {
    const t = fixture({ Sun: 10, Moon: 100 });
    const kt = build(chart, { transit: t });
    expect(kt.baseStar).toBe(nakshatra28Of(200));
    expect(kt.slots.flatMap((s) => s.labels).every((l) => l.body.transit)).toBe(true);
  });
});
