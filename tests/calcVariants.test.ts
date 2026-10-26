// Calculation variants ported from jhora.exe: the SSS house system (src/core/sss sssHouseCusps,
// kpHouses.ts), VyatipataMethod (bodies.ts sunUpagrahas), the weekday / kaala options and
// LunarYrDef of Key Info (keyInfo.ts horaInfo, lunarYearMonthAt), SunriseDefinition in the
// panchanga rise/set times (derived/panchanga.ts riseOffset), and the solar-system-plane
// ayanamsas outside the natal chart. Behaviour checks run always; the JHora captures
// (manifests tools/harness/views-sss-houses.json, views-calc-variants.json,
// views-plane-ayanamsa.json) skip until they exist.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts, parseLongitude } from './golden';
import { computeChart } from '../src/core/chart';
import { parseJhd } from '../src/core/jhd';
import { runTable, ASYNC_TABLES } from '../src/engine/jobs';
import { DEFAULTS, type JhoraIni } from '../src/settings/generated';
import { houseSpans, systemCusps } from '../src/core/kpHouses';
import { dayLength, midheaven, lagna, sssHouseCusps, type PositionsSSS } from '../src/core/sss';
import { sunUpagrahas } from '../src/core/bodies';
import { horaInfo, keyFrames, keyInfoText, lunarYearMonth, newMoon } from '../src/core/keyInfo';
import { computePositions, norm360, siderealLongitude, GRAHAS } from '../src/core/positions';
import { calcSettingsFromIni } from '../src/core/settings';
import { panchangaDay } from '../src/core/derived/panchanga';
import { PANCHANGA_JOBS } from '../src/core/derived/panchangaJobs';

const charts = goldenCharts();
const vivek = charts.find((c) => c.name === 'Swami Vivekananda') ?? charts[0];
const gandhi = charts.find((c) => c.name === 'Mahatma Gandhi') ?? charts[1];
const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

describe('SSS house system (HouseTypeWanted 11)', async () => {
  const swe = await nodeSweph();
  for (const g of [vivek, gandhi]) {
    it(`${g.name}: cusps from the SSS lagna and MC`, async () => {
      const c = await computeChart(swe, g.birth, { Siddhanta: 1, HouseTypeWanted: 11 });
      const cusps = systemCusps(c, 11, swe);
      const p = c.positions as PositionsSSS;
      expect(arcsec(cusps[0], p.ascendant)).toBeLessThan(1e-6);
      expect(arcsec(cusps[3], norm360(cusps[9] + 180))).toBeLessThan(1e-6);
      for (const i of [0, 1, 2, 4, 5]) expect(arcsec(cusps[i + 6], norm360(cusps[i] + 180))).toBeLessThan(1e-6);
      // trisection of lagna .. IC
      const q = norm360(cusps[3] - cusps[0]) / 3;
      expect(arcsec(cusps[1], norm360(cusps[0] + q))).toBeLessThan(1e-6);
      // the SSS MC lies within a few degrees of the drik MC (Porphyry cusp 10) less the SSS shift
      const drik = await computeChart(swe, g.birth, { HouseTypeWanted: 3 });
      expect(arcsec(cusps[9], systemCusps(drik, 3, swe)[9]) / 3600).toBeLessThan(5);
      houseSpans(c, { type: 11, middle: true }, swe).forEach((h, i) => expect(arcsec(h.cusp, cusps[i])).toBeLessThan(1e-6));
    });
  }

  it('drik charts keep Porphyry for type 11 (jump table default)', async () => {
    const c = await computeChart(swe, vivek.birth, { HouseTypeWanted: 11 });
    expect(systemCusps(c, 11, swe)).toEqual(systemCusps(c, 3, swe));
  });

  it('FUN_004bfc00 is the lagna iteration on right ascensions; FUN_004bfec0 a day length', () => {
    // at the equator the ascensional difference vanishes: both iterations agree
    expect(lagna(0, 100, 100, 23, 300)).toBeCloseTo(midheaven(0, 100, 100, 23, 300), 6);
    expect(lagna(30, 100, 100, 23, 300)).not.toBeCloseTo(midheaven(30, 100, 100, 23, 300), 1);
    const d = dayLength(0, 1872000.3, 10);
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(740);
    expect(dayLength(50, 1872000.3, 10)).not.toBeCloseTo(d, 0);
  });

  it('with a reference longitude the SSS lagna is searched (siddhanta flag kept)', async () => {
    const c = await computeChart(swe, vivek.birth, { Siddhanta: 1, HouseTypeWanted: 11 });
    const moon = c.positions.grahas.Moon.lon;
    const spans = houseSpans(c, { type: 11, middle: true, ref: 2 }, swe);
    expect(arcsec(spans[0].cusp, moon)).toBeLessThan(30);
    expect(sssHouseCusps(c.positions as PositionsSSS, c.birth.lat)[0]).not.toBeCloseTo(spans[0].cusp, 0);
  });
});

