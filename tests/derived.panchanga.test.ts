import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { siderealLongitude, norm360 } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { tithi, nakshatra, TITHI_NAMES } from '../src/core/keyInfo';
import { dayFrame } from '../src/core/day';
import { monthlyText, panchangaDays, timeText } from '../src/core/derived/panchanga';
import { laghuRows, laghuValue } from '../src/core/derived/laghuParasari';
import { PANCHANGA_JOBS, LAGHU_TABLES } from '../src/core/derived/panchangaJobs';

const wrap = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d < -180) d += 360; return d; };

describe('Miscellany > Panchanga', async () => {
  const swe = await nodeSweph();
  const chart = await computeChart(swe, goldenCharts()[0].birth);
  const s = calcSettingsFromIni(chart.ini);
  const lon = (jd: number, g: 'Sun' | 'Moon') => siderealLongitude(swe, jd, g, s).lon;
  const days = await panchangaDays(chart, swe, 31);

  it('has 31 rows from day 1 of the chart month, at consecutive sunrises', () => {
    expect(days).toHaveLength(31);
    expect(days[0].date).toMatchObject({ year: chart.birth.year, month: chart.birth.month, day: 1 });
    for (let i = 1; i < 31; i++) {
      const dt = days[i].sunrise.jd - days[i - 1].sunrise.jd;
      expect(dt).toBeGreaterThan(0.95);
      expect(dt).toBeLessThan(1.05);
      expect(days[i].weekday).toBe((days[i - 1].weekday + 1) % 7);
      expect(days[i].counter).toBe(i + 1);
    }
  });

  it('the birth day row starts with the tithi and nakshatra keyInfo gives at that sunrise', () => {
    const d = days[chart.birth.day - 1];
    const t0 = d.sunrise.jd;
    expect(d.tithi.items[0].index).toBe(tithi(lon(t0, 'Sun'), lon(t0, 'Moon')).index);
    expect(d.nakshatra.items[0].index).toBe(nakshatra(lon(t0, 'Moon')).index);
    const geo = { lat: chart.birth.lat, lon: chart.birth.lon, alt: chart.birth.altitudeM };
    // displayed sunrise = JHora's ecliptic rise, within a few seconds of the frame sunrise
    expect(Math.abs(t0 - dayFrame(swe, t0 + 0.3, geo, s, 0).sunrise)).toBeLessThan(5e-5);
  });

  it('tithi / karana / yoga / nakshatra ends sit on their boundaries and inside the day when counted', () => {
    for (const d of days) {
      const t0 = d.dayStart.jd;
      for (const [tr, step, f] of [
        [d.tithi, 12, (jd: number) => norm360(lon(jd, 'Moon') - lon(jd, 'Sun'))],
        [d.karana, 6, (jd: number) => norm360(lon(jd, 'Moon') - lon(jd, 'Sun'))],
        [d.yoga, 360 / 27, (jd: number) => norm360(lon(jd, 'Moon') + lon(jd, 'Sun'))],
        [d.nakshatra, 360 / 27, (jd: number) => lon(jd, 'Moon')],
        [d.moonSign, 30, (jd: number) => lon(jd, 'Moon')],
      ] as const) {
        for (const e of tr.items) {
          // JHora's search returns the later end of a 1 s bracket
          const v = f(e.end.jd) / step;
          expect(Math.abs(v - Math.round(v))).toBeLessThan(2e-4 / step);
        }
        for (let j = 0; j < tr.count; j++) {
          expect(tr.items[j].end.jd).toBeGreaterThanOrEqual(t0);
          expect(tr.items[j].end.jd).toBeLessThan(t0 + 1);
        }
        if (tr.items.length > tr.count) expect(tr.items[tr.count].end.jd >= t0 + 1 || tr.items[tr.count].end.jd < t0).toBe(true);
      }
      // successive tithis
      if (d.tithi.count >= 1) expect(d.tithi.items[1].index).toBe((d.tithi.items[0].index + 1) % 30);
    }
  });

  it('moonrise: the ascendant equals the Moon longitude (JHora ecliptic rise)', () => {
    const d = days[3];
    const jd = d.moonrise!.jd;
    const asc = norm360(swe.houses(jd, 0, chart.birth.lat, chart.birth.lon, 'P').ascmc[0] - chart.positions.ayanamsaMean);
    expect(Math.abs(wrap(asc - lon(jd, 'Moon')))).toBeLessThan(0.02);
    expect(jd).toBeGreaterThan(d.sunrise.jd);
  });

  it('kaalas are eighths and durmuhurtas fifteenths of the daytime', () => {
    for (const d of days.slice(0, 7)) {
      const len = d.sunset.jd - d.sunrise.jd;
      for (const k of [d.rahu, d.gulika, d.yama]) {
        // kaalas divide the frame's day; the displayed (ecliptic) rise/set differ by ~1-2 s
        expect(k.end.jd - k.start.jd).toBeCloseTo(len / 8, 5);
        const part = (k.start.jd - d.sunrise.jd) / (len / 8);
        expect(Math.abs(part - Math.round(part))).toBeLessThan(1e-3);
      }
      for (const m of d.durmuhurta) expect(m.end.jd - m.start.jd).toBeCloseTo(len / 15, 5);
      for (const v of d.varjya) expect(v.end.jd).toBeGreaterThanOrEqual(d.sunrise.jd);
    }
    // Sunday Rahu kaalam is the 8th part, Monday the 2nd
    const sun = days.find((d) => d.weekday === 0)!;
    expect((sun.rahu.start.jd - sun.sunrise.jd) / ((sun.sunset.jd - sun.sunrise.jd) / 8)).toBeCloseTo(7, 2);
  });

  it('formats times as JHora (truncate / round, * on another day)', () => {
    const m = { jd: 0, year: 2000, month: 1, day: 2, hour: 6 + 59 / 60 + 40 / 3600 };
    expect(timeText(m, 0, 2)).toBe('6:59');
    expect(timeText(m, 2, 2)).toBe('7:00');
    expect(timeText(m, 0, 1)).toBe('6:59*');
  });

  it('builds the monthly copy text', () => {
    const text = monthlyText(days);
    expect(text.startsWith('\n')).toBe(true);
    expect(text).toContain('RahuK: ');
    expect(text).toContain('Sunrise at ');
    expect(text.split('\n').filter((l) => /^\w+ \d+, \d+:$/.test(l))).toHaveLength(31);
    expect(text).toContain(TITHI_NAMES[days[0].tithi.items[0].index]);
  });

  it('jobs return rows and clipboard text', async () => {
    const t = await PANCHANGA_JOBS['panchanga.monthly'](chart, {}, swe);
    expect(t.rows).toHaveLength(31);
    expect(t.text!.length).toBeGreaterThan(31 * 6);
    const daily = await PANCHANGA_JOBS['panchanga.daily'](chart, {}, swe);
    expect(daily.rows).toHaveLength(2);
    expect(daily.text!.join('\n')).toContain('Choghadiyas: ');
  });
});

