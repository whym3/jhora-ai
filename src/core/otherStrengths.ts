// The remaining "Other strengths" tables of JHora 8.0, ported from jhora.exe:
//   vaiseshikamsas (FUN_004c05f0 with the test FUN_004a6af0) and their options
//     (Preferences 33166, dialog 2047: SwarudhaInAmsaBala and the *BadInAmsaBala keys),
//   basic avasthas - age, alertness, mood (FUN_004c0840, FUN_004c0a20, FUN_004c0b40)
//     with the menu-129 options: the varga of alertness and mood (33046, varga index at
//     avastha object +4, picked with dialog FUN_004d8730), permanent or compound
//     relationships (33044/33045, UseCompundRelationshipInAvasthas, read through
//     FUN_004a6340) and compound relationships of the rasi chart or of the varga
//     (33047/33048, CompoundRelationshipsFromRasi, FUN_004a6340 / FUN_004a63a0),
//   sayanadi avasthas (FUN_004c08c0),
//   Tajaka pancha-vargeeya, dwadasa-vargeeya and harsha balas
//   (FUN_004bdf70, FUN_004be280, FUN_004c0fd0) with the hadda table of FUN_004aa2a0.
import type { Chart } from './chart';
import type { Graha } from './positions';
import { GRAHAS, norm360 } from './positions';
import { SIGN_LORD } from './lords';
import { vargaLongitude, type VargaName } from './vargas';
import { vargaSpec } from './vargaOptions';
import { DEBILITATION, EXALTATION } from './signStrength';
import { MOOLATRIKONA } from './deities';
import { compoundRelation, naturalRelation, SEVEN } from './relations';
import { computeShadbala } from './shadbala';
import { nakshatraOf } from './zodiac';
import { VARGA_INDEX, VARGA_PARTS } from './vargaOptions';
import { grahaArudha, type ArudhaOptions } from './arudhas';
import { bhavaArudhaOptions, bhavaArudhaSigns } from './arudhaPadas';
import type { VargaCtx } from './signStrength';
import { DEFAULTS, type JhoraIni } from '../settings/generated';

const trunc = (x: number) => (x < 0 ? Math.ceil(x) : Math.floor(x));
/** FUN_004ae7a0: remainder in 1..n */
const mod1 = (x: number, n: number) => { const r = x % n; return r === 0 ? n : r; };
/** Own sign incl. the nodes' co-lordship of Aquarius and Scorpio (FUN_004ae4e0). */
const ownSign = (g: Graha, s: number) => SIGN_LORD[s] === g || (s === 10 && g === 'Rahu') || (s === 7 && g === 'Ketu');
const NUMBER: Record<Graha, number> = { Sun: 1, Moon: 2, Mars: 3, Mercury: 4, Jupiter: 5, Venus: 6, Saturn: 7, Rahu: 8, Ketu: 9 };
const MALEFIC = new Set<Graha>(['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu']);

function signIn(chart: Chart, g: Graha | 'Lagna', varga: VargaName = 'D1'): number {
  const lon = g === 'Lagna' ? chart.positions.ascendant : chart.positions.grahas[g].lon;
  return Math.floor(vargaLongitude(lon, vargaSpec(varga, chart.ini)) / 30) % 12;
}

/** Sign of a body in JHora's varga index v (chart + 0x17d7 + body*0x1d + v). */
const signAt = (chart: Chart, g: Graha | 'Lagna', v: number) => signIn(chart, g, VARGA_INDEX[v] ?? 'D1');
const iniOf = (chart: Chart) => ({ ...DEFAULTS, ...chart.ini }) as JhoraIni;

// ---------------------------------------------------------------- vaiseshikamsas

