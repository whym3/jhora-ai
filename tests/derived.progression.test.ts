import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { siderealLongitude, norm360 } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { ALL_VARGAS, vargaLongitude } from '../src/core/vargas';
import { angularReturn, lagnaAt } from '../src/core/derived/angularReturn';
import { BHRIGU_YEARS, progression, progressedSeed, progressedVargaLongitudes, solarArc, solarLabel } from '../src/core/derived/progression';
import { ANGULAR_JOBS, PROGRESSION_JOBS } from '../src/core/derived/progressionJobs';
import type { BirthData } from '../src/core/jhd';

const wrap = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d < -180) d += 360; return d; };

describe('Progressions and angular return', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, goldenCharts()[0].birth);
  const s = calcSettingsFromIni(natal.ini);
  const by = natal.birth.year;
  const date = { year: by + 30, month: 6, day: 15, hour: 12 };

  it('solar arc counts completed sidereal solar years', async () => {
    const jd = swe.julday(date.year, date.month, date.day, date.hour - natal.birth.tzHours);
    await swe.ensureEphemeris(jd);
    const arc = solarArc(swe, natal, jd, date.year);
    expect(Math.abs(arc / 360 - (jd - natal.positions.jdUt) / 365.256364)).toBeLessThan(0.01);
    const sun = siderealLongitude(swe, jd, 'Sun', s).lon;
    expect(Math.abs(wrap(natal.positions.grahas.Sun.lon + arc - sun))).toBeLessThan(1e-9);
  });

  it('solar progression: the Sun advances 30/n degrees per year of life', async () => {
    for (const varga of [0, 1, 7]) {
      const p = progression(swe, natal, { kind: 'solar', varga, ...date });
      const c = await computeChart(swe, p.birth, natal.ini);
      const step = 30 / p.n;
      expect(Math.abs(wrap(c.positions.grahas.Sun.lon - (natal.positions.grahas.Sun.lon + (p.arc / 360) * step)))).toBeLessThan(1e-4);
    }
    expect(solarLabel(30)).toBe('Progressed (30 deg)');
    expect(solarLabel(30 / 9)).toBe('Progressed (3:20 deg)');
    expect(solarLabel(30 / 7)).toBe('Progressed (4:17 deg)');
  });

  it('Bhrigu progression moves Sun..Saturn by arc/k, keeps lagna and nodes', async () => {
    const p = progression(swe, natal, { kind: 'bhrigu', varga: 0, ...date });
    const c = await computeChart(swe, p.birth, natal.ini);
    for (const [g, k] of Object.entries(BHRIGU_YEARS)) {
      const lon = c.positions.grahas[g as keyof typeof BHRIGU_YEARS].lon;
      expect(Math.abs(wrap(lon - natal.positions.grahas[g as keyof typeof BHRIGU_YEARS].lon - p.arc / k))).toBeLessThan(1e-9);
    }
    expect(c.positions.ascendant).toBeCloseTo(natal.positions.ascendant, 9);
    expect(c.positions.grahas.Rahu.lon).toBeCloseTo(natal.positions.grahas.Rahu.lon, 9);
  });

  it('SCD progression: one sign per year in every varga', () => {
    const p = progression(swe, natal, { kind: 'scd', varga: 0, ...date });
    let a = p.arc; while (a > 4320) a -= 4320;
    expect(p.shift).toBeCloseTo(a / 12, 9);
    // 30 years: 30 signs = 6 signs mod 12 (to within a year fraction)
    expect(Math.abs(wrap(p.shift! - (p.arc / 360) * 30))).toBeLessThan(1e-6);
    const d9 = progressedVargaLongitudes(natal, p, 'D9');
    expect(Math.abs(wrap(d9.Moon - vargaLongitude(natal.positions.grahas.Moon.lon, ALL_VARGAS.D9) - p.shift!))).toBeLessThan(1e-9);
  });

  it('nakshatra progression: seed at birth is near the natal Moon, one star per maha dasa', () => {
    const moon = natal.positions.grahas.Moon.lon;
    // at birth the running periods reproduce the Moon within one 6th-level step (equal-arc rule)
    expect(Math.abs(wrap(progressedSeed(moon, null, 0) - moon))).toBeLessThan(360 / 27);
    // at the start of the next maha dasa the seed is at the next star's start
    const NAK = 360 / 27;
    const n = Math.floor(moon / NAK);
    const frac = (moon - n * NAK) / NAK;
    const lordYears = [7, 20, 6, 10, 7, 18, 16, 19, 17][n % 9];
    const next = (1 - frac) * lordYears + 1e-9;
    expect(Math.abs(wrap(progressedSeed(moon, null, next) - norm360((n + 1) * NAK)))).toBeLessThan(1e-6);
    expect(() => progressedSeed(moon, 'Ashtottari', 1)).toThrow();
    const p = progression(swe, natal, { kind: 'nakshatra', varga: 0, body: 2, dasa: 0, ...date });
    expect(p.label).toBe('Prog (NaksDasa)');
    expect(Math.abs(wrap(p.seed! - moon - p.shift!))).toBeLessThan(1e-9);
  });

  it('angular return reproduces the natal angle (Sun-Moon, Moon-Lagna, Jupiter-Saturn)', async () => {
    for (const [a, b] of [[1, 2], [2, 0], [5, 7]]) {
      const r = angularReturn(swe, natal, { a, b, before: false, ...date, tzHours: natal.birth.tzHours });
      const c = await computeChart(swe, r.birth, natal.ini);
      const lon = (i: number) => (i === 0 ? c.positions.ascendant : c.positions.grahas[(['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const)[i - 1]].lon);
      expect(Math.abs(wrap(norm360(lon(a) - lon(b)) - r.angle))).toBeLessThan(1e-3);
      const from = swe.julday(date.year, date.month, date.day, date.hour - natal.birth.tzHours);
      expect(r.start).toBeGreaterThanOrEqual(from);
      expect(r.end).toBeGreaterThan(r.start);
    }
    const before = angularReturn(swe, natal, { a: 1, b: 2, before: true, ...date, tzHours: natal.birth.tzHours });
    expect(before.start).toBeLessThan(swe.julday(date.year, date.month, date.day, date.hour - natal.birth.tzHours));
    expect(before.label).toBe('Ang Ret Sun-Moon');
    expect(() => angularReturn(swe, natal, { a: 3, b: 3, before: false, ...date, tzHours: 0 })).toThrow(/DIFFERENT/);
    expect(Math.abs(wrap(lagnaAt(swe, natal.positions.jdUt, natal.birth, s) - natal.positions.ascendant))).toBeLessThan(1e-9);
  });

  it('jobs return the derived birth data', async () => {
    const t = await PROGRESSION_JOBS['progression.find'](natal, { kind: 'scd', varga: 1, ...date }, swe);
    const { birth, label } = JSON.parse(t.text![0]) as { birth: BirthData; label: string };
    expect(label).toBe('Progressed (SCD)');
    expect(birth.override?.ascendant).toBeDefined();
    expect(t.rows.length).toBe(10);
    const a = await ANGULAR_JOBS['angularReturn.find'](natal, { a: 1, b: 2, before: false, ...date, tzHours: natal.birth.tzHours }, swe);
    expect(JSON.parse(a.text![0]).label).toBe('Ang Ret Sun-Moon');
  });
});
