import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV2Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { vimsottari } from '../src/core/dasas/vimsottari';
import { dasaClock } from '../src/core/dasas/time';
import { antarDasaText, mahaDasaText } from '../src/core/dasas/format';
import { NAKSHATRA_DASAS, nakshatraDasa, SAPTARSHI_TITLE, saptarshiDasa } from '../src/core/dasas/nakshatra';
import { NAKSHATRAS } from '../src/core/zodiac';
import { kalachakraDasa } from '../src/core/dasas/kalachakra';

/**
 * Compare dasa texts line by line; times may differ by `tolSec` seconds. The
 * residual is a constant shift per chart, about 2 s per year of the first dasa:
 * a ~0.004" difference in the Moon (Swiss 2.02 vs 2.10), far below what the
 * longitude tables show.
 */
function compareDasaText(have: string[], want: string[], tolSec: number): string[] {
  const bad: string[] = [];
  const re = /(\d{4})-(\d\d)-(\d\d) \((\d+):(\d\d):(\d\d)\)/g;
  const secs = (m: RegExpMatchArray) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
  want.forEach((w, i) => {
    const h = have[i] ?? '';
    if (h === w) return;
    const hw = [...w.matchAll(re)], hh = [...h.matchAll(re)];
    const strip = (s: string) => s.replace(re, 'T');
    if (strip(h) !== strip(w) || hw.length !== hh.length || hw.some((m, k) => Math.abs(secs(m) - secs(hh[k])) > tolSec)) bad.push(`have: ${h}\nwant: ${w}`);
  });
  return bad;
}

describe('Vimsottari dasa matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV2Charts()) {
    const texts = chart.texts.filter((t) => t.sub === 'Nakshatra dasas' && t.mode === 'Vimsottari' && t.lines);
    if (!texts.length) continue;
    it(chart.name, async () => {
      const c = await computeChart(swe, chart.birth);
      const ctx = { clock: dasaClock(swe, c), tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
      const mds = vimsottari(c.positions.grahas.Moon.lon, 2);
      const bad: string[] = [];
      for (const t of texts) {
        const want = t.lines;
        let have: string[] | null = null;
        if (t.name === 'dasa') have = mahaDasaText('Vimsottari Dasa', mds, ctx);
        const m = /^dasa_level2_(\d+)$/.exec(t.name);
        if (m) have = antarDasaText('Vimsottari Dasa', mds[+m[1]], ctx);
        if (have) bad.push(...compareDasaText(have, want, Number(process.env.DASA_TOL ?? 90)).map((b) => `${t.name}\n${b}`));
      }
      expect(bad.slice(0, 10), bad.slice(0, 10).join('\n')).toEqual([]);
    });
  }
});

describe('nakshatra dasas match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV2Charts()) {
    for (const [mode, def] of Object.entries(NAKSHATRA_DASAS)) {
      const texts = chart.texts.filter((t) => t.sub === 'Nakshatra dasas' && t.mode === mode && t.lines);
      if (!texts.length) continue;
      it(`${chart.name}: ${mode}`, async () => {
        const c = await computeChart(swe, chart.birth);
        const ctx = { clock: dasaClock(swe, c), tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
        const mds = nakshatraDasa(def, c.positions.grahas.Moon.lon, 2);
        const bad: string[] = [];
        for (const t of texts) {
          let have: string[] | null = null;
          if (t.name === 'dasa') have = mahaDasaText(def.title, mds, ctx);
          const m = /^dasa_level2_(\d+)$/.exec(t.name);
          if (m) have = antarDasaText(def.title, mds[+m[1]], ctx);
          if (have) bad.push(...compareDasaText(have, t.lines, Number(process.env.DASA_TOL ?? 90)).map((b) => `${t.name}\n${b}`));
        }
        expect(bad.slice(0, 6), bad.slice(0, 6).join('\n')).toEqual([]);
      });
    }
  }
});

