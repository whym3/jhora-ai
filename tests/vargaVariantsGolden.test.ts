// Divisional-chart variants against JHora 8.0: Key Info's "All Divisional Longitudes"
// and "Rasis occupied in all vargas" captured with each varga preference
// (tools/harness/views-vargas.json -> golden/jhora-vargas/<Key>-<value>/<chart>.json).
// Skipped until those captures exist.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import type { JhoraIni } from '../src/settings/generated';
import type { GoldenView } from './golden';

const ROOT = 'golden/jhora-vargas';
const SIGNS = 'Ar Ta Ge Cn Le Vi Li Sc Sg Cp Aq Pi'.split(' ');

interface Capture { dir: string; chart: string; ini: Partial<JhoraIni>; views: GoldenView[] }
function captures(): Capture[] {
  if (!existsSync(ROOT)) return [];
  const out: Capture[] = [];
  for (const dir of readdirSync(ROOT)) {
    if (!existsSync(`${ROOT}/${dir}`) || dir.includes('.')) continue;
    for (const f of readdirSync(`${ROOT}/${dir}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${dir}/${f}`, 'utf8'));
      const ini = Object.fromEntries(Object.entries(g.ini_overrides ?? {}).map(([k, v]) => [k, Number(v)])) as Partial<JhoraIni>;
      out.push({ dir, chart: f.replace(/\.json$/, ''), ini, views: g.views });
    }
  }
  return out;
}

/** " 9Li39" -> sign and minutes within the sign */
const parseShort = (s: string) => {
  const m = /(\d+)(\w\w)(\d+)/.exec(s);
  return m ? { sign: SIGNS.indexOf(m[2]), minutes: +m[1] * 60 + +m[3] } : null;
};

const all = captures();

describe.skipIf(all.length === 0)('varga variants match JHora 8.0 (golden/jhora-vargas)', () => {
  for (const c of all) {
    it(`${c.dir} / ${c.chart}`, async () => {
      const swe = await nodeSweph();
      const birth = parseJhd(readFileSync(`golden/charts/${c.chart}.jhd`, 'latin1'));
      const chart = await computeChart(swe, birth, c.ini);

      const want = c.views.find((v) => v.mode === 'All Divisional Longitudes')!;
      const got = runTable(chart, 'basics.allDivisionalLongitudes', {});
      expect(got.headers, 'column labels').toEqual(want.headers);
      let checked = 0;
      want.rows.forEach((row, r) => {
        expect(got.rows[r][0].trim(), 'row label').toBe(row[0].trim());
        for (let i = 1; i < row.length; i++) {
          const w = parseShort(row[i]), g = parseShort(got.rows[r][i]);
          if (!w) continue;
          // the D-1 longitudes JHora starts from carry 0.01"; D-40..D-144 amplify that
          expect(g?.sign, `${row[0]} ${want.headers[i]} sign (${got.rows[r][i]} vs ${row[i]})`).toBe(w.sign);
          expect(Math.abs(g!.minutes - w.minutes), `${row[0]} ${want.headers[i]} ${got.rows[r][i]} vs ${row[i]}`).toBeLessThanOrEqual(1);
          checked++;
        }
      });
      expect(checked).toBeGreaterThan(1000);

      const wantR = c.views.find((v) => v.mode === 'Rasis occupied in all vargas')!;
      const gotR = runTable(chart, 'basics.rasisInVargas', {});
      expect(gotR.headers).toEqual(wantR.headers);
      wantR.rows.forEach((row, r) => {
        row.forEach((cell, i) => {
          if (i === 0 || !cell) return;
          expect(gotR.rows[r]?.[i], `${row[0]} ${wantR.headers[i]}`).toBe(cell);
        });
      });
    });
  }
});
