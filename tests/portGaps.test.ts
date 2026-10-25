// Options and views ported from jhora.exe without golden captures: Tara dasa variants,
// Karaka dasa with 7 karakas, Tithi Pravesha tropical lunar months, the Yogini & Mrityu
// points of the star chakras, Laghu Parasari on compressed charts and Strengths > Bar graphs.
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { NAK_LORD, VIMSOTTARI_YEARS, nakshatraLord } from '../src/core/lords';
import { taraDasa, taraOptions } from '../src/core/dasas/tara';
import { karakaDasa } from '../src/core/dasas/karaka';
import { kendradiPlanets } from '../src/core/dasas/otherCommon';
import { rasiCtx } from '../src/core/dasas/rasiCommon';
import { lunarMonthAt, tpYearChart } from '../src/core/derived/tithiPravesha';
import { bodyLon, ctxOf, recordSearch } from '../src/core/derived/mundane';
import { yoginiMrityu, type ChakraChart } from '../src/core/chakras/common';
import { kalachakraChakra } from '../src/core/chakras/kalachakra';
import { shoolaChakra } from '../src/core/chakras/shoola';
import { laghuRows } from '../src/core/derived/laghuParasari';
import { solarYearsToJd } from '../src/core/tajaka/annual';
import { strengthBarGraphs } from '../src/core/strengthGraphs';
import type { Graha } from '../src/core/positions';

const NAK = 360 / 27;
const norm = (x: number) => ((x % 360) + 360) % 360;

describe('Tara dasa variants (FUN_00411060)', async () => {
  const swe = await nodeSweph();
  const charts = goldenCharts().slice(0, 6);
  for (const g of charts) {
    it(`${g.name}: TaraDasaParasara = 1`, async () => {
      const c = await computeChart(swe, g.birth);
      const d = taraDasa(c, 2, { ...taraOptions(c), parasara: true });
      // Vimsottari order from the first planet of the strongest occupied kendra
      const ctx = rasiCtx(c, 0);
      const kendras = [0, 3, 6, 9].map((k) => (ctx.lagna + k) % 12);
      const lead = kendradiPlanets(ctx.lagna, 1, ctx).find((p) => kendras.includes(ctx.sign(p)))
        ?? nakshatraLord(Math.floor(c.positions.grahas.Moon.lon / NAK));
      const k = NAK_LORD.indexOf(lead);
      expect(d.map((p) => p.lord)).toEqual(NAK_LORD.map((_, j) => NAK_LORD[(k + j) % 9]));
      d.forEach((p) => expect(p.end - p.start).toBeCloseTo(VIMSOTTARI_YEARS[p.lord as Graha], 9));
      // balance from the Moon's nakshatra
      const moon = c.positions.grahas.Moon.lon;
      expect(-d[0].start).toBeCloseTo(((moon % NAK) / NAK) * VIMSOTTARI_YEARS[lead], 9);
      expect(d[0].children![0].lord).toBe(lead);
    });
  }
  it('UseSesham = 0 starts at birth; DirectionFromStar keeps the nine planets', async () => {
    const c = await computeChart(swe, charts[0].birth);
    expect(taraDasa(c, 1, { ...taraOptions(c), useSesham: false })[0].start).toBeCloseTo(0, 12);
    const d = taraDasa(c, 1, { ...taraOptions(c), directionFromStar: true });
    expect(new Set(d.map((p) => p.lord)).size).toBe(9);
    // SeshamRevApasavya only swaps the balance: the sum of both balances is the first dasa
    const a = taraDasa(c, 1, taraOptions(c)), b = taraDasa(c, 1, { ...taraOptions(c), seshamRevApasavya: true });
    if (b[0].start !== a[0].start) expect(-a[0].start - b[0].start).toBeCloseTo(a[0].end - a[0].start, 9);
  });
});

describe('Karaka dasa with 7 karakas (FUN_004139a0 / FUN_004a4c30)', async () => {
  const swe = await nodeSweph();
  it('definition 1 skips PiK; 2 labels the fifth karaka PiK (PK repeats MK)', async () => {
    const g = goldenCharts()[0];
    const d1 = karakaDasa(await computeChart(swe, g.birth, { CharaKarakaDefinition: 1 }), 1);
    const d2 = karakaDasa(await computeChart(swe, g.birth, { CharaKarakaDefinition: 2 }), 1);
    expect(d1.length).toBe(14);
    expect(d1.slice(0, 7).map((p) => p.label!.split(' ')[0])).toEqual(['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK']);
    expect(d2.slice(0, 7).map((p) => p.label!.split(' ')[0])).toEqual(['AK', 'AmK', 'BK', 'MK', 'PiK', 'GK', 'DK']);
    expect(d2.map((p) => [p.lord, p.start, p.end])).toEqual(d1.map((p) => [p.lord, p.start, p.end]));
  });
});

