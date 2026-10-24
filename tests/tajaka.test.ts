import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { siderealLongitude } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import {
  computeTajakaChart, solarYearsToJd, tajakaChartTime, tajakaPeriod, tajakaWindow, tajakaYearMode,
} from '../src/core/tajaka/annual';
import { muntha } from '../src/core/tajaka/muntha';
import { muddaDasa, muddaSeed, MUDDA_TITLE } from '../src/core/tajaka/mudda';
import { NAK_LORD } from '../src/core/lords';

const wrap = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d < -180) d += 360; return d; };

describe('Tajaka (annual) charts', async () => {
  const swe = await nodeSweph();
  const birth = goldenCharts()[0].birth;
  const natal = await computeChart(swe, birth);
  const settings = calcSettingsFromIni(natal.ini);
  const sunAt = (jd: number) => siderealLongitude(swe, jd, 'Sun', settings).lon;
  const sun0 = natal.positions.grahas.Sun.lon;

  it('defaults to true sidereal solar returns (year mode 3)', () => {
    expect(tajakaYearMode(natal.ini)).toBe(3);
  });

  it('annual chart: Sun back at its natal sidereal longitude, about n sidereal years later', async () => {
    for (const k of [1, 10, 30, 60]) {
      await swe.ensureEphemeris(natal.positions.jdUt + k * 365.25);
      const jd = tajakaChartTime(swe, natal, birth.year + k);
      expect(Math.abs(wrap(sunAt(jd) - sun0))).toBeLessThan(1.2e-5);
      expect(Math.abs(jd - natal.positions.jdUt - k * 365.256363)).toBeLessThan(2);
    }
  });

  it('year 0 is the birth moment; the annual span ends where the next year starts', () => {
    expect(Math.abs(tajakaChartTime(swe, natal, birth.year) - natal.positions.jdUt)).toBeLessThan(1.2e-5);
    const w = tajakaWindow(swe, natal, { year: birth.year + 5 });
    expect(Math.abs(w.end - tajakaChartTime(swe, natal, birth.year + 6))).toBeLessThan(1.2e-5);
    expect(w.label).toBe('Tajaka annual');
  });

  it('monthly and finer charts: Sun advanced by 30 / 2.5 / ... degrees', () => {
    const y = birth.year + 5;
    const month = ((birth.month + 2) % 12) + 1;           // third Tajaka month after the birth month
    const p = tajakaPeriod(natal, { year: y, month });
    const mOff = (month - birth.month + 12) % 12;
    expect(p.month).toBe(mOff);
    const t = tajakaWindow(swe, natal, { year: y, month });
    expect(t.label).toBe('Tajaka monthly');
    expect(Math.abs(wrap(sunAt(t.start) - (sun0 + 30 * mOff)))).toBeLessThan(1.2e-5);
    expect(Math.abs(wrap(sunAt(t.end) - (sun0 + 30 * mOff + 30)))).toBeLessThan(1.2e-5);
    const sel = { year: y, month, sixtyHour: 4, fiveHour: 3, twentyFiveMin: 2, twoMin: 12 };
    const f = tajakaWindow(swe, natal, sel);
    expect(f.label).toBe('Tajaka 2-min');
    const deg = 30 * mOff + 2.5 * 3 + (2.5 / 12) * 2 + (2.5 / 144) * 1 + (2.5 / 1728) * 11;
    expect(Math.abs(wrap(sunAt(f.start) - (sun0 + deg)))).toBeLessThan(1.2e-5);
    expect(f.end - f.start).toBeGreaterThan(0);
    expect(f.end - f.start).toBeLessThan(3 / 1440);
  });

  it('a month before the birth month belongs to the previous Tajaka year', () => {
    if (birth.month === 1) return;
    const p = tajakaPeriod(natal, { year: birth.year + 5, month: 1 });
    expect(p.years).toBe(4);
    expect(p.month).toBe(13 - birth.month);
    expect(p.startYears).toBeCloseTo(4 + (13 - birth.month) / 12, 12);
  });

  it('mean-motion year modes are fixed multiples of the year length', () => {
    expect(solarYearsToJd(swe, natal, 2, 6) - natal.positions.jdUt).toBeCloseTo(2 * 365.256364, 9);
    expect(solarYearsToJd(swe, natal, 2, 0) - natal.positions.jdUt).toBeCloseTo(2 * 365.24219, 9);
  });

  it('sunrise variant starts at the sunrise of the return day', async () => {
    const exact = tajakaWindow(swe, natal, { year: birth.year + 3 });
    const sr = tajakaWindow(swe, natal, { year: birth.year + 3 }, 'sunrise');
    expect(sr.label).toBe('Taj ann sunrise');
    expect(sr.start).toBeLessThanOrEqual(exact.start);
    expect(exact.start - sr.start).toBeLessThan(1.01);
  });

  it('muntha advances one sign per year (MunthaPreference 1) and is the progressed lagna', () => {
    const lagnaSign = Math.floor(natal.positions.ascendant / 30);
    for (let k = 0; k < 14; k++) {
      const m = muntha(natal, tajakaPeriod(natal, { year: birth.year + k }));
      expect(m.sign).toBe((lagnaSign + k) % 12);
      expect(Math.floor(m.lon / 30)).toBe(m.sign);
      expect(m.signIn('D9')).toBe((Math.floor(((natal.positions.ascendant * 9) % 360) / 30) + k) % 12);
    }
    // preference 0: continuous 30 deg per year, rasi sign in all vargas
    const p = tajakaPeriod(natal, { year: birth.year + 2, month: (birth.month % 12) + 1 });
    const m0 = muntha(natal, p, 0);
    expect(wrap(m0.lon - (natal.positions.ascendant + 30 * p.startYears))).toBeCloseTo(0, 9);
    expect(m0.signIn('D9')).toBe(m0.sign);
  });

  it('Mudda dasa: progressed natal star, compressed into the Tajaka year', async () => {
    const t = await computeTajakaChart(swe, natal, { year: birth.year + 7 });
    expect(Math.abs(wrap(t.chart.positions.grahas.Sun.lon - sun0))).toBeLessThan(1.2e-5);
    const d = muddaDasa(swe, t);
    expect(d.title).toBe(MUDDA_TITLE);
    expect(d.compression).toBeCloseTo(1, 9);
    const nak = Math.floor(natal.positions.grahas.Moon.lon / (360 / 27));
    expect(d.periods[0].lord).toBe(NAK_LORD[(nak + 7) % 9]);
    expect(Math.floor(muddaSeed(t) / (360 / 27))).toBe((nak + 7) % 27);
    const span = d.periods[8].end - d.periods[0].start;
    expect(span).toBeCloseTo(1, 9);
    expect(d.periods[0].start).toBeLessThanOrEqual(0);
    // first dasa contains the Tajaka moment, and the year ends on a dasa boundary once round
    const jd0 = d.clock.toJd(d.periods[0].start);
    expect(jd0).toBeLessThanOrEqual(t.start + 1e-9);
    expect(Math.abs(d.clock.toJd(0) - t.start)).toBeLessThan(1.2e-5);
    // one Vimsottari year = 3 degrees of solar motion
    const a = d.periods[1];
    const arc = wrap(sunAt(d.clock.toJd(a.end)) - sunAt(d.clock.toJd(a.start)));
    expect(arc).toBeCloseTo((a.end - a.start) * 360, 5);
    expect(d.periods[1].children?.length).toBe(9);
  });
});
