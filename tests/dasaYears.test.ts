// Dasa year definitions (src/core/dasas/yearDefinition.ts): the 75 YearDefinition / YearLength
// slots, the clocks of FUN_0049dae0 and the compression of FUN_00408d90 / FUN_004093f0 /
// FUN_004094b0. golden/jhora-dasa-years/<variant>/ (tools/harness/views-dasa-years.json run with
// --ini "YearDefinition=<slot> <def>" --ini "YearLength=<slot> <days>") is checked when captured.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import { dasaClock } from '../src/core/dasas/time';
import { OTHER_DASAS, RASI_DASAS } from '../src/core/dasas/registry';
import { siderealLongitude } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { DEFAULTS } from '../src/settings/generated';
import {
  compressedYearDefinition, dasaSlot, menuYearLength, nominalYearLength, NAKSHATRA_SLOTS, OTHER_SLOTS, periodInYears, RASI_SLOTS,
  slotClock, slotYear, yearClock,
} from '../src/core/dasas/yearDefinition';

const n360 = (x: number) => ((x % 360) + 360) % 360;
const arr = <T>(base: T[], slot: number, v: T) => base.map((x, i) => (i === slot ? v : x));

describe('dasa year definitions', async () => {
  const swe = await nodeSweph();
  const birth = parseJhd(readFileSync('golden/charts/Mahatma Gandhi.jhd', 'latin1'));
  const natal = await computeChart(swe, birth);
  const jd0 = natal.positions.jdUt;

  it('slots follow the dispatcher FUN_00408d90 (0.. nakshatra, 25.. rasi, 60.. other)', () => {
    expect(RASI_SLOTS).toEqual(Object.keys(RASI_DASAS));
    expect([...OTHER_SLOTS].sort()).toEqual(Object.keys(OTHER_DASAS).sort());
    expect(NAKSHATRA_SLOTS.length).toBe(13);
    expect(dasaSlot('dasas.nakshatra', 'Vimsottari')).toBe(0);
    expect(dasaSlot('dasas.nakshatra', 'Kalachakra')).toBe(2);
    expect(dasaSlot('dasas.nakshatra', 'Saptarshi nakshatra')).toBe(12);
    expect(dasaSlot('dasas.rasi', 'Narayana')).toBe(25);
    expect(dasaSlot('dasas.rasi', 'Varnada')).toBe(45);
    expect(dasaSlot('dasas.other', 'Moola')).toBe(60);
    expect(dasaSlot('dasas.other', 'Karaka')).toBe(73);
    expect(dasaSlot('dasas.other', 'Chakra')).toBe(74);
  });

  it('the default (3, true sidereal) is the Sun search of time.ts for every slot', () => {
    for (const slot of [0, 25, 73]) {
      expect(slotYear(natal.ini, slot)).toEqual({ def: 3, len: 365.24219 });
      const a = slotClock(swe, natal, slot), b = dasaClock(swe, natal);
      for (const y of [-3.2, 10, 77.7]) expect(a.toJd(y)).toBe(b.toJd(y));
    }
  });

  it('menu lengths stored with each definition (FUN_00450290) and the nominal years of FUN_00408d90', () => {
    expect([0, 1, 3, 4, 6, 7].map((d) => menuYearLength(d))).toEqual([365.24219, 360, 365.256364, 354.36708, 365.256364, 365.24219]);
    expect(menuYearLength(2, 400)).toBe(400);
    expect([0, 1, 3, 4, 6, 7].map((d) => nominalYearLength(d, 999))).toEqual([365.24219, 360, 365.24219, 354.36708, 365.256364, 365.256364]);
    expect(nominalYearLength(2, 400)).toBe(400);
  });

  it('mean tropical / savana / user / mean sidereal count YearLength[slot] days, whatever it holds', () => {
    for (const [def, len] of [[0, 365.24219], [1, 360], [2, 400], [6, 365.256364], [1, 365.24219]] as const) {
      const c = yearClock(swe, natal, def, len);
      expect(c.toJd(10)).toBeCloseTo(jd0 + 10 * len, 9);
    }
  });

  it('a slot\'s definition changes only that dasa (Narayana 25 savana, Vimsottari stays)', async () => {
    const ini = { YearDefinition: arr(DEFAULTS.YearDefinition, 25, 1), YearLength: arr(DEFAULTS.YearLength, 25, 360) };
    const c = await computeChart(swe, birth, ini);
    expect(runTable(c, 'dasas.nakshatra', { system: 'Vimsottari' }, swe).rows).toEqual(runTable(natal, 'dasas.nakshatra', { system: 'Vimsottari' }, swe).rows);
    const nar = runTable(c, 'dasas.rasi', { system: 'Narayana' }, swe);
    expect(nar.rows).not.toEqual(runTable(natal, 'dasas.rasi', { system: 'Narayana' }, swe).rows);
    // Narayana starts at birth: the end of the first dasa is birth + years x 360 days
    expect(slotClock(swe, c, 25).toJd(5)).toBeCloseTo(jd0 + 1800, 9);
  });

  it('360 tithis (4): Moon - Sun gains a whole number of turns a year', () => {
    const s = calcSettingsFromIni(natal.ini);
    const el = (jd: number) => n360(siderealLongitude(swe, jd, 'Moon', s).lon - siderealLongitude(swe, jd, 'Sun', s).lon);
    const c = yearClock(swe, natal, 4, 354.36708);
    const jd = c.toJd(3);
    expect(Math.abs(jd - (jd0 + 3 * 354.36708))).toBeLessThan(20);
    expect(Math.abs(((el(jd) - el(jd0) + 540) % 360) - 180)).toBeLessThan(1e-3);
  });

  it('true tropical (7): the tropical Sun returns to its birth longitude', () => {
    const s = { ...calcSettingsFromIni(natal.ini), ayanamsa: 'tropical' as const, ayanamsaDelta: 0 };
    const sun = (jd: number) => siderealLongitude(swe, jd, 'Sun', s).lon;
    const jd = yearClock(swe, natal, 7, 365.24219).toJd(20);
    expect(Math.abs(((sun(jd) - sun(jd0) + 540) % 360) - 180)).toBeLessThan(1e-4);
    expect(Math.abs(jd - (jd0 + 20 * 365.24219))).toBeLessThan(1);
  });

  it('FUN_004093f0: Tajaka -> 3, TP -> 4, mundane "Sol" -> 3, "Lun"/"Moon" -> 4, unless the special years are off', () => {
    expect(compressedYearDefinition(1, 'Tajaka Year', {}, 6)).toBe(3);
    expect(compressedYearDefinition(2, 'Annual TP', {}, 0)).toBe(4);
    expect(compressedYearDefinition(5, 'Solar New Year', {}, 1)).toBe(3);
    expect(compressedYearDefinition(5, 'Lunar New Month', {}, 1)).toBe(4);
    expect(compressedYearDefinition(5, 'Rasi change (Su)', {}, 1)).toBe(1);
    expect(compressedYearDefinition(6, 'Prasna-108 (37)', {}, 6)).toBe(6);
    expect(compressedYearDefinition(1, 'Tajaka Year', { SpecialYearForTajaka: 0 }, 6)).toBe(6);
    expect(compressedYearDefinition(2, 'Annual TP', { SpecialYearForTP: 0 }, 0)).toBe(0);
  });

  it('FUN_004094b0: a period in years of a fixed-length definition is days / length', () => {
    expect(periodInYears(swe, natal, 3600, 1, 360)).toBeCloseTo(10, 6);
    expect(periodInYears(swe, natal, 3600, 2, 400)).toBeCloseTo(9, 6);
  });
});