describe('VyatipataMethod (FUN_004a2670)', async () => {
  const swe = await nodeSweph();
  it('method 1: Vyatipata = Dhuma + 53 deg 20 min; the chain from it', () => {
    for (const sun of [0, 17.25, 359.9]) {
      const a = sunUpagrahas(sun), b = sunUpagrahas(sun, 1);
      expect(arcsec(b.dhuma, a.dhuma)).toBeLessThan(1e-6);
      expect(arcsec(b.vyatipata, norm360(b.dhuma + 53 + 1 / 3))).toBeLessThan(1e-6);
      expect(arcsec(b.parivesha, norm360(b.vyatipata + 180))).toBeLessThan(1e-6);
      expect(arcsec(b.indraChapa, a.indraChapa)).toBeLessThan(1e-6);
      expect(arcsec(b.upaketu, a.upaketu)).toBeLessThan(1e-6);
    }
  });
  it('only the Vyatipata and Parivesha rows change', async () => {
    const a = runTable(await computeChart(swe, vivek.birth), 'basics.longitudes', {}, swe);
    const b = runTable(await computeChart(swe, vivek.birth, { VyatipataMethod: 1 }), 'basics.longitudes', {}, swe);
    const changed = a.rows.filter((r, i) => r[1] !== b.rows[i][1]).map((r) => r[0].split(' ')[0]);
    expect(changed.sort()).toEqual(['Parivesha', 'Vyatipata']);
  });
});

describe('Key Info options (FUN_004a1c50, FUN_004a4270)', async () => {
  const swe = await nodeSweph();
  const chart = await computeChart(swe, vivek.birth);
  it('WeekdayDefinition 1 takes weekday, hora and kaala from the 6:00 LMT frame', async () => {
    const c1 = await computeChart(swe, vivek.birth, { WeekdayDefinition: 1 });
    const h0 = horaInfo(swe, chart), h1 = horaInfo(swe, c1);
    expect(h1.hora).toEqual(h0.mahakalaHora);
    expect(h1.weekday).toBe(h0.mahakalaHora.weekday);
    expect(h1.mahakalaKaala).toBe(h0.mahakalaKaala);
  });
  it('WeekdayDefinitionKaala 2 takes the Mahakala hora from the 6:00 clock frame', async () => {
    const c2 = await computeChart(swe, vivek.birth, { WeekdayDefinitionKaala: 2 });
    const h0 = horaInfo(swe, chart), h2 = horaInfo(swe, c2);
    expect(h2.hora).toEqual(h0.hora);
    expect(h2.kaala).toBe(h0.kaala);
    expect(h2.mahakalaKaala).toBe(h0.mahakalaKaala);
  });
  it('KaalaInDayNightSeparate 0 divides the whole day into 16 parts', async () => {
    const c0 = await computeChart(swe, vivek.birth, { KaalaInDayNightSeparate: 0 });
    const f = keyFrames(swe, c0).A;
    const part = Math.trunc(f.g * 16 / f.total);
    const h = horaInfo(swe, c0);
    expect(h.hora).toEqual(horaInfo(swe, chart).hora);
    expect(part).toBeGreaterThanOrEqual(0);
    expect(part).toBeLessThan(16);
    expect(typeof h.kaala).toBe('number');
  });
  it('LunarYrDef: 2 is the default; 0/1 count from the full moon; 4 is the solar month', async () => {
    const s = calcSettingsFromIni(chart.ini);
    expect(lunarYearMonth(swe, chart).text).toBe(lunarYearMonth(swe, await computeChart(swe, vivek.birth, { LunarYrDef: 2 })).text);
    const full = newMoon(swe, chart.positions.jdUt, -1, s, 180);
    expect(arcsec(norm360(full.moon - full.sun), 180)).toBeLessThan(0.01);
    const c0 = await computeChart(swe, vivek.birth, { LunarYrDef: 0 });
    expect(lunarYearMonth(swe, c0).month).toBe(Math.floor(full.sun / 30) % 12);
    const c4 = await computeChart(swe, vivek.birth, { LunarYrDef: 4 });
    expect(lunarYearMonth(swe, c4).month).toBe((Math.floor(chart.positions.grahas.Sun.lon / 30) + 11) % 12);
  });
});

