import { describe, expect, it } from 'vitest';
import type { ChakraChart } from '../../src/core/chakras/common';
import { fixtureChart } from './fixture';
import { NAK28, nakshatra28Of } from '../../src/core/zodiac';
import { SHOOLA_POS, shoolaChakra, STAR_CHAKRA_BODY_SETS } from '../../src/core/chakras/shoola';


//                 Su   Mo   Ma   Me   Ju   Ve   Sa   Ra   Ke
const LONS = [10, 278, 45, 15, 200, 5, 310, 70, 250];

describe('Shoola chakra', () => {
  const chart = fixtureChart(LONS, 100, ['Mars']);
  const c = shoolaChakra(chart);
  it('has 28 slots with each NAK28 star exactly once, starting at the natal Sun star', () => {
    expect(c.slots).toHaveLength(28);
    expect(new Set(c.slots.map((s) => s.id)).size).toBe(28);
    expect(c.baseStar).toBe(nakshatra28Of(10));
    expect(c.slots[0].label).toBe(NAK28[nakshatra28Of(10)]);
    expect(c.slots.map((s) => [s.x, s.y])).toEqual(SHOOLA_POS);
    expect(c.title).toBe('Planets:');
    expect(c.lines).toHaveLength(4);
  });
  it('places lagna and the nine grahas by their 28-star nakshatra', () => {
    expect(c.bodies).toHaveLength(10);
    for (const b of c.bodies) expect(c.slots[b.pos].id).toBe(nakshatra28Of(b.body.lon));
    expect(c.bodies.find((b) => b.body.label === 'Ma')?.text).toBe('(Ma)');
    // Moon at 278 is Abhijit (6 40 - 10 00 Cp)
    expect(c.slots[c.bodies.find((b) => b.body.label === 'Mo')!.pos].label).toBe('Abhi');
    // Sun and Venus share Aswini: the second sits in the other column
    const su = c.bodies.find((b) => b.body.label === 'Su')!, ve = c.bodies.find((b) => b.body.label === 'Ve')!;
    expect(su.pos).toBe(ve.pos);
    expect([su.x, ve.y]).not.toEqual([ve.x, su.y]);
  });
  it('honours a fixed base star and the next-star flag', () => {
    expect(shoolaChakra(chart, { fixedBaseStar: 21 }).slots[0].label).toBe('Abhi');
    expect(shoolaChakra(chart, { baseIsStar: false }).baseStar).toBe((nakshatra28Of(10) + 1) % 28);
  });
  it('skips body sets the chart data cannot provide', () => {
    expect(shoolaChakra(chart, { mode: 'upagrahas' }).bodies).toHaveLength(0);
    expect(STAR_CHAKRA_BODY_SETS.upagrahas).toHaveLength(11);
    const withLongs: ChakraChart = { ...chart, longitudes: [{ name: 'Gulika', lon: 33 }, { name: 'Maandi', lon: 40 }] };
    expect(shoolaChakra(withLongs, { mode: 'upagrahas' }).bodies.map((b) => b.text)).toEqual(['Gk', 'Md']);
  });
});
