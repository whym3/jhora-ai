// Strength, chakra and calculation options ported from jhora.exe (see the routines named in
// src/core/otherStrengths.ts, ashtakavarga.ts, pushkara.ts, arudhaPadas.ts, longitudes.ts,
// positions.ts, kpHouses.ts, chakras/sarvatobhadra.ts, derived/nisheka.ts): behaviour checks
// that run always, and JHora captures of the non-default options (golden/jhora-calc-options,
// manifest tools/harness/views-calc-options.json) that skip until captured.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';
import { parseJhd } from '../src/core/jhd';
import { DEFAULTS, type JhoraIni } from '../src/settings/generated';
import { basicAvasthas, vaiseshikamsas } from '../src/core/otherStrengths';
import { ashtakavarga, avOptionsFromIni, AV_BODIES, bhinnashtakavargas, pindaNakshatras, prastara, type AvBody } from '../src/core/ashtakavarga';
import { fromMrityuBhaga, fromPushkaraBhaga } from '../src/core/pushkara';
import { DEBILITATION, EXALTATION } from '../src/core/signStrength';
import { bhavaArudhaSigns } from '../src/core/arudhaPadas';
import { longitudeBhavaArudhas } from '../src/core/arudhas';
import { refracTrueToApp } from '../src/core/positions';
import { houseOptions, houseSpans } from '../src/core/kpHouses';
import { nishekaMoment } from '../src/core/derived/nisheka';
import {
  sbcHouse, sbcPlanetNakshatra, sbcSpecialNakshatraFrom, sbcSpecialNakshatraNatal, sbcSpecialTithi, sbcStar27At, sbcStarAt,
  sbcTaraFrom, sbcTaraNatal, SBC_STAR_CELLS,
} from '../src/core/chakras/sarvatobhadra';
import { nakshatra28Of, nakshatraOf } from '../src/core/zodiac';
import { GRAHAS } from '../src/core/positions';
import { SIGN_LORD } from '../src/core/lords';

const charts = goldenCharts();
const vivek = charts.find((c) => c.name === 'Swami Vivekananda') ?? charts[0];

describe('strength options', async () => {
  const swe = await nodeSweph();
  const c0 = await computeChart(swe, vivek.birth);

  it('defaults: vaiseshikamsas count own / exaltation / moolatrikona signs only', async () => {
    // swarudha 0 ignores every overriding condition: the toggles change nothing
    const c1 = await computeChart(swe, vivek.birth, { CombustionBadInAmsaBala: 0, NeechaBadInAmsaBala: 0, SayanadiBadInAmsaBala: 0 });
    expect(vaiseshikamsas(c1)).toEqual(vaiseshikamsas(c0));
  });

  it('swarudha adds kendras from the arudha; overriding conditions only remove them again', async () => {
    for (const sw of [1, 2, 3, 4, 5, 6, 7]) {
      const plain = vaiseshikamsas(await computeChart(swe, vivek.birth, { SwarudhaInAmsaBala: sw, CombustionBadInAmsaBala: 0, DefeatBadInAmsaBala: 0, NeechaBadInAmsaBala: 0, PoorVimsopakaBadInAmsaBala: 0, SayanadiBadInAmsaBala: 0 }));
      const strict = vaiseshikamsas(await computeChart(swe, vivek.birth, {
        SwarudhaInAmsaBala: sw, DispositorCombustionBadInAmsaBala: 1, DispositorDefeatBadInAmsaBala: 1, DispositorNeechaBadInAmsaBala: 1,
        DispositorNeechaRasiBadInAmsaBala: 1, DispositorPoorVimsopakaBadInAmsaBala: 1, DispositorSayanadiBadInAmsaBala: 1,
      }));
      const base = vaiseshikamsas(c0);
      for (const g of GRAHAS) {
        plain[g].forEach((x, i) => {
          expect(x.count, `swarudha ${sw} ${g}`).toBeGreaterThanOrEqual(base[g][i].count);
          expect(strict[g][i].count).toBeLessThanOrEqual(x.count);
          expect(strict[g][i].count).toBeGreaterThanOrEqual(base[g][i].count);
        });
      }
    }
  });

  it('avastha varga 0 and the default relationships keep the D-1 table', async () => {
    expect(basicAvasthas(c0, 0)).toEqual(basicAvasthas(c0));
    const d9 = basicAvasthas(c0, 1);
    for (const g of GRAHAS) expect(d9[g].age).toBe(basicAvasthas(c0)[g].age);
    const t = runTable(c0, 'strengths.basicAvasthas', { varga: 1 });
    expect(t.headers).toEqual(['Planet', 'Age', 'Alertness (D-9)', 'Mood (D-9)']);
    // compound relationships: a friend of the lord is never asleep when also a temporary friend
    const cc = await computeChart(swe, vivek.birth, { UseCompundRelationshipInAvasthas: 1, CompoundRelationshipsFromRasi: 1 });
    expect(Object.keys(basicAvasthas(cc, 1))).toEqual(GRAHAS);
  });

  it('vimsopaka with rasi relationships equals the default in the rasi chart', async () => {
    const r = runTable(await computeChart(swe, vivek.birth, { CompoundRelationshipsFromRasi: 1 }), 'strengths.vimsopaka', {});
    const d = runTable(c0, 'strengths.vimsopaka', {});
    expect(r.rows.length).toBe(d.rows.length);
  });
});

