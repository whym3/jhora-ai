// Transits tab against JHora 8.0 (golden/jhora-derived, captured with the transit
// form at 2024-03-15 12:00:00; Longitude Correlation also with tz 5:30 East, mode 201, 80%).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { ASYNC_TABLES } from '../src/engine/jobs';

const DIR = 'golden/jhora-derived';
const MODES = ['Standard', 'Houses', 'AV', 'SpecialNak', 'SpecialNakAspects', 'Latta', 'SpecialNakLagna', 'SpecialNakAspectsLagna', 'AngaGraha'];
const LIST = 59664;   // the transit / correlation list (59649 is the longitudes list of the transit chart)
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const normRows = (rows: string[][]) => rows.map((r) => r.map(norm));

interface View { top: string; sub: string; mode: string | null; control_id: number; headers: string[]; rows: string[][] }
const charts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => {
  const name = f.replace(/\.json$/, '');
  const g = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as { views: View[] };
  return { name, birth: parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), views: g.views.filter((v) => v.top === 'Transits') };
}) : [];

const date = { year: 2024, month: 3, day: 15, hour: 12 };
/**
 * Longitude Correlation tolerances. Its "natal" points in vargas other than D-1 are
 * the transit chart's (see correlation.ts), so a varga longitude amplifies a D-1
 * difference n-fold; deviations are compared as D-1 arcseconds (divided by n).
 * - Bhava / Hora / Ghati lagna derive from sunrise, which differs from JHora's by a few
 *   ms (as in longitudes.test.ts, tolerance 2"): measured up to 1.76" (ghati lagna).
 * - Everything else: measured <= 0.002" (Moon); tolerance 0.05".
 * - Aspect %: two decimals; a 2" D-1 shift is up to 120" in D-60, moving Parasara's
 *   curve (<= 3.34 %/deg) by up to 0.11 %. Other points: one unit in the last digit.
 * Rows (which natal points/vargas pass the 80% test, their order, transit planet,
 * longitude and speed) must match exactly.
 */
const SUNRISE = /^(Bhava|Hora|Ghati) Lagna /;
const tolerance = (label: string) => (SUNRISE.test(label) ? { lon: 2, pct: 0.12 } : { lon: 0.05, pct: 0.011 });

describe.each(charts)('Transits golden: $name', async ({ birth, views }) => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, birth);

  it.each(MODES.map((m, i) => [m, i] as const))('Basic Transit Results %s', async (mode, i) => {
    const g = views.find((v) => v.sub === 'Basic Transit Results' && v.mode === mode && v.control_id === LIST)!;
    const t = await ASYNC_TABLES['transits.basic'](natal, { date, mode: i }, swe);
    expect(t.headers).toEqual(g.headers);
    expect(normRows(t.rows)).toEqual(normRows(g.rows));
  });

  it('Longitude Correlation', async () => {
    const g = views.find((v) => v.sub === 'Longitude Correlation' && v.control_id === LIST)!;
    const t = await ASYNC_TABLES['transits.correlation'](natal, { date, tz: 5.5, mode: 0, minPercent: 80 }, swe);
    expect(t.headers).toEqual(g.headers);
    expect(t.rows.length).toBe(g.rows.length);
    const bad: string[] = [];
    t.rows.forEach((r, i) => {
      const e = g.rows[i];
      const label = norm(r[3]);
      expect(label).toBe(norm(e[3]));                       // same natal point and varga, in the same order
      expect([norm(r[0]), norm(r[1]), norm(r[2])]).toEqual([norm(e[0]), norm(e[1]), norm(e[2])]);
      const n = Number(label.match(/in D-(\d+)/)![1]);
      const tol = tolerance(label);
      const dLon = Math.abs(wrap(arcsec(r[5]) - arcsec(e[5]))) / n, dPct = Math.abs(Number(r[4]) - Number(e[4]));
      if (dLon > tol.lon || dPct > tol.pct) bad.push(`${i} ${label}: ${r[4]} ${r[5]} vs ${e[4]} ${e[5]}`);
    });
    expect(bad).toEqual([]);
  });
});

/** Parse JHora's ' 6 Li 27' 42.37"' into arcseconds. */
function arcsec(s: string): number {
  const m = s.trim().match(/^(\d+) (\w\w) (\d+)' ([\d.]+)"$/);
  if (!m) throw new Error(`bad longitude ${s}`);
  const signs = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];
  return ((signs.indexOf(m[2]) * 30 + Number(m[1])) * 60 + Number(m[3])) * 60 + Number(m[4]);
}
const wrap = (x: number) => { const f = 360 * 3600; return ((x % f) + f + f / 2) % f - f / 2; };
