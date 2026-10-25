import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_VARGAS, d30ProportionalDegree, vargaLongitude, vargaSign, type VargaName, type VargaSpec } from '../src/core/vargas';
import {
  CUSTOM_STARTS, customSign, reversesInEvenSigns, VARGA_CHOICES, VARGA_PREF_KEYS, vargaColumnLabel, vargaOptionsFromIni,
  vargasOf, vargaSpec, variantSign, type VargaIni, type VargaPrefKey,
} from '../src/core/vargaOptions';
import { DEFAULTS } from '../src/settings/generated';
import { nodeSweph } from './helpers';
import { goldenCharts } from './golden';
import { computeChart } from '../src/core/chart';
import { runTable } from '../src/engine/jobs';

// sign index helpers: Ar 0 .. Pi 11; at(sign, deg) = rasi longitude
const at = (sign: number, deg: number) => sign * 30 + deg;
const [Ar, Ta, Ge, Cn, Le, Vi, Li, Sc, Sg, Cp, Aq, Pi] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const signIn = (ini: VargaIni, v: VargaName, lon: number) => vargaSign(lon, vargaSpec(v, ini));
const lonIn = (ini: VargaIni, v: VargaName, lon: number) => vargaLongitude(lon, vargaSpec(v, ini));

/** Deterministic longitudes that avoid exact part boundaries. */
const GRID = Array.from({ length: 4000 }, (_, i) => (i * 0.0901 + 0.00037 * (i % 7)) % 360);
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

describe('varga option table', () => {
  it('is ALL_VARGAS itself for JHora defaults', () => {
    expect(vargasOf()).toBe(ALL_VARGAS);
    expect(vargasOf({})).toBe(ALL_VARGAS);
    expect(vargasOf(structuredClone(DEFAULTS))).toBe(ALL_VARGAS);
    expect(vargasOf({ HoraPreference: 6, D24Preference: 1, D108Preference: 1, DivLongFromEndToo: 1 })).toBe(ALL_VARGAS);
  });

  it('rebuilds only the vargas a setting touches', () => {
    const t = vargasOf({ D3Preference: 1 });
    expect(t.D3).not.toBe(ALL_VARGAS.D3);
    for (const v of ['D1', 'D2', 'D9', 'D10', 'D10xD9', 'D108', 'D144', 'D0'] as VargaName[]) expect(t[v]).toBe(ALL_VARGAS[v]);
    // D-10 x D-9 depends on the D-10 and D-9 definitions; D-108 on the D-9 sign, D-144 on the D-12 sign
    expect(vargasOf({ D10Preference: 2 }).D10xD9).not.toBe(ALL_VARGAS.D10xD9);
    expect(vargasOf({ D9Preference: 1 }).D108).not.toBe(ALL_VARGAS.D108);
    expect(vargasOf({ D12Preference: 1 }).D144).not.toBe(ALL_VARGAS.D144);
    // turning off DivLongFromEndToo changes only the default variant that reverses (Uma-Shambhu hora)
    const f = vargasOf({ DivLongFromEndToo: 0 });
    expect(f.D2).not.toBe(ALL_VARGAS.D2);
    expect(f.D12).toBe(ALL_VARGAS.D12);
  });

  it('ignores out-of-range values like JHora would never store them', () => {
    expect(vargaOptionsFromIni({ HoraPreference: 12, D3Preference: -1, DmDnChartDn: 20 }).prefs.HoraPreference).toBe(6);
    expect(vargasOf({ D3Preference: 9 })).toBe(ALL_VARGAS);
  });

  // The generic JHora form (sign routine + n*lon mod 30) of every default variant must
  // reproduce the default definitions verified against the goldens.
  for (const k of VARGA_PREF_KEYS.filter((x) => x !== 'D108Preference')) {
    const v = k === 'HoraPreference' ? 'D2' : (k.replace('Preference', '') as VargaName);
    const def = k === 'D81Preference' ? 0 : (DEFAULTS[k as keyof typeof DEFAULTS] as number);
    it(`JHora's ${v} routine, default variant ${def}, equals the verified default`, () => {
      const jh: VargaSpec = { kind: 'jh', n: Number(v.slice(1)), sign: variantSign(v, def)!, reverse: reversesInEvenSigns(v, def) };
      for (const lon of GRID) {
        expect(vargaSign(lon, jh), `${v} sign at ${lon}`).toBe(vargaSign(lon, ALL_VARGAS[v]));
        expect(angDiff(vargaLongitude(lon, jh), vargaLongitude(lon, ALL_VARGAS[v])), `${v} lon at ${lon}`).toBeLessThan(1e-7);
      }
    });
  }

  it('D-m x n reproduces the composite vargas (D-12 of D-9 = D-108, D-12 of D-12 = D-144)', () => {
    for (const [dm, dn, ref] of [[1, 11, 'D108'], [11, 11, 'D144']] as const) {
      const spec = vargaSpec('D10xD9', { DmDnChartDm: dm, DmDnChartDn: dn });
      for (const lon of GRID) {
        expect(vargaSign(lon, spec)).toBe(vargaSign(lon, ALL_VARGAS[ref]));
        expect(angDiff(vargaLongitude(lon, spec), vargaLongitude(lon, ALL_VARGAS[ref]))).toBeLessThan(1e-7);
      }
    }
  });
});

