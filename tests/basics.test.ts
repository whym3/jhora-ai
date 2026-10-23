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