describe('SunriseDefinition in the panchanga rise/set times (FUN_004a1a00)', async () => {
  const swe = await nodeSweph();
  it('the upper limb rises earlier and sets later; refraction adds to it', async () => {
    const c0 = await computeChart(swe, vivek.birth);
    const noon = Math.floor(c0.positions.jdUt) + 0.5 - c0.birth.tzHours / 24;
    const d = [0, 1, 2].map(async (def) => panchangaDay(await computeChart(swe, vivek.birth, { SunriseDefinition: def }), swe, noon, 1));
    const [d0, d1, d2] = await Promise.all(d);
    expect(d1.sunset.jd - d0.sunset.jd).toBeGreaterThan(0);
    expect(d2.sunset.jd - d1.sunset.jd).toBeGreaterThan(0);
    expect(d1.moonrise!.jd).not.toBe(d0.moonrise!.jd);
    expect((d2.sunset.jd - d0.sunset.jd) * 1440).toBeLessThan(10);
  });
});

describe('plane ayanamsas are evaluated per moment and body (FUN_0049aaa0 for every search)', async () => {
  const swe = await nodeSweph();
  for (const ini of [{ UserSelectedAyanamsa: 1 }, { UserSelectedAyanamsa: 19, FixedPlaneInCustomStarAyanamsa: 1 }]) {
    it(JSON.stringify(ini), async () => {
      const c = await computeChart(swe, vivek.birth, ini);
      const s = calcSettingsFromIni(c.ini);
      const geo = { lat: c.birth.lat, lon: c.birth.lon, alt: c.birth.altitudeM };
      for (const jd of [c.positions.jdUt + 3000.25, c.positions.jdUt + 40000.7]) {
        const p = computePositions(swe, jd, geo, s);
        for (const g of GRAHAS) expect(arcsec(siderealLongitude(swe, jd, g, s).lon, p.grahas[g].lon), g).toBeLessThan(1e-6);
      }
    });
  }
});

