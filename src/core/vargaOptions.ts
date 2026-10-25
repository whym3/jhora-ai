// Divisional-chart variants: the ini keys behind JHora 8.0's chart menu 103
// "Choose hora (D-2) / drekkana (D-3) / ... / nava-navamsa (D-81)" submenus and
// dialog 152 "Divisional Chart Calculation Options" (menu 32935), plus the two
// research charts: custom D-n (33375, dialog 2073) and D-m x n (33368, dialog 2071).
// vargasOf(ini) builds the VargaSpec table that every varga computation uses; with
// the default settings it is ALL_VARGAS itself (the verified default definitions).
//
// Ported from jhora.exe. The ini reader FUN_004df940 stores each key in a global
// (HoraPreference DAT_00585ee8, D3Preference DAT_0089702c, ..., Use1DegInD30ForDivLong
// DAT_005923c8, DivLongFromEndToo DAT_005923dc, CustDivSettings DAT_00897f70..78,
// DmDnChartDm/Dn DAT_005923c0/c4) read by the sign routines that FUN_004a0a90 runs
// for all 105 bodies of a chart:
//   FUN_004a7bc0 D-2 (12 variants; own-sign pairs FUN_004a7ae0)   FUN_004a8210 D-3
//   FUN_004a8460 D-4   FUN_004a8530 D-5   FUN_004a86d0 D-6   FUN_004a8710 D-7
//   FUN_004a87f0 D-8   FUN_004a78b0 D-9   FUN_004a8890 D-10  FUN_004a89f0 D-11
//   FUN_004a8a60 D-12  FUN_004a8ae0 D-16  FUN_004a8b90 D-20  FUN_004a8c40 D-24
//   FUN_004a8d00 D-27  FUN_004a8dc0 D-30  FUN_004a8fa0 D-40  FUN_004a9020 D-45
//   FUN_004a90a0 D-60  FUN_004a98a0 D-81 (preference DAT_00897028: menu only, not in the ini)
//   FUN_004a99e0 D-108 FUN_004a9a90 D-144 FUN_004a9150 custom D-n  FUN_004a93b0 D-m x n
// FUN_0049fea0 says which variants count the divisional degrees from the end of even
// signs; FUN_004b6a20 sets the research charts' n (table 0x591ed4 slots 23, 24) and
// names; FUN_00404a20 builds the column labels ("D-2 (US)", "D-10 (Trd)", ...).
// Menu commands -> values: handlers 0x43c710..0x43ee10 (e.g. 33151 Jagannatha hora
// stores HoraPreference = 1). Index arithmetic is JHora's: s = rasi sign (Ar = 0),
// p = trunc(degrees in sign * n / 30), truncating conversions (__ftol).
import { DEFAULTS, type JhoraIni } from '../settings/generated';
import { ALL_VARGAS, vargaLongitude, vargaSign, type VargaName, type VargaSpec } from './vargas';

/** The ini plus JHora's unsaved D-81 choice (menu 33240/33241 set DAT_00897028 only). */
export type VargaIni = Partial<JhoraIni> & { D81Preference?: number };

export type VargaPrefKey =
  | 'HoraPreference' | 'D3Preference' | 'D4Preference' | 'D5Preference' | 'D7Preference' | 'D8Preference'
  | 'D9Preference' | 'D10Preference' | 'D11Preference' | 'D12Preference' | 'D16Preference' | 'D20Preference'
  | 'D24Preference' | 'D27Preference' | 'D30Preference' | 'D60Preference' | 'D81Preference' | 'D108Preference';

export interface CustomDivision {
  /** CustDivSettings.nCustDivN: parts per sign (0 = JHora's empty "D-0") */
  n: number;
  /** CustDivSettings.bCyclical: parivritti, part k of the zodiac goes to sign k mod 12 */
  cyclic: boolean;
  /** CustDivSettings.bHouseAsSeed: count from the sign itself instead of Aries */
  houseSeed: boolean;
  /** sCustDivSettings.bReverseDivsInEvenSigns */
  reverseEven: boolean;
  /** sCustDivSettings.tStart: combo 1004 of dialog 2073 (CUSTOM_STARTS) */
  start: number;
}

export interface VargaOptions {
  prefs: Record<VargaPrefKey, number>;
  /** Use1DegInD30ForDivLong */
  use1DegInD30: boolean;
  /** DivLongFromEndToo */
  fromEnd: boolean;
  custom: CustomDivision;
  /** DmDnChartDm / DmDnChartDn: JHora varga indices (VARGA_INDEX) */
  dm: number;
  dn: number;
}

/** JHora's varga index order (names table 0x8a2874) and the parts per sign (table 0x591ed4). */
export const VARGA_INDEX: VargaName[] = ['D1', 'D9', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12',
  'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60', 'D81', 'D108', 'D144'];
