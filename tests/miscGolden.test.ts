// Mundane, Angular Return, Progressions and Prasna charts against JHora 8.0
// (golden/jhora-misc, captured with tools/harness/views-misc.json). For every scenario:
// * the chart JHora found has the same name and moment as ours, to the second (the
//   searches reproduce jhora.exe's own root finders, tajaka/search.ts; a documented
//   per-scenario exception may allow `MOMENT_TOL` seconds);
// * our found chart's Key Info text equals JHora's and its ten longitudes agree to 0.01";
// * where captured, the compressed Vimsottari of the found chart (mundane, prasna).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseLongitude } from './golden';
import { parseJhd, type BirthData } from '../src/core/jhd';
import { computeChart, type Chart } from '../src/core/chart';
import { keyInfoText } from '../src/core/keyInfo';
import { runTable } from '../src/engine/jobs';
import { MUNDANE_JOBS } from '../src/core/derived/mundaneJobs';
import { ANGULAR_JOBS, PROGRESSION_JOBS } from '../src/core/derived/progressionJobs';
import { PRASNA_JOBS } from '../src/core/derived/tpPrasnaJobs';
import type { Sweph } from '../src/sweph';

interface Captured { views: { mode: string; rows: string[][] }[]; texts: { mode?: string | null; name?: string; lines?: string[] }[] }
// golden/jhora-misc-prog clicks the progressions in another order (Solar and Bhrigu first),
// which exercises the history effects below; MISC_DIR picks one folder
const DIRS = process.env.MISC_DIR ? [process.env.MISC_DIR] : ['golden/jhora-misc', 'golden/jhora-misc-prog'];
const charts = DIRS.filter((d) => existsSync(d)).flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => ({ dir: d, name: f.slice(0, -5) })));

type Find = (natal: Chart, swe: Sweph) => Promise<{ birth: BirthData; label: string; periodDays?: number }>;
const job = (jobs: Record<string, (c: Chart, p: Record<string, unknown>, s: Sweph) => Promise<{ text?: string[] }>>, name: string, params: Record<string, unknown>): Find =>
  async (natal, swe) => JSON.parse((await jobs[name](natal, params, swe)).text![0]);
const mundane = (params: Record<string, unknown>) => job(MUNDANE_JOBS, 'mundane.find', params);
// combo 1012 is the first body on the form, 1009 the second; JHora names the chart "<1009>-<1012>"
const ar = (a: number, b: number, before: boolean) => job(ANGULAR_JOBS, 'angularReturn.find', { a, b, before, year: 2001, month: 3, day: 15, hour: 12, tzHours: 5.5 });
const prog = (kind: string, varga: number, body = 2, dasa = 0) => job(PROGRESSION_JOBS, 'progression.find', { kind, varga, body, dasa, year: 2010, month: 6, day: 15, hour: 12 });
const prasna = (mode: string, n: number, replace = false) => job(PRASNA_JOBS, 'prasna.find', { mode, n, replace });

