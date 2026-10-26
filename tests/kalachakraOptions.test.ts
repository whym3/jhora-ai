// Kalachakra dasa calculation methods (KalachakraDasaCalculation, kalachakra.ts), Tithi
// Ashtottari's seed options (dialog 2034) and Rasi-Bhukta Vimsottari's varga (dialog 2044):
//  - structural checks against the rules read from FUN_0040c540 / FUN_004109a0 / FUN_00411e20;
//  - golden/jhora-dasa-kalachakra/<variant>/ (tools/harness/views-dasa-kalachakra.json, one
//    --ini override per variant) when captured.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import { buildDasa } from '../src/core/dasas/build';
import { KALACHAKRA_METHODS, KALACHAKRA_YEARS, kalachakraDasa, kalachakraLevel, kalachakraMahaId } from '../src/core/dasas/kalachakra';
import { tithiAshtottariDasa, tithiOfBodies } from '../src/core/dasas/tithiAshtottari';
import { tithiOf } from '../src/core/dasas/otherCommon';
import { OTHER_DASAS } from '../src/core/dasas/registry';
import { rasiCtx } from '../src/core/dasas/rasiCommon';
import { vargaLongitude } from '../src/core/vargas';
import { vargaSpec } from '../src/core/vargaOptions';
import { NAKSHATRAS, SIGNS } from '../src/core/zodiac';
import type { Period } from '../src/core/dasas/vimsottari';