describe('variant definitions (jhora.exe sign routines)', () => {
  it('hora (FUN_004a7bc0)', () => {
    const h = (pref: number, lon: number) => signIn({ HoraPreference: pref }, 'D2', lon);
    // 0 traditional: odd signs Le then Cn, even signs Cn then Le
    expect([h(0, at(Ar, 10)), h(0, at(Ar, 20)), h(0, at(Ta, 10)), h(0, at(Ta, 20))]).toEqual([Le, Cn, Cn, Le]);
    expect([h(0, at(Ar, 15)), h(0, at(Ta, 15))]).toEqual([Cn, Le]);                 // second half starts at 15
    // 1 Jagannatha: Le-hora -> 7th of the sign's 1st/7th pair, Cn-hora -> the sign itself (Ar..Cn)
    expect([h(1, at(Ar, 10)), h(1, at(Ar, 20)), h(1, at(Le, 10)), h(1, at(Le, 20))]).toEqual([Li, Ar, Le, Aq]);
    // 2 parivritti-dwaya: halves of the zodiac in order
    expect([h(2, at(Ar, 14.99)), h(2, at(Ar, 15)), h(2, at(Ta, 1)), h(2, at(Pi, 29))]).toEqual([Ar, Ta, Ge, Pi]);
    // 3 samasaptaka, 4 mandooka, 7 labha mandooka: the sign, then its 7th / 3rd / 11th
    expect([h(3, at(Ar, 5)), h(3, at(Ar, 25)), h(4, at(Ar, 25)), h(7, at(Ar, 25)), h(7, at(Sc, 25))]).toEqual([Ar, Li, Ge, Aq, Vi]);
    // 5 Kashinatha: the lord's other / own sign by half and parity (FUN_004a7ae0 table, Cn/Le included)
    expect([h(5, at(Ar, 5)), h(5, at(Ar, 25)), h(5, at(Ta, 5)), h(5, at(Ta, 25)), h(5, at(Cn, 5)), h(5, at(Le, 25))]).toEqual([Sc, Ar, Ta, Li, Cn, Cn]);
    // 6 Uma-Shambhu (default): parivritti, even signs reversed
    expect([h(6, at(Ar, 10)), h(6, at(Ar, 20)), h(6, at(Ta, 10)), h(6, at(Ta, 20))]).toEqual([Ar, Ta, Cn, Ge]);
    // 8/9 Raman: second half from the 11th; 8 keeps Cn and Le themselves, 9 (SJC) maps them too
    expect([h(8, at(Ar, 5)), h(8, at(Ar, 25)), h(8, at(Vi, 25)), h(9, at(Vi, 25))]).toEqual([Sc, Cp, Cn, Le]);
    // 10/11 Niranjan: 3rd/8th, even signs from the 12th
    expect([h(10, at(Ar, 5)), h(10, at(Ar, 25)), h(10, at(Ta, 5)), h(11, at(Ta, 25))]).toEqual([Vi, Ar, Ge, Sc]);
  });

  it('drekkana (FUN_004a8210)', () => {
    const d = (pref: number, lon: number) => signIn({ D3Preference: pref }, 'D3', lon);
    expect([d(0, at(Ta, 5)), d(0, at(Ta, 15)), d(0, at(Ta, 25)), d(0, at(Ta, 10))]).toEqual([Ta, Vi, Cp, Vi]);
    expect([d(1, at(Ar, 5)), d(1, at(Ta, 5)), d(1, at(Pi, 25))]).toEqual([Ar, Cn, Pi]);            // parivritti-traya
    expect([d(2, at(Ar, 25)), d(2, at(Ta, 5)), d(2, at(Ge, 5)), d(2, at(Cn, 5)), d(2, at(Ta, 25))]).toEqual([Ge, Pi, Cn, Sg, Cp]); // Somanatha
    expect([d(3, at(Ta, 5)), d(3, at(Ta, 15)), d(3, at(Ge, 5)), d(3, at(Cn, 25))]).toEqual([Cp, Ta, Li, Pi]); // Jagannatha
    expect([d(4, at(Ar, 5)), d(4, at(Ta, 5)), d(4, at(Ta, 25))]).toEqual([Ar, Vi, Cn]);           // Uma-Shambhu
  });

  it('D-4, D-5, D-7, D-8', () => {
    expect(signIn({ D4Preference: 1 }, 'D4', at(Ar, 10))).toBe(Ta);
    expect(signIn({ D4Preference: 1 }, 'D4', at(Ta, 1))).toBe(Ec(4, at(Ta, 1)));
    expect(signIn({ D5Preference: 1 }, 'D5', at(Ta, 1))).toBe(Vi);
    const s7 = (pref: number, lon: number) => signIn({ D7Preference: pref }, 'D7', lon);
    expect([s7(1, at(Ta, 2)), s7(1, at(Ta, 29)), s7(2, at(Ta, 2)), s7(2, at(Ta, 29)), s7(1, at(Ar, 29))]).toEqual([Sc, Ta, Ta, Sc, Li]);
    const s8 = (lon: number) => signIn({ D8Preference: 1 }, 'D8', lon);
    expect([s8(at(Ar, 1)), s8(at(Ta, 1)), s8(at(Ge, 1)), s8(at(Ta, 29))]).toEqual([Ar, Le, Sg, Pi]);
  });

  it('navamsa (FUN_004a78b0)', () => {
    const n = (pref: number, lon: number) => signIn({ D9Preference: pref }, 'D9', lon);
    expect([n(1, at(Ar, 10)), n(1, at(Ta, 15)), n(1, at(Ta, 9))]).toEqual([Cn, Li, Pi]);   // Kalachakra: 40-degree groups
    expect([n(2, at(Ta, 1)), n(2, at(Ta, 4)), n(2, at(Ar, 29))]).toEqual([Cp, Sg, Sg]);    // Krishna Mishra
    expect([n(3, at(Ta, 1)), n(3, at(Ta, 29)), n(3, at(Ar, 1)), n(3, at(Ge, 1))]).toEqual([Vi, Cp, Ar, Li]); // uniform KM
  });

  it('D-10, D-11, D-12/16/20/27 reversal, D-24', () => {
    const d = (pref: number, lon: number) => signIn({ D10Preference: pref }, 'D10', lon);
    expect([d(2, at(Ta, 1)), d(2, at(Ta, 29)), d(3, at(Ta, 1)), d(3, at(Ta, 29)), d(4, at(Ta, 1)), d(4, at(Ta, 29))]).toEqual([Cp, Ar, Li, Cp, Vi, Sg]);
    expect([d(1, at(Ta, 1)), d(2, at(Ar, 29))]).toEqual([Aq, Cp]);
    expect([signIn({ D11Preference: 1 }, 'D11', at(Ar, 1)), signIn({ D11Preference: 1 }, 'D11', at(Ar, 29))]).toEqual([Pi, Ta]);
    expect([signIn({ D12Preference: 1 }, 'D12', at(Ta, 1)), signIn({ D12Preference: 1 }, 'D12', at(Ta, 29))]).toEqual([Ar, Ta]);
    expect(signIn({ D16Preference: 1 }, 'D16', at(Ta, 1))).toBe((4 + 15) % 12);
    expect(signIn({ D20Preference: 1 }, 'D20', at(Ta, 1))).toBe((8 + 19) % 12);
    expect(signIn({ D27Preference: 1 }, 'D27', at(Ta, 1))).toBe(Vi);
    const s24 = (pref: number, lon: number) => signIn({ D24Preference: pref }, 'D24', lon);
    expect([s24(0, at(Ta, 1)), s24(0, at(Ta, 2)), s24(0, at(Ta, 29)), s24(2, at(Ta, 1)), s24(1, at(Ta, 1))]).toEqual([Cn, Ge, Le, Le, Cn]);
  });

  it('trimsamsa and shashtyamsa', () => {
    expect(signIn({ D30Preference: 1 }, 'D30', 31.5)).toBe(Sc);           // parivritti: trunc(lon) mod 12
    expect(signIn({ D30Preference: 2 }, 'D30', at(Ta, 1.5))).toBe(Ge);    // from the sign, one per degree
    // JHora compares "x <= 10/18/25" in the Parasara trimsamsa (FUN_004a8dc0)
    expect(variantSign('D30', 0)!(at(Ar, 10))).toBe(Aq);
    const s60 = (pref: number, lon: number) => signIn({ D60Preference: pref }, 'D60', lon);
    expect([s60(1, at(Ta, 0.2)), s60(2, at(Ta, 0.2)), s60(3, at(Ta, 0.2)), s60(3, at(Ta, 29.9)), s60(0, at(Ta, 29.9))]).toEqual([Ar, Pi, Ar, Pi, Ar]);
  });

  it('nava-navamsa, ashtottaramsa, dwadasa-dwadasamsa', () => {
    expect(signIn({ D81Preference: 1 }, 'D81', 10)).toBe(Cn);
    expect(signIn({ D81Preference: 1 }, 'D81', 50)).toBe(Sc);
    // D-108 "rasi divided into 108 parts": from the rasi sign
    expect(signIn({ D108Preference: 0 }, 'D108', at(Ta, 0.1))).toBe(Ta);
    expect(signIn({ D108Preference: 0 }, 'D108', at(Ta, 29.9))).toBe((1 + 107) % 12);
    // D-108 from the chosen D-9 sign, D-144 from the chosen D-12 sign
    expect(signIn({ D9Preference: 3 }, 'D108', at(Ta, 0.1))).toBe(Vi);
    expect(signIn({ D12Preference: 1 }, 'D144', at(Ta, 0.1))).toBe(Ar);
  });

  it('custom D-n (FUN_004a9150)', () => {
    expect(vargaLongitude(123.4, ALL_VARGAS.D0)).toBe(0);
    const cyc9 = vargaSpec('D0', { 'CustDivSettings.nCustDivN': 9, 'CustDivSettings.bCyclical': 1 });
    for (const lon of GRID) expect(vargaSign(lon, cyc9)).toBe(vargaSign(lon, ALL_VARGAS.D9));
    // dialog 2073's example: the 9 parts of Ar go to Ar..Sg, those of Ta to Vi..Cp (base: the sign, start 1st/9th, reversed)
    const ukm = customSign({ n: 9, cyclic: false, houseSeed: true, reverseEven: true, start: 2 });
    expect([ukm(at(Ar, 1)), ukm(at(Ar, 29)), ukm(at(Ta, 1)), ukm(at(Ta, 29))]).toEqual([Ar, Sg, Vi, Cp]);
    // starts by element from Aries: fire 0, earth +3, air +6, water +9
    const el = customSign({ n: 4, cyclic: false, houseSeed: false, reverseEven: false, start: 8 });
    expect([el(at(Ar, 1)), el(at(Ta, 1)), el(at(Ge, 1)), el(at(Cn, 29))]).toEqual([Ar, Cn, Li, Ar]);
    expect(CUSTOM_STARTS).toHaveLength(10);
    // degrees: N * lon mod 30, never reversed
    expect(lonIn({ 'CustDivSettings.nCustDivN': 7, 'CustDivSettings.bCyclical': 1 }, 'D0', 10) % 30).toBeCloseTo(10, 9);
  });

  it('divisional longitudes: n*lon mod 30, from the end of even signs, proportional D-30', () => {
    // Jagannatha hora: Li, 2 * 10 = 20 degrees
    expect(lonIn({ HoraPreference: 1 }, 'D2', 10)).toBeCloseTo(at(Li, 20), 9);
    // reversed D-12 in an even sign: 12 * 31 mod 30 = 12, counted from the end = 18 ...
    expect(lonIn({ D12Preference: 1 }, 'D12', at(Ta, 1))).toBeCloseTo(at(Ar, 18), 9);
    // ... unless DivLongFromEndToo is off
    expect(lonIn({ D12Preference: 1, DivLongFromEndToo: 0 }, 'D12', at(Ta, 1))).toBeCloseTo(at(Ar, 12), 9);
    expect(lonIn({ DivLongFromEndToo: 0 }, 'D2', at(Ta, 10))).toBeCloseTo(at(Cn, 20), 9);
    expect(lonIn({}, 'D2', at(Ta, 10))).toBeCloseTo(at(Cn, 10), 9);
    // a part boundary maps to 0 degrees, also when reversed (FUN_004c1980 normalisation)
    expect(lonIn({ D12Preference: 1 }, 'D12', at(Ta, 5))).toBeCloseTo(at(Aq, 0), 9);
    // Use1DegInD30ForDivLong = 0: position inside the unequal portion
    expect(d30ProportionalDegree(2.5, false)).toBe(15);
    expect(d30ProportionalDegree(14, false)).toBe(15);        // 10..18: 4 of 8
    expect(d30ProportionalDegree(1, true)).toBe(6);           // even: from the end, 29 -> 4 of 5, mirrored -> 1 of 5
    expect(d30ProportionalDegree(29, true)).toBe(24);
    expect(d30ProportionalDegree(0, true)).toBe(0);
    expect(lonIn({ Use1DegInD30ForDivLong: 0 }, 'D30', at(Ar, 2.5))).toBeCloseTo(at(Ar, 15), 9);
    expect(lonIn({ Use1DegInD30ForDivLong: 0 }, 'D30', at(Ta, 1))).toBeCloseTo(at(Ta, 6), 9);
    expect(lonIn({}, 'D30', at(Ar, 2.5))).toBeCloseTo(at(Ar, 15), 9);   // 1 degree -> 30 degrees: 2.5 -> 75 mod 30
  });
});

