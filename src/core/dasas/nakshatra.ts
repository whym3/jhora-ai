// Nakshatra (graha) dasas that run a fixed sequence of lords from the Moon's
// star. Each system is either "per star" (lord index counted from a starting
// star, balance = fraction of the Moon's star left) or "grouped" (consecutive
// stars belong to one lord and the balance is taken over the whole group, as
// in Ashtottari). Antardasas follow the same sequence starting with the dasa
// lord, proportionally to the years. Rules verified against JHora 8.0 output.
// Options (per dasa slot, FUN_0040dc90 .. FUN_00410420): NakshatraDasaShift
// (DAT_008a15a8[slot]) is subtracted from the per-star count (after the
// direction: Dwadasottari ((26 - star) mod 27 - shift)) and, for the grouped
// dasas, rotates the start of their 28-star scheme (0x592020 starts, 0x592100
// spans: Abhijit 276 deg 40' - 280 deg 53' 40") by `shift` stars;
// NaksDasaADMethodPreference (DAT_008a160c[slot]) orders the sub-periods
// (vimsottari.ts adIndex = FUN_004b3720).
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { adIndex } from './vimsottari';

const NAK = 360 / 27;

export interface NakshatraDasaDef {
  title: string;
  lords: [Graha, number][];
  /** per-star systems: lord index = ((dir * (nak - startStar)) mod 27) mod n */
  startStar?: number;
  dir?: 1 | -1;
  /** count without wrapping at 27 first (Yogini: (star + 3) mod 8) */
  noWrap?: boolean;
  /** grouped systems: [start, end) longitude of each lord's group, in sequence order */
  groups?: [number, number][];
  /** how many cycles of maha dasas JHora lists */
  cycles?: number;
  /** grouped systems: first star (28-star index) and stars per lord in the 28-star scheme */
  scheme28?: { start: number; sizes: number[] };
}

export interface NakOptions {
  /** NakshatraDasaShift[slot] */
  shift?: number;
  /** NaksDasaADMethodPreference[slot] */
  adMethod?: number;
  /** grouped systems: extra rotation of the 28-star scheme (a Tajaka chart's completed years) */
  rotate?: number;
}

/** JHora's 28-star table (0x592020 / 0x592100): start and span of each star, Abhijit at 21. */
const STAR28_START = [...Array.from({ length: 21 }, (_, i) => (i * 40) / 3), 276 + 2 / 3, 280 + 53 / 60 + 40 / 3600, ...Array.from({ length: 5 }, (_, i) => ((23 + i) * 40) / 3)];
const STAR28_SPAN = STAR28_START.map((x, i) => (i === 27 ? 360 : STAR28_START[i + 1]) - x);

function groups28(start: number, sizes: number[]): [number, number][] {
  let k = ((start % 28) + 28) % 28;
  return sizes.map((n) => {
    const a = STAR28_START[k];
    let span = 0;
    for (let j = 0; j < n; j++) span += STAR28_SPAN[(k + j) % 28];
    k = (k + n) % 28;
    return [a, a + span] as [number, number];
  });
}

const L = (s: string): [Graha, number][] => s.split(' ').map((x) => {
  const [g, y] = x.split(':');
  const name = { Su: 'Sun', Mo: 'Moon', Ma: 'Mars', Me: 'Mercury', Ju: 'Jupiter', Ve: 'Venus', Sa: 'Saturn', Ra: 'Rahu', Ke: 'Ketu' }[g] as Graha;
  return [name, Number(y)];
});

