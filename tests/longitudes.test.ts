import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts, parseLongitude, view } from './golden';
import { computeChart } from '../src/core/chart';
import { allBodies } from '../src/core/longitudes';
import { calcSettingsFromIni } from '../src/core/settings';
import { formatLongitude } from '../src/core/zodiac';

const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

describe('all 56 bodies of the Longitudes table match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenCharts()) {
    it(chart.name, async () => {
      const c = await computeChart(swe, chart.birth);
      const bodies = allBodies(swe, c.positions, { lat: c.birth.lat, lon: c.birth.lon, alt: c.birth.altitudeM }, c.birth.tzHours, calcSettingsFromIni(c.ini), c.ini);
      const rows = view(chart, 'Longitudes & Basic Info').rows;
      expect(bodies.map((b) => b.name)).toEqual(rows.map((r) => r[0].split(/ - | \(R\)/)[0].trim()));
      // Tolerances. JHora prints 0.01"; every body, including those from sunrise (vighati and
      // pranapada lagnas move up to 300"/s), agrees to within 0.001" of that rounding.
      // Kunda is the lagna x 81, so its last digit may differ by one.
      const bad: string[] = [];
      rows.forEach((r, i) => {
        const want = parseLongitude(r[1]);
        const d = arcsec(bodies[i].lon, want);
        const name = bodies[i].name;
        const tol = name === 'Kunda' ? 0.0101 : 0.006;
        if (d > tol) bad.push(`${bodies[i].name}: ${formatLongitude(bodies[i].lon)} vs ${r[1].trim()} (${d.toFixed(2)}")`);
      });
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});