export const VARGA_PARTS = [1, 9, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144];
/** Dialog 2071 offers D-1..D-144 as the base chart and D-1..D-60 inside it. */
export const DM_COUNT = 23;
export const DN_COUNT = 20;

const PREF_VARGA: Record<VargaPrefKey, VargaName> = {
  HoraPreference: 'D2', D3Preference: 'D3', D4Preference: 'D4', D5Preference: 'D5', D7Preference: 'D7',
  D8Preference: 'D8', D9Preference: 'D9', D10Preference: 'D10', D11Preference: 'D11', D12Preference: 'D12',
  D16Preference: 'D16', D20Preference: 'D20', D24Preference: 'D24', D27Preference: 'D27', D30Preference: 'D30',
  D60Preference: 'D60', D81Preference: 'D81', D108Preference: 'D108',
};
export const VARGA_PREF_KEYS = Object.keys(PREF_VARGA) as VargaPrefKey[];
const prefDefault = (k: VargaPrefKey) => (k === 'D81Preference' ? 0 : DEFAULTS[k]);

// ------------------------------------------------------------------ sign routines

type SignFn = (lon: number) => number;
const T = Math.trunc;
const mod12 = (x: number) => ((x % 12) + 12) % 12;
const sgn = (lon: number) => Math.floor(lon / 30) % 12;
/** trunc((lon - s*30) * n/30): the part of the sign holding lon */
const part = (lon: number, n: number) => T((lon - sgn(lon) * 30) * (n / 30));
/** Ta (1), Cn (3), ... are even signs */
const even = (s: number) => (s & 1) === 1;
/** parivritti: part k of the zodiac to sign k mod 12 */
const cyc = (n: number): SignFn => (lon) => T(lon * (n / 30)) % 12;
const BY3 = (a: number, b: number, c: number) => (s: number) => [a, b, c][s % 3];

// FUN_004a7ae0(sign, second, table): the first / second sign owned by the sign's lord;
// with table = 0 Cancer and Leo stay themselves.
const OWN_FIRST = [0, 1, 2, 3, 3, 2, 1, 0, 8, 9, 9, 8];
const OWN_SECOND = [7, 6, 5, 4, 4, 5, 6, 7, 11, 10, 10, 11];
const ownPair = (s: number, second: boolean, table: boolean) =>
  (!table && (s === 3 || s === 4) ? s : (second ? OWN_SECOND : OWN_FIRST)[s]);
const secondHalf = (lon: number) => lon - sgn(lon) * 30 >= 15;
/** case 0: Sun's hora Le, Moon's hora Cn */
const cnLeHora: SignFn = (lon) => (T((lon * (1 / 15) + 1) * 0.5) & 1 ? 3 : 4);
const JN_HORA = [[0, 1, 2, 3, 10, 11, 0, 1, 2, 3, 10, 11], [6, 7, 8, 9, 4, 5, 6, 7, 8, 9, 4, 5]];
const halfStep = (k: number): SignFn => (lon) => (sgn(lon) + k * (T(lon * (1 / 15)) & 1)) % 12;
const raman = (table: boolean): SignFn => (lon) => {
  const s = sgn(lon), h = secondHalf(lon);
  return ownPair(h ? (s + 10) % 12 : s, (s & 1) === +h, table);
};
const niranjan = (table: boolean): SignFn => (lon) => {
  const s = sgn(lon), h = secondHalf(lon);
  const b = s & 1 ? (s + 11) % 12 : s;
  return ownPair((b + (h ? 7 : 2)) % 12, (s & 1) === +h, table);
};

/** FUN_004a7bc0, by HoraPreference */
const D2: SignFn[] = [
  cnLeHora,                                                   // 0 traditional Parasara (Cn/Le only)
  (lon) => JN_HORA[cnLeHora(lon) - 3][sgn(lon)],              // 1 Jagannatha (1st/7th)
  (lon) => T(lon * (1 / 15)) % 12,                            // 2 parivritti-dwaya
  halfStep(6),                                                // 3 samasaptaka (1st/7th)
  halfStep(2),                                                // 4 mandooka (1st/3rd)
  (lon) => { const s = sgn(lon); return ownPair(s, (s & 1) === +secondHalf(lon), true); }, // 5 Kashinatha
  (lon) => {                                                  // 6 Uma-Shambhu (default): even signs reversed
    const k = T(lon * (1 / 30));
    const l = k & 1 ? 30 - (lon - k * 30) + k * 30 : lon;
    return T(l * (1 / 15)) % 12;
  },
  halfStep(10),                                               // 7 labha mandooka (1st/11th)
  raman(false), raman(true), niranjan(false), niranjan(true), // 8..11
];