describe('Tithi Pravesha tropical lunar months (FUN_0049d7c0, LunarYrDef 1/3/5)', async () => {
  const swe = await nodeSweph();
  for (const g of goldenCharts().slice(0, 4)) {
    it(g.name, async () => {
      for (const def of [1, 3, 5]) {
        const natal = await computeChart(swe, g.birth, { LunarYrDef: def, SolarMonthUsedInTP: 0 });
        const c = ctxOf(swe, natal), trop = ctxOf(swe, natal, true);
        const jd = natal.positions.jdUt;
        const month = lunarMonthAt(c, jd, def);
        // same moment as the sidereal variant (def - 1), month from the tropical Sun minus a sign
        const phase = def === 5 ? jd : recordSearch(c, { b1: 2, b2: 1, offset: def === 1 ? 180 : 0, backward: true }, jd);
        expect(month).toBe(Math.floor(norm(bodyLon(trop, 1, phase) - 30) / 30));
        const tp = tpYearChart(swe, natal, { year: g.birth.year + 30 });
        expect(tp.end - tp.start).toBeGreaterThan(330);
        expect(lunarMonthAt(c, tp.start, def)).toBe(month);
      }
    });
  }
});

describe('Yogini & Mrityu points (FUN_004a5f30)', () => {
  // 2000-01-02 is a Sunday; sunrise at 0h UT, zone 0
  const at = (ghatis: number, weekdayOffset = 0): ChakraChart => ({
    positions: {} as ChakraChart['positions'], bodies: [],
    day: { sunrise: 2451546.0 + weekdayOffset, ghatis } as ChakraChart['day'],
    birth: { tzHours: 0 } as ChakraChart['birth'],
  });
  it('matches the hand-worked cases', () => {
    expect(yoginiMrityu(at(0))).toEqual([0, 20, 0]);
    expect(yoginiMrityu(at(3))).toEqual([18, 9, 0]);
    expect(yoginiMrityu(at(58, 6))).toEqual([2, 2, 0]);
    expect(yoginiMrityu(at(59.9, 6))).toEqual([1, 19, 0]);
    expect(yoginiMrityu({ positions: {} as ChakraChart['positions'], bodies: [] })).toBeNull();
  });
  it('the chakras draw them in their raw slots', async () => {
    const swe = await nodeSweph();
    const c = await computeChart(swe, goldenCharts()[0].birth);
    const ym = yoginiMrityu(c)!;
    const kc = kalachakraChakra(c, null, { mode: 'yogini' });
    expect(kc.complete).toBe(true);
    expect(kc.stars[ym[0]].bodies.map((b) => b.label)).toContain('Yogini (vara)');
    expect(kc.stars[ym[1]].bodies.map((b) => b.label)).toContain('Mrityu');
    const sh = shoolaChakra(c, { mode: 'yoginiMrityu' });
    expect(sh.bodies.find((b) => b.text === 'Yogini (vara)')!.pos).toBe(ym[0]);
  });
});

describe('Laghu Parasari on compressed charts (FUN_00459bc0)', async () => {
  const swe = await nodeSweph();
  it('scales the solar-return years by the period of effect', async () => {
    const c = await computeChart(swe, goldenCharts()[0].birth);
    const date = (jd: number) => { const r = swe.revjul(jd + c.birth.tzHours / 24); return `${String(r.year).padStart(4)}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`; };
    const period = 365.25;
    const full = laghuRows(c, { periodDays: period }, swe);
    expect(full.columns).toBe(4);
    const r = full.rows[0];
    expect(r.dates[1]).toBe(date(solarYearsToJd(swe, c, period * r.ages[1] * 2.2815911089935512e-05, 3)));
    const one = laghuRows(c, { periodDays: period, oneCycle: true }, swe);
    expect(one.columns).toBe(1);
    expect(one.rows[0].dates[0]).toBe(date(solarYearsToJd(swe, c, (period * one.rows[0].ages[0]) / (30 * 365.24219), 3)));
    expect(laghuRows(c, { oneCycle: true }).columns).toBe(4);
  });
});

describe('Strengths > Bar graphs (FUN_0047de30)', async () => {
  const swe = await nodeSweph();
  for (const g of goldenCharts().slice(0, 4)) {
    it(g.name, async () => {
      const c = await computeChart(swe, g.birth);
      expect([0, 1, 2, 3, 4, 5].map((s) => strengthBarGraphs(c, s).length)).toEqual([8, 2, 9, 4, 4, 4]);
      // the Shadbala graph shows JHora's Shadbala column
      const sb = strengthBarGraphs(c, 2).find((x) => x.title === 'Shadbala')!;
      const want = g.views.find((v) => v.headers[0] === 'Planet' && v.headers[1] === 'Shadbala')!.rows;
      want.forEach((row, i) => expect(sb.values[i].toFixed(2)).toBe(row[1]));
      const avb = strengthBarGraphs(c, 0)[7];
      expect(avb.title).toBe('Ashtakavarga Bala (D-1)');
      avb.values.forEach((v) => expect(v >= 0 && v <= 8 && Number.isInteger(v)).toBe(true));
      const sav = strengthBarGraphs(c, 1)[1];
      expect(sav.values.reduce((a, x) => a + x, 0)).toBe(337);
    });
  }
});