/** sign of cyclic n-varga */
function Ec(n: number, lon: number) { return Math.trunc(lon * n / 30) % 12; }

describe('labels and menu choices', () => {
  it('default column labels are the golden headers', () => {
    const golden = goldenCharts()[0].views.find((v) => v.mode === 'All Divisional Longitudes')!.headers.slice(1);
    const order: VargaName[] = ['D1', 'D9', 'D10', 'D2', 'D3', 'D4', 'D7', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45',
      'D60', 'D10xD9', 'D0', 'D5', 'D6', 'D8', 'D11', 'D81', 'D108', 'D144'];
    expect(order.map((v) => vargaColumnLabel(v))).toEqual(golden);
  });

  it('labels follow the choices', () => {
    expect(vargaColumnLabel('D2', { HoraPreference: 1 })).toBe('D-2 (Jn)');
    expect(vargaColumnLabel('D24', { D24Preference: 2 })).toBe('D-24 (Rev2)');
    expect(vargaColumnLabel('D10xD9', { DmDnChartDm: 2, DmDnChartDn: 3 })).toBe('D-2 x D-3');
    expect(vargaColumnLabel('D0', { 'CustDivSettings.nCustDivN': 7 })).toBe('D-7');
  });

  it('every choice is chart menu 103 item with the value its handler stores', () => {
    const menus = readFileSync('tools/harness/res/menus.txt', 'utf8');
    const seen = new Set<VargaPrefKey>();
    for (const c of VARGA_CHOICES) {
      seen.add(c.key);
      const values = c.options.map((o) => o.value).sort((a, b) => a - b);
      expect(values).toEqual(values.map((_, i) => i));
      for (const o of c.options) if (o.cmd) expect(menus).toContain(`${o.cmd}\t${o.label.replace(/ & /g, ' && ')}`);
    }
    expect([...seen].sort()).toEqual([...VARGA_PREF_KEYS].sort());
  });
});