const D3_US = [0, 1, 2, 5, 4, 3, 6, 7, 8, 11, 10, 9];
/** FUN_004a8210, by D3Preference */
const D3: SignFn[] = [
  (lon) => (sgn(lon) + 4 * part(lon, 3)) % 12,                // 0 traditional Parasara
  cyc(3),                                                     // 1 parivritti-traya
  (lon) => {                                                  // 2 Somanatha
    const s = sgn(lon), v = (3 * T(s / 2) + part(lon, 3)) % 12;
    return even(s) ? 11 - v : v;
  },
  (lon) => (((9 * (sgn(lon) % 4)) % 12) + 4 * part(lon, 3)) % 12, // 3 Jagannatha (trines from movable signs)
  (lon) => D3_US[T(lon * 0.1) % 12],                          // 4 Uma-Shambhu
];

const D4: SignFn[] = [(lon) => (sgn(lon) + 3 * part(lon, 4)) % 12, cyc(4)];

/** FUN_004a8530 case 0: standard panchamsa (6-degree parts, mirrored in even signs; boundaries as JHora compares) */
const standardD5: SignFn = (lon) => {
  const s = sgn(lon), x = even(s) ? 30 - (lon - s * 30) : lon - s * 30;
  const i = x < 6 ? 0 : x <= 12 ? 1 : x <= 18 ? 2 : x <= 24 ? 3 : 4;
  return (even(s) ? [7, 9, 11, 5, 1] : [0, 10, 8, 2, 6])[i];
};
const D5: SignFn[] = [standardD5, cyc(5)];

/** FUN_004a8710, by D7Preference */
const D7: SignFn[] = [
  cyc(7),                                                                         // 0 even: 7th forward
  (lon) => { const s = sgn(lon), p = part(lon, 7); return mod12(even(s) ? s + 6 - p : s + p); }, // 1 even: 7th backward
  (lon) => { const s = sgn(lon), p = part(lon, 7); return mod12(even(s) ? s - p : s + p); },     // 2 even: backward to the 7th
];

const D8: SignFn[] = [cyc(8), (lon) => (BY3(0, 4, 8)(sgn(lon)) + part(lon, 8)) % 12];

const KALA = [7, 6, 5, 3, 4, 2, 1, 0, 11, 10, 9, 8];
const trineStart = (s: number) => (BY3(0, 8, 4)(s) + s) % 12;
/** FUN_004a78b0, by D9Preference */
const D9: SignFn[] = [
  cyc(9),                                                                // 0 Parasara
  (lon) => { const s9 = T(lon * 0.3) % 12; return T(lon * 0.025) & 1 ? KALA[s9] : s9; }, // 1 Kalachakra
  (lon) => {                                                             // 2 Krishna Mishra (Rangacharya)
    const s = sgn(lon), p = part(lon, 9), st = trineStart(s);
    return mod12(even(s) ? st - p : st + p);
  },
  (lon) => {                                                             // 3 uniform Krishna Mishra (even reversal)
    const s = sgn(lon), p = part(lon, 9), st = trineStart(s);
    return even(s) ? mod12((st + 8) % 12 - p) : (st + p) % 12;
  },
];

/** FUN_004a8890, by D10Preference */
const d10 = (evenStart: number): SignFn => (lon) => {
  const s = sgn(lon), p = part(lon, 10);
  return mod12(even(s) ? s + evenStart - p : s + p);
};
const D10: SignFn[] = [
  (lon) => { const s = sgn(lon); return (s + (even(s) ? 8 : 0) + part(lon, 10)) % 12; }, // 0 even: 9th forward
  cyc(10),                                                               // 1 parivritti (Ojha)
  d10(20), d10(17), d10(16),                                             // 2 9th back, 3 back to 9th, 4 reverse 9th back
];

const D11: SignFn[] = [
  (lon) => (part(lon, 11) - sgn(lon) + 24) % 12,                         // 0 zodiacal rudramsa (= parivritti)
  (lon) => (sgn(lon) - part(lon, 11) + 11) % 12,                         // 1 anti-zodiacal (Dr. Raman)
];

/** D-12, D-16, D-20, D-27: traditional or even signs counted from the last part */
const fromBase = (n: number, base: (s: number) => number): SignFn[] => [
  (lon) => (base(sgn(lon)) + part(lon, n)) % 12,
  (lon) => { const s = sgn(lon), p = part(lon, n); return (base(s) + (even(s) ? n - 1 - p : p)) % 12; },
];
const D12 = fromBase(12, (s) => s);
const D16 = fromBase(16, BY3(0, 4, 8));
const D20 = fromBase(20, BY3(0, 8, 4));
const D27 = fromBase(27, (s) => [0, 3, 6, 9][s % 4]);

