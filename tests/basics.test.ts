import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts, type GoldenChart, type GoldenView } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';

/** Table id -> how to find JHora's golden table for it. */
const CASES: [string, (c: GoldenChart) => GoldenView | undefined, (rows: string[][]) => string[][]][] = [
  ['basics.houses', (c) => c.views.find((v) => v.headers[0] === 'House'), (r) => r],
  ['basics.kp', (c) => c.views.find((v) => v.headers[0] === 'Body/Cusp'), (r) => r],
  ['basics.charaKarakas', (c) => c.views.find((v) => v.mode === 'Chara Karakas'), (r) => r],
  ['basics.navaTarasMoon', (c) => c.views.find((v) => v.mode === 'Nava Taras (from Moon)'), (r) => r],
  ['basics.specialTarasMoon', (c) => c.views.find((v) => v.mode === 'Special Taras (from Moon)'), (r) => r],
  ['basics.yogi', (c) => c.views.find((v) => v.mode === 'Yogi, Sahayogi, Avayogi'), (r) => r],
  ['basics.combustion', (c) => c.views.find((v) => v.mode === 'Combustion'), (r) => r],
  ['basics.grahaYuddha', (c) => c.views.find((v) => v.mode === 'Graha Yuddha'), (r) => r],
  // only the rows we compute so far (Parasara drekkana and navamsa, from lagna and Moon)
  ['basics.malicious', (c) => c.views.find((v) => v.mode === '64th navamsa and 22nd drekkana'),
    (rows) => rows.filter((r) => /^The (64th navamsa|22nd Para(r)?sara drekkana)( from Moon)?$/.test(r[0]))],
];

describe('basic tables match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenCharts()) {
    const computed = computeChart(swe, chart.birth);
    for (const [table, find, pick] of CASES) {
      it(`${chart.name}: ${table}`, async () => {
        const golden = find(chart);
        expect(golden, 'golden table').toBeDefined();
        const got = runTable(await computed, table, {});
        expect(got.headers).toEqual(golden!.headers);
        const want = pick(golden!.rows).map((r) => r.map((c) => c.trim()));
        const have = got.rows.map((r) => r.map((c) => c.trim()));
        // longitudes are already verified elsewhere to 0.03"; compare them to the minute here
        const loose = (cells: string[]) => cells.map((c) => c.replace(/(\d+ \w\w \d+') \d+\.\d+"/, '$1'));
        expect(have.map(loose)).toEqual(want.map(loose));
      });
    }
  }
});

describe('All Divisional Longitudes table matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  const parseShort = (s: string) => { const m = /(\d+)(\w\w)(\d+)/.exec(s)!; return { sign: m[2], minutes: +m[1] * 60 + +m[3] }; };
  for (const chart of goldenCharts()) {
    it(chart.name, async () => {
      const got = runTable(await computeChart(swe, chart.birth), 'basics.allDivisionalLongitudes', {});
      const golden = chart.views.find((v) => v.mode === 'All Divisional Longitudes')!;
      expect(got.headers).toEqual(golden.headers);
      expect(got.rows.map((r) => r[0])).toEqual(golden.rows.map((r) => r[0].trim()));
      const bad: string[] = [];
      golden.rows.forEach((r, i) => r.slice(1).forEach((cell, j) => {
        const a = parseShort(got.rows[i][j + 1]), b = parseShort(cell);
        // D-n multiplies the sunrise-derived bodies' small residuals (up to 1.4" x 144)
        const n = (golden.headers[j + 1].match(/\d+/g) ?? ['1']).map(Number).reduce((a, b) => a * b, 1);
        // Kunda is lagna x 81 (so x81n in D-n); the vighati/pranapada lagnas carry the sunrise residual x4
        const tol = /Kunda/.test(r[0]) ? 1 + n / 4 : /Vighati|Pranapada/.test(r[0]) ? 1 + n / 8 : 1 + n / 40;
        if (a.sign !== b.sign || Math.abs(a.minutes - b.minutes) > tol) bad.push(`${r[0].trim()} ${golden.headers[j + 1]}: ${got.rows[i][j + 1]} vs ${cell}`);
      }));
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});
