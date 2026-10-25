// Longitudes under each ayanamsa choice against JHora 8.0's Key Info
// (golden/jhora-ayanamsa/<mode>/<chart>.json, captured by
// tools/harness/capture-ayanamsa.ps1 with tools/harness/views-ayanamsa.json).
// Skipped until those captures exist.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseLongitude } from './golden';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { GRAHAS, nakshatraShift, norm360 } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { NAKSHATRAS, nakshatraOf } from '../src/core/zodiac';
import type { JhoraIni } from '../src/settings/generated';

const DIR = 'golden/jhora-ayanamsa';
const runs = existsSync(DIR)
  ? readdirSync(DIR).flatMap((m) => (existsSync(`${DIR}/${m}`) ? readdirSync(`${DIR}/${m}`) : [])
    .filter((f) => f.endsWith('.json')).map((f) => `${m}/${f}`))
  : [];
const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

/** The capture's --ini overrides, typed (CustomStarCode is the only string key). */
function overrides(raw: Record<string, string>): Partial<JhoraIni> {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, k === 'CustomStarCode' ? v : Number(v)])) as Partial<JhoraIni>;
}

/** "23-06-37.20" (Key Info's Ayanamsa line) to degrees. */
function parseAyanamsa(s: string): number {
  const m = /(-?)(\d+)-(\d+)-([\d.]+)/.exec(s);
  if (!m) throw new Error(`bad ayanamsa ${s}`);
  return (m[1] ? -1 : 1) * (+m[2] + +m[3] / 60 + +m[4] / 3600);
}

describe.skipIf(runs.length === 0)('longitudes match JHora 8.0 under every ayanamsa', async () => {
  const swe = await nodeSweph();
  for (const run of runs) {
    const g = JSON.parse(readFileSync(`${DIR}/${run}`, 'utf8'));
    const jhd = `golden/charts/${g.chart}`;
    it.skipIf(!existsSync(jhd))(run, async () => {
      const birth = parseJhd(readFileSync(jhd, 'latin1'));
      const ini = overrides(g.ini_overrides ?? {});
      const chart = await computeChart(swe, birth, ini);
      const p = chart.positions;
      const rows: string[][] = g.views.find((v: { mode: string | null }) => v.mode === 'Longitudes & Basic Info').rows;
      const row = (label: string) => rows.find((r) => r[0].split(' ')[0] === label)!;
      const check = (label: string, lon: number, tol = 0.03) =>
        expect(arcsec(lon, parseLongitude(row(label)[1])), label).toBeLessThan(tol);
      check('Lagna', p.ascendant, 0.2);
      for (const b of GRAHAS) check(b, p.grahas[b].lon);

      const keyInfo: string[] = g.texts.find((t: { name: string }) => t.name === 'key_info')?.lines ?? [];
      const ay = keyInfo.find((l) => l.startsWith('Ayanamsa:'));
      if (ay) expect(arcsec(p.ayanamsaMean, parseAyanamsa(ay)), 'Ayanamsa').toBeLessThan(0.011);

      // SiderealNaksharasInTropical: the nakshatra column uses the Spica-fixed zodiac
      const shift = nakshatraShift(swe, p.jdUt, calcSettingsFromIni(ini));
      for (const b of GRAHAS) expect(NAKSHATRAS[nakshatraOf(norm360(p.grahas[b].lon + shift))], `${b} nakshatra`).toBe(row(b)[2]);
    });
  }
});