/** FUN_004a8c40, by D24Preference */
const D24: SignFn[] = [
  (lon) => { const s = sgn(lon), p = part(lon, 24); return (even(s) ? 3 - p + 24 : 4 + p + 24) % 12; }, // 0 even Cn backward
  (lon) => { const s = sgn(lon); return ((even(s) ? 3 : 4) + part(lon, 24) + 24) % 12; },              // 1 traditional
  (lon) => (part(lon, 24) + 28) % 12,                                                                  // 2 Le forward always
];

/** FUN_004a8dc0 case 0: Parasara trimsamsa (boundaries as JHora compares) */
const parasaraD30: SignFn = (lon) => {
  const s = sgn(lon), x = even(s) ? 30 - (lon - s * 30) : lon - s * 30;
  const i = x < 5 ? 0 : x <= 10 ? 1 : x <= 18 ? 2 : x <= 25 ? 3 : 4;
  return (even(s) ? [7, 9, 11, 5, 1] : [0, 10, 8, 2, 6])[i];
};
const D30: SignFn[] = [
  parasaraD30,
  (lon) => T(lon) % 12,                                                  // 1 parivritti (cyclical)
  (lon) => (sgn(lon) + T(lon - sgn(lon) * 30)) % 12,                     // 2 shashtyamsa-like (from the sign)
];

/** FUN_004a90a0, by D60Preference */
const D60: SignFn[] = [
  (lon) => (sgn(lon) + T((lon - sgn(lon) * 30) * 2)) % 12,               // 0 from the sign
  (lon) => { const s = sgn(lon), p = T((lon - s * 30) * 2); return (s + (even(s) ? 59 - p : p)) % 12; }, // 1 reversed, from the sign
  (lon) => { const s = sgn(lon), p = T((lon - s * 30) * 2); return (even(s) ? 59 - p : p) % 12; },        // 2 reversed, from Aries
  (lon) => T((lon - sgn(lon) * 30) * 2) % 12,                            // 3 from Aries
];

/** FUN_004a98a0 pref 1: Kalachakra navamsa of the Kalachakra navamsa */
const kalaD81: SignFn = (lon) => {
  const d = T(lon * 0.3);
  let s9 = d % 12;
  let x = (lon - d * (10 / 3)) * 9;
  if (T(lon * 0.025) & 1) { x = 30 - x; s9 = KALA[s9]; }
  const l2 = s9 * 30 + x;
  const s = T(l2 * 0.3) % 12;
  return T(l2 * 0.025) & 1 ? KALA[s] : s;
};

const SIGNS: Partial<Record<VargaName, SignFn[]>> = {
  D2, D3, D4, D5, D7, D8, D9, D10, D11, D12, D16, D20, D24, D27, D30, D60, D81: [cyc(81), kalaD81],
};

/** FUN_0049fea0: variants whose divisional degrees run from the end of even signs */
const REVERSING: Partial<Record<VargaName, number[]>> = {
  D9: [2, 3], D2: [6], D3: [2, 4], D10: [2, 3, 4], D24: [0], D7: [1, 2], D12: [1], D16: [1], D20: [1], D27: [1],
  D60: [1, 2], D11: [1],
};
export const reversesInEvenSigns = (v: VargaName, pref: number) => REVERSING[v]?.includes(pref) ?? false;

/** The sign routine of one variant (D-108 / D-144 / research charts excluded). */
export function variantSign(v: VargaName, pref: number): SignFn | null {
  return SIGNS[v]?.[pref] ?? null;
}

/** Combo 1004 of dialog 2073: start of the mapping, per sign class (FUN_004a9150's tables). */
const CUSTOM_PERIOD = [1, 2, 2, 2, 2, 2, 3, 3, 4, 4];
const CUSTOM_START = [[0], [0, 6], [0, 8], [0, 4], [0, 10], [0, 2], [0, 4, 8], [0, 8, 4], [0, 3, 6, 9], [0, 9, 6, 3]];
/** FUN_004a9150: the custom D-n's sign */
export function customSign(c: CustomDivision): SignFn {
  if (c.cyclic) return (lon) => mod12(T(c.n * lon * (1 / 30)));
  const t = Math.min(9, Math.max(0, Math.trunc(c.start)));
  return (lon) => {
    const s = sgn(lon);
    let p = T((lon - s * 30) * c.n * (1 / 30));
    if (c.reverseEven && even(s)) p = c.n - p - 1;
    return mod12(p + CUSTOM_START[t][s % CUSTOM_PERIOD[t]] + (c.houseSeed ? s : 0));
  };
}

// ------------------------------------------------------------------ options and table

const flag = (x: unknown, def: number) => (x === undefined ? def : Number(x)) !== 0;
const num = (x: unknown, def: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.trunc(x) : def);