export const VAISESHIKAMSA_GROUPS: { name: string; vargas: VargaName[]; names: string[] }[] = [
  { name: 'Dasa Varga (10)', vargas: ['D1', 'D2', 'D3', 'D7', 'D9', 'D10', 'D12', 'D16', 'D30', 'D60'],
    names: ['Paarijaata', 'Uttama', 'Gopura', 'Simhasana', 'Paaraavata', 'Devaloka', 'Brahmaloka', 'Airaavata', 'Sreedhaama'] },
  { name: 'Shodasa Varga (16)', vargas: ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60'],
    names: ['Bhedaka', 'Kusuma', 'Nagapurusha', 'Kanduka', 'Kerala', 'Kalpavriksha', 'ChandanaVana', 'PurnaChandra', 'Uchchaisrava', 'Dhanvantari', 'Suryakanta', 'Vidruma', 'Indraasana', 'Goloka', 'Srivallabha'] },
  { name: 'Sapta Varga (7)', vargas: ['D1', 'D2', 'D3', 'D7', 'D9', 'D12', 'D30'],
    names: ['Kimshuka', 'Vyanjana', 'Chaamara', 'Chatra', 'Kundala', 'Mukuta'] },
  { name: 'Shad Varga (6)', vargas: ['D1', 'D2', 'D3', 'D9', 'D12', 'D30'],
    names: ['Kimshuka', 'Vyanjana', 'Chaamara', 'Chatra', 'Kundala'] },
];

/** Vaiseshikamsa options of dialog 2047 (ini keys in brackets, globals of FUN_004a6af0). */
export interface AmsaBalaOptions {
  /**
   * SwarudhaInAmsaBala (0x8a4bb0), combo "What does swarudha mean here?": 0 ignore this special
   * case, 1 AL of the rasi chart, 2 AL of each varga, 3 graha arudha of the rasi chart,
   * 4 graha arudha of each varga, 5 AL lord of the rasi chart (kendras from him in the vargas),
   * 6 AL of rasi - its kendra lords, 7 AL of the varga - its kendra lords.
   */
  swarudha: number;
  /** the overriding conditions (applied only to placements made good by swarudha) */
  combust: boolean;               // CombustionBadInAmsaBala 0x592345 (rasi chart only)
  dispositorCombust: boolean;     // DispositorCombustionBadInAmsaBala 0x8a4bb4
  defeated: boolean;              // DefeatBadInAmsaBala 0x592346 (rasi chart only)
  dispositorDefeated: boolean;    // DispositorDefeatBadInAmsaBala 0x8a4bb5
  debilitated: boolean;           // NeechaBadInAmsaBala 0x592347 (in the division)
  dispositorDebilitated: boolean; // DispositorNeechaBadInAmsaBala 0x8a4bb6 (in the division)
  dispositorDebilitatedRasi: boolean; // DispositorNeechaRasiBadInAmsaBala 0x8a4bb7
  /** "in satru/adhisatru sthana" in the division (JHora stores it as PoorVimsopakaBadInAmsaBala 0x592348) */
  enemySign: boolean;
  /** the dispositor in satru/adhisatru sthana (DispositorPoorVimsopakaBadInAmsaBala 0x8a4bb8) */
  dispositorEnemySign: boolean;
  sayanadi: boolean;              // SayanadiBadInAmsaBala 0x592349
  dispositorSayanadi: boolean;    // DispositorSayanadiBadInAmsaBala 0x8a4bb9
}

export function amsaBalaOptions(ini: Partial<JhoraIni> = {}): AmsaBalaOptions {
  const v = (k: keyof JhoraIni) => (ini[k] ?? DEFAULTS[k]) as number;
  return {
    swarudha: v('SwarudhaInAmsaBala'),
    combust: v('CombustionBadInAmsaBala') !== 0,
    dispositorCombust: v('DispositorCombustionBadInAmsaBala') !== 0,
    defeated: v('DefeatBadInAmsaBala') !== 0,
    dispositorDefeated: v('DispositorDefeatBadInAmsaBala') !== 0,
    debilitated: v('NeechaBadInAmsaBala') !== 0,
    dispositorDebilitated: v('DispositorNeechaBadInAmsaBala') !== 0,
    dispositorDebilitatedRasi: v('DispositorNeechaRasiBadInAmsaBala') !== 0,
    enemySign: v('PoorVimsopakaBadInAmsaBala') !== 0,
    dispositorEnemySign: v('DispositorPoorVimsopakaBadInAmsaBala') !== 0,
    sayanadi: v('SayanadiBadInAmsaBala') !== 0,
    dispositorSayanadi: v('DispositorSayanadiBadInAmsaBala') !== 0,
  };
}

