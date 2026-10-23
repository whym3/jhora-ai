import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { SE } from '../src/sweph';

describe('sweph wasm', () => {
  it('loads files on demand and computes J2000 Sun', async () => {
    const swe = await nodeSweph();
    const jd = swe.julday(2000, 1, 1, 12);
    expect(jd).toBe(2451545.0);
    await swe.ensureEphemeris(jd);
    const sun = swe.calcUt(jd, SE.SUN, SE.FLG_SWIEPH);
    expect(sun.flags & SE.FLG_SWIEPH).toBeTruthy();
    expect(sun.lon).toBeCloseTo(280.37, 1); // tropical apparent Sun at J2000
    swe.setSidMode(1); // Lahiri
    expect(swe.ayanamsaUt(jd, SE.FLG_SWIEPH)).toBeCloseTo(23.857, 2);
    expect(swe.version()).toMatch(/^2\.10/);
  });
});