export const NAKSHATRA_DASAS: Record<string, NakshatraDasaDef> = {
  Ashtottari: {
    title: 'Ashtottari Dasa (conditional nakshatra dasa)',
    lords: L('Su:6 Mo:15 Ma:8 Me:17 Sa:10 Ju:19 Ra:12 Ve:21'),
    // Ardra.. Sun 4, Magha.. Moon 3, Hasta.. Mars 4, Anuradha.. Mercury 3,
    // P.Ashadha..Sravana Saturn (4 with Abhijit), Dhanishtha.. Jupiter 3,
    // U.Bhadra..Bharani Rahu 4, Krittika..Mrigasira Venus 3
    groups: stars([5, 4], [9, 3], [12, 4], [16, 3], [19, 3], [22, 3], [25, 4], [2, 3]),
    scheme28: { start: 5, sizes: [4, 3, 4, 3, 4, 3, 4, 3] },
  },
  Yogini: { title: 'Yogini Dasa (with planets replacing Yoginis)', lords: L('Mo:1 Su:2 Ju:3 Ma:4 Me:5 Sa:6 Ve:7 Ra:8'), startStar: -3, noWrap: true, cycles: 3 },
  'Dwisaptati sama': { title: 'Dwi-saptati sama dasa (applicable if lagna lord is in 7th or 7th lord is in lagna)', lords: L('Su:9 Mo:9 Ma:9 Me:9 Ju:9 Ve:9 Sa:9 Ra:9'), startStar: 18 },
  'Shattrimsa sama': { title: 'Shat-trimsa sama dasa (applicable for daytime births in Sun\'s hora and night-time births in Moon\'s hora)', lords: L('Mo:1 Su:2 Ju:3 Ma:4 Me:5 Sa:6 Ve:7 Ra:8'), startStar: 21, cycles: 3 },
  Dwadasottari: { title: 'Dwadasottari dasa (applicable if lagna is in Venusian amsa)', lords: L('Su:7 Ju:9 Ke:11 Me:13 Ra:15 Ma:17 Sa:19 Mo:21'), startStar: 26, dir: -1 },
  'Chaturaseeti sama': { title: 'Chaturaseeti sama dasa (applicable if 10th lord is in 10th)', lords: L('Su:12 Mo:12 Ma:12 Me:12 Ju:12 Ve:12 Sa:12'), startStar: 14 },
  Sataabdika: { title: 'Sataabdika dasa (applicable if lagna is in vargottama)', lords: L('Su:5 Mo:5 Ve:10 Me:10 Ju:20 Ma:20 Sa:30'), startStar: 26 },
  Shodasottari: { title: 'Shodasottari dasa (applicable if lagna in Moon\'s hora in Krishna paksha or in Sun\'s hora in Sukla paksha)', lords: L('Su:11 Ma:12 Ju:13 Sa:14 Ke:15 Mo:16 Me:17 Ve:18'), startStar: 7 },
  // 28-star groups (3 and 4 stars); JHora's Abhijit runs from 6 40 to 10 00 Capricorn
  Shashtihayani: {
    title: 'Shashti-hayani Dasa (applicable if Sun is in lagna)',
    lords: L('Ju:10 Su:10 Ma:10 Mo:6 Me:6 Ve:6 Sa:6 Ra:6'),
    groups: [[0, 40], [40, 280 / 3], [280 / 3, 400 / 3], [400 / 3, 560 / 3], [560 / 3, 680 / 3], [680 / 3, 830 / 3], [830 / 3, 920 / 3], [920 / 3, 360]],
    scheme28: { start: 0, sizes: [3, 4, 3, 4, 3, 4, 3, 4] },
  },
  Panchottari: { title: 'Panchottari dasa (applicable if lagna is in Cancer in rasi and dwadasamsa)', lords: L('Su:12 Me:13 Sa:14 Ma:15 Ve:16 Mo:17 Ju:18'), startStar: 16 },
};

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** star groups given as [first star, number of stars] */
function stars(...g: [number, number][]): [number, number][] {
  return g.map(([s, c]) => [s * NAK, (s + c) * NAK]);
}

/** Maha dasas (in dasa years from birth) with `levels` levels of sub-periods. */
export function nakshatraDasa(def: NakshatraDasaDef, moonLon: number, levels = 2, opts: NakOptions = {}): Period[] {
  const n = def.lords.length;
  const total = def.lords.reduce((a, [, y]) => a + y, 0);
  const nak = Math.floor(moonLon / NAK);
  const shift = opts.shift ?? 0;
  let first: number, elapsed: number;
  if (def.groups) {
    const rot = shift + (opts.rotate ?? 0);
    const groups = rot && def.scheme28 ? groups28(def.scheme28.start + rot, def.scheme28.sizes) : def.groups;
    first = groups.findIndex(([a, b]) => mod(moonLon - a, 360) < b - a);
    const [a, b] = groups[first];
    elapsed = (mod(moonLon - a, 360) / (b - a)) * def.lords[first][1];
  } else {
    // stars are counted around the 27 from the starting star, then reduced mod n
    const count = def.noWrap ? mod(nak - shift, 27) - def.startStar! : mod(mod((def.dir ?? 1) * (nak - def.startStar!), 27) - shift, 27);
    first = mod(count, n);
    elapsed = ((moonLon - nak * NAK) / NAK) * def.lords[first][1];
  }
  const out: Period[] = [];
  let t = -elapsed;
  for (let i = 0; i < n * (def.cycles ?? 1); i++) {
    const [lord, years] = def.lords[(first + i) % n];
    out.push(split({ lord, start: t, end: t + years }, def, total, levels - 1, opts.adMethod ?? 0));
    t += years;
  }
  return out;
}

