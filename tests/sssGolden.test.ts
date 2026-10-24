// SSS (Siddhanta=1) positions against JHora 8.0 output (golden/jhora-sss).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseLongitude } from './golden';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { GRAHAS } from '../src/core/positions';

const DIR = 'golden/jhora-sss';
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

describe.skipIf(files.length === 0)('SSS longitudes match JHora 8.0 (Siddhanta=1)', async () => {
  const swe = await nodeSweph();
  for (const f of files) {
    const g = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
    const jhd = `golden/charts/${g.chart ?? f.replace(/\.json$/, '.jhd')}`;
    it.skipIf(!existsSync(jhd))(f, async () => {
      const birth = parseJhd(readFileSync(jhd, 'latin1'));
      const chart = await computeChart(swe, birth, g.ini_overrides ? Object.fromEntries(
        Object.entries(g.ini_overrides as Record<string, string>).map(([k, v]) => [k, Number(v)])) : { Siddhanta: 1 });
      const rows: string[][] = g.views.find((v: { mode: string | null }) => v.mode === 'Longitudes & Basic Info').rows;
      const row = (label: string) => rows.find((r) => r[0].split(' ')[0] === label)!;
      const check = (label: string, lon: number) =>
        expect(arcsec(lon, parseLongitude(row(label)[1])), `${label}`).toBeLessThan(0.02);
      check('Lagna', chart.positions.ascendant);
      for (const b of GRAHAS) {
        check(b, chart.positions.grahas[b].lon);
        if (b !== 'Rahu' && b !== 'Ketu') expect(chart.positions.grahas[b].retrograde, `${b} (R)`).toBe(row(b)[0].includes('(R)'));
      }
    });
  }
});
