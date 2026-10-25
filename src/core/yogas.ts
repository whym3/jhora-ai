// Yogas as JHora 8.0 finds them (FUN_004c2250 and the 92 evaluators it calls,
// names/definitions/results from FUN_004cb240, display from FUN_00496e70).
//
// Bodies are JHora's numbers: 0 lagna, 1 Sun .. 7 Saturn, 8 Rahu, 9 Ketu. All
// tests read sign positions in one varga, so the same code serves any
// divisional chart. Givers were traced in the assembly (the decompiler shows
// several of them as sign or house numbers, which they are not).
import type { Chart } from './chart';
import type { Graha } from './positions';
import { vargaLongitude, type VargaName } from './vargas';
import { vargasOf } from './vargaOptions';
import { charaKarakas } from './basics';
import { bhavaArudha } from './arudhas';
import META from './data/yogas.json';
import { grahaAspects, rasiAspects as rasiAsp } from './aspects';

export interface YogaRecord {
  cat: number;
  idx: number;
  name: string;
  definition: string;
  result: string;
  /** body numbers as JHora stores them */
  givers: number[];
}

/** JHora's yoga menu order: label -> category passed to the driver (0 = all). */
export const YOGA_MODES: [string, number][] = [
  ['All yogas', 0], ['Pancha maha purusha yogas', 1], ['Solar yogas', 2], ['Lunar yogas', 3], ['Naabhasa yogas', 4],
  ['Raja yogas', 6], ['Raja sambandha yogas', 7], ['Dhana yogas', 8], ['Daridra yogas', 9], ['Parivraja yogas', 10],
  ['Other popular yogas', 5],
];

/** Short names JHora prints for giver numbers (its body order). */
export const GIVER_NAMES = ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke', 'Ur', 'Ne', 'Pl'];
export const NAABHASA_GIVERS = 'Naabhasa yoga - throughout life';