export function vargaOptionsFromIni(ini: VargaIni = {}): VargaOptions {
  const prefs = {} as Record<VargaPrefKey, number>;
  for (const k of VARGA_PREF_KEYS) {
    const v = num(ini[k], prefDefault(k));
    const n = PREF_VARGA[k] === 'D108' ? 2 : SIGNS[PREF_VARGA[k]]!.length;
    prefs[k] = v >= 0 && v < n ? v : prefDefault(k);
  }
  const dm = num(ini.DmDnChartDm, DEFAULTS.DmDnChartDm), dn = num(ini.DmDnChartDn, DEFAULTS.DmDnChartDn);
  return {
    prefs,
    use1DegInD30: flag(ini.Use1DegInD30ForDivLong, DEFAULTS.Use1DegInD30ForDivLong),
    fromEnd: flag(ini.DivLongFromEndToo, DEFAULTS.DivLongFromEndToo),
    custom: {
      n: Math.max(0, num(ini['CustDivSettings.nCustDivN'], DEFAULTS['CustDivSettings.nCustDivN'])),
      cyclic: flag(ini['CustDivSettings.bCyclical'], DEFAULTS['CustDivSettings.bCyclical']),
      houseSeed: flag(ini['CustDivSettings.bHouseAsSeed'], DEFAULTS['CustDivSettings.bHouseAsSeed']),
      reverseEven: flag(ini['sCustDivSettings.bReverseDivsInEvenSigns'], DEFAULTS['sCustDivSettings.bReverseDivsInEvenSigns']),
      start: num(ini['sCustDivSettings.tStart'], DEFAULTS['sCustDivSettings.tStart']),
    },
    dm: dm >= 0 && dm < DM_COUNT ? dm : DEFAULTS.DmDnChartDm,
    dn: dn >= 0 && dn < DN_COUNT ? dn : DEFAULTS.DmDnChartDn,
  };
}

const PARTS = Object.fromEntries(VARGA_INDEX.map((v, i) => [v, VARGA_PARTS[i]])) as Record<string, number>;
const pd = (v: VargaName) => Number(v.slice(1));

/** The VargaSpec table for a set of options; ALL_VARGAS itself when nothing differs from JHora's defaults. */
export function buildVargaTable(o: VargaOptions): Record<VargaName, VargaSpec> {
  const t: Record<VargaName, VargaSpec> = { ...ALL_VARGAS };
  let changed = false;
  const set = (v: VargaName, spec: VargaSpec) => { t[v] = spec; changed = true; };
  for (const k of VARGA_PREF_KEYS) {
    const v = PREF_VARGA[k];
    if (v === 'D108') continue;
    const pref = o.prefs[k];
    const reverse = o.fromEnd && reversesInEvenSigns(v, pref);
    const d30Prop = v === 'D30' && !o.use1DegInD30;
    if (pref === prefDefault(k) && reverse === reversesInEvenSigns(v, pref) && !d30Prop) continue;
    set(v, { kind: 'jh', n: pd(v), sign: SIGNS[v]![pref], reverse, d30Prop });
  }
  // FUN_004a99e0: parts of 108 from the rasi sign (0) or from the D-9 sign (1, default)
  const d9 = o.prefs.D9Preference, d108 = o.prefs.D108Preference;
  if (d108 !== 1 || d9 !== 0) {
    const d9Sign = D9[d9];
    set('D108', { kind: 'jh', n: 108, sign: d108 === 1 ? (lon) => (d9Sign(lon) + part(lon, 108)) % 12 : (lon) => (sgn(lon) + part(lon, 108)) % 12 });
  }
  // FUN_004a9a90: parts of 144 from the D-12 sign
  if (o.prefs.D12Preference !== 0) {
    const d12Sign = D12[o.prefs.D12Preference];
    set('D144', { kind: 'jh', n: 144, sign: (lon) => (d12Sign(lon) + part(lon, 144)) % 12 });
  }
  // FUN_004a9150 (slot 23, n = CustDivSettings.nCustDivN)
  const c = o.custom;
  if (c.n !== 0 || c.cyclic || c.houseSeed || c.reverseEven || c.start !== 0) set('D0', { kind: 'jh', n: c.n, sign: customSign(c) });
  // FUN_004a93b0 (slot 24, n = n(Dm) * n(Dn)): D-n's sign routine run on the D-m chart's longitudes
  const dm = VARGA_INDEX[o.dm], dn = VARGA_INDEX[o.dn];
  if (dm !== 'D10' || dn !== 'D9' || t.D10 !== ALL_VARGAS.D10 || t.D9 !== ALL_VARGAS.D9) {
    const inner = t[dm], outer = t[dn];
    set('D10xD9', { kind: 'jh', n: PARTS[dm] * PARTS[dn], sign: (lon) => vargaSign(vargaLongitude(lon, inner), outer) });
  }
  return changed ? t : ALL_VARGAS;
}

