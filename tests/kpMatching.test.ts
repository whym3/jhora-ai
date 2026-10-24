import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import { houseRows, houseSpans, kpCusps, systemCusps } from '../src/core/kpHouses';
import { kpLords } from '../src/core/kp';
import { norm360 } from '../src/core/positions';
import {
  defaultOtherIsGroom, GUNANKA, gunanka, matchHoroscopes, matchLevel, nakshatraPada, SEGMENT_OF_PADA,
} from '../src/core/matching';

const KP_GOLDEN_MODES = ['Planets in nakshatra', 'Planets in sub', 'Planets in prati-sub', 'Planets in sookshma-sub', 'Planets in praana-sub', 'Planets in deha-sub'];
const trim = (rows: string[][]) => rows.map((r) => r.map((c) => c.trim()));
/** compare longitudes to the minute (seconds are verified elsewhere) */
const loose = (rows: string[][]) => trim(rows).map((r) => r.map((c) => c.replace(/(\d+ \w\w \d+') \d+\.\d+"/, '$1')));

describe('KP tables and Houses match JHora 8.0 (golden v3)', async () => {
  const swe = await nodeSweph();
  for (const g of goldenV3Charts()) {
    const chart = computeChart(swe, g.birth);
    const houses = g.views.find((v) => (v as { sub?: string }).sub === 'Houses');
    if (houses) {
      it(`${g.name}: Houses`, async () => {
        const got = runTable(await chart, 'basics.houses', {}, swe);
        expect(got.headers).toEqual(houses.headers);
        expect(loose(got.rows)).toEqual(loose(houses.rows));
      });
    }
    const kp = (mode: string) => g.views.find((v) => (v as { sub?: string }).sub === 'KP' && v.mode === mode);
    const lords = kp('Sub lords');
    if (lords) {
      it(`${g.name}: KP sub lords`, async () => {
        const got = runTable(await chart, 'basics.kp', {}, swe);
        expect(got.headers).toEqual(lords.headers);
        expect(trim(got.rows)).toEqual(trim(lords.rows));
      });
    }
    KP_GOLDEN_MODES.forEach((mode, level) => {
      const want = kp(mode);
      if (!want) return;
      it(`${g.name}: KP ${mode}`, async () => {
        const got = runTable(await chart, 'basics.kpOccupants', { level }, swe);
        expect(got.headers).toEqual(want.headers);
        expect(trim(got.rows)).toEqual(trim(want.rows));
      });
    });
  }
});

describe('KP with Placidus houses (self-consistency, no golden)', async () => {
  const swe = await nodeSweph();
  const [g] = goldenV3Charts();
  for (const middle of [1, 0]) {
    it(`${g.name}: Placidus, HouseCuspsInMiddle=${middle}`, async () => {
      const chart = await computeChart(swe, g.birth, { HouseTypeWanted: 4, HouseCuspsInMiddle: middle });
      const cusps = systemCusps(chart, 4, swe);
      // Placidus cusp 1 is the ascendant; the 10th is the sidereal MC
      expect(Math.abs(norm360(cusps[0] - chart.positions.ascendant + 180) - 180)).toBeLessThan(1e-9);
      const mc = swe.houses(chart.positions.jdUt, 0, g.birth.lat, g.birth.lon, 'P').ascmc[1] - chart.positions.ayanamsaMean;
      expect(Math.abs(norm360(cusps[9] - mc + 180) - 180)).toBeLessThan(1e-9);
      // KP rows use the system's own cusps whether the lagna is the start or the middle
      expect(kpCusps(chart, { type: 4, middle: !!middle }, swe).map((x) => x.toFixed(9))).toEqual(cusps.map((x) => x.toFixed(9)));
      const kp = runTable(chart, 'basics.kp', {}, swe);
      expect(kp.rows.slice(13).map((r) => r.slice(1))).toEqual(cusps.map((c) => kpLords(c, 6).map((x) => ({ Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' })[x])));
      // houses tile the zodiac and every body is in exactly one of them
      const spans = houseSpans(chart, { type: 4, middle: !!middle }, swe);
      spans.forEach((h, i) => expect(Math.abs(norm360(spans[(i + 1) % 12].start - h.end + 180) - 180)).toBeLessThan(1e-9));
      const rows = houseRows(chart, { type: 4, middle: !!middle }, swe);
      expect(rows.flatMap((r) => r.bodies).sort()).toEqual(['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke', 'Ur', 'Ne', 'Pl'].sort());
      // occupancy lists cover the 13 bodies and 12 cusps once per level
      for (let level = 0; level < 6; level++) {
        const t = runTable(chart, 'basics.kpOccupants', { level }, swe);
        expect(t.rows.flatMap((r) => (r[1] ? r[1].split(', ') : [])).length).toBe(25);
      }
    });
  }
  it('other house types: rasi and nakshatra-pada houses', async () => {
    const chart = await computeChart(swe, g.birth, { HouseTypeWanted: 0 });
    const r = houseSpans(chart, { type: 0, middle: true });
    expect(r[0].start % 30).toBe(0);
    expect(r[0].cusp).toBeCloseTo(chart.positions.ascendant, 9);
    const p = houseSpans(chart, { type: 2, middle: true });
    const padas = (p[0].cusp - 5 / 3) / (10 / 3);
    expect(Math.abs(padas - Math.round(padas))).toBeLessThan(1e-9);
  });
});

describe('Horoscope matching (FUN_004b3b10 table)', () => {
  it('segments: a new one at every nakshatra or sign boundary', () => {
    let seg = -1, prev = '';
    const derived = Array.from({ length: 108 }, (_, p) => {
      const key = `${Math.floor(p / 4)}-${Math.floor(p / 9)}`;
      if (key !== prev) { seg++; prev = key; }
      return seg;
    });
    expect(SEGMENT_OF_PADA).toEqual(derived);
    expect(GUNANKA).toHaveLength(36);
    GUNANKA.forEach((row) => { expect(row).toHaveLength(36); row.forEach((x) => expect(x >= 0 && x <= 36).toBe(true)); });
  });
  it('same nakshatra and rasi scores 28 (only nadi fails)', () => {
    for (let s = 0; s < 36; s++) expect(GUNANKA[s][s]).toBe(28);
  });
  it('levels', () => {
    expect([0, 17, 18, 21, 22, 25, 26, 30, 31, 36].map(matchLevel)).toEqual(
      ['Below Average', 'Below Average', 'Average', 'Average', 'Fair', 'Fair', 'Good', 'Good', 'Excellent', 'Excellent']);
  });
  it('bride is the row, groom the column; the native can be either', () => {
    const a = { nak: 0, pada: 0 }, b = { nak: 1, pada: 0 };   // Aswini 1 (segment 0), Bharani 1 (segment 1)
    expect(gunanka(a, b)).toBe(33);
    expect(gunanka(b, a)).toBe(34);
    expect(matchHoroscopes({ native: a, other: b, otherIsGroom: true }).score).toBe(33);
    expect(matchHoroscopes({ native: a, other: b, otherIsGroom: false }).score).toBe(34);
    expect(defaultOtherIsGroom(2)).toBe(true);
    expect(defaultOtherIsGroom(1)).toBe(false);
    expect(defaultOtherIsGroom(null)).toBe(false);
  });
  it("JHora's message text", () => {
    const m = matchHoroscopes({ native: { nak: 5, pada: 2 }, other: { nak: 26, pada: 3 }, otherIsGroom: true });
    expect(m.text.slice(0, 4)).toEqual([
      'Native: Aardra (3rd pada)', 'Bridegroom: Revati (4th pada)', '',
      `Gunanka score after matching ashta koota (group of eight factors) = ${m.score} (out of 36).`,
    ]);
    expect(m.text[5]).toBe(`The level of match (below average/average/fair/good/excellent) = ${m.level}.`);
  });
  it('nakshatra and pada of a longitude', () => {
    expect(nakshatraPada(0)).toEqual({ nak: 0, pada: 0 });
    expect(nakshatraPada(359.99)).toEqual({ nak: 26, pada: 3 });
    expect(nakshatraPada(30)).toEqual({ nak: 2, pada: 1 });
  });
  it('matching job uses the Moon of the chart', async () => {
    const swe = await nodeSweph();
    const [g] = goldenV3Charts();
    const chart = await computeChart(swe, g.birth);
    const t = runTable(chart, 'matching.result', { otherNak: 10, otherPada: 1, otherIsGroom: true });
    const native = nakshatraPada(chart.positions.grahas.Moon.lon);
    expect(t.text![3]).toContain(`= ${gunanka(native, { nak: 10, pada: 1 })} (out of 36)`);
    expect(t.rows.length).toBeGreaterThan(0);
  });
});