describe('Miscellany > Laghu Parasari', async () => {
  const swe = await nodeSweph();
  const chart = await computeChart(swe, goldenCharts()[0].birth);

  it('D-1: lagna + body degrees in sign, mod 30, four 30-year columns', () => {
    const r = laghuRows(chart, {}, swe);
    expect(r.header).toBe('D-1 (Rasi)');
    expect(r.columns).toBe(4);
    expect(r.rows).toHaveLength(20);
    expect(r.rows[0].label).toBe('Asc-Sun');
    const v = ((chart.positions.ascendant % 30) + (chart.positions.grahas.Sun.lon % 30)) % 30;
    expect(r.rows[0].ages[0]).toBeCloseTo(v, 9);
    expect(r.rows[0].ages[3]).toBeCloseTo(v + 90, 9);
    // the date is the sidereal solar return after `age` years
    const [y] = r.rows[0].dates[1].trim().split('-').map(Number);
    expect(Math.abs(y - (chart.birth.year + r.rows[0].ages[1]))).toBeLessThanOrEqual(1);
  });

  it('counting signs in D-9: amsas counted inside the sign, cycle 9', () => {
    expect(laghuValue(45, 1, 'count')).toEqual({ value: 4.5, cycle: 9 });
    expect(laghuValue(45, 1, 'longitude').cycle).toBe(30);
    const r = laghuRows(chart, { varga: 1, lagna: null, mode: 1 });
    expect(r.columns).toBe(13);
    expect(r.rows).toHaveLength(36);
    expect(r.rows[0].label).toBe('Sun-Moon');
    for (const row of r.rows) expect(row.ages[0]).toBeLessThan(9);
    expect(laghuRows(chart, { mode: 5, lagna: 14 }).rows).toHaveLength(126);
  });

  it('sync table', () => {
    const t = LAGHU_TABLES['laghuParasari.table'](chart, {}, swe);
    expect(t.headers[1]).toBe('Date 1 (age)');
    expect(t.rows[0][1]).toMatch(/^\s?\d{4}-\d\d-\d\d {2}\(\d+\.\d\d\)$/);
  });
});