/** Dialog 2047's swarudha combo (dlginit strings, value = combo index). */
export const SWARUDHA_CHOICES = [
  'Ignore this special case', 'Arudha lagna of rasi chart', 'Arudha lagna of each divisional chart',
  'Graha arudha of rasi chart', 'Graha arudha of each divisional chart', 'AL lord of rasi chart (take kendra from him in vargas)',
  'AL of rasi, but take kendra lords (not planets in kendra)', 'AL of varga, but take kendra lords (not planets in kendra)',
];

const n360 = (x: number) => ((x % 360) + 360) % 360;

/**
 * FUN_004a6890: combustion for the vaiseshikamsa test - Mars..Saturn within 6 deg of the
 * Sun either way (<= 6), with CombustionSpecialRuleVenusMercury (0x59234a): retrograde
 * Mercury and direct Venus are not combust.
 */
function combustForAmsa(chart: Chart, g: Graha): boolean {
  if (!['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(g)) return false;
  const p = chart.positions.grahas;
  const c = n360(p[g].lon - p.Sun.lon) <= 6 || n360(p.Sun.lon - p[g].lon) <= 6;
  if (iniOf(chart).CombustionSpecialRuleVenusMercury !== 0) {
    if (g === 'Mercury' && p.Mercury.retrograde) return false;
    if (g === 'Venus' && !p.Venus.retrograde) return false;
  }
  return c;
}

/** Another graha (Sun..Ketu) ahead of g by at most 1 deg (FUN_004ae540(other, g) <= 1). */
const defeated = (chart: Chart, g: Graha) => GRAHAS.some((q) => q !== g && n360(chart.positions.grahas[q].lon - chart.positions.grahas[g].lon) <= 1);

/** Sayanadi avasthas that annul (Sayana, Upavesana, Netrapani, Gamana, Aagamana, Nidra). */
const BAD_SAYANADI = new Set([0, 1, 2, 4, 5, 11]);

/** Compound relationship of p towards q in varga v (table chart+0x124d0, FUN_004a34c0). */
const compoundIn = (chart: Chart, p: Graha, q: Graha, v: number) => compoundRelation(p, q, (x) => signAt(chart, x, v));

/**
 * FUN_004a6af0(p, v): is the planet well placed in varga v? Own sign (nodes: Aq/Sc),
 * exaltation or moolatrikona always counts. Otherwise, per SwarudhaInAmsaBala, a kendra
 * from the chosen "swarudha" counts unless one of the selected overriding conditions holds.
 */
function vaiseshikaGood(chart: Chart, g: Graha, v: number, o: AmsaBalaOptions, cache: Map<string, unknown>): boolean {
  const s = signAt(chart, g, v);
  if (ownSign(g, s) || EXALTATION[g] === s || MOOLATRIKONA[g] === s) return true;
  if (o.swarudha < 1 || o.swarudha > 7) return false;
  const memo = <T>(k: string, f: () => T): T => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k) as T; };
  // AL = body 59 (FUN_004a3800, with the arudha options); graha arudha = body 82 + planet
  const al = (vv: number) => memo(`al${vv}`, () => bhavaArudhaSigns(chart, VARGA_INDEX[vv] ?? 'D1')[0]);
  const ctx = (vv: number): VargaCtx => ({ sign: (x: Graha) => signAt(chart, x, vv), degree: (x: Graha) => chart.positions.grahas[x].lon % 30 });
  const aopt: ArudhaOptions = bhavaArudhaOptions(chart.ini);
  const kendraFrom = (ref: number) => (s - ref + 12) % 3 === 0;
  const lordsKendra = (ref: number) => [0, 3, 6, 9].some((k) => SIGN_LORD[(ref + k) % 12] === g);
  let good: boolean;
  switch (o.swarudha) {
    case 1: good = kendraFrom(al(0)); break;
    case 2: good = kendraFrom(al(v)); break;
    case 3: good = kendraFrom(grahaArudha(g, ctx(0), aopt)); break;
    case 4: good = kendraFrom(grahaArudha(g, ctx(v), aopt)); break;
    case 5: good = kendraFrom(signAt(chart, SIGN_LORD[al(0)], v)); break;
    case 6: good = lordsKendra(al(0)); break;
    default: good = lordsKendra(al(v)); break;
  }
  if (!good) return false;
  // dispositor: the sign's lord (FUN_004ad3b0; its node co-lord flag 0x896ff4 is never set)
  const d = SIGN_LORD[s];
  const sayanadi = () => memo('sayanadi', () => sayanadiAvasthas(chart));
  if (o.combust && v === 0 && combustForAmsa(chart, g)) good = false;
  if (o.dispositorCombust && combustForAmsa(chart, d)) good = false;
  if (o.defeated && v === 0 && defeated(chart, g)) good = false;
  if (o.dispositorDefeated && defeated(chart, d)) good = false;
  if (o.debilitated && DEBILITATION[g] === s) good = false;
  if (o.dispositorDebilitated && DEBILITATION[d] === signAt(chart, d, v)) good = false;
  if (o.dispositorDebilitatedRasi && DEBILITATION[d] === signAt(chart, d, 0)) good = false;
  if (o.enemySign && compoundIn(chart, g, d, v) < 0) good = false;
  if (o.dispositorEnemySign && compoundIn(chart, d, SIGN_LORD[signAt(chart, d, v)], v) < 0) good = false;
  if (o.sayanadi && BAD_SAYANADI.has(sayanadi()[g].avastha)) good = false;
  if (o.dispositorSayanadi && BAD_SAYANADI.has(sayanadi()[d].avastha)) good = false;
  return good;
}

