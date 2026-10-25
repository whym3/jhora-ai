// Basics options ported from jhora.exe without JHora goldens yet: the body selection (32821 /
// 32930, [BodiesToShow]), Amsa rulers in every varga (menu 141, FUN_00495cc0), "List of supported
// yogas" (33077, FUN_00497290), the Key Info varga for longitudes (33242), the aspect evaluation
// options (33297) and AspectValueMax (menu 163). The golden blocks compare against
// tools/harness/views-basics-options.json captures and skip while those are absent.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts, type GoldenText } from './golden';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import { listCopyLines } from '../src/core/format/listCopy';
import { AMSA_RULER_VARGAS, vargaAmsaRuler } from '../src/core/amsaRulers';
import { supportedYogas } from '../src/core/yogas';
import { BODY_GROUPS, selectedBodies } from '../src/core/basics';
import { vargaLongitude } from '../src/core/vargas';
import { vargasOf } from '../src/core/vargaOptions';
import { formatLongitude, SIGNS } from '../src/core/zodiac';

const c0 = goldenV3Charts()[0];

describe.skipIf(!c0)('body selection (BodiesToShow)', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, c0.birth);
  const withIni = (ini: Record<string, number>) => computeChart(swe, c0.birth, ini);

  it('defaults: everything but the outer planets and (in Longitudes) the arudhas', () => {
    expect(selectedBodies({}).length).toBe(56);
    expect(runTable(natal, 'basics.longitudes', {}).rows.length).toBe(56);
  });
  it('outer planets follow Ketu; upagrahas and varnadas drop out of every Key Info list', async () => {
    const c = await withIni({ BodyTypeOuterPlanet: 1, BodyTypeUpagraha: 0, BodyTypeVarnadas: 0 });
    const names = (t: string) => runTable(c, t, {}, swe).rows.map((r) => r[0].replace(/ \(R\).*| - .*/, '').trim());
    const lon = names('basics.longitudes');
    expect(lon.slice(9, 13)).toEqual(['Ketu', 'Uranus', 'Neptune', 'Pluto']);
    for (const t of ['basics.longitudes', 'basics.natalLongitudes', 'basics.allDivisionalLongitudes', 'basics.rasisInVargas', 'basics.amsaRulers']) {
      const n = names(t);
      expect(n, t).not.toContain('Dhooma');
      expect(n, t).not.toContain('V2');
      expect(n, t).toContain('Varnada Lagna');
      expect(n, t).toContain('Uranus');
    }
    expect(names('aspects.evaluation')).toContain('Uranus');
  });
  it('arudha groups apply to Rasis occupied in all vargas', async () => {
    const c = await withIni({ BodyTypeGrahaArudha: 0, BodyTypeArudhaLagna: 0 });
    const rows = runTable(c, 'basics.rasisInVargas', {}).rows.map((r) => r[0]);
    expect(rows.some((r) => /Arudha$/.test(r))).toBe(false);
    expect(rows).not.toContain('AL');
    expect(rows).toContain('A2');
  });
  it('Amsa rulers list the bodies in index order (Bhava Lagna before Maandi)', () => {
    const rows = runTable(natal, 'basics.amsaRulers', {}).rows.map((r) => r[0].replace(/ \(R\)$/, ''));
    expect(rows.indexOf('Bhava Lagna')).toBeLessThan(rows.indexOf('Maandi'));
    expect(BODY_GROUPS.length).toBe(19);
  });
});

describe.skipIf(!c0)('Key Info options', async () => {
  const swe = await nodeSweph();
  const natal = await computeChart(swe, c0.birth);
  it('33242: longitudes in a divisional chart', () => {
    const t = runTable(natal, 'basics.longitudes', { varga: 'D9' });
    expect(t.headers[1]).toBe('Longitude (in D-9)');
    const d9 = vargaLongitude(natal.positions.grahas.Sun.lon, vargasOf(natal.ini).D9);
    const sun = t.rows.find((r) => r[0].startsWith('Sun'))!;
    expect(sun[1]).toBe(formatLongitude(d9));
    expect(sun[4]).toBe(SIGNS[Math.floor(d9 / 30)]);
  });
  it('33297: aspecting and aspected vargas', () => {
    const t = runTable(natal, 'aspects.evaluation', { aspectingVarga: 'D9', aspectedVarga: 'D10' });
    expect(t.headers[1]).toBe('Longitude (in D-10)');
    expect(t.rows[0][1]).toBe(formatLongitude(vargaLongitude(natal.positions.ascendant, vargasOf(natal.ini).D10)));
  });
  it('AspectValueMax (60 by default, 100 from menu 163) scales the aspect table', async () => {
    const at60 = runTable(natal, 'aspects.table', {});
    const at100 = runTable(await computeChart(swe, c0.birth, { AspectValueMax: 100 }), 'aspects.table', {});
    expect(at60.notes![0]).toBe('Full aspect value: 60');
    expect(at100.notes![0]).toBe('Full aspect value: 100');
    const n60 = at60.rows.flat().filter((x) => /^\d+$/.test(x)).map(Number), n100 = at100.rows.flat().filter((x) => /^\d+$/.test(x)).map(Number);
    expect(Math.max(...n100)).toBeGreaterThan(Math.max(...n60));
  });
});

