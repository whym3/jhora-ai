// The Dasas tab with a derived chart shown (engine/jobs.ts derivedDasaJob) against JHora 8.0:
// * golden/jhora-tajaka: Tajaka annual chart of 2000, Dasas tab Vimsottari ("Mudda/Vimsottari
//   Dasa", natal seed progressed) and Patyayini, compressed into the Tajaka year;
// * golden/jhora-derived: Tithi Pravesha annual 2000, Vimsottari in tithi years;
// * golden/jhora-misc: Vimsottari of mundane, angular return, prasna and progression charts
//   (progressions show the natal dasas; prasna without "Compress dasas" is not compressed).
// Plus the derived-chart Dasas tab captures prepared in tools/harness/views-dasas-tajaka.json /
// views-dasas-tp.json (skipped while golden/jhora-dasas-tajaka / -tp are absent).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd, type BirthData } from '../src/core/jhd';
import { computeChart, type Chart } from '../src/core/chart';
import { ASYNC_TABLES, runTable } from '../src/engine/jobs';
import { MUNDANE_JOBS } from '../src/core/derived/mundaneJobs';
import { ANGULAR_JOBS } from '../src/core/derived/progressionJobs';
import { PRASNA_JOBS, TP_JOBS } from '../src/core/derived/tpPrasnaJobs';
import type { Sweph } from '../src/sweph';
import { vimsottari, type Period } from '../src/core/dasas/vimsottari';
import { mahaDasaText } from '../src/core/dasas/format';
import { slotClock } from '../src/core/dasas/yearDefinition';

interface Captured { name: string; views: { sub: string; mode: string; rows: string[][] }[]; texts: { sub?: string; mode?: string | null; name?: string; lines?: string[] }[] }
const load = (dir: string): Captured[] => (existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ name: f.slice(0, -5), ...JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) }))
  : []);
const re = /(\d{4})-(\d\d)-(\d\d) \((\d+):(\d\d):(\d\d)\)/g;
const secs = (m: RegExpMatchArray) => Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
function sameTimes(have: string[], want: string[], tol: number): string[] {
  return want.flatMap((w, i) => {
    const h = have[i] ?? '';
    const a = [...w.matchAll(re)], b = [...h.matchAll(re)];
    return h.replace(re, 'T').trimEnd() === w.replace(re, 'T').trimEnd() && a.length === b.length && a.every((m, k) => Math.abs(secs(m) - secs(b[k])) <= tol)
      ? [] : [`have ${h.trim()} | want ${w.trim()}`];
  });
}
const text = (g: Captured, mode: string, name = 'dasa') => g.texts.find((t) => t.mode === mode && t.name === name && t.lines)?.lines;
type Derived = { kind: string; label: string; birth: BirthData; params: Record<string, unknown> };
const dasa = (natal: Chart, swe: Sweph, table: string, system: string, derived: Derived, path: number[] = []) =>
  ASYNC_TABLES[table](natal, { system, path, derived }, swe);
const chartOf = async (swe: Sweph, name: string) => computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));

const tajaka = load('golden/jhora-tajaka');
describe.skipIf(!tajaka.length)('Dasas tab of a Tajaka chart (annual 2000) matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const g of tajaka) {
    describe(g.name, async () => {
      const natal = await chartOf(swe, g.name);
      const derived: Derived = { kind: 'tajaka', label: 'Tajaka Year', birth: natal.birth, params: { selection: { year: 2000 }, variant: 'exact' } };
      it('Vimsottari = Mudda dasa (natal seed + n stars, Sun-longitude years, times within 5 s)', async () => {
        const t = await dasa(natal, swe, 'dasas.nakshatra', 'Vimsottari', derived);
        expect(t.text![0]).toBe('Mudda/Vimsottari Dasa:');
        expect(sameTimes(t.text!, text(g, 'Vimsottari')!, 5)).toEqual([]);
      });
      it('Patyayini compressed into the year (times within 5 s)', async () => {
        const t = await dasa(natal, swe, 'dasas.other', 'Patyayini', derived);
        expect(sameTimes(t.text!, text(g, 'Patyayini')!, 5)).toEqual([]);
      });
    });
  }
});

