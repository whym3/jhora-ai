import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV2Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';

/** table id -> JHora "Other strengths" mode name */
const MODES: [string, string][] = [
  ['strengths.shadbalaSummary', 'Shadbala Summary'], ['strengths.shadbalaBreakup', 'Shadbala Break-up'], ['strengths.sthana', 'Sthana Bala'],
  ['strengths.kaala', 'Kaala Bala'], ['strengths.dig', 'DigBala'], ['strengths.cheshta', 'Cheshta Bala'], ['strengths.drig', 'DrigBala'],
  ['strengths.naisargika', 'Naisargika Bala'], ['strengths.bhava', 'Bhava balas'], ['strengths.ishtaKashta', 'Ishta-Kashta Phala'], ['strengths.rashmis', 'Rashmis'],
];

describe('shadbala tables match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV2Charts()) {
    const computed = computeChart(swe, chart.birth);
    for (const [table, mode] of MODES) {
      const golden = chart.views.find((v) => v.mode === mode);
      if (!golden) continue;
      it(`${chart.name}: ${mode}`, async () => {
        const got = runTable(await computed, table, {});
        expect(got.headers).toEqual(golden.headers);
        const bad: string[] = [];
        golden.rows.forEach((r, i) => r.forEach((cell, j) => {
          const have = got.rows[i]?.[j];
          if (j === 0) { if (have !== cell.trim()) bad.push(`${r[0]}: ${have} vs ${cell}`); return; }
          // printed to 2 decimals; allow the last digit to differ (sunrise residuals, float order)
          if (Math.abs(parseFloat(have) - parseFloat(cell)) > 0.011) bad.push(`${r[0]} ${golden.headers[j]}: ${have} vs ${cell}`);
        }));
        expect(bad, bad.join('\n')).toEqual([]);
      });
    }
  }
});

describe('vimsopaka balas match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV2Charts()) {
    const golden = chart.views.find((v) => v.headers[0] === 'Vimsopaka');
    if (!golden) continue;
    it(chart.name, async () => {
      const got = runTable(await computeChart(swe, chart.birth), 'strengths.vimsopaka', {});
      expect(got.headers).toEqual(golden.headers);
      const bad: string[] = [];
      golden.rows.forEach((r, i) => r.slice(1).forEach((cell, j) => {
        const have = got.rows[i][j + 1];
        if (Math.abs(parseFloat(have) - parseFloat(cell)) > 0.011) bad.push(`${r[0]} ${golden.headers[j + 1]}: ${have} vs ${cell}`);
      }));
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});