describe('Amsa rulers in every varga (FUN_00495cc0)', () => {
  it('D-9: deva / manushya / raakshasa cycling from the sign (n + sign mod 3)', () => {
    // 1 deg Aries: navamsa 0 of a movable sign -> Deva; 1 deg Taurus -> Manushya
    expect(vargaAmsaRuler(1, 1).name).toBe('Deva');
    expect(vargaAmsaRuler(31, 1).name).toBe('Manushya');
    expect(vargaAmsaRuler(61, 1).name).toBe('Raakshasa');
  });
  it('D-2 and D-10 reverse in even signs; D-4 does not', () => {
    expect(vargaAmsaRuler(1, 2).name).toBe('Devas  -  Sun');
    expect(vargaAmsaRuler(31, 2).name).toBe('Pitris  -  Moon');
    expect(vargaAmsaRuler(31, 9)).toMatchObject({ division: 0, index: 9, name: 'Ananta' });
    expect(vargaAmsaRuler(31, 4)).toMatchObject({ division: 0, index: 0, name: 'Sanaka' });
  });
  it('D-30 by degree bands (odd: Agni 0-5 .. Varuna 25-30; even signs reversed)', () => {
    expect(vargaAmsaRuler(2, 16).name).toBe('Agni');
    expect(vargaAmsaRuler(27, 16).name).toBe('Varuna');
    expect(vargaAmsaRuler(32, 16).name).toBe('Varuna');
    expect(vargaAmsaRuler(57, 16).name).toBe('Agni');
  });
  it('D-20 uses the odd-sign and even-sign name lists', () => {
    expect(vargaAmsaRuler(0.5, 13).name).toBe('Kaali');
    expect(vargaAmsaRuler(30.5, 13).name).toBe('Dayaa');
  });
  it('the menu offers 16 vargas ending with D-150', () => {
    expect(AMSA_RULER_VARGAS.map((v) => v[1])).toEqual([32915, 32916, 32917, 32918, 32919, 32920, 32921, 32922, 32923, 32924, 32925, 32926, 32927, 32928, 32929, 33064]);
  });
});

describe('List of supported yogas (33077)', () => {
  it('every category in order, "%d %s" index and type', () => {
    const all = supportedYogas(0);
    expect(all.length).toBe(182);
    expect([all[0].type, all[0].name]).toEqual(['Mahapurusha', 'Hamsa']);
    const t = runTable({} as never, 'strengths.yogaList', { mode: 'Raja yogas' });
    expect(t.headers).toEqual(['Index & Type', 'Yoga', 'Brief definition of yoga', 'Results ascribed to yoga']);
    expect(t.rows.length).toBe(25);
    expect(t.rows[0][0]).toBe('1 Raja');
    expect(runTable({} as never, 'strengths.yogaList', { mode: 'Dhana yogas' }).rows.length).toBe(24);
  });
});

// ---- against JHora captures (tools/harness/views-basics-options.json), skipped until captured ----
interface Golden { texts: GoldenText[] }
const load = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({
  name: f.slice(0, -5), g: JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Golden,
})) : []);
const OPTIONS = load('golden/jhora-basics-options');
const BODIES = load('golden/jhora-bodies');
const VARNADA_ROW = /^(Varnada Lagna|V\d+) /;

describe.skipIf(!OPTIONS.length)('Amsa rulers and supported yogas match JHora 8.0 captures', async () => {
  const swe = await nodeSweph();
  for (const { name, g } of OPTIONS) {
    describe(name, async () => {
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      for (const t of g.texts.filter((x) => x.lines?.length && (x.cmd === 32976 || x.mode?.startsWith('Supported: ')))) {
        it(`${t.cmd} ${t.mode}`, () => {
          if (t.cmd === 32976) {
            const v = AMSA_RULER_VARGAS.find((x) => x[2] === t.mode)![0];
            const cut = (ls: string[]) => ls.map((l) => (v === 25 && VARNADA_ROW.test(l) ? l.slice(0, 23) : l));
            expect(cut(listCopyLines(runTable(chart, 'basics.amsaRulers', { varga: v })))).toEqual(cut(t.lines));
          } else {
            const mode = t.mode!.slice('Supported: '.length);
            expect(listCopyLines(runTable(chart, 'strengths.yogaList', { mode }))).toEqual(t.lines);
          }
        });
      }
    });
  }
});

describe.skipIf(!BODIES.length)('Key Info with a body selection matches JHora 8.0 captures', async () => {
  const swe = await nodeSweph();
  const ini = { BodyTypeOuterPlanet: 1, BodyTypeUpagraha: 0, BodyTypeVarnadas: 0, BodyTypeGrahaArudha: 0 };
  const TABLE: Record<string, string> = {
    'Longitudes & Basic Info': 'basics.longitudes', 'Planetary Aspect Evaluation': 'aspects.evaluation',
    'All Divisional Longitudes': 'basics.allDivisionalLongitudes', 'Rasis occupied in all vargas': 'basics.rasisInVargas', 'Natal Longitudes': 'basics.natalLongitudes',
  };
  for (const { name, g } of BODIES) {
    describe(name, async () => {
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), ini);
      for (const t of g.texts.filter((x) => x.cmd === 32975 && x.lines?.length && TABLE[x.mode!])) {
        it(t.mode!, () => expect(listCopyLines(runTable(chart, TABLE[t.mode!], {}, swe))).toEqual(t.lines));
      }
    });
  }
});
