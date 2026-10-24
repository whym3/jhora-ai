// Derived-chart tabs against JHora 8.0 (golden/jhora-derived, 6 charts):
// * Tithi Pravesha annual chart of 2000 (form: edit 100 = 2000, combo 1003 = 0, click 1000):
//   Key Info text, Longitudes & Basic Info ('TP annual 2000') and the compressed Vimsottari
//   dasa texts ('TP Vimsottari': dasa 32972, dasa_dates 33236, dasa_level2_0).
// * Miscellany > Panchanga: monthly panchanga copy of the natal month ('monthly_jd', cmd 33086).
//   The captured text is in FUN_0046a150's layout ("Copy monthly panchanga", our
//   'panchanga.monthly'), not the tab-separated JD layout ('panchanga.monthlyJd', unverified).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseLongitude } from './golden';
import { parseJhd, type BirthData } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { keyInfoText } from '../src/core/keyInfo';
import { runTable } from '../src/engine/jobs';
import { TP_JOBS } from '../src/core/derived/tpPrasnaJobs';
import { PANCHANGA_JOBS } from '../src/core/derived/panchangaJobs';

interface Captured { name: string; views: { sub: string; mode: string; rows: string[][] }[]; texts: { sub: string; mode?: string | null; name?: string; lines?: string[] }[] }
const DIR = 'golden/jhora-derived';
const charts: Captured[] = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => ({ name: f.slice(0, -5), ...JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) }))
  : [];
const re = /(\d{4})-(\d\d)-(\d\d) \((\d+):(\d\d):(\d\d)\)/g;
const secs = (m: RegExpMatchArray) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
function sameTimes(have: string[], want: string[], tol: number): string[] {
  return want.flatMap((w, i) => {
    const h = have[i] ?? '';
    const a = [...w.matchAll(re)], b = [...h.matchAll(re)];
    return h.replace(re, 'T') === w.replace(re, 'T') && a.length === b.length && a.every((m, k) => Math.abs(secs(m) - secs(b[k])) <= tol) ? [] : [`have ${h.trim()} | want ${w.trim()}`];
  });
}
const text = (g: Captured, name: string, mode?: string) => g.texts.find((t) => t.name === name && (mode === undefined || t.mode === mode) && t.lines)!.lines!;

describe.skipIf(!charts.length)('Derived charts match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const g of charts) {
    describe(g.name, async () => {
      const natal = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${g.name}.jhd`, 'latin1')));
      const found = await TP_JOBS['tithiPravesha.find'](natal, { mode: 'year', selection: { year: 2000 } }, swe);
      const { birth, label, periodDays } = JSON.parse(found.text![0]) as { birth: BirthData; label: string; periodDays: number };
      const tp = await computeChart(swe, birth, natal.ini);

      it('Tithi Pravesha 2000: Key Info text of the TP chart (name, date, time, panchanga, ayanamsa)', () => {
        const want = text(g, 'key_info', 'TP annual 2000');
        expect(label).toBe(want[2].trim());
        // JHora's copy: chart file, '', chart name, '', Date ... Sidereal Time; ours starts at 'Natal Chart', ''
        const block = want.slice(4, want.findIndex((l) => l.startsWith('Sidereal Time:')) + 1);
        expect(keyInfoText(swe, tp).slice(2)).toEqual(block);
      });

      it('Tithi Pravesha 2000: longitudes within 0.5"', () => {
        const table = g.views.find((v) => v.sub === 'Key Info' && v.mode === 'TP annual 2000')!;
        const ours = runTable(tp, 'basics.longitudes', {});
        for (let i = 0; i < 10; i++) {
          const d = Math.abs(((parseLongitude(ours.rows[i][1]) - parseLongitude(table.rows[i][1]) + 540) % 360) - 180) * 3600;
          expect(d, `${table.rows[i][0]}: ${ours.rows[i][1]} vs ${table.rows[i][1]}`).toBeLessThan(0.5);
        }
      });

      it('Tithi Pravesha 2000: compressed Vimsottari (maha and antar dasas)', async () => {
        const md = await TP_JOBS['tithiPravesha.dasa'](natal, { birth, label, periodDays, path: [] }, swe);
        expect(sameTimes(md.text!, text(g, 'dasa', 'TP Vimsottari'), 5)).toEqual([]);
        // dates-only copy (33236): " Merc:  2000-09-16  -  2000-11-10"
        const dates = md.text!.map((l) => l.replace(/ \(\d+:\d\d:\d\d\)/g, '').replace(/^( \S+): (\d)/, '$1:  $2').replace(/(\d) - (\d)/, '$1  -  $2'));
        expect(dates.map((l) => l.trimEnd())).toEqual(text(g, 'dasa_dates', 'TP Vimsottari').map((l) => l.trimEnd()));
        const ad = await TP_JOBS['tithiPravesha.dasa'](natal, { birth, label, periodDays, path: [0] }, swe);
        expect(sameTimes(ad.text!, text(g, 'dasa_level2_0', 'TP Vimsottari'), 5)).toEqual([]);
      });

      it('Panchanga: monthly panchanga of the natal month', async () => {
        const want = text(g, 'monthly_jd');
        const t = await PANCHANGA_JOBS['panchanga.monthly'](natal, {}, swe);
        const have = t.text!;
        const diff = want.flatMap((w, i) => (w.trimEnd() === (have[i] ?? '').trimEnd() ? [] : [`${i}: have ${have[i]} | want ${w}`]));
        expect(diff).toEqual([]);
      });
    });
  }
});
