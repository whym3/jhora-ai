// Rasi and other dasas against JHora's own dasa texts (golden/jhora-dasas):
// the maha dasa list and the antardasas of the first two maha dasas.
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenDasaCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { dasaClock } from '../src/core/dasas/time';
import { antarDasaText, mahaDasaText } from '../src/core/dasas/format';
import { OTHER_DASAS, RASI_DASAS, type DasaBuilder } from '../src/core/dasas/registry';

/** Harness mode label -> registry builder. */
const BUILDERS: Record<string, DasaBuilder> = {
  ...RASI_DASAS, ...OTHER_DASAS,
  'Chara (KN Rao)': RASI_DASAS['Chara (K.N. Rao)'], 'Niryaana shoola': RASI_DASAS['Niryaana Shoola'],
  'Mandooka D-11': RASI_DASAS['Mandooka (D-11)'], 'Mandooka (KN Rao)': RASI_DASAS['Mandooka (K.N. Rao)'],
  'Buddhi gati': OTHER_DASAS['Buddhi Gati'], RBV: OTHER_DASAS['Rasi-Bhukta Vimsottari'],
};

/** Lines equal up to `tolSec` seconds in the "(h:mm:ss)" times. */
function compare(have: string[], want: string[], tolSec: number): string[] {
  const bad: string[] = [];
  const re = /(\d{4})-(\d\d)-(\d\d) \((\d+):(\d\d):(\d\d)\)/g;
  const secs = (m: RegExpMatchArray) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
  want.forEach((w, i) => {
    const h = have[i] ?? '';
    if (h === w) return;
    const hw = [...w.matchAll(re)], hh = [...h.matchAll(re)];
    if (h.replace(re, 'T') !== w.replace(re, 'T') || hw.length !== hh.length || hw.some((m, k) => Math.abs(secs(m) - secs(hh[k])) > tolSec)) bad.push(`have: ${h.trim()} | want: ${w.trim()}`);
  });
  return bad;
}

/**
 * Dates must agree to 2 s, except for dasas seeded by the Moon, tithi/karana or
 * degrees in sign, where tiny input differences are magnified over a life span.
 * With the Moon (tools/sweph-patches/0001) and delta-T (deltat.ts) identical to
 * JHora's DLL these agree to 3 s.
 */
// Sudasa's balance comes from Sree Lagna (27x the Moon) and Kaala's k from the birth time
// within the day (a sunrise error is stretched by each 45-year cycle); both agree to 2 s.
const TOLERANT = new Set(['Patyayini', 'Karana Chaturaseeti', 'Tithi Yogini']);

describe('Rasi and other dasas match JHora 8.0', async () => {
  const swe = await nodeSweph();
  const charts = goldenDasaCharts();
  const modes = [...new Set(charts.flatMap((c) => c.texts.filter((t) => t.name === 'dasa' && t.mode).map((t) => t.mode!)))];
  for (const mode of modes) {
    describe(mode, () => {
      for (const g of charts) {
        const texts = g.texts.filter((t) => t.mode === mode && t.lines && /^dasa(_level2_\d+)?$/.test(t.name ?? ''));
        if (!texts.length) continue;
        it(g.name, async () => {
          const build = BUILDERS[mode];
          expect(build, `no builder for ${mode}`).toBeDefined();
          const c = await computeChart(swe, g.birth);
          const d = build(c, 2);
          const dctx = { clock: dasaClock(swe, c), tz: g.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
          const bad: string[] = [];
          for (const t of texts) {
            const k = t.name === 'dasa' ? -1 : Number(t.name!.split('_').pop());
            const have = k < 0 ? mahaDasaText(d.title, d.periods, dctx) : antarDasaText(d.title, d.periods[k], dctx);
            bad.push(...compare(have, t.lines!, TOLERANT.has(mode) ? 3 : 2).map((b) => `${t.name}: ${b}`));
          }
          expect(bad.slice(0, 4), bad.slice(0, 4).join('\n')).toEqual([]);
        });
      }
    });
  }
});