describe('ashtakavarga options (dialog 165)', async () => {
  const swe = await nodeSweph();
  const c = await computeChart(swe, vivek.birth);
  const sign = (b: AvBody) => Math.floor((b === 'Lagna' ? c.positions.ascendant : c.positions.grahas[b].lon) / 30);
  it('defaults read from the ini equal the built-in defaults', () => {
    expect(ashtakavarga(sign, avOptionsFromIni(DEFAULTS))).toEqual(ashtakavarga(sign));
  });
  it('the reversed meaning moves every bindu to the contributor; totals are kept', () => {
    const o = { ...avOptionsFromIni(DEFAULTS), reversed: true };
    const r = bhinnashtakavargas(sign, o), d = bhinnashtakavargas(sign);
    const sum = (x: Record<AvBody, number[]>) => AV_BODIES.reduce((a, b) => a + x[b].reduce((p, q) => p + q, 0), 0);
    expect(sum(r)).toBe(sum(d));
    // PAV of X, row Y (reversed) = bindus of Y's BAV from X: the PAV totals give the BAV
    for (const b of AV_BODIES) {
      const pav = prastara(b, sign, o);
      expect(Array.from({ length: 12 }, (_, s) => AV_BODIES.reduce((a, x) => a + pav[x][s], 0))).toEqual(r[b]);
    }
  });
  it('eight AVs in the SAV add the lagna; the bhava SAV keeps the total', () => {
    const d = ashtakavarga(sign);
    const e = ashtakavarga(sign, { ...avOptionsFromIni(DEFAULTS), eightInSav: true });
    expect(e.sav.map((x, s) => x - d.sav[s])).toEqual(d.bav.Lagna);
    const h = ashtakavarga(sign, { ...avOptionsFromIni(DEFAULTS), bhavaSav: true });
    expect(h.sav.reduce((a, x) => a + x, 0)).toBe(337);
  });
  it('one Parasara flag off moves one bindu', () => {
    const f = avOptionsFromIni({ AshtakaVargaCalculation: [1, 1, 1, 1, 1, 0] });
    const a = ashtakavarga(sign, f), d = ashtakavarga(sign);
    expect(AV_BODIES.reduce((n, b) => n + a.bav[b].filter((x, s) => x !== d.bav[b][s]).length, 0)).toBeLessThanOrEqual(2);
  });
  it('32843: nakshatra and rasi of BAV count x sodhya pinda; lagna shift (32973)', () => {
    const av = ashtakavarga(sign);
    const n = pindaNakshatras(av);
    const k = av.bav.Sun[0] * av.pindas.Sun.total;
    expect(n.Sun[0]).toEqual({ nakshatra: ((k % 27) || 27) - 1, rasi: ((k % 12) || 12) - 1 });
    const t = runTable(c, 'strengths.ashtakavarga', { mode: 'Nakshatras & rasis', varga: 'D1' });
    expect(t.rows).toHaveLength(12);
    const s0 = runTable(c, 'strengths.ashtakavarga', { mode: 'BAVs and SAV', varga: 'D1', lagnaShift: 0 });
    const s3 = runTable(c, 'strengths.ashtakavarga', { mode: 'BAVs and SAV', varga: 'D1', lagnaShift: 3 });
    const s12 = runTable(c, 'strengths.ashtakavarga', { mode: 'BAVs and SAV', varga: 'D1', lagnaShift: 12 });
    expect(s12.rows).toEqual(s0.rows);
    expect(s3.rows[0]).not.toEqual(s0.rows[0]);
  });
});

