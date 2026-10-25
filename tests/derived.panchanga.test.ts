import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { siderealLongitude, norm360 } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { tithi, nakshatra, TITHI_NAMES, KI_NAKSHATRAS, WEEKDAYS } from '../src/core/keyInfo';
import { dayFrame } from '../src/core/day';
import { monthlyText, panchangaDays, timeText } from '../src/core/derived/panchanga';
import { laghuRows, laghuValue } from '../src/core/derived/laghuParasari';
import { PANCHANGA_JOBS, LAGHU_TABLES } from '../src/core/derived/panchangaJobs';
import { dpFormatText, ephemerisDms, ephemerisText, movementsText, splitLongitude, DP_HEADER } from '../src/core/derived/panchangaCopies';
import { siderealAscendant, GRAHAS } from '../src/core/positions';
import { panchangaDay, MONTHS, type Moment } from '../src/core/derived/panchanga';
import { SIGN_NAMES } from '../src/core/zodiac';

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

describe('Miscellany > Panchanga: ephemeris, movements and DP format copies', async () => {
  const swe = await nodeSweph();
  const chart = await computeChart(swe, goldenCharts()[0].birth);
  const s = calcSettingsFromIni(chart.ini);
  const { year, month, tzHours: tz, lat, lon: geoLon } = chart.birth;
  const lon = (jd: number, body: number) => (body === 0
    ? siderealAscendant(swe, jd, { lat, lon: geoLon }, s)
    : siderealLongitude(swe, jd, GRAHAS[body - 1], s).lon);
  const hms = (t: string) => { const [h, m, x] = t.split(':').map(Number); return h + m / 60 + (x ?? 0) / 3600; };
  const atDay = (day: number, time: string) => swe.julday(year, month, day, hms(time) - tz);
  const near = (a: number, b: number) => Math.abs(wrap(a - b));

  it('splits longitudes as FUN_004c1980 (no carry from the rounded seconds)', () => {
    expect(splitLongitude(-10)).toMatchObject({ sign: 11, deg: 20, min: 0 });
    expect(ephemerisDms(106 + 54 / 60 + 55.4 / 3600)).toBe('106:54:55');
    expect(ephemerisDms(5 + 7 / 60 + 3 / 3600)).toBe('005:07:03');
    expect(ephemerisDms(264 + 59.6 / 3600)).toBe('264:00:60');
  });

  it('monthly ephemeris: 31 rows at 5:30 am, sidereal time at local mean noon', async () => {
    const text = (await ephemerisText(chart, swe)).split('\n');
    expect(text.slice(0, 5)).toEqual(['', `Monthly Ephemeris for ${MONTHS[month - 1]}, ${year} (at 5:30 am everyday):`, '',
      'Date\tDay\tSunrise\tSunset   \tSidTime    \tSun    \tMoon   \tMars   \tMercury \tJupiter  \tVenus   \tSaturn   \tRahu', '']);
    const rows = text.slice(5).map((l) => l.split('\t'));
    expect(rows).toHaveLength(31);
    const days = await panchangaDays(chart, swe, 31);
    const jd0 = swe.julday(year, month, 1, 5.5 - tz);
    rows.forEach((r, i) => {
      expect(r).toHaveLength(14);
      expect(r[13]).toBe('');
      expect(Number(r[0])).toBe(swe.revjul(jd0 + i + tz / 24).day);
      expect(r[1]).toBe(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][days[i].weekday]);
      for (let k = 1; k <= 8; k++) {
        const [d, m, x] = r[4 + k].split(':').map(Number);
        expect(near(d + m / 60 + x / 3600, lon(jd0 + i, k))).toBeLessThan(1 / 3600);
      }
      // the frame's sunrise before 5:30 (the previous day's when the Sun rises later)
      const fr = dayFrame(swe, jd0 + i, { lat, lon: geoLon, alt: chart.birth.altitudeM }, s, 0);
      expect(Math.abs(hms(r[2]) - swe.revjul(fr.sunrise + tz / 24).hour)).toBeLessThan(1 / 3600);
      if (i) expect(((hms(r[4]) - hms(rows[i - 1][4]) + 24) % 24) * 60).toBeCloseTo(3.943, 1);
    });
    // ARMC / 15 at 12:00 local mean time of day 1
    const sid = swe.houses(swe.julday(year, month, 1, 12 - geoLon / 15), 0, lat, geoLon, 'P').ascmc[2] / 15;
    expect(Math.abs(hms(rows[0][4]) - sid)).toBeLessThan(1 / 3600);
  });

  it('planetary movements: sign and nakshatra entries and aspects in the calendar month', async () => {
    const text = (await movementsText(chart, swe)).split('\n');
    expect(text[1]).toBe(`Planetary Movements for ${MONTHS[month - 1]}, ${year}:`);
    expect(text[3]).toBe('Entry of planets into signs');
    const iN = text.indexOf('Entry of planets in nakshatras'), iA = text.indexOf('Planetary aspects of Jyotish:');
    expect(iN).toBeGreaterThan(3);
    expect(iA).toBeGreaterThan(iN);
    const NAMES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
    const SHORT = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke'];
    const nDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const entries = (from: number, to: number, arc: number, names: readonly string[]) => {
      const ls = text.slice(from, to).filter((l) => l);
      for (const l of ls) {
        const [body, verb, target, day, time] = l.split('\t');
        expect(verb).toBe('enters');
        const b = NAMES.indexOf(body);
        expect(b >= 1 && b !== 2).toBe(true);
        expect(Number(day)).toBeLessThanOrEqual(nDays);
        const at = lon(atDay(Number(day), time), b);
        const k = names.indexOf(target);
        // on a boundary of the entered division: its start (direct) or its end (retrograde)
        expect(Math.min(near(at, k * arc), near(at, (k + 1) * arc))).toBeLessThan(0.002);
      }
      return ls.length;
    };
    expect(entries(4, iN, 30, SIGN_NAMES)).toBeGreaterThan(0);
    expect(entries(iN + 1, iA, 360 / 27, KI_NAKSHATRAS)).toBeGreaterThan(0);
    const OFFSET: Record<string, number> = { '[C]': 0, '[S]': 180, '[4]': 270, '[8]': 150, '[5]': 240, '[9]': 120, '[3]': 300, '[10]': 90 };
    const aspects = text.slice(iA + 1).filter((l) => l).map((l) => l.split('\t'));
    expect(aspects.length).toBeGreaterThan(20);
    let prev = -Infinity;
    for (const [x, label, y, day, time] of aspects) {
      const jd = atDay(Number(day), time);
      expect(jd).toBeGreaterThanOrEqual(prev - 1e-5);   // sorted by time
      prev = jd;
      expect(near(lon(jd, SHORT.indexOf(x)) - lon(jd, SHORT.indexOf(y)), OFFSET[label])).toBeLessThan(0.01);
    }
    expect(aspects.filter(([x, l, y]) => l === '[C]' && x === 'Mo' && y === 'Sa')).toHaveLength(1);
    // mutual aspects are listed in both directions
    const fourth = aspects.find(([, l]) => l === '[4]')!;
    expect(aspects.some(([x, l, y, d, t]) => l === '[10]' && x === fourth[2] && y === fourth[0] && d === fourth[3] && t === fourth[4])).toBe(true);
  });

  it('DP format: header, one row per day, lagna exits and the bodies in each sign', async () => {
    const o = { year, month, day: chart.birth.day, days: 3 };
    const text = (await dpFormatText(chart, swe, o)).split('\n');
    expect(text[0]).toBe(DP_HEADER);
    expect(DP_HEADER.split('\t')).toHaveLength(64);
    expect(text).toHaveLength(4);
    const t2 = (m: Moment) => timeText(m, 2, m.day);
    for (let i = 0; i < 3; i++) {
      const r = text[i + 1].split('\t');
      expect(r).toHaveLength(64);
      const d = panchangaDay(chart, swe, swe.julday(year, month, o.day, 12 - tz) + i, o.day + i);
      const t1 = d.dayStart;
      expect(r.slice(0, 4)).toEqual([`${t1.day}-${String(t1.month).padStart(2, '0')}-${t1.year}`, String(t1.year), MONTHS[t1.month - 1], String(t1.day)]);
      expect(r[9]).toBe(d.tithi.items[0].index < 15 ? 'Sukla' : 'Krishna');
      expect(r[10]).toBe(TITHI_NAMES[d.tithi.items[0].index].replace(/^(Sukla|Krishna) /, ''));
      expect(r[11]).toBe(t2(d.tithi.items[0].end));
      expect(r[12]).toBe(`${t2(d.rahu.start)} - ${t2(d.rahu.end)}`);
      expect(r[13]).toBe(WEEKDAYS[d.weekday]);
      expect(r[26]).toBe(t2(d.sunrise));
      expect(r[27]).toBe(t2(d.sunset));
      expect(r[20] === '').toBe(d.varjya.length < 2);
      // the lagna leaves the listed signs (from the Sun's) at the listed times
      const sun = Math.trunc(lon(t1.jd, 1) / 30);
      for (let k = 0; k < 12; k++) expect(r[28 + 2 * k]).toBe(SIGN_NAMES[(sun + k) % 12]);
      // the first exit is a couple of hours after sunrise, on C's date ('h:mm' is rounded: 0.3 degree)
      const exit = swe.julday(t1.year, t1.month, t1.day, hms(r[29]) - tz);
      expect(near(lon(exit, 0), ((sun + 1) % 12) * 30)).toBeLessThan(0.3);
      const cols = r.slice(52);
      ['Sun', 'Moon', 'Mars', 'Merc', 'Jup', 'Ven', 'Sat', 'Rah', 'Ket'].forEach((name, k) => {
        expect(cols[Math.trunc(lon(t1.jd, k + 1) / 30)].split(', ')).toContain(name);
      });
      expect(cols.filter((c) => c).join(', ').split(', ')).toHaveLength(9);
    }
  });

  it('jobs return the copy texts and tables', async () => {
    const e = await PANCHANGA_JOBS['panchanga.ephemeris'](chart, {}, swe);
    expect(e.rows).toHaveLength(31);
    expect(e.headers[4]).toBe('SidTime');
    const mv = await PANCHANGA_JOBS['panchanga.movements'](chart, { year: 2024, month: 3 }, swe);
    expect(mv.caption).toBe('Planetary Movements for March, 2024');
    expect(mv.rows.some((r) => r[0] === 'Entry of planets into signs' && r[1] === 'Sun' && r[3] === 'Pisces')).toBe(true);
    expect(mv.rows.some((r) => r[0] === 'Planetary aspects of Jyotish')).toBe(true);
    const dp = await PANCHANGA_JOBS['panchanga.dpFormat'](chart, { year: 2024, month: 2, day: 28, days: 3 }, swe);
    expect(dp.rows.map((r) => r[0])).toEqual(['28-02-2024', '29-02-2024', '1-03-2024']);
    expect(dp.text![0]).toBe(DP_HEADER);
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
