// Small natal tables of JHora's "Longitudes & Basic Info" menu (menu 105).
import { GRAHAS, norm360, type Graha, type Positions } from './positions';
import { ALL_VARGAS, vargaLongitude, type VargaSpec } from './vargas';
import { NAKSHATRAS, nakshatraOf, signOf } from './zodiac';
import { NAK_LORD, nakshatraLord, signLord } from './lords';

export const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
export const SHORT: Record<string, string> = {
  Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa',
  Rahu: 'Ra', Ketu: 'Ke', Uranus: 'Ur', Neptune: 'Ne', Pluto: 'Pl',
};

// ---- Houses (default: equal 30-degree houses with the lagna in the middle) ----
export interface House { start: number; cusp: number; end: number; bodies: string[] }

export function equalHousesMiddle(p: Positions): House[] {
  const bodies: [string, number][] = [
    ['Lagna', p.ascendant],
    ...GRAHAS.map((g): [string, number] => [g, p.grahas[g].lon]),
    ...(['Uranus', 'Neptune', 'Pluto'] as const).map((g): [string, number] => [g, p.outer[g].lon]),
  ];
  return Array.from({ length: 12 }, (_, i) => {
    const cusp = norm360(p.ascendant + 30 * i);
    const start = norm360(cusp - 15);
    // JHora lists occupants in body order (As, Su, Mo, ..., Pl), not by longitude.
    const inside = bodies.filter(([, lon]) => norm360(lon - start) < 30).map(([n]) => SHORT[n]);
    return { start, cusp, end: norm360(cusp + 15), bodies: inside };
  });
}

// ---- Chara karakas (8-karaka scheme: Rahu included, Pitri karaka included) ----
export const KARAKA_NAMES: [string, string][] = [
  ['AK', 'Self'], ['AmK', 'Minister (advisor)'], ['BK', 'Brother (associate)'], ['MK', 'Mother (nourisher)'],
  ['PiK', 'Father (authority)'], ['PK', 'Son (follower)'], ['GK', 'Cousin (rival)'], ['DK', 'Spouse (partner)'],
];

/** Planets ordered by advancement within their sign; Rahu counts from the end of its sign. */
export function charaKarakas(p: Positions, scheme: 7 | 8 = 8): { karaka: string; planet: Graha; meaning: string }[] {
  const list: Graha[] = scheme === 8
    ? ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu']
    : ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const adv = (g: Graha) => { const d = p.grahas[g].lon % 30; return g === 'Rahu' ? 30 - d : d; };
  const sorted = [...list].sort((a, b) => adv(b) - adv(a));
  const names = scheme === 8 ? KARAKA_NAMES : KARAKA_NAMES.filter(([k]) => k !== 'PiK');
  return sorted.map((planet, i) => ({ karaka: names[i][0], planet, meaning: names[i][1] }));
}

// ---- Taras ----
export const NAVA_TARAS: [string, string][] = [
  ['Janma', 'Birth'], ['Sampat', 'Wealth'], ['Vipat', 'Danger'], ['Kshema', 'Well-being'], ['Pratyak', 'Obstacles'],
  ['Saadhana', 'Achievement'], ['Naidhana', 'Death'], ['Mitra', 'Friend'], ['Parama Mitra', 'Good friend'],
];

export function navaTaras(fromLon: number): { tara: string; meaning: string; lord: Graha; naks: string[] }[] {
  const start = nakshatraOf(fromLon);
  return NAVA_TARAS.map(([tara, meaning], i) => ({
    tara, meaning, lord: NAK_LORD[(start + i) % 9],
    naks: [0, 9, 18].map((k) => NAKSHATRAS[(start + i + k) % 27]),
  }));
}

/**
 * Special taras. Counted in the 28-star scheme (Abhijit after Uttarashadha) except
 * where JHora counts differently; the offsets below reproduce JHora's table.
 */
const NAK28 = [...NAKSHATRAS.slice(0, 21), 'Abhi', ...NAKSHATRAS.slice(21)] as string[];
const NAK28_LORD: Graha[] = [...Array.from({ length: 21 }, (_, i) => nakshatraLord(i)), 'Sun', ...Array.from({ length: 6 }, (_, i) => nakshatraLord(21 + i))];
export const SPECIAL_TARAS: [string, string, number][] = [
  ['Janma', 'Existence', 1], ['Karma', 'Work', 10], ['Samudayika', 'Collective', 18], ['Sanghatika', 'Social', 16],
  ['Jaati', 'Family', 4], ['Naidhana', 'Death', 7], ['Desa', 'Nation', 12], ['Abhisheka', 'Coronation', 28],
  ['Aadhaana', 'Kindling', 19], ['Vainasika', 'Destructive', 22], ['Maanasa', 'Mental', 25],
];

