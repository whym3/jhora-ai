// The remaining Dasas tab features (src/core/dasas/tribhagi.ts, dasaJobs.ts, overrides.ts,
// descriptions.ts; nakshatra dasa varga, title extras, Moola / Narayana options):
//  - structural checks against the rules read from jhora.exe;
//  - the dates-only copy (33236) against every captured 'dasa' / 'dasa_dates' pair;
//  - golden/jhora-dasa-commands/<variant>/ (tools/harness/views-dasa-commands.json, one --ini
//    override per variant, Tribhagi toggled by the manifest) when captured.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenDasaCharts, goldenV2Charts, goldenV3Charts } from './golden';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import { DEFAULTS, type JhoraIni } from '../src/settings/generated';
import { vimsottari } from '../src/core/dasas/vimsottari';
import { NAKSHATRA_DASAS, nakshatraDasa, nakshatraSeedLon } from '../src/core/dasas/nakshatra';
import { buildDasa } from '../src/core/dasas/build';
import { tribhagi, tribhagiVimsottari, TRIBHAGI_SUFFIX } from '../src/core/dasas/tribhagi';
import { datesOnlyLines, mahaDasaText } from '../src/core/dasas/format';
import { dasaClock } from '../src/core/dasas/time';
import { DASA_ASYNC_JOBS, locateEvent, sumLongitudeText, sumOfLongitudes, withCycle } from '../src/core/dasas/dasaJobs';
import { DASA_DESCRIPTIONS, quickInfoCaption } from '../src/core/dasas/descriptions';
import { NAKSHATRA_SLOTS, OTHER_SLOTS, RASI_SLOTS } from '../src/core/dasas/yearDefinition';
import { OTHER_DASAS, RASI_DASAS } from '../src/core/dasas/registry';
import { moolaDasa } from '../src/core/dasas/moola';
import { withOverrides } from '../src/core/dasas/overrides';
import { vargaLongitude } from '../src/core/vargas';
import { vargaSpec } from '../src/core/vargaOptions';
import { NAK_LORD } from '../src/core/lords';
import { NAKSHATRAS, SIGNS } from '../src/core/zodiac';

const NAK = 360 / 27;
const arr = <T>(base: T[], slot: number, v: T) => base.map((x, i) => (i === slot ? v : x));
const lens = (ps: { start: number; end: number }[]) => ps.map((p) => p.end - p.start);