/**
 * Number of vargas of each group in which the planet is well placed (FUN_004c05f0 over
 * the varga lists of each group), with the amsa's name. With JHora's default
 * (SwarudhaInAmsaBala=0) only own, exaltation and moolatrikona signs count.
 */
export function vaiseshikamsas(chart: Chart): Record<Graha, { count: number; label: string }[]> {
  const o = amsaBalaOptions(chart.ini);
  const cache = new Map<string, unknown>();
  const out = {} as Record<Graha, { count: number; label: string }[]>;
  for (const g of GRAHAS) {
    out[g] = VAISESHIKAMSA_GROUPS.map((grp) => {
      const count = grp.vargas.filter((v) => vaiseshikaGood(chart, g, VARGA_INDEX.indexOf(v), o, cache)).length;
      return { count, label: count >= 2 ? `${count}-${grp.names[count - 2]}` : '' };
    });
  }
  return out;
}

/**
 * The cells as JHora's list shows them: its label tables (0x8a26b0 Dasa, 0x8a266c Shodasa,
 * 0x8a26dc Sapta, 0x8a26fc Shad, used by FUN_0047fd90) hold the names padded with blanks to
 * 14 characters (Shodasa: 15), and all blanks below 2.
 */
export function vaiseshikamsaCells(chart: Chart): Record<Graha, string[]> {
  const width = [14, 15, 14, 14];
  const v = vaiseshikamsas(chart);
  return Object.fromEntries(GRAHAS.map((g) => [g, v[g].map((x, i) => x.label.padEnd(width[i]))])) as Record<Graha, string[]>;
}

// ---------------------------------------------------------------- basic avasthas

