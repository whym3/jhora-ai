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
      // Tolerances. Planets agree to 0.03" and the lagna to 0.2" (1836 chart); Kunda is
      // lagna x 81. Bodies derived from sunrise inherit a 4-18 ms difference between
      // JHora's old Swiss rise iteration and Swiss 2.10: up to 1.4" on the ghati lagna
      // (1 sign/ghati) and 5.4" on the vighati/pranapada lagnas (4 signs/ghati).
      const FAST = new Set(['Vighati Lagna', 'Pranapada Lagna']);
      const SUNRISE = new Set(['Bhava Lagna', 'Hora Lagna', 'Ghati Lagna', 'Sree Lagna', 'Maandi', 'Gulika', 'Kaala', 'Mrityu',
        'Artha Prahara', 'Yama Ghantaka', 'Prana Sphuta', 'Deha Sphuta', 'Mrityu Sphuta', 'Sookshma TriSphuta',
        'TriSphuta', 'ChatusSphuta', 'PanchaSphuta']);
      const bad: string[] = [];
      rows.forEach((r, i) => {
        const want = parseLongitude(r[1]);
        const d = arcsec(bodies[i].lon, want);
        const name = bodies[i].name;
        const tol = FAST.has(name) ? 6 : SUNRISE.has(name) ? 2 : name === 'Kunda' ? 20 : 0.2;
        if (d > tol) bad.push(`${bodies[i].name}: ${formatLongitude(bodies[i].lon)} vs ${r[1].trim()} (${d.toFixed(2)}")`);
      });
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});