const tp = load('golden/jhora-derived');
describe.skipIf(!tp.length)('Dasas tab of a Tithi Pravesha chart (annual 2000) matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const g of tp) {
    it(g.name, async () => {
      const natal = await chartOf(swe, g.name);
      const found = await TP_JOBS['tithiPravesha.find'](natal, { mode: 'year', selection: { year: 2000 } }, swe);
      const { birth, label, periodDays } = JSON.parse(found.text![0]) as { birth: BirthData; label: string; periodDays: number };
      const derived: Derived = { kind: 'tithiPravesha', label, birth, params: { periodDays } };
      // tithi years: as derivedGolden.test.ts, JHora's times after the chart moment come out 1-2 s later
      const md = await dasa(natal, swe, 'dasas.nakshatra', 'Vimsottari', derived);
      expect(sameTimes(md.text!, text(g, 'TP Vimsottari')!, 2)).toEqual([]);
      const ad = await dasa(natal, swe, 'dasas.nakshatra', 'Vimsottari', derived, [0]);
      expect(sameTimes(ad.text!, text(g, 'TP Vimsottari', 'dasa_level2_0')!, 2)).toEqual([]);
    });
  }
});

const misc = load(process.env.MISC_DIR ?? 'golden/jhora-misc');
const findJson = async (p: Promise<{ text?: string[] }>) => JSON.parse((await p).text![0]) as { birth: BirthData; label: string; periodDays?: number };
/** label -> the derived chart as the store keeps it */
const MISC: Record<string, (natal: Chart, swe: Sweph) => Promise<Derived>> = {
  'Mundane: Transit Sun Rasi before': async (n, s) => mundane(n, s, { mode: 'transit', body: 1, division: 0, after: false }),
  'Mundane: Conjunction Saturn Jupiter before': async (n, s) => mundane(n, s, { mode: 'conjunction', body1: 5, body2: 7, aspect: 0, after: false }),
  'Mundane: Solar New Year previous': async (n, s) => mundane(n, s, { mode: 'solarYear', next: false }),
  'Mundane: Lunar New Month next': async (n, s) => mundane(n, s, { mode: 'lunarMonth', next: true }),
  'Mundane: Swearing-in 0y 45d': async (n, s) => mundane(n, s, { mode: 'swearingIn', years: 0, days: 45 }),
  'Angular Return: Sun-Moon after': async (n, s) => angular(n, s, { a: 1, b: 2, before: false, year: 2001, month: 3, day: 15, hour: 12, tzHours: 5.5 }),
  'Angular Return: Jupiter-Saturn after': async (n, s) => angular(n, s, { a: 5, b: 7, before: false, year: 2001, month: 3, day: 15, hour: 12, tzHours: 5.5 }),
  'Prasna: 108 37': async (n, s) => {
    const f = await findJson(PRASNA_JOBS['prasna.find'](n, { mode: '108', n: 37 }, s));
    return { kind: 'prasna', label: f.label, birth: f.birth, params: { periodDays: f.periodDays ?? 0 } };
  },
  'Progression: Solar Rasi': async (n) => ({ kind: 'progression', label: 'Prog (Solar)', birth: n.birth, params: {} }),
};
async function mundane(natal: Chart, swe: Sweph, params: Record<string, unknown>): Promise<Derived> {
  const f = await findJson(MUNDANE_JOBS['mundane.find'](natal, params, swe));
  return { kind: 'mundane', label: f.label, birth: f.birth, params: { ...params, periodDays: f.periodDays } };
}
async function angular(natal: Chart, swe: Sweph, params: Record<string, unknown>): Promise<Derived> {
  const f = await findJson(ANGULAR_JOBS['angularReturn.find'](natal, params, swe));
  expect(f.periodDays).toBeGreaterThan(0);
  return { kind: 'angularReturn', label: f.label, birth: f.birth, params: { ...params, periodDays: f.periodDays } };
}

describe.skipIf(!misc.length)('Dasas tab of mundane / angular return / prasna / progressed charts matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const g of misc) {
    describe(g.name, async () => {
      const natal = await chartOf(swe, g.name);
      for (const [label, make] of Object.entries(MISC)) {
        const want = text(g, label);
        it.skipIf(!want)(`${label}: Vimsottari (times within 2 s)`, async () => {
          const derived = await make(natal, swe);
          const t = await dasa(natal, swe, 'dasas.nakshatra', 'Vimsottari', derived);
          if (derived.kind === 'progression' || !derived.params.periodDays) {
            // natal dasas, not compressed. JHora's pane keeps a cycle offset per dasa (DAT_00597d30[slot] ->
            // DAT_0071fbbc, moved by FUN_00401620's date navigation around 0x401900): the progressions
            // captured before navigated Vimsottari to 2010-06-15, so JHora lists the cycle holding that date
            const mds = vimsottari(natal.positions.grahas.Moon.lon, 1);
            const years = (swe.julday(2010, 6, 15, 12 - natal.birth.tzHours) - natal.positions.jdUt) / 365.2422;
            const k = Math.floor((years - mds[0].start) / 120) * 120;
            const shift = (ps: Period[]): Period[] => ps.map((p) => ({ ...p, start: p.start + k, end: p.end + k }));
            expect(t.rows).toEqual(runTable(natal, 'dasas.nakshatra', { system: 'Vimsottari', path: [] }, swe).rows);
            const ctx = { clock: slotClock(swe, natal, 0), tz: natal.birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
            expect(sameTimes(mahaDasaText('Vimsottari Dasa', shift(mds), ctx), want!, 2)).toEqual([]);
            return;
          }
          expect(sameTimes(t.text!, want!, 2)).toEqual([]);
        });
      }
    });
  }
});

