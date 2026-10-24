import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';

/** Mode name in JHora's vimsopaka pane -> table id. */
const MODES: Record<string, string> = {
  'Amsa Balas': 'strengths.amsaBalas',
  'Basic Avasthas': 'strengths.basicAvasthas',
  'Sayanadi Avasthas': 'strengths.sayanadi',
  'Pancha-vargeeya Bala': 'strengths.panchaVargeeya',
  'Dwadasa-vargeeya Bala': 'strengths.dwadasaVargeeya',
  'Harsha Bala': 'strengths.harsha',
};
const norm = (s: string) => s.trim().split(/\s+/).join(' ');

describe('Other strengths (vimsopaka pane modes) match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const chart of goldenV3Charts()) {
    const texts = chart.texts.filter((t) => t.sub === 'Other strengths' && t.name === 'vimsopaka' && t.mode && MODES[t.mode] && t.lines?.length);
    for (const t of texts) {
      it(`${chart.name}: ${t.mode}`, async () => {
        const c = await computeChart(swe, chart.birth);
        const table = runTable(c, MODES[t.mode!], {});
        const want = t.lines.slice(2).filter((l) => l.trim()).map(norm);
        const have = table.rows.map((r) => norm(r.join(' ')));
        expect(have).toEqual(want);
      });
    }
  }
});
