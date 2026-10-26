// Self-consistency checks for the derived-chart tabs: Tithi Pravesha and Prasna here;
// Mundane, Progressions/Angular Return and Panchanga/Laghu Parasari have their own
// tests/derived.<feature>.test.ts files. Also checks that every job is registered.
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { siderealLongitude, norm360 } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { tithi } from '../src/core/keyInfo';
import { lunarMonthAt, praveshaError, tpDateChart, tpYearChart } from '../src/core/derived/tithiPravesha';
import { ctxOf } from '../src/core/derived/mundane';
import { KP249, prasnaLagna } from '../src/core/derived/prasna';
import { ASYNC_TABLES, TABLES } from '../src/engine/jobs';
import { DERIVED_VIEWS } from '../src/ui/shell/derivedViews';
import type { BirthData } from '../src/core/jhd';

/** JHora's root finder stops at a 1 s bracket (later end): ~1.4e-4 deg of elongation per second */
const TOL = 2e-4;
const wrap = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d < -180) d += 360; return d; };

describe('Tithi Pravesha', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, goldenCharts()[0].birth);
  const s = calcSettingsFromIni(natal.ini);
  const by = natal.birth.year;
  const sunSign = (jd: number) => Math.floor(siderealLongitude(swe, jd, 'Sun', s).lon / 30);
  const natalSign = Math.floor(natal.positions.grahas.Sun.lon / 30);
  await swe.ensureEphemeris(natal.positions.jdUt + 40 * 365.25);

  it('annual TP: natal tithi angle, Sun in the natal sign, about a year long', () => {
    for (const k of [1, 7, 25, 40]) {
      const r = tpYearChart(swe, natal, { year: by + k });
      expect(r.label).toBe('Annual TP');
      expect(Math.abs(praveshaError(swe, natal, 0, r.start))).toBeLessThan(TOL);
      expect(sunSign(r.start)).toBe(natalSign);
      const sun = siderealLongitude(swe, r.start, 'Sun', s).lon;
      expect(tithi(sun, siderealLongitude(swe, r.start, 'Moon', s).lon).index).toBe(tithi(natal.positions.grahas.Sun.lon, natal.positions.grahas.Moon.lon).index);
      // within the natal solar month of year k
      expect(Math.abs(r.start - natal.positions.jdUt - k * 365.2564)).toBeLessThan(32);
      expect(r.end - r.start).toBeGreaterThan(353);
      expect(r.end - r.start).toBeLessThan(386);
      expect(Math.abs(praveshaError(swe, natal, 0, r.end))).toBeLessThan(TOL);
    }
  });

  it('monthly TP: m-1 synodic months after the annual moment; daily TP adds 12 deg per day', () => {
    const y = by + 10;
    const a = tpYearChart(swe, natal, { year: y, month: 1 });
    expect(a.label).toBe('Monthly TP');
    const m3 = tpYearChart(swe, natal, { year: y, month: 3 });
    expect(Math.abs(praveshaError(swe, natal, 0, m3.start))).toBeLessThan(TOL);
    expect(Math.abs(m3.start - a.start - 2 * 29.5306)).toBeLessThan(1.5);
    expect(m3.end - m3.start).toBeGreaterThan(29);
    expect(m3.end - m3.start).toBeLessThan(30.1);
    const d5 = tpYearChart(swe, natal, { year: y, month: 3, day: 5 });
    expect(d5.label).toBe('Daily TP');
    expect(Math.abs(praveshaError(swe, natal, 0, d5.start, 48))).toBeLessThan(TOL);
    expect(Math.abs(praveshaError(swe, natal, 0, d5.end, 60))).toBeLessThan(TOL);
    expect(d5.start).toBeGreaterThan(m3.start);
    expect(d5.start - m3.start).toBeLessThan(6);
  });

  it('date mode: before/after the date, fortnight and daily angles', () => {
    const date = { year: by + 20, month: 5, day: 10, hour: 12 };
    const jd = swe.julday(date.year, date.month, date.day, date.hour - natal.birth.tzHours);
    const after = tpDateChart(swe, natal, { kind: 1, before: false, ...date });
    const before = tpDateChart(swe, natal, { kind: 1, before: true, ...date });
    expect(after.start).toBeGreaterThan(jd);
    expect(before.start).toBeLessThan(jd);
    expect(after.start - before.start).toBeCloseTo(29.53, 0);
    const ann = tpDateChart(swe, natal, { kind: 0, before: false, ...date });
    expect(ann.start).toBeGreaterThan(jd);
    expect(sunSign(ann.start)).toBe(natalSign);
    expect(Math.abs(praveshaError(swe, natal, 0, ann.start))).toBeLessThan(TOL);
    const fn = tpDateChart(swe, natal, { kind: 2, before: false, ...date });
    const e = praveshaError(swe, natal, 0, fn.start);
    expect(Math.min(Math.abs(e), Math.abs(wrap(e - 180)))).toBeLessThan(TOL);
    expect(fn.start - jd).toBeLessThan(15.5);
    expect(fn.end - fn.start).toBeLessThan(16);
    const dy = tpDateChart(swe, natal, { kind: 3, before: false, ...date });
    const off = norm360(praveshaError(swe, natal, 0, dy.start) + 1e-9);
    expect(Math.abs(off - 12 * Math.round(off / 12)) % 360).toBeLessThan(TOL);
    expect(dy.start - jd).toBeGreaterThan(0);
    expect(dy.start - jd).toBeLessThan(1.3);
  });

  it('yoga pravesha reproduces Moon + Sun; lunar month helper is consistent', () => {
    const r = tpYearChart(swe, natal, { year: by + 5, type: 2 });
    expect(r.label).toBe('Annual YP');
    expect(Math.abs(praveshaError(swe, natal, 2, r.start))).toBeLessThan(TOL);
    expect(lunarMonthAt(ctxOf(swe, natal), natal.positions.jdUt, 4)).toBe((natalSign + 11) % 12);
  });

  it('job returns the TP chart birth data (tithi reproduced by the computed chart)', async () => {
    const t = await ASYNC_TABLES['tithiPravesha.find'](natal, { mode: 'year', selection: { year: by + 30 } }, swe);
    const { birth, label, periodDays } = JSON.parse(t.text![0]) as { birth: BirthData; label: string; periodDays: number };
    expect(label).toBe('Annual TP');
    expect(periodDays).toBeGreaterThan(350);
    const c = await computeChart(swe, birth);
    const e = (x: typeof c) => norm360(x.positions.grahas.Moon.lon - x.positions.grahas.Sun.lon);
    expect(Math.abs(wrap(e(c) - e(natal)))).toBeLessThan(1e-3);
    const d = await ASYNC_TABLES['tithiPravesha.dasa'](natal, { birth, label, periodDays, path: [] }, swe);
    expect(d.rows.length).toBe(9);
  });
});

