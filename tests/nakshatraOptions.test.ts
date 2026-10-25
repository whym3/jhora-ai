// Nakshatra dasa options per slot (build.ts / nakshatra.ts / vimsottari.ts): seed
// (NakshatraDasaStartPoint, FUN_004a4b10), NakshatraDasaShift, NaksDasaADMethodPreference
// (FUN_004b3720) and AntiZodiacalDasa. golden/jhora-dasa-options/<variant>/ (captured with
// tools/harness/views-dasa-options.json and one --ini override) is checked when present.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import { adIndex, vimsottari } from '../src/core/dasas/vimsottari';
import { NAKSHATRA_DASAS, nakshatraDasa, nakshatraSeedLon } from '../src/core/dasas/nakshatra';
import { NAK_LORD } from '../src/core/lords';
import { DEFAULTS } from '../src/settings/generated';
import { NAKSHATRA_SLOTS } from '../src/core/dasas/yearDefinition';
import { buildDasa } from '../src/core/dasas/build';

const NAK = 360 / 27;
const arr = <T>(base: T[], slot: number, v: T) => base.map((x, i) => (i === slot ? v : x));

describe('nakshatra dasa options', async () => {
  const swe = await nodeSweph();
  const birth = parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1'));
  const natal = await computeChart(swe, birth);
  const moon = natal.positions.grahas.Moon.lon;

  it('FUN_004b3720 antardasa orders', () => {
    expect([0, 1, 2, 3, 4, 5].map((m) => [0, 1, 2].map((j) => adIndex(3, j, 9, m)))).toEqual([
      [3, 4, 5], [3, 2, 1], [4, 5, 6], [4, 3, 2], [2, 3, 4], [2, 1, 0],
    ]);
    expect([0, 1, 2].map((j) => adIndex(3, j, 9, 0, true))).toEqual([3, 2, 1]);
  });

  it('seeds of FUN_004a4b10: Utpanna / Kshema / Aadhaana are 4 / 3 / 7 stars from the Moon, 4 the lagna', () => {
    expect(nakshatraSeedLon(natal, 1)).toBeCloseTo((moon + 4 * NAK) % 360, 9);
    expect(nakshatraSeedLon(natal, 2)).toBeCloseTo((moon + 3 * NAK) % 360, 9);
    expect(nakshatraSeedLon(natal, 3)).toBeCloseTo((moon + 7 * NAK) % 360, 9);
    expect(nakshatraSeedLon(natal, 4)).toBe(natal.positions.ascendant);
    expect(nakshatraSeedLon(natal, 8)).toBe(natal.positions.grahas.Sun.lon);
  });

  it('Vimsottari: shift moves the counting star back, anti-zodiacal runs backwards with the elapsed part', () => {
    const n = Math.floor(moon / NAK), frac = moon / NAK - n;
    const plain = vimsottari(moon, 1);
    const shifted = vimsottari(moon, 1, { shift: 1 });
    expect(shifted[0].lord).toBe(NAK_LORD[(n + 8) % 9]);
    expect(shifted[1].lord).toBe(plain[0].lord);
    const rev = vimsottari(moon, 2, { reverse: true });
    expect(rev.map((p) => p.lord)).toEqual([0, 8, 7, 6, 5, 4, 3, 2, 1].map((k) => NAK_LORD[(n + k) % 9]));
    expect(-rev[0].start).toBeCloseTo((1 - frac) * (rev[0].end - rev[0].start), 9);
    expect(rev[0].children!.map((p) => p.lord)).toEqual(rev.map((p) => p.lord));
  });

  it('grouped dasas: the 28-star scheme reproduces the default groups and rotates with the shift', () => {
    for (const key of ['Ashtottari', 'Shashtihayani']) {
      const def = NAKSHATRA_DASAS[key];
      expect(nakshatraDasa(def, moon, 2, { shift: 28 })).toEqual(nakshatraDasa(def, moon, 2));
      expect(nakshatraDasa(def, moon, 1, { shift: 1 })).not.toEqual(nakshatraDasa(def, moon, 1));
    }
  });

  it('per-slot ini arrays reach the Dasas tab (NakshatraDasaStartPoint[0] = 4: Vimsottari from the lagna)', async () => {
    const c = await computeChart(swe, birth, { NakshatraDasaStartPoint: arr(DEFAULTS.NakshatraDasaStartPoint, 0, 4) });
    expect(buildDasa(c, 'dasas.nakshatra', 'Vimsottari', 2).periods).toEqual(vimsottari(natal.positions.ascendant, 2));
    expect(runTable(c, 'dasas.nakshatra', { system: 'Vimsottari' }, swe).rows).not.toEqual(runTable(natal, 'dasas.nakshatra', { system: 'Vimsottari' }, swe).rows);
    // Ashtottari (slot 1) is not affected by slot 0
    expect(buildDasa(c, 'dasas.nakshatra', 'Ashtottari', 2).periods).toEqual(buildDasa(natal, 'dasas.nakshatra', 'Ashtottari', 2).periods);
  });
});

const ROOT = 'golden/jhora-dasa-options';
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
const KEYS = ['NakshatraDasaStartPoint', 'NakshatraDasaShift', 'NaksDasaADMethodPreference', 'AntiZodiacalDasa'] as const;
describe.skipIf(!variants.length)('nakshatra dasa options match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const v of variants) {
    for (const f of readdirSync(`${ROOT}/${v}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${v}/${f}`, 'utf8')) as { ini_overrides: Record<string, string>; texts: { sub?: string; mode?: string; name?: string; lines?: string[] }[] };
      const key = KEYS.find((k) => g.ini_overrides[k] !== undefined);
      if (!key) continue;
      const [slot, value] = g.ini_overrides[key].split(' ').map(Number);
      const system = NAKSHATRA_SLOTS[slot];
      for (const name of ['dasa', 'dasa_level2_0']) {
        const want = g.texts.find((t) => t.mode === system && t.name === name && t.lines)?.lines;
        it.skipIf(!want)(`${v} / ${f.slice(0, -5)}: ${system} ${name} with ${key}[${slot}] = ${value}`, async () => {
          const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${f.slice(0, -5)}.jhd`, 'latin1')), { [key]: arr(DEFAULTS[key], slot, value) });
          const t = runTable(chart, 'dasas.nakshatra', { system, path: name === 'dasa' ? [] : [0] }, swe);
          expect(sameTimes(t.text!, want!, 2)).toEqual([]);
        });
      }
    }
  }
});
