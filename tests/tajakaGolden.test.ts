// Tajaka charts against JHora: golden/jhora-tajaka (annual chart of 2000, "Find Tajaka
// Chart") and golden/jhora-tajaka-month (June 2000 monthly sunrise chart).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseLongitude } from './golden';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { computeTajakaChart, type TajakaSelection, type TajakaVariant } from '../src/core/tajaka/annual';
import { compressPeriods, jhoraSunClock, muddaDasa, tajakaCompression } from '../src/core/tajaka/mudda';
import type { DasaClock } from '../src/core/dasas/time';
import { mahaDasaText } from '../src/core/dasas/format';
import { patyayiniDasa, PATYAYINI_TITLE } from '../src/core/dasas/patyayini';
import { runTable } from '../src/engine/jobs';

interface Captured { name: string; views: { sub: string; mode: string; rows: string[][] }[]; texts: { sub: string; mode?: string; name?: string; lines?: string[] }[] }
const load = (dir: string): Captured[] => (existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ name: f.slice(0, -5), ...JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) }))
  : []);
const norm = (s: string) => s.trim().split(/\s+/).join(' ');
const re = /(\d{4})-(\d\d)-(\d\d) \((\d+):(\d\d):(\d\d)\)/g;
const secs = (m: RegExpMatchArray) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
function sameTimes(have: string[], want: string[], tol: number): string[] {
  return want.flatMap((w, i) => {
    const h = have[i] ?? '';
    const a = [...w.matchAll(re)], b = [...h.matchAll(re)];
    return h.replace(re, 'T') === w.replace(re, 'T') && a.length === b.length && a.every((m, k) => Math.abs(secs(m) - secs(b[k])) <= tol) ? [] : [`have ${h.trim()} | want ${w.trim()}`];
  });
}


function suite(title: string, charts: Captured[], sel: TajakaSelection, variant: TajakaVariant) {
  describe.skipIf(!charts.length)(title, async () => {
    const swe = await nodeSweph();
    for (const g of charts) {
      describe(g.name, async () => {
        const natal = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${g.name}.jhd`, 'latin1')));
        const t = await computeTajakaChart(swe, natal, sel, variant);
        const ctx = (clock: DasaClock) => ({ clock, tz: natal.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) });
        it('planet longitudes (within 0.5": the return search is ported from jhora.exe)', () => {
          const table = g.views.find((v) => v.sub === 'Key Info' && v.mode === 'Longitudes & Basic Info')!;
          const ours = runTable(t.chart, 'basics.longitudes', {});
          for (let i = 0; i < 10; i++) {
            const d = Math.abs(((parseLongitude(ours.rows[i][1]) - parseLongitude(table.rows[i][1]) + 540) % 360) - 180) * 3600;
            expect(d, `${table.rows[i][0]}: ${ours.rows[i][1]} vs ${table.rows[i][1]}`).toBeLessThan(0.5);
          }
        });
        it('Mudda dasa (times within 5 s)', () => {
          const want = g.texts.find((x) => x.mode === 'Vimsottari' && x.name === 'dasa')!.lines!;
          const m = muddaDasa(swe, t);
          expect(sameTimes(mahaDasaText(m.title, m.periods, ctx(m.clock)), want, 5)).toEqual([]);
        });
        it('Patyayini dasa (compressed into the chart span, times within 5 s)', () => {
          const want = g.texts.find((x) => x.mode === 'Patyayini' && x.name === 'dasa')!.lines!;
          const periods = compressPeriods(patyayiniDasa(t.chart, 2), tajakaCompression(swe, t) / 120);
          expect(sameTimes(mahaDasaText(PATYAYINI_TITLE, periods, ctx(jhoraSunClock(swe, t.chart))), want, 5)).toEqual([]);
        });
        for (const [mode, table] of [['Pancha-vargeeya Bala', 'strengths.panchaVargeeya'], ['Dwadasa-vargeeya Bala', 'strengths.dwadasaVargeeya'], ['Harsha Bala', 'strengths.harsha']]) {
          // A sunrise chart is cast at the computed sunrise; whether it is a day or night birth
          // (Harsha bala) depends on JHora's rise-search order, which day.ts reproduces.
          it.skipIf(!g.texts.some((x) => x.mode === mode && x.name === 'vimsopaka'))(mode, () => {
            const want = g.texts.find((x) => x.mode === mode && x.name === 'vimsopaka')!.lines!.slice(2).filter((l) => l.trim()).map(norm);
            expect(runTable(t.chart, table, {}).rows.map((r) => norm(r.join(' ')))).toEqual(want);
          });
        }
      });
    }
  });
}

suite('Tajaka annual chart (2000) matches JHora 8.0', load('golden/jhora-tajaka'), { year: 2000 }, 'exact');
// golden/jhora-tajaka-month: Year 2000, Month combo index 6 (June), "Find Tajaka Sunrise Chart" (button 1014)
suite('Tajaka monthly sunrise chart (June 2000) matches JHora 8.0', load('golden/jhora-tajaka-month'), { year: 2000, month: 6 }, 'sunrise');
