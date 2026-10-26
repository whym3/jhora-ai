// Rasi dasa options of the dasa pane's Options dialogs (narayana.ts Paka / Sama / Ayur, sudasa.ts
// SudasaADOption, shoola.ts start house, overrides.ts reach of the temporary strengths):
//  - structural checks against the rules read from jhora.exe (FUN_00414060, FUN_004156d0,
//    FUN_00407920, the dialog store routines);
//  - golden/jhora-dasa-rasi-options/<variant>/ (tools/harness/views-dasa-rasi-options.json, one
//    --ini override per variant) when captured.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import type { JhoraIni } from '../src/settings/generated';
import { RASI_DASAS } from '../src/core/dasas/registry';
import { narayanaDasa, pakaYears } from '../src/core/dasas/narayana';
import { sudasaAntardasaSigns } from '../src/core/dasas/sudasa';
import { shoolaTitle } from '../src/core/dasas/shoola';
import { withOverrides } from '../src/core/dasas/overrides';
import { dasaLord, mod12, rasiCtx, skFlag, strong7 } from '../src/core/dasas/rasiCommon';
import { DEBILITATION, EXALTATION, signLordByDistance } from '../src/core/signStrength';
import { SIGNS } from '../src/core/zodiac';

const idx = (label: string | undefined) => SIGNS.indexOf(label as (typeof SIGNS)[number]);
const len = (p: { start: number; end: number }) => p.end - p.start;