function split(p: Period, def: NakshatraDasaDef, total: number, levels: number, adMethod = 0): Period {
  if (levels <= 0) return p;
  const i0 = def.lords.findIndex(([g]) => g === p.lord);
  const len = p.end - p.start;
  const children: Period[] = [];
  let t = p.start;
  for (let i = 0; i < def.lords.length; i++) {
    const [lord, years] = def.lords[adIndex(i0, i, def.lords.length, adMethod)];
    const sub = (len * years) / total;
    children.push(split({ lord, start: t, end: t + sub }, def, total, levels - 1, adMethod));
    t += sub;
  }
  return { ...p, children };
}

/**
 * Saptarshi nakshatra dasa: from the lagna's star backwards, 10 years per star
 * starting at birth; antardasas are the next ten stars backwards, a year each.
 */
export const SAPTARSHI_TITLE = 'Saptarshi nakshatra dasa';
export function saptarshiDasa(lagnaLon: number, levels = 2, starNames: readonly string[]): Period[] {
  const star0 = Math.floor(lagnaLon / NAK);
  const make = (star: number, start: number, len: number, depth: number): Period => {
    const p: Period = { lord: 'Sun', label: starNames[mod(star, 27)], start, end: start + len };
    if (depth > 1) p.children = Array.from({ length: 10 }, (_, i) => make(star - i, start + (i * len) / 10, len / 10, depth - 1));
    return p;
  };
  return Array.from({ length: 10 }, (_, i) => make(star0 - i, i * 10, 10, levels));
}

/**
 * FUN_004a4b10: the 21 seeds of the nakshatra dasas (chart+0x12250 longitude, +0x121f8 star,
 * +0x122f8 remaining part), from JHora's body table 0x59236c [2,2,2,2,0,31,32,36,1,3..9,20,19,17,
 * 103,104]; seeds 1..3 are the 5th, 4th and 8th stars from the Moon (Utpanna, Kshema,
 * Aadhaana: star + 4 / 3 / 7, longitude + 53 deg 20' / 40 / 93 deg 20', same remaining part).
 * NakshatraDasaStartPoint[slot] picks one (the seed menu 155 of the seed comparison view,
 * 33140..33134 / 33161 -> 1..8, "Accept this seed" 33142 stores it for Vimsottari).
 */
export const NAKSHATRA_SEEDS = [
  'Moon', 'Utpanna (5th from Moon)', 'Kshema (4th from Moon)', 'Aadhaana (8th from Moon)', 'Lagna', 'Maandi', 'Gulika',
  'Sookshma TriSphuta', 'Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu', 'Bhrigu Bindu', 'Indu Lagna', 'Pranapada Lagna',
] as const;

export function nakshatraSeedLon(chart: Chart, point = 0): number {
  const g = chart.positions.grahas;
  const n360 = (x: number) => ((x % 360) + 360) % 360;
  const named = (name: string) => {
    const b = chart.longitudes.find((x) => x.name === name);
    if (!b) throw new Error(`nakshatra dasa seed ${name} missing`);
    return b.lon;
  };
  switch (point) {
    case 0: return g.Moon.lon;
    case 1: return n360(g.Moon.lon + 160 / 3);
    case 2: return n360(g.Moon.lon + 40);
    case 3: return n360(g.Moon.lon + 280 / 3);
    case 4: return chart.positions.ascendant;
    case 5: case 6: case 7: case 16: case 17: case 18: return named(NAKSHATRA_SEEDS[point]);
    case 8: return g.Sun.lon;
    default:
      if (point >= 9 && point <= 15) return g[(['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const)[point - 9]].lon;
      throw new Error(`nakshatra dasa seed ${point} not supported`);
  }
}