describe('dasa pane features', async () => {
  const swe = await nodeSweph();
  const birth = parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1'));
  const natal = await computeChart(swe, birth);
  const moon = natal.positions.grahas.Moon.lon;

  it('Tribhagi Vimsottari: 27 maha dasas of a third, labelled "lord (star)", 2-letter antardasas', () => {
    const t = tribhagiVimsottari(moon, 2);
    const v = vimsottari(moon, 2);
    expect(t).toHaveLength(27);
    expect(t.reduce((a, p) => a + p.end - p.start, 0)).toBeCloseTo(120, 9);
    // the first cycle is the Vimsottari dasa scaled by 1/3 (balance included)
    t.slice(0, 9).forEach((p, i) => { expect(p.start).toBeCloseTo(v[i].start / 3, 9); expect(p.lord).toBe(v[i].lord); });
    const star = Math.floor(moon / NAK);
    expect(t[0].label).toBe(`${{ Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' }[NAK_LORD[star % 9]]} (${NAKSHATRAS[star]})`);
    expect(t[10].label!.endsWith(`(${NAKSHATRAS[(star + 10) % 27]})`)).toBe(true);
    // antardasas: the Vimsottari order from the maha dasa lord, years / 120 of the period
    const ad = t[12].children!;
    expect(ad.map((p) => p.lord)).toEqual(v[3].children!.map((p) => p.lord));
    expect(ad.every((p) => p.label!.length === 2)).toBe(true);
    lens(ad).forEach((l, j) => expect(l / (t[12].end - t[12].start)).toBeCloseTo(lens(v[3].children!)[j] / (v[3].end - v[3].start), 12));
  });

  it('Tribhagi of the other nakshatra dasas: three cycles at 1/3; Kalachakra, Yogini and Shattrimsa untouched', () => {
    const tri = { tribhagi: true };
    const a = buildDasa(natal, 'dasas.nakshatra', 'Ashtottari', 2, tri);
    const plain = buildDasa(natal, 'dasas.nakshatra', 'Ashtottari', 2);
    expect(a.title).toBe(plain.title + TRIBHAGI_SUFFIX);
    expect(a.periods).toEqual(tribhagi(plain.periods));
    expect(a.periods).toHaveLength(3 * plain.periods.length);
    expect(a.periods[8].start).toBeCloseTo(a.periods[0].start + 108 / 3, 9);
    for (const s of ['Kalachakra', 'Yogini', 'Shattrimsa sama']) expect(buildDasa(natal, 'dasas.nakshatra', s, 2, tri)).toEqual(buildDasa(natal, 'dasas.nakshatra', s, 2));
    expect(buildDasa(natal, 'dasas.nakshatra', 'Vimsottari', 2, tri).title).toBe('Vimsottari Dasa - Tribhagi variation');
    expect(buildDasa(natal, 'dasas.nakshatra', 'Saptarshi nakshatra', 1, tri).periods).toHaveLength(30);
  });

  it('nakshatra dasa varga (DAT_00597ed8): the seed bodies in that varga, "using D-9" in the title', () => {
    const d9 = vargaLongitude(moon, vargaSpec('D9', natal.ini));
    expect(nakshatraSeedLon(natal, 0, { varga: 1 })).toBeCloseTo(d9, 12);
    const b = buildDasa(natal, 'dasas.nakshatra', 'Vimsottari', 2, { nakVarga: 1 });
    expect(b.periods).toEqual(vimsottari(d9, 2));
    expect(b.title).toBe('Vimsottari Dasa (using D-9)');
    expect(buildDasa(natal, 'dasas.nakshatra', 'Kalachakra', 1, { nakVarga: 1 }).title).toMatch(/^Kalachakra Dasa \(From Moon of D-9, /);
    // FUN_0049a930's offset moves every seed body
    expect(nakshatraSeedLon(natal, 4, { shift: 1.5 })).toBeCloseTo(natal.positions.ascendant + 1.5, 12);
    expect(nakshatraSeedLon(natal, 0, { shift: 0 })).toBe(moon);
  });

  it('title extras (obj+0x76d38): reverse, using, shift of n stars; Saptarshi shift is title-only', async () => {
    const c = async (patch: Partial<JhoraIni>) => computeChart(swe, birth, patch);
    const shift1 = await c({ NakshatraDasaShift: arr(DEFAULTS.NakshatraDasaShift, 0, 1) });
    expect(buildDasa(shift1, 'dasas.nakshatra', 'Vimsottari', 1).title).toBe('Vimsottari Dasa (shift of 1 stars)');
    const rev = await c({ NakshatraDasaShift: arr(DEFAULTS.NakshatraDasaShift, 0, 2), AntiZodiacalDasa: arr(DEFAULTS.AntiZodiacalDasa, 0, 1) });
    expect(buildDasa(rev, 'dasas.nakshatra', 'Vimsottari', 1, { nakVarga: 1 }).title).toBe('Vimsottari Dasa (reverse, using D-9, shift of 2 stars)');
    const yog = await c({ NakshatraDasaShift: arr(DEFAULTS.NakshatraDasaShift, 3, 2) });
    expect(buildDasa(yog, 'dasas.nakshatra', 'Yogini', 1).title).toBe(`${NAKSHATRA_DASAS.Yogini.title} (shift of 2 stars)`);
    const sap = await c({ NakshatraDasaShift: arr(DEFAULTS.NakshatraDasaShift, 12, 3) });
    const s1 = buildDasa(sap, 'dasas.nakshatra', 'Saptarshi nakshatra', 2), s0 = buildDasa(natal, 'dasas.nakshatra', 'Saptarshi nakshatra', 2);
    expect(s1.periods).toEqual(s0.periods);
    expect(s1.title).toBe(`${s0.title} (shift of 3 stars)`);
    // defaults: no extra
    expect(buildDasa(natal, 'dasas.nakshatra', 'Vimsottari', 1).title).toBe('Vimsottari Dasa');
  });

  it('cycles (DAT_0071fbbc): the maha dasas move by the sum of their years', () => {
    const v = vimsottari(moon, 2);
    const c = withCycle(v, 1);
    expect(c[0].start).toBeCloseTo(v[0].start + 120, 9);
    expect(c[0].children![0].end).toBeCloseTo(v[0].children![0].end + 120, 9);
    const t0 = runTable(natal, 'dasas.nakshatra', { system: 'Vimsottari', path: [] }, swe);
    const t1 = runTable(natal, 'dasas.nakshatra', { system: 'Vimsottari', path: [], cycle: 1 }, swe);
    expect(t1.rows).toHaveLength(t0.rows.length);
    expect(t1.rows[0][1].slice(0, 4)).toBe(String(Number(t0.rows[0][1].slice(0, 4)) + 120));
    expect(withCycle(v, 0)).toBe(v);
  });

  it('Locate an event (FUN_00401820): moves the cycle until a maha dasa holds the moment', async () => {
    const r = await locateEvent(natal, 'dasas.nakshatra', { system: 'Vimsottari' }, swe, { year: 2010, month: 6, day: 15, hour: 12, tz: birth.tzHours, level: 2 });
    expect(r.cycle).toBe(1);
    expect(r.indices).toHaveLength(3);
    const jd = swe.julday(2010, 6, 15, 12 - birth.tzHours);
    const md = r.dasa.periods[r.indices[0]];
    expect(r.dasa.clock.toJd(md.start)).toBeLessThanOrEqual(jd);
    expect(r.dasa.clock.toJd(md.end)).toBeGreaterThan(jd);
    const t = await DASA_ASYNC_JOBS['dasas.locate'](natal, { table: 'dasas.nakshatra', system: 'Vimsottari', at: { year: 1900, month: 1, day: 1, hour: 0, tz: birth.tzHours, level: 1 } }, swe);
    expect(JSON.parse(t.text![0]).cycle).toBe(0);
    expect(t.rows).toHaveLength(2);
  });

  it('Copy to clipboard (only dates): the full text with ":  " and "  -  " and no times', () => {
    const v = vimsottari(moon, 1);
    const ctx = { clock: dasaClock(swe, natal), tz: birth.tzHours, revjul: (jd: number) => swe.revjul(jd) };
    expect(mahaDasaText('Vimsottari Dasa', v, ctx, true)).toEqual(datesOnlyLines(mahaDasaText('Vimsottari Dasa', v, ctx)));
    expect(mahaDasaText('Vimsottari Dasa', v, ctx, true)[4]).toMatch(/^ \w+:  \d{4}-\d\d-\d\d  -  \d{4}-\d\d-\d\d$/);
    const t = runTable(natal, 'dasas.rasi', { system: 'Narayana', path: [0], datesOnly: true }, swe);
    expect(t.text![2]).toMatch(/^ \w+ MD:  \d{4}-\d\d-\d\d  -  \d{4}-\d\d-\d\d$/);
  });

  it('Sum of longitudes (FUN_00451400): Rahu and Ketu counted as 360 - longitude', async () => {
    const g = natal.positions.grahas;
    expect(sumOfLongitudes(natal, ['Sun', 'Rahu'])).toBeCloseTo(g.Sun.lon + 360 - g.Rahu.lon, 12);
    expect(sumLongitudeText(0)).toBe(' 0 Ar 00\' 00.00"');
    expect(sumLongitudeText(395.5 + 1 / 120)).toBe(' 5 Ta 30\' 30.00"');
    const t = await DASA_ASYNC_JOBS['dasas.sumLongitudes'](natal, { table: 'dasas.nakshatra', system: 'Vimsottari', path: [0], index: 1 }, swe);
    const v = vimsottari(moon, 2);
    expect(t.text![0]).toBe(`Sum of longitudes of planets upto selected level is ${sumLongitudeText(sumOfLongitudes(natal, [v[0].lord, v[0].children![1].lord]))}.`);
    const r = await DASA_ASYNC_JOBS['dasas.sumLongitudes'](natal, { table: 'dasas.rasi', system: 'Narayana', path: [0] }, swe);
    expect(r.text![0]).toMatch(/^Available only in dasas of planets/);
  });

  it('Entry chart of this period (32892): the chart at the period start', async () => {
    const t = await DASA_ASYNC_JOBS['dasas.entry'](natal, { table: 'dasas.nakshatra', system: 'Vimsottari', path: [], index: 2 }, swe);
    const r = JSON.parse(t.text![0]);
    const v = vimsottari(moon, 1);
    const clock = dasaClock(swe, natal);
    const jd = swe.julday(r.birth.year, r.birth.month, r.birth.day, r.birth.hour - birth.tzHours);
    expect(Math.abs(jd - clock.toJd(v[2].start)) * 86400).toBeLessThan(1);
    expect(r.periodDays).toBeCloseTo(clock.toJd(v[2].end) - clock.toJd(v[2].start), 6);
    expect(r.label).toMatch(/^Period Entry: /);
  });

  it('Dasa-Transit Correlation (33269): Ju / Sa / Ra / Ke in the houses from the period sign', async () => {
    const t = await DASA_ASYNC_JOBS['dasas.transit'](natal, { table: 'dasas.rasi', system: 'Narayana', path: [], index: 0 }, swe);
    expect(t.rows.length).toBeGreaterThan(4);
    expect(new Set(t.rows.map((r) => r[2]))).toEqual(new Set(['Jupiter', 'Saturn', 'Rahu', 'Ketu']));
    expect(t.caption).toMatch(new RegExp(`^Transits from ${runTable(natal, 'dasas.rasi', { system: 'Narayana' }, swe).rows[0][0]} during`));
  });

  it('Quick Info (button 2): a description for every dasa and "Quick Info on <title up to Dasa>"', async () => {
    expect(quickInfoCaption('Narayana Dasa of D-1 chart (a versatile phalita rasi dasa)')).toBe('Quick Info on Narayana Dasa');
    expect(quickInfoCaption('Shat-trimsa sama dasa (applicable ...)')).toBe('Quick Info on Shat-trimsa sama dasa');
    for (const s of [...NAKSHATRA_SLOTS.map((_, i) => i), ...RASI_SLOTS.map((_, i) => 25 + i), ...OTHER_SLOTS.map((_, i) => 60 + i)]) {
      if (s !== 37) expect(DASA_DESCRIPTIONS[s], `slot ${s}`).toBeTruthy();
    }
    const q = await DASA_ASYNC_JOBS['dasas.quickInfo'](natal, { table: 'dasas.rasi', system: 'Paryaaya' }, swe);
    expect(q.text![1]).toMatch(/^This dasa applies to natives with lagna in a/);
    const v = await DASA_ASYNC_JOBS['dasas.quickInfo'](natal, { table: 'dasas.nakshatra', system: 'Vimsottari' }, swe);
    expect(v.text).toEqual(['Quick Info on Vimsottari Dasa', DASA_DESCRIPTIONS[0]]);
  });

  it('Moola dasa options (dialog 2008)', async () => {
    const ctx = { sign: (g: keyof typeof natal.positions.grahas) => Math.floor(natal.positions.grahas[g].lon / 30), degree: (g: keyof typeof natal.positions.grahas) => natal.positions.grahas[g].lon % 30 };
    const lagna = Math.floor(natal.positions.ascendant / 30);
    expect(moolaDasa(lagna, ctx, 2, { lagna: true, moon: true, sun: true, noMtCorrection: false })).toEqual(moolaDasa(lagna, ctx, 2));
    const def = OTHER_DASAS.Moola(natal, 1).periods;
    const noCands = await computeChart(swe, birth, { LagnaUsedInMoolaDasa: 0, MoonUsedInMoolaDasa: 0, SunUsedInMoolaDasa: 0 });
    expect(OTHER_DASAS.Moola(noCands, 1).periods.map((p) => p.lord).sort()).toEqual(def.map((p) => p.lord).sort());
    const noCorr = await computeChart(swe, birth, { MoolaDasaNoCorrectionInMoolaTrikona: 1 });
    // first-cycle years change only for planets in their moolatrikona sign
    const a = OTHER_DASAS.Moola(noCorr, 1).periods.slice(0, 9), b = def.slice(0, 9);
    expect(a.map((p) => p.lord)).toEqual(b.map((p) => p.lord));
  });

  it('Narayana dasa of a D-n (NarayanaDasaChart)', async () => {
    const c = await computeChart(swe, birth, { NarayanaDasaChart: 1 });
    const d = RASI_DASAS.Narayana(c, 1);
    expect(d.title).toBe('Narayana Dasa of D-9 chart (a versatile phalita rasi dasa)');
    expect(d.periods).toHaveLength(24);
    expect(RASI_DASAS.Narayana(natal, 1).title).toBe('Narayana Dasa of D-1 chart (a versatile phalita rasi dasa)');
  });

  it('temporary strengths (overrides.ts): start sign, co-lords, pairs; none = unchanged', () => {
    expect(RASI_DASAS.Narayana(withOverrides(natal, {}), 2)).toEqual(RASI_DASAS.Narayana(natal, 2));
    const s = RASI_DASAS.Narayana(withOverrides(natal, { start: 3 }), 1);
    expect(s.periods[0].label).toBe(SIGNS[3]);
    const first = RASI_DASAS.Narayana(natal, 1).periods[0].label!;
    const i = SIGNS.indexOf(first as (typeof SIGNS)[number]);
    const flipped = RASI_DASAS.Narayana(withOverrides(natal, { stronger: Array.from({ length: 6 }, (_, k) => (k === i % 6 ? (i + 6) % 12 : null)) }), 1);
    expect(flipped.periods[0].label).toBe(SIGNS[(i + 6) % 12]);
    const t = runTable(natal, 'dasas.rasi', { system: 'Lagnamsaka', overrides: { start: 5 } }, swe);
    expect(t.rows[0][0]).toBe(SIGNS[5]);
  });

  it('a Kalachakra seed other than the Moon is named in the title', async () => {
    const c = await computeChart(swe, birth, { NakshatraDasaStartPoint: arr(DEFAULTS.NakshatraDasaStartPoint, 2, 4) });
    expect(buildDasa(c, 'dasas.nakshatra', 'Kalachakra', 1).title).toMatch(/^Kalachakra Dasa \(From Lagna of D-1, /);
    expect(nakshatraDasa(NAKSHATRA_DASAS.Ashtottari, moon, 1)).toEqual(buildDasa(natal, 'dasas.nakshatra', 'Ashtottari', 1).periods);
  });
});

// ---- the dates-only copy against JHora's captures ----
describe('Copy to clipboard (only dates) matches JHora 8.0', () => {
  const charts = [...goldenDasaCharts(), ...goldenV2Charts(), ...goldenV3Charts()];
  const pairs = charts.flatMap((g) => g.texts.filter((t) => t.name === 'dasa_dates' && t.lines).flatMap((d) => {
    const full = g.texts.find((t) => t.name === 'dasa' && t.mode === d.mode && t.sub === d.sub && t.lines);
    // (a few captures copied another dasa's full text: jhora-v3 Raman's Kalachakra 'dasa' is Ashtottari)
    const same = full && full.lines.length === d.lines.length && full.lines[4]?.split(':')[0] === d.lines[4]?.split(':')[0];
    return same ? [{ name: `${g.name} / ${d.sub} / ${d.mode}`, full: full.lines, dates: d.lines }] : [];
  }));
  it.skipIf(!pairs.length)(`${pairs.length} captured pairs`, () => {
    const bad = pairs.filter((p) => datesOnlyLines(p.full).map((l) => l.trimEnd()).join('\n') !== p.dates.map((l) => l.trimEnd()).join('\n')).map((p) => p.name);
    expect(bad.slice(0, 5)).toEqual([]);
  });
});

// ---- golden/jhora-dasa-commands/<variant>/ (absent until captured) ----
const ROOT = 'golden/jhora-dasa-commands';
const variants = existsSync(ROOT) ? readdirSync(ROOT).filter((d) => !d.includes('.')) : [];
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
/** capture.py --ini values: "slot value" for the ini arrays, else a number. */
function iniPatch(o: Record<string, string>): Partial<JhoraIni> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const base = (DEFAULTS as unknown as Record<string, unknown>)[k];
    if (Array.isArray(base)) { const [slot, x] = v.split(' ').map(Number); out[k] = arr(base as number[], slot, x); } else out[k] = Number(v);
  }
  return out as Partial<JhoraIni>;
}
const TABLE: Record<string, 'dasas.nakshatra' | 'dasas.rasi' | 'dasas.other'> = { 'Nakshatra dasas': 'dasas.nakshatra', 'Rasi dasas': 'dasas.rasi', 'Other dasas': 'dasas.other' };
describe.skipIf(!variants.length)('dasa commands and options match JHora 8.0 (golden/jhora-dasa-commands)', async () => {
  const swe = await nodeSweph();
  for (const v of variants) {
    for (const f of readdirSync(`${ROOT}/${v}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${v}/${f}`, 'utf8')) as { ini_overrides: Record<string, string>; texts: { sub?: string; mode?: string; name?: string; lines?: string[] }[] };
      for (const t of g.texts.filter((x) => x.lines && x.mode && /^(dasa|dasa_dates|dasa_level2_\d+)$/.test(x.name ?? ''))) {
        // modes "Tribhagi <system>" were captured with menu 32971 toggled on
        const tri = t.mode!.startsWith('Tribhagi ');
        const system = t.mode!.replace(/^Tribhagi /, '');
        it(`${v} / ${f.slice(0, -5)}: ${t.mode} ${t.name}`, async () => {
          const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${f.slice(0, -5)}.jhd`, 'latin1')), iniPatch(g.ini_overrides));
          const k = /^dasa_level2_(\d+)$/.exec(t.name!);
          const have = runTable(chart, TABLE[t.sub!], { system, path: k ? [Number(k[1])] : [], tribhagi: tri, datesOnly: t.name === 'dasa_dates' }, swe);
          expect(sameTimes(have.text!, t.lines!, 2)).toEqual([]);
        });
      }
    }
  }
});
