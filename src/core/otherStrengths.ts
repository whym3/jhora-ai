// The remaining "Other strengths" tables of JHora 8.0, ported from jhora.exe:
//   vaiseshikamsas (FUN_004c05f0 with the test FUN_004a6af0),
//   basic avasthas - age, alertness, mood (FUN_004c0840, FUN_004c0a20, FUN_004c0b40),
//   sayanadi avasthas (FUN_004c08c0),
//   Tajaka pancha-vargeeya, dwadasa-vargeeya and harsha balas
//   (FUN_004bdf70, FUN_004be280, FUN_004c0fd0) with the hadda table of FUN_004aa2a0.
import type { Chart } from './chart';
import type { Graha } from './positions';
import { GRAHAS, norm360 } from './positions';
import { SIGN_LORD } from './lords';
import { ALL_VARGAS, vargaLongitude, type VargaName } from './vargas';
import { DEBILITATION, EXALTATION } from './signStrength';
import { MOOLATRIKONA } from './deities';
import { compoundRelation, naturalRelation, SEVEN } from './relations';
import { computeShadbala } from './shadbala';
import { nakshatraOf } from './zodiac';

const trunc = (x: number) => (x < 0 ? Math.ceil(x) : Math.floor(x));
/** FUN_004ae7a0: remainder in 1..n */
const mod1 = (x: number, n: number) => { const r = x % n; return r === 0 ? n : r; };
/** Own sign incl. the nodes' co-lordship of Aquarius and Scorpio (FUN_004ae4e0). */
const ownSign = (g: Graha, s: number) => SIGN_LORD[s] === g || (s === 10 && g === 'Rahu') || (s === 7 && g === 'Ketu');
const NUMBER: Record<Graha, number> = { Sun: 1, Moon: 2, Mars: 3, Mercury: 4, Jupiter: 5, Venus: 6, Saturn: 7, Rahu: 8, Ketu: 9 };
const MALEFIC = new Set<Graha>(['Sun', 'Mars', 'Saturn', 'Rahu', 'Ketu']);

function signIn(chart: Chart, g: Graha | 'Lagna', varga: VargaName = 'D1'): number {
  const lon = g === 'Lagna' ? chart.positions.ascendant : chart.positions.grahas[g].lon;
  return Math.floor(vargaLongitude(lon, ALL_VARGAS[varga]) / 30) % 12;
}

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

/**
 * Number of vargas of each group in which the planet is in its own,
 * exaltation or moolatrikona sign (JHora's default, SwarudhaInAmsaBala=0,
 * which also skips the cancellation options), with the amsa's name.
 */
export function vaiseshikamsas(chart: Chart): Record<Graha, { count: number; label: string }[]> {
  const out = {} as Record<Graha, { count: number; label: string }[]>;
  for (const g of GRAHAS) {
    out[g] = VAISESHIKAMSA_GROUPS.map((grp) => {
      const count = grp.vargas.filter((v) => { const s = signIn(chart, g, v); return ownSign(g, s) || EXALTATION[g] === s || MOOLATRIKONA[g] === s; }).length;
      return { count, label: count >= 2 ? `${count}-${grp.names[count - 2]}` : '' };
    });
  }
  return out;
}

// ---------------------------------------------------------------- basic avasthas

export const AGES = ['Baala (infant)', 'Kumara (adolescent)', 'Yuva (young)', 'Vriddha (old)', 'Mrita (dead)'];
export const ALERTNESS = ['Jaagrita (awake)', 'Swapna (dreaming)', 'Sushupta (asleep)'];
export const MOODS = [
  'Deepta (glowing)', 'Swastha (comfortable)', 'Mudita (delighted)', 'Saanta (peaceful)', 'Deena (sad)', 'Duhkhita (distressed)',
  'Vikala (crippled)', 'Khala (mischievous)', 'Kopita (angry)', 'Lajjita (ashamed)', 'Garvita (proud)',
];

export interface BasicAvastha { age: number; alertness: number; moods: number[] }

/** Malefics (Sun, Mars, Saturn, Rahu, Ketu) in a sign (FUN_004a6220 with list 4). */
const maleficsIn = (chart: Chart, s: number) => GRAHAS.filter((g) => MALEFIC.has(g) && signIn(chart, g) === s).length;

export function basicAvasthas(chart: Chart): Record<Graha, BasicAvastha> {
  const lagna = signIn(chart, 'Lagna');
  const sun = chart.positions.grahas.Sun.lon;
  const out = {} as Record<Graha, BasicAvastha>;
  for (const g of GRAHAS) {
    const lon = chart.positions.grahas[g].lon;
    const s = Math.floor(lon / 30);
    let d = lon - s * 30;
    if (s % 2 === 1) d = 30 - d;
    const age = trunc(d * 0.16666666666666666);
    const lord = SIGN_LORD[s];
    // alertness: own/exalted awake; natural friend or neutral of the sign lord dreaming; enemy asleep
    const alertness = ownSign(g, s) || EXALTATION[g] === s ? 0 : naturalRelation(g, lord) >= 0 ? 1 : 2;
    const f = new Array(11).fill(false);
    if (EXALTATION[g] === s) f[0] = true;
    if (ownSign(g, s)) f[1] = true;
    if (lord !== g) {
      const r = compoundRelation(g, lord, (x) => signIn(chart, x));
      if (r === 2) f[2] = true; else if (r === 1) f[3] = true; else if (r === 0) f[4] = true; else f[5] = true;
    }
    const m = maleficsIn(chart, s);
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