export const AGES = ['Baala (infant)', 'Kumara (adolescent)', 'Yuva (young)', 'Vriddha (old)', 'Mrita (dead)'];
export const ALERTNESS = ['Jaagrita (awake)', 'Swapna (dreaming)', 'Sushupta (asleep)'];
export const MOODS = [
  'Deepta (glowing)', 'Swastha (comfortable)', 'Mudita (delighted)', 'Saanta (peaceful)', 'Deena (sad)', 'Duhkhita (distressed)',
  'Vikala (crippled)', 'Khala (mischievous)', 'Kopita (angry)', 'Lajjita (ashamed)', 'Garvita (proud)',
];

export interface BasicAvastha { age: number; alertness: number; moods: number[] }

/** Malefics (Sun, Mars, Saturn, Rahu, Ketu) in a sign of varga v (FUN_004a6220 with list 4). */
const maleficsIn = (chart: Chart, s: number, v: number) => GRAHAS.filter((g) => MALEFIC.has(g) && signAt(chart, g, v) === s).length;

/** Menu 129 avastha options. */
export interface AvasthaOptions {
  /** varga index of alertness and mood (33046; JHora's varga order, 0 = rasi) */
  varga: number;
  /** UseCompundRelationshipInAvasthas (0x8a4b6c): alertness from compound instead of permanent relationships */
  compound: boolean;
  /** CompoundRelationshipsFromRasi (0x8a4b6d): the compound table of the rasi chart, not of the varga */
  fromRasi: boolean;
}

export function avasthaOptions(ini: Partial<JhoraIni> = {}, varga = 0): AvasthaOptions {
  return {
    varga: VARGA_INDEX[varga] ? varga : 0,
    compound: (ini.UseCompundRelationshipInAvasthas ?? DEFAULTS.UseCompundRelationshipInAvasthas) !== 0,
    fromRasi: (ini.CompoundRelationshipsFromRasi ?? DEFAULTS.CompoundRelationshipsFromRasi) !== 0,
  };
}

/** "D-9" etc. for the avastha column headers ("Alertness (D-1)"). */
export const avasthaVargaLabel = (v: number) => `D-${VARGA_PARTS[v] ?? 1}`;

/** Age (from the D-1 degree), alertness and mood (in the avastha varga) of each graha. */
export function basicAvasthas(chart: Chart, varga = 0): Record<Graha, BasicAvastha> {
  const o = avasthaOptions(chart.ini, varga);
  const v = o.varga;
  const lagna = signAt(chart, 'Lagna', v);
  const sun = chart.positions.grahas.Sun.lon;
  // compound relationship table as FUN_004c0b40 / FUN_004a6340 read it
  const compound = (p: Graha, q: Graha) => compoundIn(chart, p, q, o.fromRasi ? 0 : v);
  const out = {} as Record<Graha, BasicAvastha>;
  for (const g of GRAHAS) {
    const lon = chart.positions.grahas[g].lon;
    const s1 = Math.floor(lon / 30);
    let d = lon - s1 * 30;
    if (s1 % 2 === 1) d = 30 - d;
    const age = trunc(d * 0.16666666666666666);
    const s = signAt(chart, g, v);
    const lord = SIGN_LORD[s];
    // alertness: own/exalted awake; friend or neutral of the sign lord dreaming; enemy asleep
    const rel = o.compound ? compound(g, lord) : naturalRelation(g, lord);
    const alertness = ownSign(g, s) || EXALTATION[g] === s ? 0 : rel >= 0 ? 1 : 2;
    const f = new Array(11).fill(false);
    if (EXALTATION[g] === s) f[0] = true;
    if (ownSign(g, s)) f[1] = true;
    if (lord !== g) {
      const r = compound(g, lord);
      if (r === 2) f[2] = true; else if (r === 1) f[3] = true; else if (r === 0) f[4] = true; else f[5] = true;
    }
    const m = maleficsIn(chart, s, v);
    if (m > (MALEFIC.has(g) ? 2 : 1)) f[6] = true;
    if (lord === 'Sun' || lord === 'Mars' || lord === 'Saturn') f[7] = true;
    let dist = norm360(lon - sun);
    if (dist > 180) dist = 360 - dist;
    if (dist <= 6 && g !== 'Sun') f[8] = true;
    if ((s - lagna + 12) % 12 === 4 && m > (MALEFIC.has(g) ? 1 : 0)) f[9] = true;
    if (EXALTATION[g] === s || MOOLATRIKONA[g] === s) f[10] = true;
    out[g] = { age, alertness, moods: f.flatMap((x, i) => (x ? [i] : [])) };
  }
  return out;
}