const byObject = new WeakMap<object, Record<VargaName, VargaSpec>>();
const byKey = new Map<string, Record<VargaName, VargaSpec>>();

/** The varga table in effect for an ini (chart.ini); ALL_VARGAS without one or with JHora's defaults. */
export function vargasOf(ini?: VargaIni | null): Record<VargaName, VargaSpec> {
  if (!ini) return ALL_VARGAS;
  const hit = byObject.get(ini);
  if (hit) return hit;
  const o = vargaOptionsFromIni(ini);
  const key = JSON.stringify(o);
  let t = byKey.get(key);
  if (!t) {
    t = buildVargaTable(o);
    if (byKey.size > 64) byKey.clear();
    byKey.set(key, t);
  }
  byObject.set(ini, t);
  return t;
}

/** One varga's spec under an ini (drop-in for ALL_VARGAS[name]). */
export const vargaSpec = (name: VargaName, ini?: VargaIni | null): VargaSpec => vargasOf(ini)[name];

// ------------------------------------------------------------------ labels and UI choices

/** Column label suffixes by preference (FUN_00404a20; '' = no suffix). */
const SUFFIX: Partial<Record<VargaName, string[]>> = {
  D2: ['CnL', 'Jn', 'Pv', 'SN', 'Md', 'KN', 'US', 'Lm', 'Rm', 'RmM', 'Ni', 'NiM'],
  D3: ['Trd', 'Pv', 'Sn', 'Jn', 'US'], D4: ['', 'Pv'], D5: ['', 'Pv'], D7: ['Trd', '7-1', '1-7'], D8: ['', 'Ra'],
  D9: ['', 'K', 'KM', 'UKM'], D10: ['Trd', 'Pv', '9-12', '6-9', '5-8'], D11: ['', 'Ra'], D12: ['Trd', 'Rev'],
  D16: ['Trd', 'Rev'], D20: ['Trd', 'Rev'], D24: ['Rev', 'Trd', 'Rev2'], D27: ['Trd', 'Rev'], D30: ['', 'Pv', 'Sh'],
  D60: ['Trd', 'Rev', 'RvAr', 'Ar'], D81: ['', 'K'],
};
const VARGA_PREF = Object.fromEntries(Object.entries(PREF_VARGA).map(([k, v]) => [v, k])) as Partial<Record<VargaName, VargaPrefKey>>;

/** JHora's column header for a varga under an ini: "D-2 (US)", "D-10 x D-9", "D-0", ... */
export function vargaColumnLabel(v: VargaName, ini?: VargaIni | null): string {
  const o = vargaOptionsFromIni(ini ?? {});
  if (v === 'D10xD9') return `D-${VARGA_PARTS[o.dm]} x D-${VARGA_PARTS[o.dn]}`;
  if (v === 'D0') return `D-${o.custom.n}`;
  const k = VARGA_PREF[v];
  const suffix = k ? SUFFIX[v]?.[o.prefs[k]] : '';
  return suffix ? `D-${v.slice(1)} (${suffix})` : `D-${v.slice(1)}`;
}

export interface VargaChoice {
  key: VargaPrefKey;
  varga: VargaName;
  /** the chart menu's submenu caption */
  title: string;
  /** in menu order; value = the ini value the menu command stores */
  options: { value: number; label: string; cmd: number }[];
}

