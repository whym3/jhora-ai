// Sanity checks for the Sri Surya Siddhanta port (src/core/sss).
// NONE of these compare against JHora output: they are internal-consistency
// checks and textbook SSS values (Burgess' translation of the Surya Siddhanta,
// ch. 1). Golden comparisons against JHora with Siddhanta=1 are to be added.
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import {
  APOGEE_REVOLUTIONS, apogeeLongitude, BEEJA, CIVIL_DAYS_PER_MAHAYUGA, computePositionsSSS, KALI_EPOCH_JD,
  meanLongitude, norm, REVOLUTIONS, sssAyanamsa, sunriseHours, trueLongitude, yearsSinceCreation,
} from '../src/core/sss';
import { computePositions, GRAHAS } from '../src/core/positions';
import { calcSettingsFromIni, DEFAULT_SETTINGS } from '../src/core/settings';

const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const SIDEREAL_YEAR = CIVIL_DAYS_PER_MAHAYUGA / 4320000; // 365.2587565 days

describe('SSS constants (textbook, not JHora output)', () => {
  it('revolutions per mahayuga / kalpa are the Surya Siddhanta numbers', () => {
    expect([...REVOLUTIONS]).toEqual([0, 4320000, 57753336, 2296832, 17937060, 364220, 7022376, 146568, -232238]);
    expect([...APOGEE_REVOLUTIONS].slice(1, 8)).toEqual([387, 488203000, 204, 368, 900, 535, 39]);
    expect(CIVIL_DAYS_PER_MAHAYUGA).toBe(1577917828);
    expect(KALI_EPOCH_JD).toBe(588465.5);
  });

  it('1,955,880,000 years elapsed from creation to the Kali epoch', () => {
    expect(yearsSinceCreation(0)).toBe(1955880000);
    expect(yearsSinceCreation(SIDEREAL_YEAR * 5000)).toBeCloseTo(1955885000, 6);
  });
});

describe('SSS mean motions (internal consistency)', () => {
  it('at the Kali epoch every mean planet is at 0 Aries apart from its beeja term', () => {
    for (let i = 1; i <= 8; i++) {
      const beeja = norm(BEEJA[i] * 1955880000 * 1e-10);
      expect(angDiff(meanLongitude(0, 0, i), beeja), `planet ${i}`).toBeLessThan(1e-9);
    }
  });

  it('the node (JHora adds 180 for Rahu) stood at 180 at Kali: 232238 x 452.75 revs is x.5', () => {
    expect((232238 * 452.75) % 1).toBe(0.5);
    const rahu = norm(meanLongitude(0, 0, 8) - BEEJA[8] * 0.195588 + 180);
    expect(angDiff(rahu, 180)).toBeLessThan(1e-9);
  });

  it('mandoccas at Kali: Sun 77 deg 7\' 48", Moon 90 deg (+ beeja for the Moon)', () => {
    // JHora multiplies by the double 2.3148148148148147e-10 (not exactly 1/4.32e9);
    // over 2.2e8 revolutions of the Moon's apogee that leaves ~3e-6 deg.
    expect(angDiff(apogeeLongitude(0, 0, 1), 77 + 7 / 60 + 48 / 3600)).toBeLessThan(1e-9);
    expect(angDiff(apogeeLongitude(0, 0, 2), 90 - 7.80380064202824e-10 * 1955880000)).toBeLessThan(1e-5);
  });

  it('the mean Sun returns after one SSS sidereal year; mean daily motions', () => {
    const a = 1_850_000;
    expect(angDiff(meanLongitude(a + SIDEREAL_YEAR, 0, 1), meanLongitude(a, 0, 1))).toBeLessThan(1e-7);
    const daily = (i: number) => norm(meanLongitude(a + 1, 0, i) - meanLongitude(a, 0, i));
    expect(daily(1)).toBeCloseTo(4320000 * 360 / 1577917828, 9); // 0.98560 deg
    expect(daily(2)).toBeCloseTo(57753336 * 360 / 1577917828, 8); // 13.17635 deg
    expect(daily(7)).toBeCloseTo(146568 * 360 / 1577917828, 9);
  });

  it('desantara: a place east of Ujjain sees the same physical instant', () => {
    // A grows by dl/360 days; JHora subtracts R*dl/(360*4320000) deg, i.e. it
    // treats dl/360 days as dl/360 of a sidereal year's worth of 1 deg/day.
    const a = 1_870_000.25, dl = 10;
    const d = meanLongitude(a + dl / 360, dl, 1) - meanLongitude(a, 0, 1);
    expect(d).toBeCloseTo((4320000 * 360 / 1577917828 - 1) * dl / 360, 9);
  });
});

describe('SSS ayanamsa (FUN_0049a290)', () => {
  const atYears = (y: number) => sssAyanamsa(y * SIDEREAL_YEAR + 1e-9);
  it('27 deg libration, 7200-year period, 0 at Kali year 3600 (499 CE)', () => {
    expect(Math.abs(atYears(0))).toBeLessThan(1e-6);
    expect(atYears(1800)).toBeCloseTo(-27, 5);
    expect(Math.abs(atYears(3600))).toBeLessThan(1e-5);
    expect(atYears(5400)).toBeCloseTo(27, 5);
    expect(atYears(5127 + 7200)).toBeCloseTo(atYears(5127), 6);
    // triangle wave: 1 deg per 66.67 years
    expect(atYears(5000) - atYears(4000)).toBeCloseTo(15, 5);
  });
});

