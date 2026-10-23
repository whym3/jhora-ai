import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts, parseLongitude, view } from './golden';
import { birthJdUt } from '../src/core/jhd';
import { computePositions, GRAHAS } from '../src/core/positions';
import { DEFAULT_SETTINGS } from '../src/core/settings';
import { formatLongitude, nakshatraOf, NAKSHATRAS, padaOf, signOf, SIGNS } from '../src/core/zodiac';

const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

describe('graha and lagna longitudes match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenCharts()) {
    it(chart.name, async () => {
      const b = chart.birth;
      const jd = birthJdUt(b, (y, m, d, h) => swe.julday(y, m, d, h));
      await swe.ensureEphemeris(jd);
      const pos = computePositions(swe, jd, { lat: b.lat, lon: b.lon, alt: b.altitudeM }, DEFAULT_SETTINGS);
      const rows = view(chart, 'Longitudes & Basic Info').rows;
      const want = (label: string) => rows.find((r) => r[0].split(' ')[0] === label)!;
      const check = (label: string, lon: number, tol = 0.03) => {
        const r = want(label);
        expect(arcsec(lon, parseLongitude(r[1])), `${label} ${formatLongitude(lon)} vs ${r[1]}`).toBeLessThan(tol);
        expect([NAKSHATRAS[nakshatraOf(lon)], String(padaOf(lon)), SIGNS[signOf(lon)]]).toEqual([r[2], r[3], r[4]]);
      };
      // The lagna uses current Swiss sidereal-time models; JHora's 2.02 DLL differs by ~0.1" in 1836.
      check('Lagna', pos.ascendant, 0.2);
      for (const g of GRAHAS) check(g, pos.grahas[g].lon);
    });
  }
});