// ---- captures prepared for the other dasas of a derived chart (absent until captured) ----
const NAK_CMD: Record<string, string> = { Vimsottari: 'Vimsottari', Ashtottari: 'Ashtottari', Yogini: 'Yogini', Kalachakra: 'Kalachakra', 'Shattrimsa sama': 'Shattrimsa sama', 'Saptarshi nakshatra': 'Saptarshi nakshatra' };
const RASI_CMD = ['Narayana', 'Lagnamsaka', 'Drigdasa', 'Lagna Kendradi', 'AK Kendradi Rasi', 'Chara (Parasara)', 'Brahma', 'Shoola', 'Mandooka (D-11)'];
const OTHER_CMD = ['Patyayini', 'Rasi-Bhukta Vimsottari', 'Tithi Ashtottari', 'Yoga Vimsottari', 'Karana Chaturaseeti', 'Tithi Yogini', 'Karaka', 'Moola', 'Naisargika'];
const cases: [string, string, string][] = [
  ...Object.keys(NAK_CMD).map((s): [string, string, string] => ['Nakshatra dasas', 'dasas.nakshatra', s]),
  ...RASI_CMD.map((s): [string, string, string] => ['Rasi dasas', 'dasas.rasi', s]),
  ...OTHER_CMD.map((s): [string, string, string] => ['Other dasas', 'dasas.other', s]),
];
for (const [dir, title, make] of [
  ['golden/jhora-dasas-tajaka', 'Tajaka 2000', async (natal: Chart): Promise<Derived> => ({ kind: 'tajaka', label: 'Tajaka Year', birth: natal.birth, params: { selection: { year: 2000 }, variant: 'exact' } })],
  ['golden/jhora-dasas-tp', 'Tithi Pravesha 2000', async (natal: Chart, swe: Sweph): Promise<Derived> => {
    const f = await findJson(TP_JOBS['tithiPravesha.find'](natal, { mode: 'year', selection: { year: 2000 } }, swe));
    return { kind: 'tithiPravesha', label: f.label, birth: f.birth, params: { periodDays: f.periodDays } };
  }],
] as const) {
  const charts = load(dir);
  describe.skipIf(!charts.length)(`Dasas tab of a ${title} chart, all dasas (${dir})`, async () => {
    const swe = await nodeSweph();
    for (const g of charts) {
      describe(g.name, async () => {
        const natal = await chartOf(swe, g.name);
        const derived = await make(natal, swe);
        for (const [sub, table, system] of cases) {
          const want = g.texts.find((t) => t.sub === sub && t.mode === system && t.name === 'dasa' && t.lines)?.lines;
          it.skipIf(!want)(`${system} (times within 5 s)`, async () => {
            const t = await dasa(natal, swe, table, system, derived);
            expect(sameTimes(t.text!, want!, 5)).toEqual([]);
          });
        }
      });
    }
  });
}

describe('derived dasa job plumbing', async () => {
  const swe = await nodeSweph();
  const natal = await chartOf(swe, 'Mahatma Gandhi');
  it('without params.derived, or for a progressed chart, the Dasas jobs show the natal dasas', async () => {
    const plain = runTable(natal, 'dasas.rasi', { system: 'Narayana', path: [] }, swe);
    expect((await ASYNC_TABLES['dasas.rasi'](natal, { system: 'Narayana', path: [] }, swe)).rows).toEqual(plain.rows);
    const prog = await dasa(natal, swe, 'dasas.rasi', 'Narayana', { kind: 'progression', label: 'Prog', birth: { ...natal.birth, year: natal.birth.year + 40 }, params: {} });
    expect(prog.rows).toEqual(plain.rows);
  });
});