// ---------------------------------------------------------------- sayanadi avasthas

export const SAYANADI = [
  'Sayana (lying down)', 'Upavesana (sitting)', 'Netrapani (eyes and hands)', 'Prakasana (glowing)', 'Gamana (on the move)',
  'Aagamana (coming)', 'Sabha (at an assembly)', 'Aagama (returning)', 'Bhojana (eating)', 'NrityaLipsa (desirous of dancing)',
  'Kautuka (eager)', 'Nidra (sleeping)',
];
export const INTENSITY = ['Drishti (medium)', 'Cheshta (full)', 'Vicheshta (little)'];
const SAYANADI_CONST: Record<Graha, number> = { Sun: 5, Moon: 2, Mars: 2, Mercury: 3, Jupiter: 5, Venus: 3, Saturn: 3, Rahu: 4, Ketu: 4 };

/**
 * BPHS: (navamsa within the sign x nakshatra x planet number) + lagna sign +
 * janma ghatis + Moon's nakshatra, mod 12; the five intensities take
 * (avastha^2 + k) mod 12 for k = 1..5, plus the planet's constant, mod 3.
 */
export function sayanadiAvasthas(chart: Chart): Record<Graha, { avastha: number; intensities: number[] }> {
  const lagna = signIn(chart, 'Lagna');
  const moonStar = nakshatraOf(chart.positions.grahas.Moon.lon) + 1;
  const ghatis = trunc(chart.day.ghatis);
  const out = {} as Record<Graha, { avastha: number; intensities: number[] }>;
  for (const g of GRAHAS) {
    const lon = chart.positions.grahas[g].lon;
    const s = Math.floor(lon / 30);
    const navamsa = 1 - trunc((lon - s * 30) * -0.30000000000000004);
    const star = nakshatraOf(lon) + 1;
    const a = mod1(navamsa * star * NUMBER[g] + lagna + 1 + ghatis + 1 + moonStar, 12);
    const intensities: number[] = [];
    for (let k = 1; k <= 5; k++) intensities.push(mod1(SAYANADI_CONST[g] + mod1(a * a + k, 12), 3) - 1);
    out[g] = { avastha: a - 1, intensities };
  }
  return out;
}

// ---------------------------------------------------------------- Tajaka balas

/** Tajaka friendship of the seven planets: 2 own, 1 friend, 0 otherwise (rows/cols Sun..Saturn). */
const TAJAKA_FRIEND = [
  [2, 1, 1, 0, 1, 0, 0],
  [1, 2, 1, 0, 1, 0, 0],
  [1, 1, 2, 0, 1, 0, 0],
  [0, 0, 0, 2, 0, 1, 1],
  [1, 1, 1, 0, 2, 0, 0],
  [0, 0, 0, 1, 0, 2, 1],
  [0, 0, 0, 1, 0, 1, 2],
];
const tf = (p: Graha, q: Graha) => TAJAKA_FRIEND[SEVEN.indexOf(p)][SEVEN.indexOf(q)];