export function specialTaras(fromLon: number): { tara: string; meaning: string; nak: string; lord: Graha }[] {
  const janma27 = nakshatraOf(fromLon);
  const janma28 = janma27 >= 21 ? janma27 + 1 : janma27; // index in the 28-star list
  return SPECIAL_TARAS.map(([tara, meaning, n]) => {
    const i = (janma28 + n - 1) % 28;
    return { tara, meaning, nak: NAK28[i], lord: NAK28_LORD[i] };
  });
}

// ---- Yogi, Sahayogi, Avayogi ----
export function yogiPoints(p: Positions) {
  const yoga = norm360(p.grahas.Sun.lon + p.grahas.Moon.lon + 93 + 20 / 60);
  const avayoga = norm360(yoga + 186 + 40 / 60);
  return {
    yogaSphuta: yoga, avayogaSphuta: avayoga,
    yogi: nakshatraLord(nakshatraOf(yoga)),
    sahayogi: signLord(signOf(yoga)),
    avayogi: nakshatraLord(nakshatraOf(avayoga)),
  };
}

// ---- Combustion and planetary war ----
/**
 * Combustion as jhora.exe computes it (FUN_004a6890): Mars..Saturn are combust
 * within 6 degrees of the Sun (either side, strictly less). With the
 * CombustionSpecialRuleVenusMercury option (default on), retrograde Mercury
 * and direct Venus are never combust.
 */
const COMBUST_ORB = 6;
export function isCombust(p: Positions, g: Graha, specialRule = true): boolean {
  if (!['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(g)) return false;
  const d = Math.abs(((p.grahas[g].lon - p.grahas.Sun.lon + 540) % 360) - 180);
  let combust = d < COMBUST_ORB;
  if (specialRule) {
    if (g === 'Mercury' && p.grahas.Mercury.retrograde) combust = false;
    if (g === 'Venus' && !p.grahas.Venus.retrograde) combust = false;
  }
  return combust;
}

/**
 * Planetary war as JHora reports it: any two grahas (Sun and nodes included)
 * within one degree; the one further ahead in longitude wins.
 */
export function grahaYuddha(p: Positions): Record<Graha, { wins: Graha[]; loses: Graha[] }> {
  const out = {} as Record<Graha, { wins: Graha[]; loses: Graha[] }>;
  for (const g of GRAHAS) out[g] = { wins: [], loses: [] };
  for (const a of GRAHAS) for (const b of GRAHAS) {
    if (a === b) continue;
    const d = ((p.grahas[a].lon - p.grahas[b].lon + 540) % 360) - 180;
    if (Math.abs(d) <= 1 && d > 0) { out[a].wins.push(b); out[b].loses.push(a); }
  }
  return out;
}

// ---- 64th navamsa and 22nd drekkana ----
/** Lord of the division `count` steps on from the division that holds `lon`, in varga `spec` with `n` parts per sign. */
export function nthDivisionLord(lon: number, n: number, count: number, spec: VargaSpec): Graha {
  const size = 30 / n;
  const idx = Math.floor(lon / size) + count - 1;       // absolute division index on the zodiac
  const mid = (idx % (12 * n)) * size + size / 2;
  return signLord(signOf(vargaLongitude(mid, spec)));
}
export const lord64thNavamsa = (lon: number) => nthDivisionLord(lon, 9, 64, ALL_VARGAS.D9);
export const lord22ndDrekkana = (lon: number, spec: VargaSpec) => nthDivisionLord(lon, 3, 22, spec);

/** Aquarius and Scorpio lords are named with their co-lords, as JHora prints them. */
export function lordLabel(lon: number, spec: VargaSpec, count: number, n: number): string {
  const size = 30 / n;
  const idx = Math.floor(lon / size) + count - 1;
  const mid = (idx % (12 * n)) * size + size / 2;
  const sign = signOf(vargaLongitude(mid, spec));
  // JHora names Rahu with Saturn for Aquarius but gives Scorpio to Mars alone here.
  if (sign === 10) return 'Saturn and Rahu';
  return signLord(sign);
}
