import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCalcs } from './golden';
import { computeChart } from '../src/core/chart';
import { AV_BODIES, ashtakavarga, type AvBody } from '../src/core/ashtakavarga';

describe('Ashtakavarga matches JHora 8.0 (complete calculations dump)', async () => {
  const swe = await nodeSweph();
  for (const g of goldenCalcs()) {
    it(g.name, async () => {
      const c = await computeChart(swe, g.birth);
      const p = c.positions;
      const sign = (b: AvBody) => Math.floor((b === 'Lagna' ? p.ascendant : p.grahas[b].lon) / 30);
      const av = ashtakavarga(sign);
      const i0 = g.lines.findIndex((l) => l.startsWith('Ashtakavarga of Rasi Chart'));
      const ip = g.lines.findIndex((l) => l.includes('Sodhya Pinda  Rasi Pinda'));
      expect(i0).toBeGreaterThan(0);
      const have: string[] = [], want: string[] = [];
      AV_BODIES.forEach((b, k) => {
        // rows: "As   4   7   2   3*  ..." where * marks the body's own sign
        const row = g.lines[i0 + 3 + k];
        want.push(row.replace(/\*/g, ' ').trim().split(/\s+/).join(' '));
        have.push([row.slice(0, 2), ...av.bav[b]].join(' '));
        const own = row.slice(4).split('').reduce<number[]>((a, ch, i, s) => (ch === '*' ? [...a, Math.floor((i - 2) / 4)] : a), []);
        expect(own, `${b} own-sign marker`).toEqual([sign(b)]);
        want.push(g.lines[ip + 1 + k].trim().split(/\s+/).join(' '));
        const sp = av.pindas[b];
        have.push([row.slice(0, 2), sp.total, sp.rasi, sp.graha].join(' '));
      });
      expect(have).toEqual(want);
    });
  }
});

describe('Ashtakavarga job', async () => {
  const swe = await nodeSweph();
  const { runTable } = await import('../src/engine/jobs');
  it('renders every mode for D-1 and D-9; SAV totals 337', async () => {
    const g = goldenCalcs()[0];
    const c = await computeChart(swe, g.birth);
    for (const varga of ['D1', 'D9']) {
      for (const mode of ['BAVs and SAV', 'SoAV', 'PAV of Sun', 'PAV of Lagna', 'Sodhya pindas']) {
        const t = await runTable(c, 'strengths.ashtakavarga', { mode, varga });
        expect(t.rows.length).toBeGreaterThan(7);
        if (mode === 'BAVs and SAV') expect(t.rows[8].slice(1).reduce((a, x) => a + Number(x), 0)).toBe(337);
      }
    }
  });
});
