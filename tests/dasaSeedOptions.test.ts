// Chara dasa (Parasara)'s seed and chart (dialog 2079 / varga picker FUN_004d8730, FUN_0044e6c0)
// and the Kalachakra method of the nakshatra dasa progression (FUN_00401820 over FUN_0040c540):
// structural checks against the rules read from jhora.exe. Both are session or option states the
// --ini harness cannot set for the seed, so no golden capture backs them yet.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart, type Chart } from '../src/core/chart';
import { RASI_DASAS } from '../src/core/dasas/registry';
import { charaParasaraDasa } from '../src/core/dasas/charaParasara';
import { drigDasa } from '../src/core/dasas/drigdasa';
import { trikonaDasa } from '../src/core/dasas/trikona';
import { yogardhaDasa } from '../src/core/dasas/yogardha';
import { rasiCtx } from '../src/core/dasas/rasiCommon';
import { kalachakraDasa } from '../src/core/dasas/kalachakra';
import { norm360 } from '../src/core/positions';
import { dasaYearsAt, progressedSeed, progression } from '../src/core/derived/progression';
import { SIGNS } from '../src/core/zodiac';

const idx = (label: string | undefined) => SIGNS.indexOf(label as (typeof SIGNS)[number]);
const wrap = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d < -180) d += 360; return d; };

describe('Chara dasa (Parasara) seed and the shared rasi dasa chart', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1')));
  const ctx = rasiCtx(natal, 0);

  it('seed 0 is the default (lagna); Sun and Moon start from their signs with the (s+8)/3 direction', () => {
    expect(RASI_DASAS['Chara (Parasara)'](natal, 2, { charaSeed: 0 })).toEqual(RASI_DASAS['Chara (Parasara)'](natal, 2));
    for (const [seed, sign] of [[0, ctx.lagna], [1, ctx.sign('Sun')], [2, ctx.sign('Moon')]] as const) {
      const ps = RASI_DASAS['Chara (Parasara)'](natal, 1, { charaSeed: seed }).periods;
      expect(idx(ps[0].label)).toBe(sign);
      const dir = Math.floor((sign + 8) / 3) % 2 === 0 ? 1 : -1;
      expect(idx(ps[1].label)).toBe((sign + dir + 12) % 12);
      expect(ps).toEqual(charaParasaraDasa(natal, 1, 0, undefined, seed));
    }
  });

  it('rasiVarga drives Drigdasa, Trikona, Chara (Parasara) and Yogardha and their titles', () => {
    const v = 1; // D-9
    const d9 = rasiCtx(natal, v);
    const chara = RASI_DASAS['Chara (Parasara)'](natal, 1, { rasiVarga: v });
    expect(chara.title).toBe('Chara dasa of D-9 (a popular phalita rasi dasa)');
    expect(idx(chara.periods[0].label)).toBe(d9.lagna);
    expect(RASI_DASAS['Chara (Parasara)'](natal, 1, { rasiVarga: v, charaSeed: 2 }).periods[0].label).toBe(SIGNS[d9.sign('Moon')]);
    const cases: [string, (c: Chart, l: number, v: number) => unknown][] = [
      ['Drigdasa', (c, l, x) => drigDasa(c, l, x)], ['Trikona', (c, l, x) => trikonaDasa(c, l, x)], ['Yogardha', (c, l, x) => yogardhaDasa(c, l, x)]];
    for (const [key, f] of cases) {
      const d = RASI_DASAS[key](natal, 1, { rasiVarga: v });
      expect(d.title).toContain('D-9');
      expect(d.periods).toEqual(f(natal, 1, v));
      expect(RASI_DASAS[key](natal, 1, { rasiVarga: 0 })).toEqual(RASI_DASAS[key](natal, 1));
    }
  });
});

describe('Kalachakra nakshatra dasa progression follows KalachakraDasaCalculation', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1')));
  const moon = natal.positions.grahas.Moon.lon;
  const PADA = 360 / 108;
  const base = Math.trunc(moon * 0.3) * PADA;

  it('the seed is the pada base plus one pada per maha dasa of the chosen method', () => {
    expect(progressedSeed(moon, 'Kalachakra', 3)).toBe(progressedSeed(moon, 'Kalachakra', 3, true, 5));
    for (let m = 0; m <= 6; m++) {
      const mahas = kalachakraDasa(moon, 9, true, 1, { seed: 'Moon', varga: 'D-1' }, m).periods;
      const s0 = progressedSeed(moon, 'Kalachakra', 0, true, m);
      expect(wrap(s0 - base)).toBeGreaterThanOrEqual(0);
      expect(wrap(s0 - base)).toBeLessThan(PADA);
      for (const k of [1, 2, 3]) {
        const s = progressedSeed(moon, 'Kalachakra', mahas[k].start + 1e-9, true, m);
        expect(Math.abs(wrap(s - norm360(base + k * PADA)))).toBeLessThan(1e-6);
      }
    }
  });

  it('progression() reads the method from the ini', () => {
    const date = { year: natal.birth.year + 30, month: 6, day: 15, hour: 12 };
    const jd = swe.julday(date.year, date.month, date.day, date.hour - natal.birth.tzHours);
    const seeds = new Set<number>();
    for (const m of [0, 3, 5, 6]) {
      const c = { ...natal, ini: { ...natal.ini, KalachakraDasaCalculation: m } };
      const p = progression(swe, c, { kind: 'nakshatra', varga: 0, body: 2, dasa: 2, ...date });
      expect(p.seed).toBeCloseTo(progressedSeed(moon, 'Kalachakra', dasaYearsAt(swe, c, jd, 2), c.ini.KCDRohini4NavamsaInLeo !== 0, m), 9);
      seeds.add(Math.round(p.seed! * 1e6));
    }
    expect(seeds.size).toBeGreaterThan(1);
  });
});
