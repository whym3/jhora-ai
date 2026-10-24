import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { MUNDANE_JOBS } from '../src/core/derived/mundaneJobs';
import { divisionArc, mundaneDasa, mundaneYearDefinition, periodInYears, swearingInLabel } from '../src/core/derived/mundane';
import type { BirthData } from '../src/core/jhd';

const wrap = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d <= -180) d += 360; return d; };
const n360 = (x: number) => ((x % 360) + 360) % 360;
const SEC = 1 / 86400;

describe('Mundane tab', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, goldenCharts()[0].birth);
  const run = async (params: Record<string, unknown>) => {
    const t = await MUNDANE_JOBS['mundane.find'](natal, params, swe);
    const r = JSON.parse(t.text![0]) as { birth: BirthData; label: string; periodDays: number };
    return { ...r, table: t, chart: await computeChart(swe, r.birth, natal.ini) };
  };
  const lonAt = async (birth: BirthData, dt: number) => {
    const c = await computeChart(swe, { ...birth, hour: birth.hour + dt * 24 });
    return c;
  };

  it('planetary transit: the body sits on a division boundary and the period ends at the next change', async () => {
    const r = await run({ mode: 'transit', body: 1, division: 0, after: true });
    expect(r.label).toBe('Rasi change (Su)');
    const sun = r.chart.positions.grahas.Sun.lon;
    expect(Math.abs(wrap(sun - Math.round(sun / 30) * 30))).toBeLessThan(2e-4);   // 1-second bracket
    expect(r.chart.positions.jdUt).toBeGreaterThan(natal.positions.jdUt);
    expect(r.chart.positions.jdUt - natal.positions.jdUt).toBeLessThan(32);
    expect(r.periodDays).toBeGreaterThan(28);
    expect(r.periodDays).toBeLessThan(33);
    // before: the Moon entered its present nakshatra
    const m = await run({ mode: 'transit', body: 2, division: 1, after: false });
    const moon = m.chart.positions.grahas.Moon.lon;
    const arc = divisionArc(1);
    expect(Math.abs(wrap(moon - Math.round(moon / arc) * arc))).toBeLessThan(2e-3);
    expect(Math.floor(n360(moon + 1e-3) / arc)).toBe(Math.floor(natal.positions.grahas.Moon.lon / arc));
    expect(m.chart.positions.jdUt).toBeLessThan(natal.positions.jdUt);
  });

  it('navamsa changes of Mars are 3 deg 20 min apart', async () => {
    const r = await run({ mode: 'transit', body: 3, division: 2, after: true });
    const mars = r.chart.positions.grahas.Mars.lon;
    expect(Math.abs(wrap(mars - Math.round(mars / (30 / 9)) * (30 / 9)))).toBeLessThan(1e-4);
    expect(r.label).toBe('Navamsa change (Ma)');
  });

  it('conjunction and aspects: lon(p1) - lon(p2) equals the angle', async () => {
    const r = await run({ mode: 'conjunction', body1: 2, body2: 1, aspect: 0, after: true });
    expect(r.label).toBe('Mo-Su Conj');
    const p = r.chart.positions.grahas;
    expect(Math.abs(wrap(p.Moon.lon - p.Sun.lon))).toBeLessThan(2e-4);
    expect(r.periodDays).toBeGreaterThan(29);
    expect(r.periodDays).toBeLessThan(30);
    const o = await run({ mode: 'conjunction', body1: 5, body2: 7, aspect: 2, after: false });   // Jupiter 5th from Saturn
    const q = o.chart.positions.grahas;
    expect(Math.abs(wrap(q.Jupiter.lon - q.Saturn.lon - 120))).toBeLessThan(1e-4);
    await expect(run({ mode: 'conjunction', body1: 8, body2: 9, aspect: 0, after: true })).rejects.toThrow(/never conjoin/);
  });

  it('stationary transit: the speed changes sign at the found moment', async () => {
    const r = await run({ mode: 'stationary', body: 1, after: true });   // Mercury
    expect(r.label).toBe('Retro change (Me)');
    const before = await lonAt(r.birth, -0.01), after = await lonAt(r.birth, 0.01);
    expect(Math.sign(before.positions.grahas.Mercury.speed)).not.toBe(Math.sign(after.positions.grahas.Mercury.speed));
    expect(r.periodDays).toBeGreaterThan(15);
    expect(r.periodDays).toBeLessThan(120);
  });

  it('solar charts: Sun at 0 Aries sidereal (new year), at a sign start (new month), at 66 deg 40 min (Ardra)', async () => {
    const y = await run({ mode: 'solarYear', next: true });
    expect(y.label).toBe('Solar Month');
    expect(Math.abs(wrap(y.chart.positions.grahas.Sun.lon))).toBeLessThan(1e-4);
    expect(y.periodDays).toBeCloseTo(365.256, 1);
    const m = await run({ mode: 'solarMonth', next: false });
    const s = m.chart.positions.grahas.Sun.lon;
    expect(Math.round(s / 30) % 12).toBe(Math.floor(natal.positions.grahas.Sun.lon / 30));
    expect(Math.abs(wrap(s - Math.round(s / 30) * 30))).toBeLessThan(1e-4);
    const a = await run({ mode: 'ardra', next: true });
    expect(a.label).toBe('Meteorological Yr');
    expect(Math.abs(wrap(a.chart.positions.grahas.Sun.lon - 200 / 3))).toBeLessThan(1e-4);
  });

  it('lunar charts: new moon year/month, fortnight, tithi start', async () => {
    const y = await run({ mode: 'lunarYear', next: true });
    const p = y.chart.positions.grahas;
    expect(Math.abs(wrap(p.Moon.lon - p.Sun.lon))).toBeLessThan(1e-3);
    expect(Math.floor(p.Sun.lon / 30)).toBe(11);                      // new moon with the Sun in Pisces (Chaitra)
    expect(y.periodDays).toBeGreaterThan(353);
    expect(y.periodDays).toBeLessThan(385);
    const m = await run({ mode: 'lunarMonth', next: false });
    const q = m.chart.positions.grahas;
    expect(Math.abs(wrap(q.Moon.lon - q.Sun.lon))).toBeLessThan(1e-3);
    expect(m.chart.positions.jdUt).toBeLessThan(natal.positions.jdUt);
    const f = await run({ mode: 'fortnight', next: true });
    const e = n360(f.chart.positions.grahas.Moon.lon - f.chart.positions.grahas.Sun.lon);
    expect(Math.min(Math.abs(wrap(e)), Math.abs(wrap(e - 180)))).toBeLessThan(1e-3);
    expect(f.periodDays).toBeGreaterThan(13);
    expect(f.periodDays).toBeLessThan(16.5);
    const d = await run({ mode: 'lunarDay', next: false });
    const de = n360(d.chart.positions.grahas.Moon.lon - d.chart.positions.grahas.Sun.lon);
    const ne = n360(natal.positions.grahas.Moon.lon - natal.positions.grahas.Sun.lon);
    expect(Math.abs(wrap(de - Math.floor(ne / 12) * 12))).toBeLessThan(1e-3);
    expect(d.periodDays).toBeGreaterThan(0.7);
    expect(d.periodDays).toBeLessThan(1.2);
  });

  it('eclipses: a lunar eclipse at maximum is a full moon near a node; contacts are listed', async () => {
    const r = await run({ mode: 'eclipse', type: 0, next: true, maximum: true });
    expect(r.label).toMatch(/Lun Ecli$/);
    const p = r.chart.positions.grahas;
    expect(Math.abs(wrap(p.Moon.lon - p.Sun.lon - 180))).toBeLessThan(0.5);
    expect(Math.min(Math.abs(wrap(p.Sun.lon - p.Rahu.lon)), Math.abs(wrap(p.Sun.lon - p.Ketu.lon)))).toBeLessThan(13);
    expect(r.table.rows.some((row) => row[0] === 'Maximum eclipse point')).toBe(true);
    const s = await run({ mode: 'eclipse', type: 1, next: false, maximum: true });
    const q = s.chart.positions.grahas;
    expect(Math.abs(wrap(q.Moon.lon - q.Sun.lon))).toBeLessThan(0.5);
    expect(s.chart.positions.jdUt).toBeLessThan(natal.positions.jdUt);
  });

  it('swearing-in: the chart is kept, the period sets the dasa compression', async () => {
    const r = await run({ mode: 'swearingIn', years: 4, days: 0 });
    expect(r.label).toBe('4-yr chart');
    expect(Math.abs(r.chart.positions.jdUt - natal.positions.jdUt)).toBeLessThan(SEC);
    expect(swearingInLabel(4 * 365.24219 + 10)).toBe('Chart of 1471 days');
    const d = mundaneDasa(swe, r.chart, r.periodDays, r.label);
    expect(d.yearDefinition).toBe(3);
    expect(d.compression).toBeCloseTo(4 * 365.24219 / 365.256364, 3);
    const span = d.periods[8].end - d.periods[0].start;
    expect(span * 120 / 120).toBeCloseTo(d.compression, 9);
    expect(d.periods[0].start).toBeLessThanOrEqual(0);
    // tithi years for lunar charts, Sun-longitude years for solar charts
    expect(mundaneYearDefinition({}, 'Lunar Month')).toBe(4);
    expect(mundaneYearDefinition({}, 'Solar Month')).toBe(3);
    const lm = await run({ mode: 'lunarMonth', next: true });
    expect(periodInYears(swe, lm.chart, lm.periodDays, 4)).toBeCloseTo(1 / 12, 6);
    const t = await MUNDANE_JOBS['mundane.dasa'](natal, { birth: lm.birth, label: lm.label, periodDays: lm.periodDays }, swe);
    expect(t.rows.length).toBe(9);
  });

  it('lifecycle chart: the Sun back at its natal sidereal longitude after 144 years', async () => {
    const r = await run({ mode: 'lifecycle', n: 1 });
    expect(Math.abs(wrap(r.chart.positions.grahas.Sun.lon - natal.positions.grahas.Sun.lon))).toBeLessThan(1e-4);
    expect((r.chart.positions.jdUt - natal.positions.jdUt) / 365.256364).toBeCloseTo(144, 1);
  });

  it('a derived chart is stepped 0.0035 day so repeated searches move on', async () => {
    const a = await run({ mode: 'transit', body: 2, division: 0, after: true });
    const b = await run({ mode: 'transit', body: 2, division: 0, after: true, current: a.birth });
    expect(b.chart.positions.jdUt - a.chart.positions.jdUt).toBeGreaterThan(1.5);
  });
});
