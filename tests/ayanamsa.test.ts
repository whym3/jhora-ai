// JHora's ayanamsa choices (Preferences > Ayanamsa, dialog 155) against values
// computed with JHora's own swedll32.dll by tools/harness/dll_ayanamsa.py, which
// follows jhora.exe's FUN_0049a3a0 (sid modes), FUN_0049a370 (doc+0x1680) and the
// star shifts of FUN_0049aaa0 (fixture: tests/fixtures/ayanamsa-dll.json).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { birthJdUt } from '../src/core/jhd';
import { computePositions, GRAHAS, nakshatraShift } from '../src/core/positions';
import { AYANAMSA_BY_INDEX, AYANAMSA_CHOICES, calcSettingsFromIni } from '../src/core/settings';
import type { JhoraIni } from '../src/settings/generated';
import { goldenCharts } from './golden';
import { nodeSweph } from './helpers';

interface DllMode { lagnaAyanamsa: number; lons: number[] }
const fixture = JSON.parse(readFileSync('tests/fixtures/ayanamsa-dll.json', 'utf8')) as {
  charts: Record<string, { jdUt: number; nakshatraShift: number; modes: Record<string, DllMode> }>;
};

/** ini overrides for a fixture mode key ("17", "19:<CustomStarCode>:<lon>:<fixed plane>", then optional "|Key=value"). */
function iniFor(key: string): Partial<JhoraIni> {
  const [mode, extra] = key.split('|');
  const [i, code, lon, plane] = mode.split(':');
  const ini: Record<string, number | string> = code
    ? { UserSelectedAyanamsa: 19, CustomStarCode: code, CustomStarLongitude: +lon, FixedPlaneInCustomStarAyanamsa: +plane }
    : { UserSelectedAyanamsa: +i };
  if (extra) ini[extra.split('=')[0]] = +extra.split('=')[1];
  return ini as Partial<JhoraIni>;
}

const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;

describe('ayanamsa modes', () => {
  it('maps every dialog choice to its own mode', () => {
    expect(AYANAMSA_CHOICES.map((c) => c.index).sort((a, b) => a - b)).toEqual([...AYANAMSA_BY_INDEX.keys()]);
    expect(calcSettingsFromIni({}).ayanamsa).toBe('true-chitrapaksha');
    expect(calcSettingsFromIni({ UserSelectedAyanamsa: 16 }).ayanamsa).toBe('tropical');
    expect(calcSettingsFromIni({ UserSelectedAyanamsa: 18 }).sssAyanamsa).toBe(true);
    expect(calcSettingsFromIni({ UserSelectedAyanamsa: 19 }).customStar).toEqual({ code: ',alVir', lon: 180, fixedPlane: false });
  });

  it('matches the DLL for every mode on the golden charts (< 0.0001")', async () => {
    const swe = await nodeSweph();
    const worst: Record<string, number> = {};
    for (const c of goldenCharts()) {
      const f = fixture.charts[c.name];
      const jdUt = birthJdUt(c.birth, (y, m, d, h) => swe.julday(y, m, d, h));
      expect(jdUt).toBeCloseTo(f.jdUt, 9);
      await swe.ensureEphemeris(jdUt);
      for (const [key, dll] of Object.entries(f.modes)) {
        const p = computePositions(swe, jdUt, { lat: c.birth.lat, lon: c.birth.lon, alt: c.birth.altitudeM }, calcSettingsFromIni(iniFor(key)));
        const ours = GRAHAS.slice(0, 8).map((g) => p.grahas[g].lon);
        const err = Math.max(arcsec(p.ayanamsaMean, dll.lagnaAyanamsa), ...ours.map((l, i) => arcsec(l, dll.lons[i])));
        worst[key] = Math.max(worst[key] ?? 0, err);
      }
    }
    for (const [key, err] of Object.entries(worst)) expect(err, `mode ${key}`).toBeLessThan(1e-4);
  });

  it('SSS ayanamsa with the drik planets equals the one the SSS model uses', async () => {
    const swe = await nodeSweph();
    const c = goldenCharts()[0];
    const jdUt = birthJdUt(c.birth, (y, m, d, h) => swe.julday(y, m, d, h));
    await swe.ensureEphemeris(jdUt);
    const geo = { lat: c.birth.lat, lon: c.birth.lon, alt: 0 };
    const ini = { UserSelectedAyanamsa: 18, DeltaFromUserSelectedAyanamsa: 0.1 };
    const drik = computePositions(swe, jdUt, geo, calcSettingsFromIni(ini));
    const sss = computePositions(swe, jdUt, geo, calcSettingsFromIni({ ...ini, Siddhanta: 1 }));
    expect(drik.ayanamsaMean).toBe(sss.ayanamsaMean);
    expect(drik.ayanamsa).toBe(drik.ayanamsaMean);
  });

  it('shifts nakshatras by the Spica ayanamsa when tropical (SiderealNaksharasInTropical)', async () => {
    const swe = await nodeSweph();
    const s = calcSettingsFromIni({ UserSelectedAyanamsa: 16, SiderealNaksharasInTropical: 1 });
    for (const c of goldenCharts()) {
      const jdUt = birthJdUt(c.birth, (y, m, d, h) => swe.julday(y, m, d, h));
      await swe.ensureEphemeris(jdUt);
      expect(arcsec(nakshatraShift(swe, jdUt, s), fixture.charts[c.name].nakshatraShift)).toBeLessThan(1e-4);
    }
    expect(nakshatraShift(swe, 2451545, calcSettingsFromIni({ UserSelectedAyanamsa: 16 }))).toBe(0);
    expect(nakshatraShift(swe, 2451545, calcSettingsFromIni({ SiderealNaksharasInTropical: 1 }))).toBe(0);
  });
});