/** Chart menu 103's "Choose ..." submenus (menu order, captions and command ids from the MENU resource). */
export const VARGA_CHOICES: VargaChoice[] = [
  { key: 'D9Preference', varga: 'D9', title: 'Choose navamsa (D-9)', options: [
    { value: 0, label: "Parasara's navamsa", cmd: 33237 },
    { value: 3, label: 'Parasara navamsa with even sign reversal (Uniform Krishna Mishra navamsa)', cmd: 33319 },
    { value: 1, label: 'Kalachakra navamsa', cmd: 33238 },
    { value: 2, label: "Rangacharya's Krishna mishra navamsa / Nadi Navamsa of Pt Rath (non-uniform)", cmd: 33285 }] },
  { key: 'HoraPreference', varga: 'D2', title: 'Choose hora (D-2)', options: [
    { value: 6, label: 'Parasara hora with parivritti & even sign reversal (Uma-Shambhu)', cmd: 33258 },
    { value: 0, label: 'Traditional Parasara hora (only Cn & Le)', cmd: 33152 },
    { value: 1, label: 'Jagannatha hora (1st/7th, day/night)', cmd: 33151 },
    { value: 2, label: 'Parivritti-dwaya (bicyclical) hora', cmd: 33156 },
    { value: 3, label: 'Samasaptaka hora (rasi and 7th)', cmd: 33153 },
    { value: 4, label: 'Mandooka hora (rasi and 3rd)', cmd: 33154 },
    { value: 5, label: 'Kashinatha hora (ownership, day/night)', cmd: 33155 },
    { value: 7, label: 'Labha Mandooka hora (rasi and 11th)', cmd: 33257 },
    { value: 8, label: 'Raman hora (1st/11th, day/night)', cmd: 33256 },
    { value: 9, label: 'Raman hora (SJC modified)', cmd: 33261 },
    { value: 10, label: 'Niranjan hora (3rd/8th, 2nd/7th, day/night)', cmd: 33259 },
    { value: 11, label: 'Niranjan hora (SJC modified)', cmd: 33260 }] },
  { key: 'D3Preference', varga: 'D3', title: 'Choose drekkana (D-3)', options: [
    { value: 4, label: 'Parasara drekkana with parivritti & even sign reversal (Uma-Shambhu)', cmd: 33395 },
    { value: 0, label: 'Traditional Parasara drekkana', cmd: 33147 },
    { value: 1, label: 'Parivritti-traya drekkana', cmd: 33144 },
    { value: 2, label: 'Somanatha drekkana', cmd: 33145 },
    { value: 3, label: 'Jagannatha drekkana', cmd: 33146 }] },
  { key: 'D4Preference', varga: 'D4', title: 'Choose chaturthamsa (D-4)', options: [
    { value: 0, label: 'Traditional Parasara chaturthamsa', cmd: 33180 },
    { value: 1, label: 'Parivritti chaturthamsa (cyclical, H-4)', cmd: 33176 }] },
  { key: 'D5Preference', varga: 'D5', title: 'Choose panchamsa (D-5)', options: [
    { value: 0, label: 'Standard panchamsa', cmd: 33181 },
    { value: 1, label: 'Parivritti panchamsa (cyclical, H-5)', cmd: 33177 }] },
  { key: 'D7Preference', varga: 'D7', title: 'Choose saptamsa (D-7)', options: [
    { value: 0, label: 'Traditional Parasara saptamsa (Even: Start from 7th & go forward)', cmd: 33401 },
    { value: 1, label: 'Pararsara saptamsa with even sign reversal (Even: Start from 7th & go reverse)', cmd: 33402 },
    { value: 2, label: 'Pararsara saptamsa with even sign reversal (Even: Go reverse & end in 7th)', cmd: 33403 }] },
  { key: 'D8Preference', varga: 'D8', title: 'Choose ashtamsa (D-8)', options: [
    { value: 0, label: 'Continuous/regular ashtamsa', cmd: 33182 },
    { value: 1, label: "Dr. Raman's ashtamsa (tattva based)", cmd: 33178 }] },
  { key: 'D10Preference', varga: 'D10', title: 'Choose dasamsa (D-10)', options: [
    { value: 0, label: 'Traditional Parasara dasamsa (Even: Start from 9th & go forward)', cmd: 33263 },
    { value: 2, label: 'Pararsara dasamsa with even sign reversal (Even: Start from 9th & go reverse)', cmd: 33398 },
    { value: 3, label: 'Pararsara dasamsa with even sign reversal (Even: Go reverse & end in 9th)', cmd: 33399 },
    { value: 4, label: 'Pararsara dasamsa with even sign reversal (Even: Start from reverse 9th & go reverse)', cmd: 33400 },
    { value: 1, label: 'Parivritti dasamsa (Ojha)', cmd: 33264 }] },
  { key: 'D11Preference', varga: 'D11', title: 'Choose D-11', options: [
    { value: 0, label: 'Rudramsa (regular, Pt. Rath)', cmd: 33183 },
    { value: 1, label: 'Ekadasamsa (anti-zodiacal, Dr. Raman)', cmd: 33179 }] },
  { key: 'D12Preference', varga: 'D12', title: 'Choose dwadasamsa (D-12)', options: [
    { value: 0, label: 'Traditional Parasara dwadasamsa', cmd: 33411 },
    { value: 1, label: 'Parasara dwadasamsa with even sign reversal', cmd: 33412 }] },
  { key: 'D16Preference', varga: 'D16', title: 'Choose shodasamsa (D-16)', options: [
    { value: 0, label: 'Traditional Parasara shodasamsa', cmd: 33407 },
    { value: 1, label: 'Parasara shodasamsa with even sign reversal', cmd: 33408 }] },
  { key: 'D20Preference', varga: 'D20', title: 'Choose vimsamsa (D-20)', options: [
    { value: 0, label: 'Traditional Parasara vimsamsa', cmd: 33413 },
    { value: 1, label: 'Parasara vimsamsa with even sign reversal', cmd: 33414 }] },
  { key: 'D24Preference', varga: 'D24', title: 'Choose siddhamsa (D-24)', options: [
    { value: 0, label: 'Parasara siddhamsa with even sign reversal (Odd Le->Cn, Even Cn->Le)', cmd: 33396 },
    { value: 1, label: 'Traditional Parasara siddhamsa (Odd Le->Cn, Even Cn->Ge)', cmd: 33397 },
    { value: 2, label: 'Parasara siddhamsa with even sign double reversal (Odd Le->Cn, Even Le->Cn)', cmd: 33409 }] },
  { key: 'D27Preference', varga: 'D27', title: 'Choose nakshatramsa (D-27)', options: [
    { value: 0, label: 'Traditional Parasara nakshatramsa', cmd: 33415 },
    { value: 1, label: 'Parasara nakshatramsa with even sign reversal', cmd: 33416 }] },
  { key: 'D30Preference', varga: 'D30', title: 'Choose trimsamsa (D-30)', options: [
    { value: 0, label: 'Parasara trimsamsa', cmd: 33150 },
    { value: 1, label: 'Parivritti (cyclical) trimsamsa', cmd: 33149 },
    { value: 2, label: 'Shashtyamsa like trimsamsa', cmd: 33148 }] },
  { key: 'D60Preference', varga: 'D60', title: 'Choose shashtyamsa (D-60)', options: [
    { value: 0, label: 'Traditional Parasara shashtyamsa (from sign)', cmd: 33405 },
    { value: 3, label: 'Parasara shashtyamsa (from Aries)', cmd: 33417 },
    { value: 1, label: 'Parasara shashtyamsa with even sign reversal (from sign)', cmd: 33406 },
    { value: 2, label: 'Parasara shashtyamsa with even sign reversal (from Aries)', cmd: 33410 }] },
  { key: 'D81Preference', varga: 'D81', title: 'Choose nava-navamsa (D-81)', options: [
    { value: 0, label: "Parasara's nava-navamsa", cmd: 33240 },
    { value: 1, label: 'Kalachakra nava-navamsa', cmd: 33241 }] },
  { key: 'D108Preference', varga: 'D108', title: 'Ashtottaramsa chart (D-108) to be used', options: [
    { value: 0, label: 'Rasi divided into 108 parts', cmd: 0 },
    { value: 1, label: 'Navamsa divided into 12 parts', cmd: 0 }] },
];