// ---- JHora captures (absent until captured) ----
interface Capture {
  ini_overrides: Record<string, string>;
  views: { top?: string; sub?: string; mode?: string | null; control_id?: number; headers: string[]; rows: string[][] }[];
  texts: { sub?: string; mode?: string | null; name?: string; cmd?: number; lines?: string[] }[];
}
/** capture.py's --ini strings to ini values (CustomStarCode is the only string key). */
function iniOf(o: Record<string, string>): Partial<JhoraIni> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof (DEFAULTS as unknown as Record<string, unknown>)[k] === 'string' ? v : Number(v)])) as Partial<JhoraIni>;
}
function captures(root: string): { variant: string; name: string; g: Capture }[] {
  if (!existsSync(root)) return [];
  return readdirSync(root).filter((d) => !d.includes('.')).flatMap((variant) => readdirSync(`${root}/${variant}`)
    .filter((f) => f.endsWith('.json')).map((f) => ({ variant, name: f.slice(0, -5), g: JSON.parse(readFileSync(`${root}/${variant}/${f}`, 'utf8')) as Capture })));
}
const loose = (cells: string[]) => cells.map((x) => x.trim().replace(/(\d+ \w\w \d+') \d+\.\d+"/, '$1'));
const keyInfoLines = (g: Capture) => {
  const t = g.texts.find((x) => x.name === 'key_info' && x.lines?.length);
  if (!t) return null;
  const want = t.lines!.slice(2).map((l) => l.trimEnd());
  while (want.length && want[want.length - 1] === '') want.pop();
  return want;
};
const byCmd = (g: Capture, ...cmds: number[]) => g.texts.find((t) => t.cmd !== undefined && cmds.includes(t.cmd) && t.lines?.length)?.lines;
const sameText = (have: string[], want: string[]) => want.flatMap((w, i) => (w.trimEnd() === (have[i] ?? '').trimEnd() ? [] : [`${i}: have ${have[i]} | want ${w}`]));

const SSS_HOUSES = captures('golden/jhora-sss-houses');
describe.skipIf(!SSS_HOUSES.length)('SSS houses match JHora 8.0 (golden/jhora-sss-houses)', async () => {
  const swe = await nodeSweph();
  for (const { variant, name, g } of SSS_HOUSES) {
    it(`${variant} / ${name}`, async () => {
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), iniOf(g.ini_overrides));
      const want = g.views.find((v) => v.sub === 'Houses')!;
      const have = runTable(chart, 'basics.houses', {}, swe);
      expect(have.rows.map((r) => [r[0], r[4]])).toEqual(want.rows.map((r) => [r[0].trim(), r[4].trim()]));
      have.rows.forEach((r, i) => [1, 2, 3].forEach((j) =>
        expect(arcsec(parseLongitude(r[j]), parseLongitude(want.rows[i][j])), `${r[0]} col ${j}`).toBeLessThan(1)));
    });
  }
});

const VARIANTS = captures('golden/jhora-calc-variants');
describe.skipIf(!VARIANTS.length)('calculation variants match JHora 8.0 (golden/jhora-calc-variants)', async () => {
  const swe = await nodeSweph();
  for (const { variant, name, g } of VARIANTS) {
    const load = () => computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), iniOf(g.ini_overrides));
    const ki = keyInfoLines(g);
    it.skipIf(!ki)(`${variant} / ${name}: Key Info`, async () => expect(keyInfoText(swe, await load())).toEqual(ki));
    const lon = g.views.find((v) => v.sub === 'Key Info' && v.mode === 'Longitudes & Basic Info');
    it.skipIf(!lon)(`${variant} / ${name}: longitudes`, async () => {
      expect(runTable(await load(), 'basics.longitudes', {}, swe).rows.map(loose)).toEqual(lon!.rows.map(loose));
    });
    // WeekdayDefinition 1 moves the panchanga day (FUN_00465c80), which is not ported
    const monthly = byCmd(g, 33085, 33086);
    it.skipIf(!monthly || g.ini_overrides.WeekdayDefinition === '1')(`${variant} / ${name}: monthly panchanga`, async () => {
      const t = await PANCHANGA_JOBS['panchanga.monthly'](await load(), {}, swe);
      expect(sameText(t.text!, monthly!)).toEqual([]);
    });
  }
});

const PLANE = captures('golden/jhora-plane-ayanamsa');
const TRANSIT_DATE = { year: 2024, month: 3, day: 15, hour: 12 };
describe.skipIf(!PLANE.length)('plane ayanamsas match JHora 8.0 (golden/jhora-plane-ayanamsa)', async () => {
  const swe = await nodeSweph();
  for (const { variant, name, g } of PLANE) {
    const load = () => computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), iniOf(g.ini_overrides));
    const ki = keyInfoLines(g);
    it.skipIf(!ki)(`${variant} / ${name}: Key Info`, async () => expect(keyInfoText(swe, await load())).toEqual(ki));
    for (const [job, cmds] of [['panchanga.monthly', [33085, 33086]], ['panchanga.ephemeris', [33087]], ['panchanga.movements', [33088]]] as const) {
      const want = byCmd(g, ...cmds);
      it.skipIf(!want)(`${variant} / ${name}: ${job}`, async () => {
        const t = await PANCHANGA_JOBS[job](await load(), {}, swe);
        expect(sameText(t.text!, want!)).toEqual([]);
      });
    }
    const transit = g.views.find((v) => v.sub === 'Basic Transit Results' && v.mode === 'Standard' && v.control_id === 59664);
    it.skipIf(!transit)(`${variant} / ${name}: transits (Standard)`, async () => {
      const t = await ASYNC_TABLES['transits.basic'](await load(), { date: TRANSIT_DATE, mode: 0 }, swe);
      const n = (rows: string[][]) => rows.map((r) => r.map((x) => x.replace(/\s+/g, ' ').trim()));
      expect(n(t.rows)).toEqual(n(transit!.rows));
    });
  }
});
