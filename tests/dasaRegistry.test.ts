// Every registered rasi/other dasa builds three levels with contiguous, finite periods.
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { OTHER_DASAS, RASI_DASAS } from '../src/core/dasas/registry';
import type { Period } from '../src/core/dasas/vimsottari';

function check(ps: Period[], depth: number): string[] {
  const bad: string[] = [];
  ps.forEach((p, i) => {
    if (!Number.isFinite(p.start) || !Number.isFinite(p.end) || p.end < p.start) bad.push(`bad span ${p.label}`);
    if (i > 0 && Math.abs(ps[i - 1].end - p.start) > 1e-9) bad.push(`gap before ${p.label}`);
    if (depth > 1) {
      if (!p.children?.length) bad.push(`no children under ${p.label}`);
      else {
        if (Math.abs(p.children[0].start - p.start) > 1e-9 || Math.abs(p.children[p.children.length - 1].end - p.end) > 1e-9) bad.push(`children of ${p.label} do not fill it`);
        bad.push(...check(p.children, depth - 1));
      }
    }
  });
  return bad;
}

describe('dasa registry builds', async () => {
  const swe = await nodeSweph();
  const charts = goldenV3Charts().slice(0, 4);
  for (const [name, build] of [...Object.entries(RASI_DASAS), ...Object.entries(OTHER_DASAS)]) {
    it(name, async () => {
      for (const g of charts) {
        const d = build(await computeChart(swe, g.birth), 3);
        expect(d.title.length).toBeGreaterThan(0);
        expect(d.periods.length).toBeGreaterThanOrEqual(7);
        // JHora gives each Rasi-Bhukta pratyantardasa a whole antardasa's length (ported as is)
        const bad = check(d.periods, name === 'Rasi-Bhukta Vimsottari' ? 2 : 3);
        expect(bad.slice(0, 5), `${g.name}: ${bad.slice(0, 5).join('; ')}`).toEqual([]);
      }
    });
  }
});
