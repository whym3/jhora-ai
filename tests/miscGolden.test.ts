// Mundane, Angular Return, Progressions and Prasna charts against JHora 8.0
// (golden/jhora-misc, captured with tools/harness/views-misc.json). For every scenario:
// * the chart JHora found has the same name and moment as ours (to the second; searches
//   that JHora stops at a 1-second bracket may differ by up to `MOMENT_TOL` seconds);
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
const DIR = process.env.MISC_DIR ?? 'golden/jhora-misc';
const charts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];

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
  for (const name of charts) {
    const g: Captured = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'));
    describe(name, async () => {
      const natal = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      for (const [label, find] of Object.entries(SCENARIOS)) {
        const ki = g.texts.find((t) => t.mode === label && t.name === 'key_info' && t.lines);
        if (!ki) continue;
        it(label, async () => {
          // JHora's copy: chart file, '', chart name, '', Date ... Sidereal Time, then the natal block
          const want = ki.lines!.slice(4, ki.lines!.findIndex((l) => l.startsWith('Sidereal Time:')) + 1);
          const found = await find(natal, swe);
          expect.soft(found.label).toBe(ki.lines![2].trim());
          const dt = birthMoment(found.birth) - moment(want);
          expect.soft(Math.abs(dt), `found ${found.birth.year}-${found.birth.month}-${found.birth.day} ${found.birth.hour}h, ${dt} s from JHora`).toBeLessThanOrEqual(MOMENT_TOL[label] ?? 1);
          const chart = await computeChart(swe, found.birth, natal.ini);
          const have = keyInfoText(swe, chart).slice(2);
          const diff = want.flatMap((w, i) => (w === have[i] ? [] : [`want ${w} | have ${have[i]}`]));
          expect(diff, diff.join('\n')).toEqual([]);
          const table = g.views.find((v) => v.mode === label);
          if (table) {
            const ours = runTable(chart, 'basics.longitudes', {});
            for (let i = 0; i < 10; i++) {
              const d = Math.abs(((parseLongitude(ours.rows[i][1]) - parseLongitude(table.rows[i][1]) + 540) % 360) - 180) * 3600;
              expect(d, `${table.rows[i][0]}: ${ours.rows[i][1]} vs ${table.rows[i][1]}`).toBeLessThan(0.0101);
            }
          }
        });
      }
    });
  }
});