describe('calculation options', async () => {
  const swe = await nodeSweph();
  const c0 = await computeChart(swe, vivek.birth);

  it('pushkara bhaga (33392) and mrityu bhaga (33079) tables', () => {
    expect(fromPushkaraBhaga(2 * 30 + 23.4, false)).toBeCloseTo(-0.1, 9);    // Patel: Gemini 24
    expect(fromPushkaraBhaga(2 * 30 + 17.4)).toBeCloseTo(-0.1, 9);           // JP: Gemini 18
    expect(fromMrityuBhaga('Moon', 26.2, { table: 1, location: 1 })).toBeCloseTo(0.2, 9);
    expect(fromMrityuBhaga('Jupiter', 19.2, { table: 0, location: 0 })).toBeCloseTo(-0.3, 9);
    expect(fromMrityuBhaga('Jupiter', 19.2)).toBeCloseTo(0.7, 9);
  });

  it('nodal exaltation (33391) is applied per chart and reset by the default', async () => {
    await computeChart(swe, vivek.birth, { NodalExaltationParasara: 1 });
    expect([EXALTATION.Rahu, EXALTATION.Ketu, DEBILITATION.Rahu, DEBILITATION.Ketu]).toEqual([1, 7, 7, 1]);
    await computeChart(swe, vivek.birth);
    expect([EXALTATION.Rahu, EXALTATION.Ketu, DEBILITATION.Rahu, DEBILITATION.Ketu]).toEqual([2, 8, 8, 2]);
  });

  it('upagraha options move Mandi / Gulika only', async () => {
    const c = await computeChart(swe, vivek.birth, { MandiInSaturnPortion: 0, GulikaInSaturnPortion: 0 });
    const lon = (x: typeof c, n: string) => x.longitudes.find((b) => b.name === n)!.lon;
    expect(lon(c, 'Maandi')).not.toBeCloseTo(lon(c0, 'Maandi'), 3);
    expect(lon(c, 'Kaala')).toBe(lon(c0, 'Kaala'));
    const l = await computeChart(swe, vivek.birth, { UpagrahaDayDefinition: 1 });
    expect(lon(l, 'Hora Lagna')).toBe(lon(c0, 'Hora Lagna'));
    const k = await computeChart(swe, vivek.birth, { ContinuousSpecialLagnas: 1 });
    const d = c0.positions.grahas.Sun.lon - c0.longitudes.find((b) => b.name === 'Bhava Lagna')!.lon + c0.day.ghatis * 6;
    expect(Math.abs((lon(k, 'Bhava Lagna') - lon(c0, 'Bhava Lagna') + 360) % 360 - ((d % 360 + 360) % 360))).toBeLessThan(1e-6);
  });

  it('swe_refrac: Bennett above 15 deg, none below -5', () => {
    expect(refracTrueToApp(45, 1010, 10)).toBeCloseTo(45 + (58.276 - 0.0824) / 3600, 9);
    expect(refracTrueToApp(-10, 1013, 20)).toBe(-10);
  });

  it('refraction (dialog 149) shifts positions by under a degree', async () => {
    const c = await computeChart(swe, vivek.birth, { ApparentRefraction: 1 });
    for (const g of GRAHAS) {
      const d = Math.abs(((c.positions.grahas[g].lon - c0.positions.grahas[g].lon + 540) % 360) - 180);
      expect(d, g).toBeLessThan(1);
    }
    expect(c.positions.ascendant).toBe(c0.positions.ascendant);
  });

  it('sidereal nakshatras with the tropical zodiac (SiderealNaksharasInTropical)', async () => {
    const c = await computeChart(swe, vivek.birth, { UserSelectedAyanamsa: 16, SiderealNaksharasInTropical: 1 });
    expect(c.nakshatraShift).toBeDefined();
    expect(Math.abs(c.nakshatraShift! + c0.positions.ayanamsa)).toBeLessThan(1);
    const t = runTable(c, 'basics.longitudes', {});
    const moon = t.rows.find((r) => r[0].startsWith('Moon'))!;
    expect(runTable(c0, 'basics.longitudes', {}).rows.find((r) => r[0].startsWith('Moon'))![2]).toBe(moon[2]);
  });

  it('longitude based bhava arudhas (33245) from a base body', async () => {
    const c = await computeChart(swe, vivek.birth, { LongitudeBasedBhavaArudhas: 1 });
    const a = bhavaArudhaSigns(c, 'D1');
    expect(a).toHaveLength(12);
    const lon = (b: number) => (b === 0 ? c.positions.ascendant : c.positions.grahas[GRAHAS[b - 1]].lon);
    const opt = { bhavaExceptions: false, grahaExceptions: false, nodesAsLords: false };
    // without exceptions an arudha is twice the lord's distance from the house
    const l = longitudeBhavaArudhas(lon, 2, { sign: (g) => Math.floor(c.positions.grahas[g].lon / 30), degree: () => 0 }, opt);
    const lord = SIGN_LORD[Math.floor(c.positions.grahas.Moon.lon / 30)];
    expect(l[0]).toBeCloseTo((2 * c.positions.grahas[lord].lon - c.positions.grahas.Moon.lon + 720) % 360, 6);
  });

  it('houses from a reference longitude (33248)', async () => {
    const opt = houseOptions(c0, 2);
    const h = houseSpans(c0, opt, swe);
    expect(h[0].cusp).toBeCloseTo(c0.positions.grahas.Moon.lon, 3);
    const r0 = houseSpans(c0, houseOptions(c0), swe);
    expect(r0[0].cusp).toBeCloseTo(c0.positions.ascendant, 9);
  });

  it('Nisheka (33291): conception about nine months before birth', async () => {
    const m = nishekaMoment(swe, c0);
    const days = c0.positions.jdUt - m.jd;
    expect(days).toBeGreaterThan(28);
    expect(days).toBeLessThan(400);
    expect(days).toBeCloseTo(m.days * 360 / 365, 9);
  });
});

