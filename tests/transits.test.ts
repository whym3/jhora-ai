// Self-consistency checks of the Transits tab port (no JHora goldens yet; see
// the capture notes in the transits_notes.md scratch file).
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { ASYNC_TABLES } from '../src/engine/jobs';
import { siderealLongitude, norm360 } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { signOf } from '../src/core/zodiac';
import { basicTransitTable, vedhaMatrix, ANGA_PARTS, ANGA_LIMBS } from '../src/core/transits/basic';
import { computeTransitChart, VARGA_ORDER, GOOD_HOUSE, VEDHA_HOUSE, clockText, arudhaLongitudes, type TransitDate } from '../src/core/transits/common';
import { lastIngress, murthis } from '../src/core/transits/murthi';
import { transitCalendar, calendarVedha } from '../src/core/transits/calendar';
import { specialSearch, searchTarget, type SpecialSearch } from '../src/core/transits/search';
import { jhoraCrossing, SECOND } from '../src/core/tajaka/search';
import { longitudeCorrelation, namedAspect, windowOrb, correlationTable } from '../src/core/transits/correlation';

describe('Transits', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, goldenCharts()[0].birth);
  const date: TransitDate = { year: 2024, month: 3, day: 15, hour: 12 };
  await swe.ensureEphemeris(swe.julday(2024, 3, 15, 12));
  const transit = await computeTransitChart(swe, natal, date);
  const settings = calcSettingsFromIni(natal.ini);

  it('casts the transit chart at the natal place and zone', () => {
    expect(transit.birth.lat).toBe(natal.birth.lat);
    expect(transit.birth.tzHours).toBe(natal.birth.tzHours);
    expect(transit.birth.year).toBe(2024);
  });

  it('tables are well formed and use JHora list headers', () => {
    const heads = [
      ['Planet', 'Tara', 'Murthi', 'House', 'Under vedha from', 'Causing vedha to'],
      ['Planet', 'From Moon', 'From Lagna', 'From Navamsa Moon', 'From Navamsa Lagna'],
      ['Planet', 'AV Score', 'SAV Score', 'Kakshya', 'Good?', 'Good house from references'],
      ['Planet', 'Special nakshatra occupied in transit (Moon)'],
      ['Planet', 'Occupied special nakshatra', 'Special nakshatras aspected in transit (Moon)'],
      ['Planet', 'Latta on', 'Anything special about it'],
      ['Planet', 'Special nakshatra occupied in transit (Lagna)'],
      ['Planet', 'Occupied special nakshatra', 'Special nakshatras aspected in transit (Lagna)'],
      ['Planet', 'Limb (Moon)', 'Result (from Moon)', 'Limb (lagna)', 'Result (from lagna)', 'Limb (Sun)', 'Result (from Sun)'],
    ];
    heads.forEach((h, mode) => {
      const t = basicTransitTable(natal, transit, mode);
      expect(t.headers).toEqual(h);
      for (const r of t.rows) expect(r.length).toBe(h.length);
    });
    expect(basicTransitTable(natal, transit, 0).rows).toHaveLength(11);
    expect(basicTransitTable(natal, transit, 2).rows).toHaveLength(11);
  });

  it('houses from Moon agree with the standard mode and good-house flags', () => {
    const std = basicTransitTable(natal, transit, 0).rows;
    const hs = basicTransitTable(natal, transit, 1).rows;
    for (let i = 0; i < 9; i++) expect(std[i][3].split(' ')[0]).toBe(hs[i][1]);
    // every vedha house belongs to a good house
    for (let b = 1; b <= 7; b++) VEDHA_HOUSE[b].forEach((v, h) => { if (v) expect(GOOD_HOUSE[b][h]).toBe(1); });
  });

  it('vedha matrix is symmetric in its rules and exempts the classical pairs', () => {
    const ref = signOf(natal.positions.grahas.Moon.lon);
    const m = vedhaMatrix(transit, ref);
    expect(m[0][6] || m[6][0] || m[1][3] || m[3][1]).toBe(false);
    for (let i = 0; i < 7; i++) expect(m[i][i]).toBe(false);
  });

  it('AV mode scores are bindu counts', () => {
    const t = basicTransitTable(natal, transit, 2, { avNatalVarga: 1, avTransitVarga: 0 });
    for (const r of t.rows.slice(0, 8)) {
      expect(Number(r[1])).toBeGreaterThanOrEqual(0); expect(Number(r[1])).toBeLessThanOrEqual(8);
      expect(r[5] ? r[5].split(', ').length : 0).toBe(Number(r[1]));
    }
    expect(t.rows[10]).toEqual(['Transit varga:', 'D-1', '', '', '', '']);
  });

  it('anga graha tables cover 27 stars', () => {
    for (let k = 0; k < 9; k++) {
      expect(ANGA_PARTS[k]).toHaveLength(27);
      for (const p of ANGA_PARTS[k]) expect(ANGA_LIMBS[k][p]).not.toBe('-');
    }
  });

  it('JHora crossing search and the last ingress', () => {
    const lon = (jd: number) => siderealLongitude(swe, jd, 'Sun', settings).lon;
    const t0 = transit.positions.jdUt;
    const target = norm360(lon(t0) + 10);
    const t = jhoraCrossing(lon, target, t0, { step: 10, tol: SECOND });
    expect(Math.abs(norm360(lon(t) - target + 180) - 180)).toBeLessThan(1e-3);
    const ti = lastIngress(swe, transit, 'Jupiter');
    expect(ti).toBeLessThan(t0);
    const sign = signOf(siderealLongitude(swe, t0, 'Jupiter', settings).lon);
    expect(signOf(siderealLongitude(swe, ti + 1e-3, 'Jupiter', settings).lon)).toBe(sign);
    const m = murthis(swe, transit, signOf(natal.positions.grahas.Moon.lon));
    expect(m[9]).toBe(m[8]);
    for (const x of m.slice(1)) expect([0, 1, 2, 3]).toContain(x);
  });

  it('calendar rows step by the given days', () => {
    const cal = transitCalendar(swe, natal, { start: date, stepDays: 2, rows: 4 });
    expect(cal.rows).toHaveLength(4);
    expect(cal.rows[1].date.day).toBe(17);
    expect(cal.rows[0].label).toBe('2024-03-15 (12:00)');
    expect(cal.title).toBe('Rasi chart transits of planets with respect to natal Rasi chart');
    const std = basicTransitTable(natal, transit, 0).rows;
    cal.rows[0].cells.forEach((c, k) => expect(`${['1st', '2nd', '3rd'][c.houseMoon - 1] ?? `${c.houseMoon}th`}`).toBe(std[k][3].split(' ')[0]));
    expect(calendarVedha(transit.positions, 1, 2, 0, 0)).toBeTypeOf('boolean');
    expect(clockText(23.9999)).toBe('24:00');
  });

  it('special search lands on the requested longitude', () => {
    const s: SpecialSearch = { planet: 5, deg: 10, min: 0, sec: 0, ahead: true, ref: { kind: 'planet', body: 'Moon', varga: 0 }, after: true, date };
    const { jd, periodDays } = specialSearch(swe, natal, s);
    expect(jd).toBeGreaterThan(transit.positions.jdUt);
    // JHora's 1 s bracket (later end): Jupiter moves < 0.25 deg/day, so < 3e-6 deg
    const err = (t: number) => norm360(siderealLongitude(swe, t, 'Jupiter', settings).lon - searchTarget(natal, s) + 180) - 180;
    expect(Math.abs(err(jd))).toBeLessThan(3e-6);
    // the period of effect runs to the next such crossing (direct or retrograde), searched forward
    expect(periodDays).toBeGreaterThan(0);
    expect(periodDays).toBeLessThan(13 * 365.25);
    expect(Math.abs(err(jd + periodDays))).toBeLessThan(3e-6);
    const before = specialSearch(swe, natal, { ...s, after: false });
    expect(before.jd).toBeLessThan(transit.positions.jdUt);
    expect(Math.abs(err(before.jd))).toBeLessThan(3e-6);
    // the before-search's next crossing is at or before the transit moment's next one
    expect(before.jd + before.periodDays).toBeLessThanOrEqual(jd + SECOND);
    expect(searchTarget(natal, { ...s, ref: { kind: 'sign', sign: 3 }, ahead: false })).toBe(80);
  });

  it('longitude correlation rows satisfy their own tests', () => {
    expect(namedAspect(100, 10, 1, 4)).toEqual([0, '3/4']);
    expect(namedAspect(100, 10, 3, 4)).toEqual([0, 'Full']);
    expect(namedAspect(190, 10, 1, 4)).toEqual([0, 'Full']);
    expect(windowOrb(101, 10, 1, 4, [90, 180, 270])).toBe(1);
    expect(windowOrb(150, 10, 1, 4, [90, 180, 270])).toBe(360);
    expect(arudhaLongitudes(natal)).toHaveLength(12);
    for (const mode of [0, 1, 2, 3]) {
      const rows = longitudeCorrelation(natal, transit, { mode });
      expect(rows.map((r) => r.planet)).toEqual([5, 7, 8, 9, 3, 1, 6, 4, 2]);
      for (const r of rows) expect(r.matches.length).toBeLessThanOrEqual(100);
      const t = correlationTable(rows, mode);
      expect(t.headers[4]).toBe(mode === 0 ? 'Aspect %' : 'Aspect Orb (deg)');
      if (mode >= 2) for (const r of rows) for (const m of r.matches) expect(m.value).toBeLessThanOrEqual(4);
    }
  });

  it('jobs are registered and run', async () => {
    const b = await ASYNC_TABLES['transits.basic'](natal, { date, mode: 0 }, swe);
    expect(b.rows[0][2]).not.toBe('');
    const c = await ASYNC_TABLES['transits.calendar'](natal, { start: date, rows: 2 }, swe);
    expect(c.rows).toHaveLength(2);
    expect(c.headers).toEqual(['Date', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke']);
    const s = await ASYNC_TABLES['transits.search'](natal, { planet: 1, deg: 0, min: 0, sec: 0, ahead: true, ref: { kind: 'sign', sign: 0 }, after: true, date }, swe);
    const found = JSON.parse(s.text![0]).date as TransitDate;
    expect(found.month).toBe(4);   // sidereal Sun enters Aries mid-April
    const l = await ASYNC_TABLES['transits.correlation'](natal, { date, tz: natal.birth.tzHours, mode: 1 }, swe);
    expect(l.headers).toEqual(['Transit Planet', 'Transit Longitude', 'Speed', 'Natal Point', 'Aspect Orb (deg)', 'Natal Longitude']);
    expect(VARGA_ORDER).toHaveLength(23);
  });
});