const sign = (p: Period) => p.label!.split(' ')[0];
const Y = (s: string) => KALACHAKRA_YEARS[SIGNS.indexOf(s as (typeof SIGNS)[number])];
const ROW3 = ['Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];

describe('Kalachakra dasa calculation methods (FUN_0040c540)', () => {
  // Aswini 4 (pada 3, savya row 3), 45% of the pada elapsed
  const lon = 10 + 1.5;
  const frac = 0.45;
  const kc = (m: number, levels = 2) => kalachakraDasa(lon, 9, true, levels, undefined, m);

  it('the dialog lists seven methods; 5 is the default and other values fall back to it', () => {
    expect(KALACHAKRA_METHODS).toHaveLength(7);
    expect(kc(5)).toEqual(kalachakraDasa(lon));
    expect(kc(9)).toEqual(kalachakraDasa(lon));
  });

  it('5: entries p, p + 1, ... of the table; the unelapsed part of the pada', () => {
    const d = kc(5);
    expect(d.periods.map((p) => p.label)).toEqual(ROW3.map((x, i) => `${x} (${NAKSHATRAS[Math.floor((3 + i) / 4)]}${((3 + i) % 4) + 1})`));
    expect(d.periods[0].start).toBeCloseTo(-frac * 21, 9);
  });

  it('1, 3, 4: the nine signs of the pada row, first dasa fraction', () => {
    for (const m of [1, 3, 4]) {
      const d = kc(m);
      expect(d.periods.map(sign)).toEqual(ROW3);
      expect(d.periods[0].label).toBe(`Cn (${NAKSHATRAS[6]}4)`);
      expect(d.periods[0].start).toBeCloseTo(-frac * 21, 9);
      expect(d.title).toBe(kc(5).title);
    }
  });

  it('0, 2, 6: the elapsed part of the whole cycle picks the first dasa', () => {
    // row total 86, 0.45 x 86 = 38.7 = Cn 21 + Le 5 + Vi 9 + 3.7 of Li
    for (const m of [0, 2, 6]) {
      const d = kc(m);
      expect(sign(d.periods[0])).toBe('Li');
      expect(d.periods[0].start).toBeCloseTo(-(frac * 86 - 35), 9);
    }
    // continuous: into the next row (Sc Li Vi); strictly from the cycle: back to its start
    expect(kc(0).periods.map(sign)).toEqual(['Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi', 'Sc', 'Li', 'Vi']);
    expect(kc(2).periods.map(sign)).toEqual(kc(0).periods.map(sign));
    expect(kc(6).periods.map(sign)).toEqual(['Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi', 'Cn', 'Le', 'Vi']);
    expect(kc(0).title).toMatch(/Paramayush: 83 yr/);
  });

  it('antardasas: row rotation (0, 1), continuation (2, 3), the row of the entry as a pada (4, 5, 6)', () => {
    const li = (m: number) => kc(m).periods.find((p) => sign(p) === 'Li')!.children!.map(sign);
    expect(li(1)).toEqual(['Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi', 'Cn', 'Le', 'Vi']);
    expect(li(0)).toEqual(li(1));
    expect(li(3)).toEqual(['Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi', 'Sc', 'Li', 'Vi']);
    expect(li(2)).toEqual(li(3));
    // entry 30 read as pada 30 (Punarvasu 3): savya row 6
    expect(li(4)).toEqual(['Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi', 'Sc', 'Li', 'Vi']);
    for (const m of [0, 1, 2, 3, 4, 5, 6]) {
      const md = kc(m).periods[2];
      const ad = md.children!;
      const total = ad.reduce((a, p) => a + Y(sign(p)), 0);
      ad.forEach((p) => expect(p.end - p.start).toBeCloseTo(((md.end - md.start) * Y(sign(p))) / total, 9));
    }
  });

  it('an apasavya seed wraps inside the apasavya half; deeper levels use the same S(t)', () => {
    // Rohini 1 (pada 12): row 12 'Sg Cp Aq Pi Ar Ta Ge Le Cn'
    const r = 40 + 0.1;
    const d = kalachakraDasa(r, 9, true, 3, undefined, 2);
    expect(d.title).toMatch(/Apasavya/);
    expect(kalachakraMahaId(r, 0, true, 2)).toBeGreaterThanOrEqual(108);
    for (let i = 0; i < 9; i++) expect(kalachakraMahaId(r, i, true, 2)).toBeGreaterThanOrEqual(108);
    const md = d.periods[3], id = kalachakraMahaId(r, 3, true, 2);
    expect(kalachakraLevel({ ...md, children: undefined }, id, true, true, 2).map((x) => x.period.label)).toEqual(md.children!.map((p) => p.label));
  });
});

describe('Kalachakra method from the ini, Tithi Ashtottari and RBV options', async () => {
  const swe = await nodeSweph();
  const birth = parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1'));
  const natal = await computeChart(swe, birth);

  it('KalachakraDasaCalculation reaches the dasa pane', async () => {
    const c = await computeChart(swe, birth, { KalachakraDasaCalculation: 1 });
    const moon = natal.positions.grahas.Moon.lon;
    expect(buildDasa(c, 'dasas.nakshatra', 'Kalachakra', 2).periods).toEqual(kalachakraDasa(moon, 9, true, 2, { seed: 'Moon', varga: 'D-1' }, 1).periods);
    expect(buildDasa(natal, 'dasas.nakshatra', 'Kalachakra', 2).periods).toEqual(kalachakraDasa(moon, 9, true, 2).periods);
  });

  it('Tithi Ashtottari (dialog 2034): the two bodies and the varga', () => {
    expect(tithiOfBodies(natal)).toEqual(tithiOf(natal));
    expect(tithiAshtottariDasa(natal, 2, 0, undefined, { bodies: [1, 2], varga: 0 })).toEqual(tithiAshtottariDasa(natal, 2));
    const g = natal.positions.grahas;
    const n360 = (x: number) => ((x % 360) + 360) % 360;
    const rev = tithiOfBodies(natal, 0, 0, [2, 1]);
    expect(rev.index).toBe(Math.trunc(n360(g.Sun.lon - g.Moon.lon) / 12));
    const spec = vargaSpec('D9', natal.ini);
    const d9 = tithiOfBodies(natal, 1, 1);
    const d = n360(n360(vargaLongitude(g.Moon.lon, spec) - vargaLongitude(g.Sun.lon, spec)) * 2);
    expect(d9.index).toBe(Math.trunc(d / 12));
    expect(d9.remaining).toBeCloseTo((12 * (d9.index + 1) - d) / 12, 12);
    const t = OTHER_DASAS['Tithi Ashtottari'](natal, 1, { tithiSeed: { harmonic: 1, varga: 1 } });
    expect(t.title).toBe('Tithi Ashtottari Dasa of Dhana tithi in D-9 (useful especially in Tithi Pravesha charts)');
    expect(OTHER_DASAS['Tithi Ashtottari'](natal, 2, {})).toEqual(OTHER_DASAS['Tithi Ashtottari'](natal, 2));
  });

  it('Rasi-Bhukta Vimsottari (dialog 2044): antardasas from the lord\'s sign in the varga', () => {
    const d = OTHER_DASAS['Rasi-Bhukta Vimsottari'](natal, 2, { rbvVarga: 1 });
    expect(d.title).toBe('Rasi-Bhukta Vimsottari Dasa (of D-9 chart, )');
    const ctx = rasiCtx(natal, 1);
    for (const md of d.periods) expect(md.children![0].label).toBe(SIGNS[ctx.sign(md.lord)]);
    expect(d.periods.map((p) => [p.start, p.end])).toEqual(OTHER_DASAS['Rasi-Bhukta Vimsottari'](natal, 2).periods.map((p) => [p.start, p.end]));
  });
});

// ---- golden/jhora-dasa-kalachakra/<variant>/ (absent until captured) ----
const ROOT = 'golden/jhora-dasa-kalachakra';
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
describe.skipIf(!variants.length)('Kalachakra methods match JHora 8.0 (golden/jhora-dasa-kalachakra)', async () => {
  const swe = await nodeSweph();
  for (const v of variants) {
    for (const f of readdirSync(`${ROOT}/${v}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${v}/${f}`, 'utf8')) as { ini_overrides: Record<string, string>; texts: { mode?: string; name?: string; lines?: string[] }[] };
      for (const t of g.texts.filter((x) => x.lines && x.mode === 'Kalachakra' && /^(dasa|dasa_dates|dasa_level2_\d+)$/.test(x.name ?? ''))) {
        it(`${v} / ${f.slice(0, -5)}: ${t.name}`, async () => {
          const ini = Object.fromEntries(Object.entries(g.ini_overrides).map(([k, x]) => [k, Number(x)]));
          const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${f.slice(0, -5)}.jhd`, 'latin1')), ini);
          const k = /^dasa_level2_(\d+)$/.exec(t.name!);
          const have = runTable(chart, 'dasas.nakshatra', { system: 'Kalachakra', path: k ? [Number(k[1])] : [], datesOnly: t.name === 'dasa_dates' }, swe);
          expect(sameTimes(have.text!, t.lines!, 2)).toEqual([]);
        });
      }
    }
  }
});