describe('Prasna', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, goldenCharts()[0].birth);

  it('Prasna-108 fixes the navamsa centre', () => {
    expect(prasnaLagna('108', 1)).toBeCloseTo(5 / 3, 12);
    expect(prasnaLagna('108', 10)).toBeCloseTo(30 + 5 / 3, 12);
    expect(prasnaLagna('108', 108)).toBeCloseTo(360 - 5 / 3, 12);
    expect(() => prasnaLagna('108', 109)).toThrow();
  });

  it('Prasna-249: KP subs split at sign boundaries', () => {
    expect(KP249.length).toBe(249);
    expect(KP249[0]).toBe(0);
    expect(KP249[1]).toBe(7);                     // Ketu-Ketu sub: 0 Ar 46'40"
    for (let i = 1; i < 249; i++) expect(KP249[i]).toBeGreaterThan(KP249[i - 1]);
    for (let k = 0; k < 12; k++) expect(KP249).toContain(270 * k);
    expect(prasnaLagna('249', 249)).toBeCloseTo(360 - 19 / 9, 9);   // Revati-Saturn sub
  });

  it('Nadi Prasna: centre of the unequal nadiamsa', () => {
    expect(prasnaLagna('nadi', 1)).toBeCloseTo(0.25, 12);
    expect(prasnaLagna('nadi', 151)).toBeCloseTo(30.25, 12);
    expect(prasnaLagna('nadi', 1, 0)).toBeCloseTo(0.1, 12);
    expect(Math.floor(prasnaLagna('nadi', 1800) / 30)).toBe(11);
  });

  it('job: replace puts PLag on the lagna; otherwise the chart is unchanged', async () => {
    const t = await ASYNC_TABLES['prasna.find'](natal, { mode: '249', n: 100, replace: true }, swe);
    const { birth, label } = JSON.parse(t.text![0]) as { birth: BirthData; label: string };
    expect(label).toBe('Prasna-249 (100)');
    const c = await computeChart(swe, birth);
    expect(c.positions.ascendant).toBeCloseTo(KP249[99] / 9, 9);
    expect(c.positions.grahas.Moon.lon).toBeCloseTo(natal.positions.grahas.Moon.lon, 9);
    const u = await ASYNC_TABLES['prasna.find'](natal, { mode: '108', n: 5, compress: { years: 1, days: 0 } }, swe);
    const p = JSON.parse(u.text![0]) as { birth: BirthData; periodDays: number; label: string };
    // the lagna stays; Prasna Lagna is listed as a separate body
    expect(p.birth.override).toEqual({ prasnaLagna: prasnaLagna('108', 5) });
    expect(p.periodDays).toBeCloseTo(365.24219, 9);
    const d = await ASYNC_TABLES['prasna.dasa'](natal, { birth: p.birth, label: p.label, periodDays: p.periodDays, path: [] }, swe);
    expect(d.rows.length).toBe(9);
  });
});

describe('derived-chart registry', () => {
  it('registers every job and view', () => {
    for (const id of ['tithiPravesha.find', 'tithiPravesha.dasa', 'prasna.find', 'prasna.dasa', 'mundane.find', 'mundane.dasa',
      'progression.find', 'angularReturn.find', 'panchanga.monthly', 'panchanga.daily', 'laghuParasari.table']) expect(ASYNC_TABLES[id], id).toBeTypeOf('function');
    expect(TABLES['laghuParasari.table']).toBeTypeOf('function');
    expect(Object.keys(DERIVED_VIEWS).sort()).toEqual(['Miscellany/Angular Return', 'Miscellany/Laghu Parasari', 'Miscellany/Panchanga',
      'Miscellany/Prasna (Horary)', 'Miscellany/Progressions', 'Mundane', 'Tithi Pravesha']);
  });
});