/** Hadda (Egyptian terms) of FUN_004aa2a0: four boundaries and five lords per sign. */
const HADDA_BOUNDS = [
  [6, 12, 20, 25], [8, 14, 22, 27], [6, 12, 17, 24], [7, 13, 19, 26], [6, 11, 18, 24], [7, 17, 21, 28],
  [6, 14, 21, 28], [7, 11, 19, 24], [12, 17, 21, 26], [7, 14, 22, 26], [7, 13, 20, 25], [12, 16, 19, 28],
];
const HADDA_LORDS: Graha[][] = ([
  [5, 6, 4, 3, 7], [6, 4, 5, 7, 3], [4, 6, 5, 3, 7], [3, 6, 4, 5, 7], [5, 6, 7, 4, 3], [4, 6, 5, 3, 7],
  [7, 4, 5, 6, 3], [3, 6, 4, 5, 7], [5, 6, 4, 3, 7], [4, 5, 6, 7, 3], [4, 6, 5, 3, 7], [6, 5, 4, 3, 7],
] as number[][]).map((r) => r.map((n) => GRAHAS[n - 1]));

export function haddaLord(lon: number): Graha {
  const s = Math.floor(lon / 30) % 12;
  const d = lon - s * 30;
  let i = 0;
  while (i < 4 && !(d < HADDA_BOUNDS[s][i])) i++;
  return HADDA_LORDS[s][i];
}

export const PANCHA_CLASSES = ['Weak', 'Ordinary', 'Powerful', 'Very Strong', 'Extraordinary'];
export const HARSHA_CLASSES = ['Nil', 'Little', 'Average', 'Full', 'Excess'];

export interface TajakaBalas { pancha: number; panchaClass: number; dwadasa: number; harsha: number }

export function tajakaBalas(chart: Chart): Record<string, TajakaBalas> {
  const sb = computeShadbala(chart);
  const lagna = signIn(chart, 'Lagna');
  const out: Record<string, TajakaBalas> = {};
  const HARSHA_HOUSE: Record<string, number> = { Sun: 8, Moon: 2, Mars: 5, Mercury: 0, Jupiter: 10, Venus: 4, Saturn: 11 };
  for (const g of SEVEN) {
    const lon = chart.positions.grahas[g].lon;
    const lordIn = (v: VargaName) => SIGN_LORD[signIn(chart, g, v)];
    const T = (q: Graha) => tf(g, q);
    const pancha = (sb.planets[g as keyof typeof sb.planets].uchcha / 3 + [7.5, 15, 30][T(lordIn('D1'))] + [3.75, 7.5, 15][T(haddaLord(lon))]
      + [2.5, 5, 10][T(lordIn('D3'))] + [1.25, 2.5, 5][T(lordIn('D9'))]) * 0.25;
    const panchaClass = pancha < 5 ? 0 : pancha < 10 ? 1 : pancha < 15 ? 2 : pancha < 20 ? 3 : 4;
    // dwadasa-vargeeya: D-1..D-12 signs owned by the planet or a Tajaka friend, or its exaltation; never its debilitation
    let dwadasa = 0;
    for (let n = 1; n <= 12; n++) {
      const s = signIn(chart, g, `D${n}` as VargaName);
      if (EXALTATION[g] === s) dwadasa++;
      else if (DEBILITATION[g] !== s && T(SIGN_LORD[s]) !== 0) dwadasa++;
    }
    // harsha bala: 5 points each for its harsha house, own/exaltation sign, the gender's houses and day/night
    const s = signIn(chart, g);
    const house = (s - lagna + 12) % 12;
    let harsha = 0;
    if (HARSHA_HOUSE[g] === house) harsha += 5;
    if (ownSign(g, s) || EXALTATION[g] === s) harsha += 5;
    const male = g === 'Sun' || g === 'Mars' || g === 'Jupiter';
    if (Math.floor(house / 3) % 2 === (male ? 1 : 0)) harsha += 5;
    if (male === chart.day.isDay) harsha += 5;
    out[g] = { pancha, panchaClass, dwadasa, harsha };
  }
  return out;
}
