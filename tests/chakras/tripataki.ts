import { describe, expect, it } from 'vitest';
import { SIGNS } from '../../src/core/zodiac';
import { TRIPATAKI_LINES, tripatakiChakra } from '../../src/core/chakras/tripataki';
import { fixtureChart } from './fixture';

describe('Tripataki chakra', () => {
  const chart = fixtureChart([10, 278, 45, 15, 200, 5, 310, 70, 250], 100);
  const c = tripatakiChakra(chart);
  it('has the 12 signs once each, from the lagna sign anticlockwise', () => {
    expect(c.slots).toHaveLength(12);
    expect(new Set(c.slots.map((s) => s.id)).size).toBe(12);
    expect(c.baseSign).toBe(3);
    expect(c.slots[0]).toMatchObject({ label: 'Cn', x: 66, y: -6 });
    expect(c.slots[1].label).toBe(SIGNS[4]);
    expect(c.title).toBe('Planets in D-1(from Lagna in D-1)');
  });
  it('draws grid, 12 vedha diagonals and three pennants', () => {
    expect(TRIPATAKI_LINES).toHaveLength(6 + 12 + 9);
  });
  it('places all ten bodies in the slot of their sign', () => {
    expect(c.bodies).toHaveLength(10);
    for (const b of c.bodies) expect(c.slots[b.pos].id).toBe(Math.floor(b.body.lon / 30));
    const lagna = c.bodies.find((b) => b.body.index === 0)!;
    expect(lagna.pos).toBe(0);
  });
  it('supports a fixed base sign', () => {
    const f = tripatakiChakra(chart, { fixedBaseSign: 0 });
    expect(f.slots[0].label).toBe('Ar');
  });
});