/** Scenario label (views-misc.json) -> our search. */
const SCENARIOS: Record<string, Find> = {
  'Mundane: Transit Sun Rasi before': mundane({ mode: 'transit', body: 1, division: 0, after: false }),
  'Mundane: Transit Moon Nakshatra after': mundane({ mode: 'transit', body: 2, division: 1, after: true }),
  'Mundane: Transit Jupiter Navamsa before': mundane({ mode: 'transit', body: 5, division: 2, after: false }),
  'Mundane: Transit Lagna Rasi after': mundane({ mode: 'transit', body: 0, division: 0, after: true }),
  'Mundane: Conjunction Saturn Jupiter before': mundane({ mode: 'conjunction', body1: 5, body2: 7, aspect: 0, after: false }),
  'Mundane: Opposition Sun Moon after': mundane({ mode: 'conjunction', body1: 2, body2: 1, aspect: 1, after: true }),
  'Mundane: Trine5 Mars Venus after': mundane({ mode: 'conjunction', body1: 6, body2: 3, aspect: 2, after: true }),
  'Mundane: Stationary Jupiter before': mundane({ mode: 'stationary', body: 2, after: false }),
  'Mundane: Stationary Mercury after': mundane({ mode: 'stationary', body: 1, after: true }),
  'Mundane: Eclipse next Lunar start': mundane({ mode: 'eclipse', next: true, type: 0, maximum: false }),
  'Mundane: Eclipse previous Global Solar maximum': mundane({ mode: 'eclipse', next: false, type: 1, maximum: true }),
  'Mundane: Eclipse next Local Solar start': mundane({ mode: 'eclipse', next: true, type: 2, maximum: false }),
  'Mundane: Solar New Year previous': mundane({ mode: 'solarYear', next: false }),
  'Mundane: Solar New Month next': mundane({ mode: 'solarMonth', next: true }),
  'Mundane: Lunar New Year previous': mundane({ mode: 'lunarYear', next: false }),
  'Mundane: Lunar New Month next': mundane({ mode: 'lunarMonth', next: true }),
  'Mundane: New Lunar Day previous': mundane({ mode: 'lunarDay', next: false }),
  'Mundane: Ardra Pravesha next': mundane({ mode: 'ardra', next: true }),
  'Mundane: Fortnight previous': mundane({ mode: 'fortnight', next: false }),
  'Mundane: Swearing-in 1y 0d': mundane({ mode: 'swearingIn', years: 1, days: 0 }),
  'Mundane: Swearing-in 0y 45d': mundane({ mode: 'swearingIn', years: 0, days: 45 }),
  'Angular Return: Sun-Moon after': ar(1, 2, false),
  'Angular Return: Lagna-Sun before': ar(0, 1, true),
  'Angular Return: Jupiter-Saturn after': ar(5, 7, false),
  'Progression: NakshatraDasa Rasi Moon Vimsottari': prog('nakshatra', 0, 2, 0),
  'Progression: NakshatraDasa Navamsa Lagna Yogini': prog('nakshatra', 1, 0, 3),
  // tools/harness/views-progressions-grouped.json (MISC_DIR=golden/jhora-prog-grouped)
  'Progression: NakshatraDasa Rasi Moon Ashtottari': prog('nakshatra', 0, 2, 1),
  'Progression: NakshatraDasa Rasi Moon Kalachakra': prog('nakshatra', 0, 2, 2),
  'Progression: NakshatraDasa Rasi Moon Shashtisama': prog('nakshatra', 0, 2, 11),
  'Progression: NakshatraDasa Rasi Moon Dwisaptati': prog('nakshatra', 0, 2, 4),
  'Progression: NakshatraDasa Navamsa Moon Shattrimsa': prog('nakshatra', 1, 2, 5),
  'Progression: NakshatraDasa Rasi Lagna Panchottari': prog('nakshatra', 0, 0, 10),
  'Progression: Sudarsana Rasi': prog('scd', 0),
  'Progression: Solar Rasi': prog('solar', 0),
  'Progression: Solar D-10': prog('solar', 9),
  'Progression: Bhrigu Rasi': prog('bhrigu', 0),
  'Prasna: 108 37': prasna('108', 37),
  'Prasna: 249 150': prasna('249', 150),
  'Prasna: Nadi 777': prasna('nadi', 777),
  'Prasna: 249 100 replace': prasna('249', 100, true),
};
const MOMENT_TOL: Record<string, number> = {};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Date and Time lines of a Key Info block -> local civil time (seconds since 1970, zone ignored). */
function moment(lines: string[]): number {
  const d = /^Date:\s+(\w+) (\d+), (-?\d+)/.exec(lines.find((l) => l.startsWith('Date:'))!)!;
  const t = /^Time:\s+(\d+):(\d+):(\d+)/.exec(lines.find((l) => l.startsWith('Time:'))!)!;
  return Date.UTC(+d[3], MONTHS.indexOf(d[1]), +d[2], +t[1], +t[2], +t[3]) / 1000;
}
const birthMoment = (b: BirthData) => {
  const s = Math.round(b.hour * 3600);
  return Date.UTC(b.year, b.month - 1, b.day) / 1000 + s;
};