describe('SSS true longitudes and sunrise (internal consistency)', () => {
  it('equations of centre stay within the epicycle limits', () => {
    for (let a = 1_800_000; a < 1_800_000 + 800; a += 7.3) {
      const sun = trueLongitude(a, 0, 1), moon = trueLongitude(a, 0, 2);
      expect(angDiff(sun.lon, sun.mean)).toBeLessThan(2.2);   // ~2 deg 10'
      expect(angDiff(moon.lon, moon.mean)).toBeLessThan(5.1); // ~5 deg 02'
    }
  });

  it('sunrise is 6h at the equator and symmetric between the hemispheres', () => {
    const a = 1_870_000;
    expect(sunriseHours(a + 0.5, 0, 0)).toBeCloseTo(6, 9);
    // (not exact: each iteration evaluates the Sun at its own sunrise time)
    const n = sunriseHours(a + 0.5, 0, 40), s = sunriseHours(a + 0.5, 0, -40);
    expect(Math.abs(n + s - 12)).toBeLessThan(0.002);
  });
});

describe('computePositionsSSS against the drik model (sanity, loose bounds)', async () => {
  const swe = await nodeSweph();
  const sss = calcSettingsFromIni({ Siddhanta: 1 });
  const geo = { lat: 28.6, lon: 77.2, alt: 0 };

  it('ini Siddhanta=1 selects SSS; defaults do not', () => {
    expect(sss.sss).toBe(true);
    expect(DEFAULT_SETTINGS.sss).toBe(false);
    expect(calcSettingsFromIni({ UserSelectedAyanamsa: 18 }).sssAyanamsa).toBe(true);
  });

  for (const [label, jd] of [['2000-01-01', 2451545.0], ['2025-01-15', 2460690.75], ['1950-06-21', 2433453.9]] as const) {
    it(label, async () => {
      await swe.ensureEphemeris(jd);
      const p = computePositionsSSS(jd, geo, sss, swe);
      const d = computePositions(swe, jd, geo, DEFAULT_SETTINGS);
      // the hook in computePositions
      expect(computePositions(swe, jd, geo, sss)).toEqual(p);
      // SSS drifts from modern ephemerides: its Saturn period is 10765.8 days
      // (modern 10759.2), ~10 deg behind by 2000 CE; mean-planet errors are
      // amplified up to ~3x by the sighra equation near oppositions (Mars 2025).
      const tol: Record<string, number> = { Sun: 3, Moon: 4, Mars: 15, Mercury: 8, Jupiter: 6, Venus: 10, Saturn: 14, Rahu: 4, Ketu: 4 };
      for (const g of GRAHAS) {
        expect(angDiff(p.grahas[g].lon, d.grahas[g].lon), `${g}`).toBeLessThan(tol[g]);
        expect(p.grahas[g].speed).toBe(0);
        expect(p.grahas[g].lat).toBe(0);
      }
      expect(angDiff(p.grahas.Ketu.lon, p.grahas.Rahu.lon + 180)).toBeLessThan(1e-9);
      expect(angDiff(p.ascendant, d.ascendant)).toBeLessThan(4);
      expect(p.outer).toEqual(d.outer);
      expect(p.ayanamsaMean).toBe(d.ayanamsaMean);
    });
  }

  it('Mars is flagged retrograde at its January 2025 opposition, direct in October 2024', async () => {
    await swe.ensureEphemeris(2460690.5);
    expect(computePositionsSSS(2460690.5, geo, sss, swe).grahas.Mars.retrograde).toBe(true);
    expect(computePositionsSSS(2460590.5, geo, sss, swe).grahas.Mars.retrograde).toBe(false);
  });

  it('with the SSS ayanamsa (18) the shift into the user zodiac is -Delta only', async () => {
    const s18 = calcSettingsFromIni({ Siddhanta: 1, UserSelectedAyanamsa: 18, DeltaFromUserSelectedAyanamsa: 0 });
    const p = computePositionsSSS(2451545.0, geo, s18, swe);
    for (const g of GRAHAS) expect(angDiff(p.grahas[g].lon, norm(p.sss.sssLongitudes[g]))).toBeLessThan(1e-12);
    expect(angDiff(p.ascendant, norm(p.sss.sssLagna))).toBeLessThan(1e-12);
  });

  it('lagna equals the true Sun (tropically) at SSS sunrise, and advances ~360 deg per day', async () => {
    const p0 = computePositionsSSS(2460690.75, geo, sss, swe);
    const rise = p0.sss.sunriseLocalJd - geo.lon / 360 - (p0.sss.aharganaApparent - p0.sss.ahargana);
    const p = computePositionsSSS(rise + 1e-7, geo, sss, swe);
    expect(p.sss.minutesSinceSunrise).toBeLessThan(0.2);
    expect(angDiff(p.sss.sssLagna, p.sss.sssLongitudes.Sun)).toBeLessThan(0.06);
    const q = computePositionsSSS(rise + 0.25, geo, sss, swe);
    expect(norm(q.sss.sssLagna - p.sss.sssLagna)).toBeGreaterThan(60);
    expect(norm(q.sss.sssLagna - p.sss.sssLagna)).toBeLessThan(120);
  });
});