const PLANET_NAMES = ['', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const GRAHA_OF: Graha[] = ['Sun', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const NUM: Record<Graha, number> = { Sun: 1, Moon: 2, Mars: 3, Mercury: 4, Jupiter: 5, Venus: 6, Saturn: 7, Rahu: 8, Ketu: 9 };

const mod12 = (x: number) => ((x % 12) + 12) % 12;
/** classical sign lords (FUN_004ad3b0 with its option off) */
const LORD = [3, 6, 4, 2, 1, 4, 6, 3, 5, 7, 7, 5];
/** JHora's tables 0x591e34 / 0x591e5c / 0x591e84 by body number */
const EX = [0, 0, 1, 9, 5, 3, 11, 6, 2, 8];
const DEB = [0, 6, 7, 3, 11, 9, 5, 0, 8, 2];
const MT = [0, 4, 1, 0, 5, 8, 6, 10, 5, 11];
/** natural relations 0x585ed4 [p][q]: 0 self, 2 friend, 3 neutral, 4 enemy */
const NAT = [
  [], [0, 0, 2, 2, 3, 2, 4, 4, 4, 4], [0, 2, 0, 3, 2, 3, 3, 3, 4, 4], [0, 2, 2, 0, 4, 2, 3, 3, 4, 2],
  [0, 2, 4, 3, 0, 3, 2, 3, 3, 3], [0, 2, 2, 2, 4, 0, 4, 3, 3, 3], [0, 4, 4, 3, 2, 3, 0, 2, 2, 2],
  [0, 4, 4, 4, 2, 3, 2, 0, 2, 2], [0, 4, 4, 4, 3, 3, 2, 2, 0, 2], [0, 4, 4, 4, 3, 3, 2, 2, 0, 0],
];
const BEN = [2, 4, 5, 6];
const MAL = [1, 3, 7, 8, 9];
const GROUPS = [[1, 2, 3, 4, 5, 6, 7], BEN, [1, 3, 7], [1, 2, 3, 4, 5, 6, 7, 8, 9], MAL];
/** Dhana table of FUN_004c2f60: per lagna [5th, 11th, 11th, 11th], then per lagna [in lagna, aspecting x3] */
const DHANA = [
  1, 7, 2, 5, 4, 5, 2, 3, 6, 3, 0, 0, 3, 6, 0, 0, 5, 4, 0, 0, 7, 2, 1, 0, 7, 1, 2, 0, 5, 4, 0, 0, 3, 6, 0, 0, 6, 3, 0, 0,
  4, 5, 2, 3, 2, 7, 2, 5, 3, 4, 6, 7, 6, 4, 7, 0, 4, 5, 7, 0, 2, 4, 5, 0, 1, 3, 5, 0, 4, 5, 7, 0, 6, 4, 7, 0, 3, 4, 6, 7,
  5, 3, 4, 0, 7, 3, 5, 0, 7, 3, 5, 0, 5, 3, 4, 0,
];
const PARIVRAJA_PLANET = [
  '', ' (Sun shows a ritualistic ascetic)', ' (Moon shows a pilgrim or a Saiva)', ' (Mars shows a Buddhist or a tantrik)',
  ' (Mercury shows a knower of many tricks)', ' (Jupiter shows a Vedantin)', ' (Venus shows ascetics who perform yajnas)',
  ' (Saturn shows a rigorous sadhaka or yogi or a beggar)',
];

const META_BY_KEY = new Map((META as [number, number, string, string, string][]).map(([c, i, n, d, r]) => [`${c}:${i}`, { name: n, definition: d, result: r }]));

function meta(cat: number, idx: number): { name: string; definition: string; result: string } {
  if (cat === 8) {
    const L = idx % 12;
    const P = (i: number) => PLANET_NAMES[DHANA[i]];
    if (idx < 12) {
      const t = (k: number) => DHANA[L * 4 + k];
      let d = `${P(L * 4)} in 5th, ${P(L * 4 + 1)}`;
      if (t(2)) d += `, ${P(L * 4 + 2)}`;
      if (t(3)) d += `, ${P(L * 4 + 3)}`;
      return { name: 'Dhana', definition: `${d} in 11th for ${SIGN_NAMES[L]} lagna`, result: 'Very rich' };
    }
    const b = 48 + L * 4;
    let d = `${P(b)} in ${SIGN_NAMES[L]} lagna, conjoined or aspected by ${P(b + 1)}, ${P(b + 2)}`;
    if (DHANA[b + 3]) d += `, ${P(b + 3)}`;
    return { name: 'Dhana', definition: d, result: 'Very rich' };
  }
  const m = META_BY_KEY.get(`${cat}:${idx}`);
  if (!m) throw new Error(`no yoga ${cat}:${idx}`);
  return m;
}

/** Own sign incl. the nodes' co-lordship of Aquarius and Scorpio (FUN_004ae4e0). */
const own = (p: number, s: number) => LORD[s] === p || (s === 10 && p === 8) || (s === 7 && p === 9);

interface Ctx {
  /** signs of bodies 0..9 in the yoga's varga */
  S: number[];
  /** signs of bodies 0..9 in D-1 and D-9 (some yogas read these whatever the varga) */
  D1: number[];
  D9: number[];
  cnt: number[][];
  HL: number;
  GL: number;
  AL: number;
  A9: number;
  /** chara karakas AK, AmK, BK, MK, PiK, PK, GK, DK as body numbers */
  K: number[];
  lagnaDegree: number;
  /** lagna sign in each varga index used by the D-1/D-9/D-2/D-3/D-12/D-30 aspect yoga */
  signIn: (v: VargaName, b: number) => number;
}

function buildCtx(chart: Chart, varga: VargaName): Ctx {
  const lonOf = (b: number) => (b === 0 ? chart.positions.ascendant : chart.positions.grahas[GRAHA_OF[b]].lon);
  const V = vargasOf(chart.ini);
  const signIn = (v: VargaName, b: number) => Math.floor(vargaLongitude(lonOf(b), V[v]) / 30) % 12;
  const signOfLon = (lon: number) => Math.floor(vargaLongitude(lon, V[varga]) / 30) % 12;
  const S = Array.from({ length: 10 }, (_, b) => signIn(varga, b));
  const cnt = GROUPS.map((g) => Array.from({ length: 12 }, (_, s) => g.filter((p) => S[p] === s).length));
  const named = (n: string) => chart.longitudes.find((x) => x.name === n)!.lon;
  const vctx = { sign: (g: Graha) => S[NUM[g]], degree: (g: Graha) => chart.positions.grahas[g].lon % 30 };
  return {
    S, cnt,
    D1: Array.from({ length: 10 }, (_, b) => signIn('D1', b)),
    D9: Array.from({ length: 10 }, (_, b) => signIn('D9', b)),
    HL: signOfLon(named('Hora Lagna')),
    GL: signOfLon(named('Ghati Lagna')),
    AL: bhavaArudha(S[0], vctx),
    A9: bhavaArudha(mod12(S[0] + 8), vctx),
    K: charaKarakas(chart.positions, 8).map((k) => NUM[k.planet]),
    lagnaDegree: Math.floor(chart.positions.ascendant % 30),
    signIn,
  };
}

/** Find JHora's yogas of one category (0 = all) in a varga, in JHora's order. */
export function findYogas(chart: Chart, category = 0, varga: VargaName = 'D1'): YogaRecord[] {
  const c = buildCtx(chart, varga);
  const { S, cnt } = c;
  const [, ben, , all9, mal5] = cnt;
  const occ = cnt[0];
  const L = S[0];
  const out: YogaRecord[] = [];
  const y = (cat: number, idx: number, givers: number[] = []) => {
    if (out.length >= 300) return;
    out.push({ cat, idx, givers, ...meta(cat, idx) });
  };

  const lord = (s: number) => LORD[mod12(s)];
  const H0 = (p: number) => mod12(S[p] - L);
  const H1 = (p: number) => H0(p) + 1;
  const asp = (p: number, q: number) => rasiAsp(S[p], S[q]);
  const kkHouse = (h: number) => h % 3 === 0 || h % 4 === 0;
  const kk = (p: number) => kkHouse(H0(p));
  const ownex = (p: number) => own(p, S[p]) || EX[p] === S[p];
  const isBen = (p: number) => BEN.includes(p);
  /** compound relation of p towards q: 1 adhimitra .. 5 adhisatru, 0 self */
  const comp = (p: number, q: number) => {
    if (p === q) return 0;
    const nat = NAT[p][q];
    const temp = [1, 2, 3, 9, 10, 11].includes(mod12(S[q] - S[p]));
    return temp ? nat - 1 : nat + 1;
  };
  /** FUN_004a6510 */
  const strong = (p: number) => {
    if (kk(p) || ownex(p)) return true;
    const q = lord(S[p]);
    if (NAT[p][q] === 2) return true;
    const r = comp(p, q);
    return r === 1 || r === 2;
  };
  /** FUN_004a63e0: a planet in or owning the 2nd/7th whose sign is or aspects `sign` */
  const marakaS = (sign: number) => {
    const s2 = mod12(L + 1), s7 = mod12(L + 6);
    for (let b = 1; b <= 9; b++) {
      if ((S[b] === s2 || S[b] === s7 || own(b, s2) || own(b, s7)) && rasiAsp(S[b], sign)) return true;
    }
    return false;
  };
  const marakaP = (p: number) => marakaS(S[p]);
  const inSigns = (list: number[], signs: number[]) => list.filter((p) => signs.includes(S[p]));
  const want = (cat: number) => category === 0 || category === cat;

  const LL = lord(L), L2 = lord(L + 1), L4 = lord(L + 3), L5 = lord(L + 4), L6 = lord(L + 5), L7 = lord(L + 6);
  const L8 = lord(L + 7), L9 = lord(L + 8), L10 = lord(L + 9), L11 = lord(L + 10), L12 = lord(L + 11);
  const navLord = (p: number) => lord(c.D9[p]);

  // ---------------------------------------------------------------- 1 Pancha maha purusha
  if (want(1)) {
    ([[5, [8, 11, 3]], [6, [1, 6, 11]], [4, [2, 5]], [3, [0, 7, 9]], [7, [9, 10, 6]]] as [number, number[]][]).forEach(([p, signs], i) => {
      if (H0(p) % 3 === 0 && signs.includes(S[p])) y(1, i, [p]);
    });
  }

  // ---------------------------------------------------------------- 2 Solar, 3 Lunar
  const flanks = (from: number) => {
    const second: number[] = [], twelfth: number[] = [];
    for (let p = 3; p <= 7; p++) {
      const d = mod12(S[p] - from);
      if (d === 11) twelfth.push(p); else if (d === 1) second.push(p);
    }
    return { second, twelfth };
  };
  if (want(2)) {
    const { second, twelfth } = flanks(S[1]);
    if (!twelfth.length) { if (second.length) y(2, 1, second); }
    else if (!second.length) y(2, 2, twelfth);
    else y(2, 0, [...second, ...twelfth]);
    const d = mod12(S[4] - S[1]);
    if (d === 0 || d === 6) y(2, 3, [1, 4]);
  }
  if (want(3)) {
    const { second, twelfth } = flanks(S[2]);
    if (!twelfth.length) {
      if (second.length) y(3, 1, second);
      else {
        let empty = true;
        for (let p = 1; p <= 7; p++) if (H0(p) % 3 === 0 && p !== 2) empty = false;
        if (empty) y(3, 3, [2]);
      }
    } else if (second.length) y(3, 0, [...second, ...twelfth]);
    else y(3, 2, twelfth);
    const dm = mod12(S[3] - S[2]);
    if (dm === 0 || dm === 6) y(3, 4, [2, 3]);
    if (mod12(S[5] - S[2]) % 3 === 0) y(3, 5, [2, 5]);
    const adhi: number[] = [];
    let mals = 0;
    for (let p = 1; p <= 7; p++) {
      const d = mod12(S[p] - S[2]);
      if (d >= 5 && d <= 7) { if (p >= 4 && p <= 6) adhi.push(p); else mals++; }
    }
    if (adhi.length > 1 && mals <= adhi.length) y(3, 6, adhi);
  }

  // ---------------------------------------------------------------- 4 Naabhasa
  if (want(4)) {
    const h = (s: number) => mod12(s - L);
    const signs = Array.from({ length: 12 }, (_, s) => s);
    const onlyIn = (test: (s: number) => boolean) => signs.every((s) => !occ[s] || test(s));
    const exactly = (test: (s: number) => boolean) => signs.every((s) => (occ[s] > 0) === test(s));
    for (let k = 0; k < 3; k++) if (onlyIn((s) => s % 3 === k)) y(4, k);
    const kendras = [0, 3, 6, 9].map((k) => mod12(L + k));
    if (kendras.filter((s) => ben[s] > 0 && mal5[s] <= ben[s]).length > 2) y(4, 3);
    if (kendras.filter((s) => mal5[s] > 0 && ben[s] <= mal5[s]).length > 2) y(4, 4);
    if ([[0, 3], [3, 6], [6, 9], [9, 0]].some(([a, b]) => onlyIn((s) => h(s) === a || h(s) === b))) y(4, 12);
    if (onlyIn((s) => h(s) === 0 || h(s) === 6)) y(4, 13);
    if (onlyIn((s) => h(s) === 3 || h(s) === 9)) y(4, 14);
    if (onlyIn((s) => h(s) % 4 === 0)) y(4, 15);
    if ([1, 2, 3].some((k) => onlyIn((s) => h(s) % 4 === k))) y(4, 16);
    const at = (k: number) => mod12(L + k);
    if (mal5[at(0)] < ben[at(0)] && mal5[at(6)] < ben[at(6)] && ben[at(3)] < mal5[at(3)] && ben[at(9)] < mal5[at(9)]) y(4, 17);
    if (mal5[at(3)] < ben[at(3)] && mal5[at(9)] < ben[at(9)] && ben[at(0)] < mal5[at(0)] && ben[at(6)] < mal5[at(6)]) y(4, 18);
    if (exactly((s) => h(s) % 3 === 0)) y(4, 19);
    if (exactly((s) => h(s) % 3 === 1) || exactly((s) => h(s) % 3 === 2)) y(4, 20);
    [0, 3, 6, 9].forEach((k, i) => { if (exactly((s) => mod12(h(s) - k) < 4)) y(4, 21 + i); });
    let run = 0, start = 0;
    for (let i = 0; i < 24; i++) {
      if (!occ[i % 12]) { run = 0; continue; }
      if (run === 0) start = mod12(i - L);
      if (++run === 7) { y(4, ({ 0: 25, 3: 26, 6: 27, 9: 28 } as Record<number, number>)[start] ?? 29); break; }
    }
    if (exactly((s) => h(s) % 2 === 0)) y(4, 30);
    if (exactly((s) => h(s) % 2 === 1)) y(4, 31);
    const n = occ.filter((x) => x > 0).length;
    if (n >= 1 && n <= 7) y(4, n + 4);
  }

  // ---------------------------------------------------------------- 5 Other popular
  if (want(5)) {
    if (ben[mod12(L + 1)] > 0 && ben[mod12(L + 11)] > 0) y(5, 0, BEN.filter((p) => H1(p) === 2 || H1(p) === 12));
    if (mal5[mod12(L + 1)] > 0 && mal5[mod12(L + 11)] > 0) y(5, 1, MAL.filter((p) => H1(p) === 2 || H1(p) === 12));
    if (S[5] === S[3] || mod12(S[5] + 6) === S[3]) y(5, 2, [5, 3]);
    {
      const t1 = mod12(L + 9), t2 = mod12(S[2] + 9);
      if (mal5[t1] === 0 && mal5[t2] === 0 && (ben[t1] > 0 || ben[t2] > 0)) {
        y(5, 3, BEN.filter((p) => H1(p) === 10 || H1(p) === mod12(S[2] - L + 9) + 1));
      }
    }
    if ([0, 3, 6, 9].filter((k) => ben[mod12(L + k)] > 0).length > 1 && mal5[mod12(L + 6)] === 0 && mal5[mod12(L + 7)] === 0) {
      y(5, 4, BEN.filter((p) => H0(p) % 3 === 0));
    }
    // FUN_004c4b70, FUN_004c4d40 and FUN_004c6a40 return after their first yoga
    if (L4 !== 5 && mod12(S[5] - S[L4]) % 3 === 0 && strong(LL)) y(5, 5, [L4, 5]);
    else if (S[L4] === S[L10] && (own(L4, S[L4]) || EX[L4] === S[L4])) y(5, 6, [L4, L10]);
    if (EX[LL] === S[LL] && H0(LL) % 3 === 0 && asp(LL, 5)) y(5, 7, [LL, 5]);
    else if (ben[mod12(L + 9)] + ben[mod12(L + 8)] + ben[mod12(L + 6)] > 1) y(5, 8, BEN.filter((p) => [6, 8, 9].includes(H0(p))));
    if (L5 !== L6 && mod12(S[L5] - S[L6]) % 3 === 0 && strong(LL)) y(5, 9, [L5, L6]);
    else if (S[LL] === S[L10] && S[LL] % 3 === 0 && LL !== L10 && strong(L9)) y(5, 10, [LL, L10, L9]);
    if ([0, 1, 6, 11].every((k) => all9[mod12(L + k)] > 0) && strong(L9)) {
      y(5, 11, [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => [1, 2, 7, 12].includes(H1(p))));
    } else if (mod12(S[LL] - S[5]) % 3 === 0 && mod12(S[6] - S[5]) % 3 === 0 && strong(L9)) y(5, 12, [LL, 5, 6, L9]);
    {
      const list = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => kk(p) && (own(p, S[p]) || EX[p] === S[p]));
      if (list.length > 1 && strong(LL)) y(5, 13, list);
    }
    if (S[L7] === mod12(L + 9) && EX[L7] === mod12(L + 9) && S[L9] === S[L10]) y(5, 14, [L7, L9, L10]);
    if (ben[L] > 0 && ben[mod12(L + 8)] > 0 && all9[mod12(L + 4)] > 0 && mal5[mod12(L + 3)] > 0 && mal5[mod12(L + 7)] > 0) y(5, 15);
    {
      const good = (p: number) => { const s = S[p], q = lord(s), r = comp(p, q); return own(p, s) || EX[p] === s || NAT[p][q] === 2 || r === 1 || r === 2; };
      const b = BEN.filter((p) => good(p) && [4, 5, 6].includes(H0(p)));
      const m = MAL.filter((p) => good(p) && [0, 2, 10].includes(H0(p)));
      if (b.length > 1 && m.length > 1) y(5, 16, [...b, ...m]);
    }
    if (S[L2] === mod12(L + 8) && S[L9] === mod12(L + 1) && kk(LL)) y(5, 17, [L2, L9, LL]);
    if (H0(7) === 9 && H0(2) % 4 === 0 && L % 3 === 1 && H0(6) % 3 === 0 && ben[S[2]] > 1) {
      y(5, 18, [2, 6, 7, ...BEN.filter((p) => S[p] === S[2] && p !== 2)]);
    }
    if (H0(5) === 1 && (S[5] === S[4] || asp(5, 4)) && (S[5] === S[6] || asp(5, 6))) y(5, 19, [5, 4, 6]);
    {
      const d = lord(S[LL]), r = lord(c.D1[d]), n = navLord(d);
      if ([LL, d, r, n].every((p) => ownex(p) || kk(p))) y(5, 20, [LL, d, r, n]);
    }
    {
      const a = mod12(L + 6), b = mod12(L + 7);
      if (ben[a] > 0 && ben[b] > 0 && mal5[a] === 0 && mal5[b] === 0) y(5, 21, BEN.filter((p) => H1(p) === 7 || H1(p) === 8));
    }
    // (Kulavardhana is evaluated later, see below)
    if (S[5] === 8 && S[L2] === 8 && EX[LL] === S[LL]) y(5, 23, [5, L2, LL]);
    if (EX[L11] === S[L11] && S[L11] === S[6] && mod12(S[L11] - S[LL]) % 3 === 0) y(5, 24, L11 === 6 ? [6] : [L11, 6]);
    if (S[L4] === mod12(L + 9) && S[L10] === mod12(L + 3) && EX[LL] === S[LL]) y(5, 25, [L4, L10, LL]);
    {
      const d = lord(S[LL]), q = lord(S[d]), r = comp(d, q);
      if (S[LL] === S[2] && (mod12(S[d] - L) % 3 === 0 || r === 1 || r === 0) && asp(0, d) && all9[L] > 0) y(5, 26, [LL, d, 2]);
    }
    if (S[5] === mod12(S[L9] + 8) && ben[mod12(S[5] + 8)] > 0 && S[7] === mod12(L + 9)) y(5, 27, [5, 7]);
    if (EX[L10] === S[L10] && DEB[L6] === S[L6]) y(5, 28, [L10, L6]);
    if (S[L6] === mod12(L + 5)) y(5, 29, [L6]);
    if (S[L8] === mod12(L + 7)) y(5, 30, [L8]);
    if (S[L12] === mod12(L + 11)) y(5, 31, [L12]);
    if (asp(6, 7) && asp(7, 9) && asp(9, 6)) y(5, 32, [6, 7, 9]);
    else if (mod12(S[7] - S[6]) % 4 === 0 && mod12(S[9] - S[6]) % 4 === 0) y(5, 33, [6, 7, 9]);
    {
      const s3 = mod12(c.AL + 2), s6 = mod12(c.AL + 5);
      if (ben[s3] + ben[s6] > 0 && mal5[s3] + mal5[s6] === 0) y(5, 34, inSigns(BEN, [s3, s6]));
    }
    ([[35, L2, [1, 11, 7]], [36, L7, [3, 8, 7]], [37, LL, [3, 9, 10]]] as [number, number, number[]][]).forEach(([idx, p, offs]) => {
      const signs = offs.map((k) => mod12(S[p] + k));
      const b = signs.reduce((a, s) => a + ben[s], 0), m = signs.reduce((a, s) => a + mal5[s], 0);
      if (b === BEN.length || (b > 2 && m < b)) y(5, idx, inSigns(BEN, signs));
    });
    if (mod12(S[5] - S[L9]) % 3 === 0 && mod12(S[6] - S[L11]) % 3 === 0 && (mod12(S[4] - S[LL]) % 3 === 0 || mod12(S[4] - S[L10]) % 3 === 0)) y(5, 38, [5, 6, 4]);
    {
      const n9 = navLord(L9), s2 = mod12(L + 1);
      if (S[L9] === s2 && S[L10] === s2 && S[n9] === s2) y(5, 39, [L9, L10, n9]);
    }
    if (S[L5] === mod12(L + 8) && S[L9] === mod12(L + 9) && S[L10] === mod12(L + 4)) y(5, 40, [L5, L9, L10]);
    if (mod12(S[1] - S[2]) % 4 === 0 && mod12(S[3] - S[2]) % 4 === 0) y(5, 41, [1, 2, 3]);
    {
      const n = navLord(L10);
      if (EX[n] === S[n] && S[n] === mod12(L + 9) && S[LL] === mod12(L + 9)) y(5, 42, [n, LL]);
    }
    {
      const n6 = navLord(L6), n9 = navLord(L9);
      if (L % 3 === 1 && asp(0, L6) && S[n6] === S[1] && S[n9] === S[1]) y(5, 43, [L6, n6, n9, 1]);
    }
    if (mod12(S[L9] - L) % 3 === 0 && ownex(L9) && strong(LL)) y(5, 44, [L9]);
    if (S[L10] === mod12(L + 4) && mod12(S[4] - L) % 3 === 0 && S[1] === 4
      && (mod12(S[4] - S[2]) % 4 === 0 || mod12(S[5] - S[2]) % 4 === 0) && S[3] === mod12(L + 10)) y(5, 45, [L10, 5, 4, 1]);
    {
      const n2 = navLord(L2), n5 = navLord(L5), n11 = navLord(L11), s9 = S[L9];
      if (S[n2] === s9 && EX[n2] === S[n2]) y(5, 46, [n2, L9]);
      else if (S[n5] === s9 && EX[n5] === S[n5]) y(5, 47, [n5, L9]);
      else if (S[n11] === s9 && EX[n11] === S[n11]) y(5, 48, [n11, L9]);
    }
    {
      const placed = (p: number) => H0(p) === 1 || kk(p);
      const q = lord(S[5]), r = comp(5, q);
      if (placed(4) && placed(5) && placed(6) && (ownex(5) || NAT[5][q] === 2 || r === 1 || r === 2)) y(5, 49, [4, 5, 6]);
    }
    if (S[7] === EX[7] && H0(7) % 3 === 0 && H0(5) % 3 === 0 && H0(6) % 3 === 0) y(5, 50, [5, 6, 7]);
    if (S[L2] === mod12(L + 9) && S[L10] === mod12(L + 1) && S[LL] === mod12(L + 10) && S[L11] === L && L % 3 === 1) {
      y(5, 51, [L2, L10, LL, L11]);
    }
    if (S[L5] === mod12(L + 10) && S[L11] === mod12(L + 4) && S[2] === mod12(L + 4)) y(5, 52, [L5, L11, 2]);
    if (S[1] === mod12(L + 9) && S[L10] === mod12(L + 2) && S[L10] === S[7]) y(5, 53, [1, L10, 7]);
    {
      const d5 = mod12(S[5] - S[2]);
      if (mod12(S[1] - S[2]) === 1 && mod12(S[4] - S[2]) === 2 && (d5 === 4 || d5 === 8)) y(5, 54, [2, 1, 4, 5]);
    }
    if ([1, 2, 3, 4, 5, 6, 7].every((p) => [L, S[2], S[1]].includes(mod12(S[p] + 8)))) y(5, 22);
    {
      const up = (p: number) => [2, 5, 9, 10].includes(H0(p));
      const b = BEN.filter(up).length, m = MAL.filter(up).length;
      if (b === BEN.length || (b > 2 && m < b)) y(5, 55, BEN.filter(up));
    }
    if (mod12(S[L10] - mod12(L + 6)) % 4 === 0 && EX[1] === S[1] && mod12(S[2] - L) === 8 && asp(LL, 5)) y(5, 56, [L10, 1, 2, LL]);
  }

  // ---------------------------------------------------------------- 6 Raja
  if (want(6)) {
    const pairs: [number, number][] = [];
    for (const k of [8, 4, 0]) {
      const i2 = lord(L + k), s2 = S[i2];
      for (const j of [9, 0, 3, 6]) {
        const i3 = lord(L + j), s3 = S[i3];
        if (i3 === i2) {
          if (j !== 0 && k !== 0) y(6, 0, [i3]);
          continue;
        }
        const assoc = s3 === s2 || (grahaAspects(GRAHA_OF[i3], s3, s2) && grahaAspects(GRAHA_OF[i2], s2, s3)) || (LORD[s3] === i2 && LORD[s2] === i3);
        if (!assoc) continue;
        let idx = 3;
        if (j === 0 && k === 8) idx = 1;
        else if (j === 9 && k === 8) idx = 2;
        if (idx === 3 && pairs.some(([a, b]) => (a === i3 && b === i2) || (a === i2 && b === i3))) continue;
        y(6, idx, [i3, i2]);
        pairs.push([i3, i2]);
      }
    }
    {
      const [AK, , , , PiK, PK] = c.K;
      const hAK = H0(AK), hPK = H0(PK), hPiK = H0(PiK);
      const fifth = (h: number) => h === 0 || h === 4;
      if ((fifth(hAK) && fifth(hPK)) || hAK === hPK) y(6, 4, [AK, PK]);
      if ((fifth(hAK) && fifth(hPiK)) || hAK === hPiK) y(6, 5, [AK, PiK]);
    }
    {
      const assoc = (p: number, x: number) => S[p] === x || own(p, x) || rasiAsp(S[p], x);
      for (let p = 1; p <= 9; p++) {
        const a = assoc(p, L), h = assoc(p, c.HL), g = assoc(p, c.GL);
        if (a && h && g) y(6, 6, [p]);
        else if (a && g) y(6, 7, [p]);
        else if (a && h) y(6, 8, [p]);
      }
    }
    const AK = c.K[0];
    {
      const ok = (h: number) => h === 0 || h === 4 || h === 6;
      if (ok(H0(AK)) && ok(H0(L9))) y(6, 9, [AK, L9]);
    }
    {
      const bb = (s: number) => ben[mod12(s + 4)] + ben[mod12(s + 1)] * 2;
      if (bb(S[AK]) > 2 && bb(S[LL]) > 2) y(6, 10);
    }
    if ([0, 3, 6, 9].reduce((a, k) => a + ben[mod12(L + k)], 0) === BEN.length
      && [2, 5, 10].reduce((a, k) => a + mal5[mod12(L + k)], 0) === MAL.length) y(6, 11);
    {
      const deb = [L6, L8, L12].filter((p) => DEB[p] === S[p]);
      if (ownex(LL) && asp(0, LL) && deb.length) y(6, 12, [LL, ...deb]);
    }
    const s5 = S[L5], s9 = S[L9];
    if ((s5 === s9 || s5 === S[LL]) && [0, 3, 9].includes(mod12(s5 - L))) y(6, 13);
    if (s5 === s9 || s5 === mod12(s9 + 6)) y(6, asp(0, LL) ? 14 : 15, [L5, L9]);
    {
      const list = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => S[p] === MT[p] || S[p] === EX[p]);
      if (list.length > 3) y(6, 16, list);
    }
    const s6 = S[L6], s8 = S[L8], s12 = S[L12];
    const h6 = mod12(L + 5), h8 = mod12(L + 7), h12 = mod12(L + 11);
    if (s6 === h8 || s6 === h12) y(6, 17, [L6]);
    if (s8 === h6 || s8 === h12) y(6, 18, [L8]);
    if (s12 === h6 || s12 === h8) y(6, 19, [L12]);
    const together = (a: number, b: number) => a === b || a === mod12(b + 6);
    if (together(s6, s8) && together(s6, s12)) y(6, 20, [L6, L8, L12]);
    else if (together(s6, s8)) y(6, 21, [L6, L8]);
    else if (together(s6, s12)) y(6, 22, [L6, L12]);
    else if (together(s8, s12)) y(6, 23, [L8, L12]);
    {
      const vargas: VargaName[] = ['D1', 'D9', 'D2', 'D3', 'D12', 'D30'];
      const list = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((p) => vargas.every((v) => rasiAsp(c.signIn(v, 0), c.signIn(v, p))));
      if (list.length) y(6, 24, list);
    }
  }

  // ---------------------------------------------------------------- 7 Raja sambandha
  if (want(7)) {
    const [AK, AmK] = c.K;
    const sAmK = S[AmK], sAK = S[AK], s10 = S[L10], hAK = H0(AK);
    if (sAmK === s10 || rasiAsp(sAmK, s10)) y(7, 0, [AmK, L10]);
    else if (S[LL] === s10 || rasiAsp(S[LL], s10)) y(7, 1, [LL, L10]);
    if (sAmK === sAK) y(7, 2, [AK, AmK]);
    if (sAmK === EX[AmK] || own(AmK, sAmK)) y(7, 3, [AmK]);
    if (H0(AmK) % 4 === 0) y(7, 4, [AmK]);
    {
      const d = mod12(sAmK - sAK);
      if (d % 4 === 0 || d % 3 === 0) y(7, 5, [AK, AmK]);
    }
    if ([L, c.AL, sAK].every((s) => mal5[mod12(s + 2)] > 0 && mal5[mod12(s + 5)] > 0)) y(7, 6);
    if ((sAK === EX[AK] || own(AK, sAK)) && kkHouse(hAK) && rasiAsp(S[L9], sAK)) y(7, 7, [AK, L9]);
    const withBenefic = ben[sAK] > 1 && isBen(AK) || (ben[sAK] > 0 && !isBen(AK));
    if (own(AK, S[2]) && hAK === 0) {
      if (withBenefic) y(7, 8, [AK]);
    } else {
      if ([4, 6, 8, 9].includes(hAK) && withBenefic) y(7, 9, [AK]);
      if (hAK === 8 && c.A9 === L) y(7, 10, [AK]);
    }
    if (S[LL] === mod12(L + 9) && s10 === L) y(7, 11, [LL, L10]);
    if (S[2] === mod12(sAK + 3) && S[6] === mod12(sAK + 3)) y(7, 12, [2, 6]);
    if (sAK === S[L5] && kkHouse(hAK)) y(7, 13, [AK, L5]);
    if (S[LL] === S[L5] && kkHouse(H0(LL))) y(7, 14, [LL, L5]);
  }

  // ---------------------------------------------------------------- 8 Dhana
  if (want(8)) {
    const t = (k: number) => DHANA[L * 4 + k];
    if (H1(t(0)) === 5 && H1(t(1)) === 11 && (!t(2) || H1(t(2)) === 11) && (!t(3) || H1(t(3)) === 11)) {
      y(8, L, [t(0), t(1), ...(t(2) ? [t(2)] : []), ...(t(3) ? [t(3)] : [])]);
    }
    const b = 48 + L * 4, x = DHANA[b], u = DHANA[b + 3];
    // JHora's own giver list here holds a pointer and the lagna sign; the planets the rule names are used instead.
    if (H1(x) === 1 && asp(x, DHANA[b + 1]) && asp(x, DHANA[b + 2]) && (!u || asp(x, u))) {
      y(8, L + 12, [x, DHANA[b + 1], DHANA[b + 2], ...(u ? [u] : [])]);
    }
  }

  // ---------------------------------------------------------------- 9 Daridra
  if (want(9)) {
    const sLL = S[LL];
    if (sLL === mod12(L + 11) && S[L12] === L && (marakaP(LL) || marakaP(L12))) y(9, 0, [LL, L12]);
    if (sLL === mod12(L + 5) && S[L6] === L && (marakaP(LL) || marakaP(L6))) y(9, 1, [LL, L6]);
    if (sLL === mod12(L + 7) && marakaP(LL) && (L === S[9] || S[2] === S[9])) y(9, 2, [LL, 9]);
    if ([5, 7, 11].some((k) => sLL === mod12(L + k))
      && ((mal5[sLL] > 0 && isBen(LL)) || (mal5[sLL] > 1 && !isBen(LL)))
      && (S[L2] === DEB[L2] || NAT[L2][lord(S[L2])] === 4)) y(9, 3, [LL, L2]);
    if (S[L5] === mod12(L + 5) && S[L9] === mod12(L + 11) && (marakaP(L5) || marakaP(L9))) y(9, 4, [L5, L9]);
    if (mal5[L] > 1 && S[L9] !== L && S[L10] !== L && marakaS(L)) y(9, 5, MAL.filter((p) => S[p] === L));
  }

  // ---------------------------------------------------------------- 10 Parivraja
  if (want(10)) {
    if (S[2] === S[7]) {
      if (S[2] === c.AL) y(10, 0, [7, 2]);
      else if (rasiAsp(S[2], c.AL)) y(10, 1, [7, 2]);
    }
    if (all9[S[L10]] > 4 && kk(L10)) y(10, 2, [L10]);
    if (c.lagnaDegree > 27 && ben[L] > 0 && kk(5)) y(10, 3, [5, ...BEN.filter((p) => S[p] === L)]);
    const moonD3 = c.signIn('D3', 2), moonD9 = c.D9[2];
    if ((moonD3 === 9 || moonD3 === 10) && asp(2, 3) && asp(2, 7)) y(10, 4, [2, 7, 3]);
    if ((moonD9 === 0 || moonD9 === 7) && asp(2, 7)) y(10, 5, [2, 7]);
    const d = lord(S[2]);
    let only = true;
    for (let p = 1; p <= 6; p++) if (p !== d && asp(d, p)) only = false;
    if (d !== 7 && !asp(d, 7)) only = false;
    if (only) {
      y(10, 6, [d]);
      const r = out[out.length - 1];
      if (r && r.cat === 10 && r.idx === 6) r.result += PARIVRAJA_PLANET[d] ?? '';
    }
  }
  return out;
}

/** Text of the "Yoga givers" column. */
export function giversText(r: YogaRecord): string {
  if (r.cat === 4) return NAABHASA_GIVERS;
  return r.givers.map((g) => GIVER_NAMES[g] ?? '').join(', ');
}