describe.skipIf(!charts.length)('Mundane / Angular Return / Progressions / Prasna match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const { dir, name } of charts) {
    const g: Captured = JSON.parse(readFileSync(`${dir}/${name}.json`, 'utf8'));
    describe(`${name} (${dir.slice(7)})`, async () => {
      const natal = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      for (const [label, find] of Object.entries(SCENARIOS)) {
        const ki = g.texts.find((t) => t.mode === label && t.name === 'key_info' && t.lines);
        if (!ki) continue;
        // JHora keeps a shifted progression's flags (derived record +0x275c8..ca) and shift
        // (+0x275d0) when the next chart is again a progression (FUN_00403120 clears them
        // only for another chart kind): a Solar or Bhrigu progression captured after an SCD
        // or nakshatra dasa one is computed from the natal moment plus the old shift, so its
        // lagna repeats that progression's. Such captures depend on the click history, not
        // on the scenario, and are skipped.
        const lagna = (mode: string) => g.views.find((v) => v.mode === mode)?.rows[0]?.[1];
        const stale = /^Progression: (Solar|Bhrigu)/.test(label) && lagna(label) !== undefined
          && g.views.some((v) => /^Progression: (Sudarsana|NakshatraDasa)/.test(v.mode) && v.rows[0]?.[1] === lagna(label));
        it.skipIf(stale)(label, async () => {
          // JHora's copy: chart file, '', chart name, '', Date ... Sidereal Time, then the natal block
          const want = ki.lines!.slice(4, ki.lines!.findIndex((l) => l.startsWith('Sidereal Time:')) + 1);
          const found = await find(natal, swe);
          expect.soft(found.label).toBe(ki.lines![2].trim());
          const dt = birthMoment(found.birth) - moment(want);
          expect.soft(Math.abs(dt), `found ${found.birth.year}-${found.birth.month}-${found.birth.day} ${found.birth.hour}h, ${dt} s from JHora`).toBeLessThanOrEqual(MOMENT_TOL[label] ?? 0);
          const chart = await computeChart(swe, found.birth, natal.ini);
          const have = keyInfoText(swe, chart).slice(2);
          // The reverse history effect: a nakshatra dasa or Sudarsana progression shown right
          // after a Solar or Bhrigu one keeps that chart's Tithi, Nakshatra, Yoga and Karana
          // lines (golden/jhora-misc-prog clicks Solar, Solar D-10, Bhrigu first), and so do the
          // nakshatra dasa / Sudarsana ones after it. Those lines must then equal ours for that
          // last Solar or Bhrigu progression (g.views keeps the click order).
          const order = g.views.map((v) => v.mode).filter((m) => m.startsWith('Progression:'));
          const prev = order.slice(0, order.indexOf(label)).reverse().find((m) => !/^Progression: (NakshatraDasa|Sudarsana)/.test(m));
          // A Bhrigu progression's Sun..Saturn replacements live in the document (doc+0x4f030,
          // flags doc+0x4efb8), not in the derived record, so they also survive into the
          // shifted chart: its Sun..Saturn are then Bhrigu's plus the shift.
          const carried = new Map<string, number>();
          if (/^Progression: (NakshatraDasa|Sudarsana)/.test(label) && prev && /^Progression: (Solar|Bhrigu)/.test(prev)) {
            const p = await SCENARIOS[prev](natal, swe);
            const before = keyInfoText(swe, await computeChart(swe, p.birth, natal.ini)).slice(2);
            have.forEach((l, i) => { if (/^(Tithi|Nakshatra|Yoga|Karana):/.test(l)) have[i] = before[i]; });
            for (const [gr, lon] of Object.entries(p.birth.override?.grahas ?? {})) carried.set(gr, lon! + (found.birth.override?.shift ?? 0));
          }
          const diff = want.flatMap((w, i) => (w === have[i] ? [] : [`want ${w} | have ${have[i]}`]));
          expect(diff, diff.join('\n')).toEqual([]);
          const table = g.views.find((v) => v.mode === label);
          if (table) {
            // all 56 rows: a shifted progression moves every body, upagrahas and arudhas too
            const ours = runTable(chart, 'basics.longitudes', {});
            expect(ours.rows.length).toBe(table.rows.length);
            for (let i = 0; i < table.rows.length; i++) {
              const body = table.rows[i][0].split(' ')[0];
              const lon = carried.has(body) ? carried.get(body)! : parseLongitude(ours.rows[i][1]);
              const d = Math.abs(((lon - parseLongitude(table.rows[i][1]) + 540) % 360) - 180) * 3600;
              // a found moment agrees to the printed second, not to JHora's fraction of it: the
              // lagna then agrees to its 0.0101" but Kunda (lagna x 81) and the fast points
              // built from the lagna or the ghatis amplify that
              const tol = /^Kunda/.test(body) ? 81 * 0.0101 : /^(Vighati|Sookshma|Prana|Pranapada|Mrityu|TriSphuta)/.test(body) ? 0.1 : 0.0101;
              expect.soft(d, `${table.rows[i][0]}: ${ours.rows[i][1]} vs ${table.rows[i][1]}`).toBeLessThan(tol);
            }
          }
        });
      }
    });
  }
});