describe('Saptarshi nakshatra dasa matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV2Charts()) {
    const texts = chart.texts.filter((t) => t.sub === 'Nakshatra dasas' && t.mode === 'Saptarshi nakshatra' && t.lines);
    if (!texts.length) continue;
    it(chart.name, async () => {
      const c = await computeChart(swe, chart.birth);
      const ctx = { clock: dasaClock(swe, c), tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
      const mds = saptarshiDasa(c.positions.ascendant, 2, NAKSHATRAS);
      const bad: string[] = [];
      for (const t of texts) {
        let have: string[] | null = null;
        if (t.name === 'dasa') have = mahaDasaText(SAPTARSHI_TITLE, mds, ctx);
        const m = /^dasa_level2_(\d+)$/.exec(t.name);
        if (m) have = antarDasaText(SAPTARSHI_TITLE, mds[+m[1]], ctx);
        if (have) bad.push(...compareDasaText(have, t.lines, 2).map((b) => `${t.name} ${b}`));
      }
      expect(bad.slice(0, 6), bad.slice(0, 6).join(' | ')).toEqual([]);
    });
  }
});

describe('Kalachakra dasa (maha dasas) matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV2Charts()) {
    const t = chart.texts.find((x) => x.sub === 'Nakshatra dasas' && x.mode === 'Kalachakra' && x.name === 'dasa' && x.lines);
    if (!t) continue;
    it(chart.name, async () => {
      const c = await computeChart(swe, chart.birth);
      const ctx = { clock: dasaClock(swe, c), tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
      const k = kalachakraDasa(c.positions.grahas.Moon.lon);
      const bad = compareDasaText(mahaDasaText(k.title, k.periods, ctx), t.lines, Number(process.env.DASA_TOL ?? 90));
      expect(bad.slice(0, 6), bad.slice(0, 6).join(' | ')).toEqual([]);
    });
  }
});

describe('Narayana dasa matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  const { narayanaDasa } = await import('../src/core/dasas/narayana');
  for (const chart of goldenV2Charts()) {
    const texts = chart.texts.filter((t) => t.sub === 'Rasi dasas' && (t.name === 'dasa' || t.name === 'dasa_level2_0') && t.lines);
    if (!texts.length) continue;
    it(chart.name, async () => {
      const c = await computeChart(swe, chart.birth);
      const p = c.positions;
      const ctx = { sign: (g: keyof typeof p.grahas) => Math.floor(p.grahas[g].lon / 30), degree: (g: keyof typeof p.grahas) => p.grahas[g].lon % 30 };
      const dctx = { clock: dasaClock(swe, c), tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
      const n = narayanaDasa(Math.floor(p.ascendant / 30), ctx);
      const bad: string[] = [];
      for (const t of texts) {
        const have = t.name === 'dasa' ? mahaDasaText(n.title, n.periods, dctx) : antarDasaText(n.title, n.periods[0], dctx);
        bad.push(...compareDasaText(have, t.lines, 2).map((b) => `${t.name} ${b}`));
      }
      expect(bad.slice(0, 6), bad.slice(0, 6).join(' | ')).toEqual([]);
    });
  }
});

describe('Moola dasa matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  const { moolaDasa, MOOLA_TITLE } = await import('../src/core/dasas/moola');
  for (const chart of goldenV2Charts()) {
    const texts = chart.texts.filter((t) => t.sub === 'Other dasas' && (t.name === 'dasa' || t.name === 'dasa_level2_0') && t.lines?.[0]?.startsWith('Moola'));
    if (!texts.length) continue;
    it(chart.name, async () => {
      const c = await computeChart(swe, chart.birth);
      const p = c.positions;
      const ctx = { sign: (g: keyof typeof p.grahas) => Math.floor(p.grahas[g].lon / 30), degree: (g: keyof typeof p.grahas) => p.grahas[g].lon % 30 };
      const dctx = { clock: dasaClock(swe, c), tz: chart.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
      const mds = moolaDasa(Math.floor(p.ascendant / 30), ctx);
      const bad: string[] = [];
      for (const t of texts) {
        const have = t.name === 'dasa' ? mahaDasaText(MOOLA_TITLE, mds, dctx) : antarDasaText(MOOLA_TITLE, mds[0], dctx);
        bad.push(...compareDasaText(have, t.lines, 2).map((b) => `${t.name} ${b}`));
      }
      expect(bad.slice(0, 6), bad.slice(0, 6).join(' | ')).toEqual([]);
    });
  }
});
