// Planetary Aspect Evaluation (Basics > Key Info mode 33296) against JHora 8.0's list view
// (golden/jhora-dasas, all 18 charts). Cells must match exactly, except:
// * longitudes agree to the last printed digit (0.01"; Kunda is the lagna x 81);
// * "-" (JHora: the value is exactly 0) and " 0.00%" are the same: on an exact sign
//   boundary ("6th from Sun" on the Sun) the result depends on the last bit of the
//   longitudes, which JHora's x87 arithmetic and ours do not share.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseLongitude } from './golden';
import { computeChart } from '../src/core/chart';
import { parseJhd } from '../src/core/jhd';
import { runTable } from '../src/engine/jobs';

const DIR = 'golden/jhora-dasas';

describe('Planetary Aspect Evaluation matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
    const name = f.slice(0, -5);
    it(name, async () => {
      const golden = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')).views.find((v: { mode: string }) => v.mode === 'Planetary Aspect Evaluation');
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      const got = runTable(chart, 'aspects.evaluation', {});
      expect(got.headers).toEqual(golden.headers);
      expect(got.rows.map((r) => r[0].trim())).toEqual(golden.rows.map((r: string[]) => r[0].trim()));
      const zero = (s: string) => (s.trim() === '-' ? '0.00%' : s.trim());
      const bad: string[] = [];
      golden.rows.forEach((r: string[], i: number) => r.slice(1).forEach((cell, k) => {
        const have = got.rows[i][k + 1];
        const ok = k === 0 ? Math.abs(((parseLongitude(have) - parseLongitude(cell) + 540) % 360) - 180) * 3600 <= 0.0101 : zero(have) === zero(cell);
        if (!ok) bad.push(`${r[0].trim()} / ${golden.headers[k + 1]}: ${have} vs ${cell}`);
      }));
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }
});
