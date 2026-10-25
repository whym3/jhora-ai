// Edit > "User defined special point" and "Planetary Special Lagnas (research)" against
// JHora 8.0: Key Info's Longitudes table with the user bodies switched on, captured once per
// ini setting (tools/harness/views-userpoints.json -> golden/jhora-userpoints/<run>/<chart>.json).
// Skipped until those captures exist.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseLongitude, type GoldenView } from './golden';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import type { JhoraIni } from '../src/settings/generated';

const ROOT = 'golden/jhora-userpoints';

interface Capture { run: string; chart: string; ini: Partial<JhoraIni>; views: GoldenView[] }
function captures(): Capture[] {
  if (!existsSync(ROOT)) return [];
  const out: Capture[] = [];
  for (const run of readdirSync(ROOT)) {
    if (run.includes('.')) continue;
    for (const f of readdirSync(`${ROOT}/${run}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${run}/${f}`, 'utf8'));
      const ini = Object.fromEntries(Object.entries(g.ini_overrides ?? {}).map(([k, v]) => [k, /^-?[\d.]+$/.test(String(v)) ? Number(v) : v])) as Partial<JhoraIni>;
      out.push({ run, chart: f.replace(/\.json$/, ''), ini, views: g.views });
    }
  }
  return out;
}

const all = captures();

describe.skipIf(all.length === 0)('user bodies match JHora 8.0 (golden/jhora-userpoints)', () => {
  for (const c of all) {
    it(`${c.run} / ${c.chart}`, async () => {
      const swe = await nodeSweph();
      const birth = parseJhd(readFileSync(`golden/charts/${c.chart}.jhd`, 'latin1'));
      const chart = await computeChart(swe, birth, c.ini);
      const want = c.views.find((v) => v.mode === 'Longitudes & Basic Info')!;
      const extra = want.rows.slice(56);
      expect(extra.map((r) => r[0].trim()), 'user body rows').toEqual((chart.userPoints ?? []).map((u) => u.name));
      extra.forEach((row, i) => {
        const diff = Math.abs(((parseLongitude(row[1]) - chart.userPoints![i].lon + 540) % 360) - 180) * 3600;
        expect(diff, `${row[0]}: ${row[1]}`).toBeLessThanOrEqual(1);
      });
    });
  }
});