describe('the options reach the tables', () => {
  it('Key Info divisional tables and chart signs use the chosen variants', async () => {
    const swe = await nodeSweph();
    const g = goldenCharts()[0];
    const def = await computeChart(swe, g.birth);
    const jn = await computeChart(swe, g.birth, { HoraPreference: 1, DmDnChartDm: 2, DmDnChartDn: 3 });
    const t0 = runTable(def, 'basics.allDivisionalLongitudes', {});
    const t1 = runTable(jn, 'basics.allDivisionalLongitudes', {});
    const col = (t: typeof t0, h: string) => t.rows.map((r) => r[t.headers.indexOf(h)]);
    expect(t1.headers).toContain('D-2 (Jn)');
    expect(t1.headers).toContain('D-2 x D-3');
    expect(col(t1, 'D-2 (Jn)')).not.toEqual(col(t0, 'D-2 (US)'));
    expect(col(t1, 'D-9')).toEqual(col(t0, 'D-9'));
    const r1 = runTable(jn, 'basics.rasisInVargas', {});
    expect(r1.headers).toContain('D-2 (Jn)');
    const lagnaD2 = r1.rows[0][r1.headers.indexOf('D-2 (Jn)')];
    expect(lagnaD2).toBe(['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'][signIn(jn.ini, 'D2', jn.positions.ascendant)]);
  });
});
