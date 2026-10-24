import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts, goldenV2Charts, type GoldenChart, type GoldenView } from './golden';
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
  ['basics.sahamas', (c) => c.views.find((v) => v.mode === 'Sahamas'), (r) => r],
  ['basics.pushkara', (c) => c.views.find((v) => v.mode === 'Pushkaramsas'), (r) => r],
  ['basics.mrityuBhaga', (c) => c.views.find((v) => v.mode === 'Mrityu Bhaga'), (r) => r],
  ['basics.drekkanas', (c) => c.views.find((v) => v.mode === 'Planetary drekkanas'), (r) => r],
  ['basics.deities', (c) => c.views.find((v) => v.mode === 'Brahma Rudra Maheswara'), (r) => r],
  ['basics.nakshatraAspects', (c) => c.views.find((v) => v.mode === 'Nakshatra Aspects & Latta'), (r) => r],
  ['basics.specialTithis', (c) => c.views.find((v) => v.mode === 'Special Tithis'), (r) => r],
  ['basics.grahaYuddha', (c) => c.views.find((v) => v.mode === 'Graha Yuddha'), (r) => r],
  // only the rows we compute so far (Parasara drekkana and navamsa, from lagna and Moon)
  ['basics.malicious', (c) => c.views.find((v) => v.mode === '64th navamsa and 22nd drekkana'),
    (rows) => rows.filter((r) => /^The (64th navamsa|22nd Para(r)?sara drekkana)( from Moon)?$/.test(r[0]))],
];

/**
 * Longitudes are already verified elsewhere to 0.03"; compare them to the minute here.
 * Degree distances ("9.6110 deg") are compared to the last printed digit.
 */
function expectRowsClose(have: string[][], want: string[][]) {
  const loose = (cells: string[]) => cells.map((c) => c.replace(/(\d+ \w\w \d+') \d+\.\d+"/, '$1').replace(/^(\d+\.\d{4}) deg$/, 'DEG'));
  expect(have.map(loose)).toEqual(want.map(loose));
  const bad: string[] = [];
  want.forEach((r, i) => r.forEach((cell, j) => {
    const m = /^(\d+\.\d{4}) deg$/.exec(cell);
    if (m && Math.abs(+m[1] - parseFloat(have[i][j])) > 0.0001 + 1e-9) bad.push(`${r[0]}: ${have[i][j]} vs ${cell}`);
  }));
  expect(bad, bad.join('\n')).toEqual([]);
}

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
        expectRowsClose(have, want);
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
        const n = (golden.headers[j + 1].match(/\d+/g) ?? ['1']).map(Number).reduce((a, b) => a * b, 1);
        // to the minute; Kunda is lagna x 81 (so x81n in D-n)
        const tol = /Kunda/.test(r[0]) ? 1 + n / 40 : 1;
        if (a.sign !== b.sign || Math.abs(a.minutes - b.minutes) > tol) bad.push(`${r[0].trim()} ${golden.headers[j + 1]}: ${got.rows[i][j + 1]} vs ${cell}`);
      }));
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});

describe('Rasis occupied in all vargas (with arudhas) matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenCharts()) {
    it(chart.name, async () => {
      const got = runTable(await computeChart(swe, chart.birth), 'basics.rasisInVargas', {});
      const golden = chart.views.find((v) => v.mode === 'Rasis occupied in all vargas')!;
      expect(got.headers).toEqual(golden.headers);
      expect(got.rows.map((r) => r[0])).toEqual(golden.rows.map((r) => r[0].trim()));
      const bad: string[] = [];
      golden.rows.forEach((r, i) => r.slice(1).forEach((cell, j) => {
        if (!cell) return;
        if (got.rows[i][j + 1] !== cell) bad.push(`${r[0].trim()} ${golden.headers[j + 1]}: ${got.rows[i][j + 1]} vs ${cell}`);
      }));
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});

describe('Amsa rulers (D-150) match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV2Charts()) {
    const text = chart.texts.find((t) => t.sub === 'Amsa rulers');
    if (!text) continue;
    it(chart.name, async () => {
      const got = runTable(await computeChart(swe, chart.birth), 'basics.amsaRulers', {});
      // JHora's rows use a single space before the number when the name is long: parse by regex
      const want = text.lines.slice(2).filter((l) => l.trim()).map((l) => /^(.*?)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(l)!.slice(1));
      expect(got.rows.map((r) => r[0])).toEqual(want.map((r) => r[0]));
      // The varnada rows reflect an internal JHora longitude that is not the displayed one
      // (their "Division" is 1..12); we compute them from the displayed longitude instead.
      const cmp = (rows: string[][]) => rows.filter((r) => !/^V(arnada|\d)/.test(r[0]));
      expect(cmp(got.rows)).toEqual(cmp(want));
    });
  }
});
