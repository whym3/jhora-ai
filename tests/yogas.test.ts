import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';

const norm = (s: string) => s.trim().split(/\s+/).join(' ');

describe('Yogas match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV3Charts()) {
    const texts = chart.texts.filter((t) => t.sub === 'Other strengths' && t.name === 'yogas' && t.mode && t.lines?.length);
    for (const t of texts) {
      it(`${chart.name}: ${t.mode}`, async () => {
        const c = await computeChart(swe, chart.birth);
        const table = runTable(c, 'strengths.yogas', { mode: t.mode });
        const want = t.lines.slice(2).filter((l) => l.trim()).map(norm);
        const have = table.rows.map((r) => norm(r.join(' ')));
        expect(have).toEqual(want);
      });
    }
  }
});