describe('Sarvatobhadra special points', async () => {
  const swe = await nodeSweph();
  const c = await computeChart(swe, vivek.birth);
  it('box to star (FUN_00474b80) agrees with the 28-star layout', () => {
    SBC_STAR_CELLS.forEach(([r, col], k28) => {
      const k27 = sbcStar27At(r, col)!;
      expect(k27 === null).toBe(false);
      expect(k28 === 21 ? 20 : k28 > 21 ? k28 - 1 : k28).toBe(k27);
    });
    expect(sbcStar27At(0, 0)).toBeNull();
    expect(sbcStar27At(4, 4)).toBeNull();
  });
  it('janma nakshatra is the Moon\'s box; tara 0 holds its three trines', () => {
    const [cell] = sbcSpecialNakshatraNatal(c, 0, 0);
    expect(sbcStarAt(cell.row, cell.col)).toBe(nakshatra28Of(c.positions.grahas.Moon.lon));
    const t = sbcTaraNatal(c, 0, 0);
    expect(t).toHaveLength(3);
    const n27 = nakshatraOf(c.positions.grahas.Moon.lon);
    expect(t.map((x) => sbcStar27At(x.row, x.col))).toEqual([n27, (n27 + 9) % 27, (n27 + 18) % 27]);
    const [from] = sbcSpecialNakshatraFrom(cell.row, cell.col, 1);
    expect((sbcStarAt(from.row, from.col) - sbcStarAt(cell.row, cell.col) + 28) % 28).toBe(9);
    expect(sbcTaraFrom(c, cell.row, cell.col, 0, 0)).toHaveLength(3);
  });
  it('tithi, house and planet points land on tithi, rasi and star boxes', () => {
    expect(sbcSpecialTithi(c, 0, 0)).toHaveLength(1);
    const [h] = sbcHouse(c, 0, 0, 0);
    expect(h.row >= 2 && h.row <= 6 && h.col >= 2 && h.col <= 6).toBe(true);
    const [p] = sbcPlanetNakshatra(c, 1, 0);
    expect(sbcStarAt(p.row, p.col)).toBe(nakshatra28Of(c.positions.grahas.Moon.lon));
  });
});

describe('option dialogs 165 and 2047 (FUN_004e7db0 / FUN_004e80a0 DDX maps)', async () => {
  const { applyFields, dialogFields, optionDialog, readField } = await import('../src/ui/dialogs/optionRegistry');
  const set = (dialog: number, values: Record<number, number>) => {
    const d = optionDialog(dialog)!;
    return applyFields(d, DEFAULTS, { ...Object.fromEntries(dialogFields(d).map((f) => [f.id, readField(f, DEFAULTS)])), ...values });
  };
  it('165: check 1010 inverts AshtakaVargaDefinition; 1001..1004, 1008, 1009 are the six flags', () => {
    expect(readField(dialogFields(optionDialog(165)!).find((f) => f.id === 1010)!, DEFAULTS)).toBe(0);
    expect(set(165, { 1010: 1 }).AshtakaVargaDefinition).toBe(0);
    expect(set(165, { 1009: 0, 1002: 0 }).AshtakaVargaCalculation).toEqual([1, 0, 1, 1, 1, 0]);
    expect(set(165, { 1012: 1, 1013: 1 })).toMatchObject({ BhavaDrivenSarvaAshtakaVarga: 1, EightAVInSAV: 1 });
  });
  it('2047: combo 1003 is SwarudhaInAmsaBala, 1014/1015 the satru-sthana checks', () => {
    expect(set(2047, { 1003: 5, 1014: 0, 1015: 1 })).toMatchObject({ SwarudhaInAmsaBala: 5, PoorVimsopakaBadInAmsaBala: 0, DispositorPoorVimsopakaBadInAmsaBala: 1 });
  });
});