// ---- JHora captures of the non-default definitions (absent until captured) ----
const ROOT = 'golden/jhora-dasa-years';
const variants = existsSync(ROOT) ? readdirSync(ROOT).filter((d) => !d.includes('.')) : [];
const SYSTEM_OF_SLOT: Record<number, [string, string, string]> = {
  0: ['Nakshatra dasas', 'dasas.nakshatra', 'Vimsottari'], 25: ['Rasi dasas', 'dasas.rasi', 'Narayana'], 73: ['Other dasas', 'dasas.other', 'Karaka'],
};
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
describe.skipIf(!variants.length)('non-default dasa year definitions match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const v of variants) {
    for (const f of readdirSync(`${ROOT}/${v}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${v}/${f}`, 'utf8')) as {
        ini_overrides: Record<string, string>; texts: { sub?: string; mode?: string; name?: string; lines?: string[] }[];
      };
      const [slot, def] = (g.ini_overrides.YearDefinition ?? '0 3').split(' ').map(Number);
      const len = Number((g.ini_overrides.YearLength ?? `${slot} 365.24219`).split(' ')[1]);
      const [sub, table, system] = SYSTEM_OF_SLOT[slot] ?? SYSTEM_OF_SLOT[0];
      const want = g.texts.find((t) => t.sub === sub && t.mode === system && t.name === 'dasa' && t.lines)?.lines;
      it.skipIf(!want)(`${v} / ${f.slice(0, -5)}: ${system} with YearDefinition[${slot}] = ${def}, YearLength ${len}`, async () => {
        const ini = { YearDefinition: arr(DEFAULTS.YearDefinition, slot, def), YearLength: arr(DEFAULTS.YearLength, slot, len) };
        const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${f.slice(0, -5)}.jhd`, 'latin1')), ini);
        const t = runTable(chart, table, { system, path: [] }, swe);
        expect(sameTimes(t.text!, want!, def === 4 ? 3 : 2)).toEqual([]);
      });
    }
  }
});

describe('year definition menu (FUN_00450290)', () => {
  it('stores the definition and its length for this dasa, all dasas or the category', async () => {
    const { applyYearDefinition } = await import('../src/core/dasas/yearDefinition');
    const one = applyYearDefinition(DEFAULTS, 25, 1, 0, 0);
    expect(one.YearDefinition.filter((v) => v === 1).length).toBe(1);
    expect(one.YearDefinition[25]).toBe(1);
    expect(one.YearLength[25]).toBe(360);
    const cat = applyYearDefinition(DEFAULTS, 30, 6, 0, 2);
    expect(cat.YearDefinition.slice(25, 60).every((v) => v === 6)).toBe(true);
    expect(cat.YearDefinition[24]).toBe(3);
    expect(cat.YearLength[40]).toBe(365.256364);
    const all = applyYearDefinition(DEFAULTS, 0, 2, 400, 1);
    expect(all.YearLength.every((v) => v === 400)).toBe(true);
  });
});