/** Dialog 2073 combo 1004 (sCustDivSettings.tStart). */
export const CUSTOM_STARTS = [
  'The base',
  'The 1st/7th from base (if sign is odd/even)',
  'The 1st/9th from base (if sign is odd/even)',
  'The 1st/5th from base (if sign is odd/even)',
  'The 1st/11th from base (if sign is odd/even)',
  'The 1st/3rd from base (if sign is odd/even)',
  'The 1st/5th/9th from base (if sign is movable/fixed/dual)',
  'The 1st/9th/5th from base (if sign is movable/fixed/dual)',
  'The 1st/4th/7th/10th from base (if sign is fiery/earthy/airy/watery)',
  'The 1st/10th/7th/4th from base (if sign is fiery/earthy/airy/watery)',
];
/** Dialog 2073 combo 1003 (CustDivSettings.bHouseAsSeed). */
export const CUSTOM_BASES = ['Aries always', 'The sign in question'];
/** Dialog 2071 combo items (DmDnChartDm uses all 23, DmDnChartDn the first 20). */
export const DMDN_NAMES = ['Rasi (D-1)', 'Navamsa (D-9)', 'Hora (D-2)', 'Drekkana (D-3)', 'Chaturthamsa (D-4)', 'Panchamsa (D-5)',
  'Shashthamsa (D-6)', 'Saptamsa (D-7)', 'Ashtamsa (D-8)', 'Dasamsa (D-10)', 'Rudramsa (D-11)', 'Dwadasamsa (D-12)',
  'Shodasamsa (D-16)', 'Vimsamsa (D-20)', 'Siddhamsa (D-24)', 'Nakshatramsa (D-27)', 'Trimsamsa (D-30)', 'Khavedamsa (D-40)',
  'Akshavedamsa (D-45)', 'Shashtyamsa (D-60)', 'Navanavamsa (D-81)', 'Ashtottaramsa (D-108)', 'Dwadasamsa-Dwadasamsa (D-144)'];

/** The ini keys the varga table depends on (for the UI's reset). */
export const VARGA_INI_KEYS = [
  ...VARGA_PREF_KEYS.filter((k) => k !== 'D81Preference'), 'Use1DegInD30ForDivLong', 'DivLongFromEndToo',
  'CustDivSettings.nCustDivN', 'CustDivSettings.bCyclical', 'CustDivSettings.bHouseAsSeed',
  'sCustDivSettings.bReverseDivsInEvenSigns', 'sCustDivSettings.tStart', 'DmDnChartDm', 'DmDnChartDn',
] as const satisfies readonly (keyof JhoraIni)[];