describe('rasi dasa options (dialogs 2006 / 2049 / 2007 / strengths)', async () => {
  const swe = await nodeSweph();
  const birth = parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1'));
  const natal = await computeChart(swe, birth);
  const ctx = rasiCtx(natal, 0);

  it('Paka Narayana dasa: from the lagna itself, FUN_004ace40 years, antardasas from the dasa sign\'s lord', () => {
    const d = RASI_DASAS.Narayana(natal, 2, { narayanaKind: 1 });
    expect(d.title).toBe('Paka Narayana Dasa of D-1 chart (a versatile phalita rasi dasa)');
    expect(idx(d.periods[0].label)).toBe(ctx.lagna);
    expect(d.periods).toHaveLength(24);
    d.periods.slice(0, 12).forEach((p, i) => {
      const s = idx(p.label);
      const lord = signLordByDistance(s, ctx), q = ctx.sign(lord);
      let y = mod12(Math.floor(q / 3) % 2 === 0 ? s - q : q - s) || 12;
      if (mod12(q + 6) === s) y = 10;
      if (EXALTATION[lord] === q && y < 12) y++;
      if (DEBILITATION[lord] === q && y > 0) y--;
      expect(len(p)).toBe(y);
      expect(pakaYears(s, ctx)).toBe(y);
      expect(len(d.periods[i + 12])).toBe(12 - y);
      expect(idx(p.children![0].label)).toBe(ctx.sign(dasaLord(s, ctx)));
    });
  });

  it('Sama Narayana dasa: 12 dasas of 10 years, the normal antardasas', () => {
    const d = RASI_DASAS.Narayana(natal, 2, { narayanaKind: 2 });
    const n = RASI_DASAS.Narayana(natal, 2);
    expect(d.title).toBe(`Sama ${n.title}`);
    expect(d.periods).toHaveLength(12);
    d.periods.forEach((p, i) => {
      expect(len(p)).toBe(10);
      expect(p.label).toBe(n.periods[i].label);
      expect(p.children!.map((c) => c.label)).toEqual(n.periods[i].children!.map((c) => c.label));
    });
  });

  it('Ayur Narayana dasa: the normal dasa with the nodes exalted in Ta / Le (tables restored afterwards)', () => {
    const before = [EXALTATION.Rahu, EXALTATION.Ketu, DEBILITATION.Rahu, DEBILITATION.Ketu];
    const a = narayanaDasa(ctx.lagna, ctx, 'D-1', 2, 3);
    expect([EXALTATION.Rahu, EXALTATION.Ketu, DEBILITATION.Rahu, DEBILITATION.Ketu]).toEqual(before);
    EXALTATION.Rahu = 1; EXALTATION.Ketu = 4; DEBILITATION.Rahu = 7; DEBILITATION.Ketu = 10;
    let manual;
    try { manual = narayanaDasa(ctx.lagna, ctx, 'D-1', 2, 0); } finally { [EXALTATION.Rahu, EXALTATION.Ketu, DEBILITATION.Rahu, DEBILITATION.Ketu] = before; }
    expect(a).toEqual(manual);
    expect(RASI_DASAS.Narayana(natal, 2, { narayanaKind: 0 })).toEqual(RASI_DASAS.Narayana(natal, 2));
  });

  it('SudasaADOption (FUN_004156d0 0x415a20): the five antardasa rules, 4 = the default', async () => {
    const def = RASI_DASAS.Sudasa(natal, 2);
    const c4 = await computeChart(swe, birth, { SudasaADOption: 4 });
    expect(RASI_DASAS.Sudasa(c4, 2)).toEqual(def);
    const sign = idx(def.periods[0].label);
    const dirOf = (from: number, base: number) => { const f = skFlag(base, ctx); const d = from % 2 === 0 ? 1 : -1; return f === 1 ? 1 : f === 2 ? -d : d; };
    const st = strong7(sign, ctx), lordSign = ctx.sign(dasaLord(st, ctx));
    const reg = (from: number, d: number) => Array.from({ length: 12 }, (_, i) => mod12(from + i * d));
    const quad = (from: number, d: number) => [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11].map((k) => mod12(from + k * d));
    expect(sudasaAntardasaSigns(sign, ctx, 0)).toEqual(reg(lordSign, dirOf(lordSign, st)));
    expect(sudasaAntardasaSigns(sign, ctx, 1)).toEqual(quad(sign, dirOf(sign, sign)));
    expect(sudasaAntardasaSigns(sign, ctx, 2)).toEqual(reg(sign, dirOf(sign, sign)));
    expect(sudasaAntardasaSigns(sign, ctx, 3)).toEqual(quad(st, dirOf(st, st)));
    expect(sudasaAntardasaSigns(sign, ctx, 4)).toEqual(reg(st, dirOf(st, st)));
    for (const o of [0, 1, 2, 3]) {
      const c = await computeChart(swe, birth, { SudasaADOption: o });
      const d = RASI_DASAS.Sudasa(c, 2);
      expect(d.periods.map(len)).toEqual(def.periods.map(len));
      expect(d.periods[0].children!.map((p) => idx(p.label))).toEqual(sudasaAntardasaSigns(sign, ctx, o as 0 | 1 | 2 | 3));
    }
  });

  it('Shoola dasa start house (dialog 2007, DAT_00597ed0): lagna moved by n houses, "from <n> house" title', () => {
    const d = RASI_DASAS.Shoola(natal, 1, { shoolaFromHouse: 2 });
    expect(d.title).toBe('Shoola dasa from 3rd house (troubles and death)');
    expect(idx(d.periods[0].label)).toBe(strong7(mod12(ctx.lagna + 2), ctx));
    expect(shoolaTitle(11)).toBe('Shoola dasa from 12th house (troubles and death)');
    expect(RASI_DASAS.Shoola(natal, 2, { shoolaFromHouse: 0 })).toEqual(RASI_DASAS.Shoola(natal, 2));
    expect(RASI_DASAS.Shoola(natal, 1).title).toBe('Shoola dasa (troubles and death)');
  });

  it('"Start dasas from" reaches the dasas that read chart+0x17eb4[slot] (and Sudasa / Sthira their own tables)', () => {
    const start = mod12(ctx.lagna + 5);
    const ov = withOverrides(natal, { start });
    for (const s of ['Lagna Kendradi', 'AK Kendradi Rasi', 'Chara (Parasara)', 'Chara (K.N. Rao)', 'Yogardha', 'Niryaana Shoola', 'Brahma', 'Navamsa', 'Sudasa']) {
      const d = RASI_DASAS[s](ov, 1);
      if (s !== 'AK Kendradi Rasi') expect(idx(d.periods[0].label), s).toBe(start);
      else expect(d.periods.slice(0, 4).map((p) => idx(p.label)), s).toContain(start);
    }
    // not read by Trikona, Chara (Rangacharya), Drigdasa, Sthira (reads Narayana's D-1 start)
    for (const s of ['Trikona', 'Chara (Rangacharya)', 'Drigdasa', 'Sthira']) expect(RASI_DASAS[s](ov, 2), s).toEqual(RASI_DASAS[s](natal, 2));
    expect(idx(RASI_DASAS.Sthira(withOverrides(natal, { narayanaStart: start }), 1).periods[0].label)).toBe(start);
  });

  it('pair exception combos: SK of the stronger sign; the start sign\'s exception loses to them', () => {
    const lag = ctx.lagna, st = strong7(lag, ctx);
    const plain = RASI_DASAS.Narayana(natal, 1).periods.map((p) => p.label);
    // start = the computed stronger sign: its "Saturn exception" is overwritten by the pair combo (= computed flag)
    const base = skFlag(st, ctx);
    const other = base === 2 ? 0 : 2;
    expect(RASI_DASAS.Narayana(withOverrides(natal, { start: st, sk: other }), 1).periods.map((p) => p.label)).toEqual(plain);
    // the pair combo itself changes it
    const pairSk = Array.from({ length: 6 }, (_, k) => (k === st % 6 ? other : null)) as (0 | 2 | null)[];
    const flipped = RASI_DASAS.Narayana(withOverrides(natal, { pairSk }), 1).periods.map((p) => p.label);
    expect(flipped).not.toEqual(plain);
    expect(skFlag(st, rasiCtx(withOverrides(natal, { pairSk }), 0))).toBe(other);
    // the weaker sign keeps the start sign's exception
    const weak = mod12(st + 6);
    expect(skFlag(weak, rasiCtx(withOverrides(natal, { start: weak, sk: 1 }), 0))).toBe(1);
  });

  it('co-lord overrides reach Chara (K.N. Rao) / Chara (Parasara) years; empty overrides change nothing', () => {
    for (const s of Object.keys(RASI_DASAS)) expect(RASI_DASAS[s](withOverrides(natal, {}), 2), s).toEqual(RASI_DASAS[s](natal, 2));
    const both = (o: object) => ['Chara (K.N. Rao)', 'Chara (Parasara)'].map((s) => RASI_DASAS[s](withOverrides(natal, o), 1).periods.map(len));
    const sat = both({ aqLord: 'Saturn' }), rahu = both({ aqLord: 'Rahu' });
    // Aquarius years follow the chosen lord in at least one of the two unless both lords share a sign
    if (ctx.sign('Saturn') !== ctx.sign('Rahu')) expect(sat).not.toEqual(rahu);
  });
});