// ---- JHora captures of the non-default options (absent until captured) ----
const ROOT = 'golden/jhora-calc-options';
const variants = existsSync(ROOT) ? readdirSync(ROOT).filter((d) => !d.includes('.')) : [];
interface Capture {
  ini_overrides: Record<string, string>;
  views: { sub?: string; mode?: string | null; headers: string[]; rows: string[][] }[];
  texts: { sub?: string; mode?: string | null; name?: string; lines?: string[] }[];
}
/** capture.py's --ini strings to ini values ("i v" of an array key sets slot i). */
function iniOf(o: Record<string, string>): Partial<JhoraIni> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    const d = (DEFAULTS as unknown as Record<string, unknown>)[k];
    if (Array.isArray(d)) { const [i, x] = v.split(' ').map(Number); const a = d.slice(); a[i] = x; out[k] = a; } else out[k] = Number(v);
  }
  return out as Partial<JhoraIni>;
}
const norm = (s: string) => s.trim().split(/\s+/).join(' ');
const PANE: Record<string, string> = {
  'Vimsopaka Balas': 'strengths.vimsopaka', 'Amsa Balas': 'strengths.amsaBalas', 'Basic Avasthas': 'strengths.basicAvasthas', 'Sayanadi Avasthas': 'strengths.sayanadi',
};
const KEY_INFO: Record<string, string> = { 'Pushkaramsas': 'basics.pushkara', 'Mrityu Bhaga': 'basics.mrityuBhaga', 'Combustion': 'basics.combustion' };
const loose = (cells: string[]) => cells.map((x) => x.trim().replace(/(\d+ \w\w \d+') \d+\.\d+"/, '$1').replace(/^(\d+\.\d\d)\d\d deg$/, '$1'));

describe.skipIf(!variants.length)('calculation options match JHora 8.0 (golden/jhora-calc-options)', async () => {
  const swe = await nodeSweph();
  for (const v of variants) {
    for (const f of readdirSync(`${ROOT}/${v}`).filter((x) => x.endsWith('.json'))) {
      const g = JSON.parse(readFileSync(`${ROOT}/${v}/${f}`, 'utf8')) as Capture;
      const name = f.slice(0, -5);
      const load = () => computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), iniOf(g.ini_overrides));
      for (const t of g.texts.filter((x) => x.sub === 'Other strengths' && x.name === 'vimsopaka' && x.mode && PANE[x.mode] && x.lines?.length)) {
        it(`${v} / ${name}: ${t.mode}`, async () => {
          const table = runTable(await load(), PANE[t.mode!], {});
          expect(table.rows.map((r) => norm(r.join(' ')))).toEqual(t.lines!.slice(2).filter((l) => l.trim()).map(norm));
        });
      }
      for (const view of g.views.filter((x) => x.sub === 'Key Info' && x.mode && (KEY_INFO[x.mode] || x.mode === 'Longitudes & Basic Info'))) {
        it(`${v} / ${name}: ${view.mode}`, async () => {
          const table = runTable(await load(), KEY_INFO[view.mode!] ?? 'basics.longitudes', {}, swe);
          expect(table.rows.map(loose)).toEqual(view.rows.map(loose));
        });
      }
      const calcs = g.texts.find((x) => x.name === 'complete_calcs' && x.lines?.length)?.lines;
      const i0 = calcs?.findIndex((l) => l.startsWith('Ashtakavarga of Rasi Chart')) ?? -1;
      it.skipIf(i0 < 0)(`${v} / ${name}: ashtakavarga`, async () => {
        const c = await load();
        const sign = (b: AvBody) => Math.floor((b === 'Lagna' ? c.positions.ascendant : c.positions.grahas[b].lon) / 30);
        const av = ashtakavarga(sign, avOptionsFromIni(c.ini));
        const want = AV_BODIES.map((_, k) => calcs![i0 + 3 + k].replace(/\*/g, ' ').trim().split(/\s+/).slice(1).map(Number));
        expect(AV_BODIES.map((b) => av.bav[b])).toEqual(want);
      });
    }
  }
});
