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
 * Dates must agree to 2 s, except for dasas seeded by the Moon, tithi/yoga/karana,
 * Sree Lagna, sunrise or degrees in sign: there a ~0.004" Moon / ~0.1" lagna /
 * few-ms sunrise difference from JHora is magnified, by up to ~2.5 min over a
 * life span (cf. the 90 s of the Vimsottari test).
 */
// Sudasa's balance comes from Sree Lagna, which moves 27x the Moon: JHora's Moon differs
// from ours by ~0.002-0.004" (Swiss Ephemeris versions), i.e. up to ~0.2" of Sree Lagna.
const TOL_SEC: Record<string, number> = { Sudasa: 600 };
const TOLERANT = new Set(['Tara', 'Kaala', 'Patyayini', 'RBV', 'Tithi Ashtottari', 'Yoga Vimsottari', 'Karana Chaturaseeti', 'Tithi Yogini']);

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
            bad.push(...compare(have, t.lines!, TOL_SEC[mode] ?? (TOLERANT.has(mode) ? 180 : 2)).map((b) => `${t.name}: ${b}`));
          }
          expect(bad.slice(0, 4), bad.slice(0, 4).join('\n')).toEqual([]);
        });
      }
    });
  }
});