// ---- golden/jhora-dasa-rasi-options/<variant>/ (absent until captured) ----
const ROOT = 'golden/jhora-dasa-rasi-options';
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
describe.skipIf(!variants.length)('rasi dasa options match JHora 8.0 (golden/jhora-dasa-rasi-options)', async () => {
  const swe = await nodeSweph();
  for (const v of variants) {
    for (const f of readdirSync(`${ROOT}/${v}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${v}/${f}`, 'utf8')) as { ini_overrides: Record<string, string>; texts: { sub?: string; mode?: string; name?: string; lines?: string[] }[] };
      const patch = Object.fromEntries(Object.entries(g.ini_overrides ?? {}).map(([k, x]) => [k, Number(x)])) as Partial<JhoraIni>;
      for (const t of g.texts.filter((x) => x.lines && x.mode && /^(dasa|dasa_dates|dasa_level2_\d+)$/.test(x.name ?? ''))) {
        it(`${v} / ${f.slice(0, -5)}: ${t.mode} ${t.name}`, async () => {
          const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${f.slice(0, -5)}.jhd`, 'latin1')), { ...patch });
          const k = /^dasa_level2_(\d+)$/.exec(t.name!);
          const have = runTable(chart, 'dasas.rasi', { system: t.mode, path: k ? [Number(k[1])] : [], datesOnly: t.name === 'dasa_dates' }, swe);
          expect(sameTimes(have.text!, t.lines!, 2)).toEqual([]);
        });
      }
    }
  }
});
