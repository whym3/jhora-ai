// Small natal tables of JHora's "Longitudes & Basic Info" menu (menu 105).
import { GRAHAS, norm360, type Graha, type Positions } from './positions';
import { ALL_VARGAS, vargaLongitude, type VargaSpec } from './vargas';
import { NAK28, NAKSHATRAS, nakshatra28Of, nakshatraOf, signOf } from './zodiac';
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

/**
 * The "64th navamsa and 22nd drekkana" view (cmd 33159, routine at 0x430700): both lie
 * 210 degrees on (63 navamsas = 21 drekkanas), so JHora shifts the body by 210 deg and
 * runs a varga's sign routine on it - the D-9 routine of the chosen navamsa, and the
 * D-3 routine once per drekkana variant (D3Preference 0..4, then restored).
 */
export function maliciousLordLabel(lon: number, spec: VargaSpec): string {
  const sign = signOf(vargaLongitude(norm360(lon + 210), spec));
  return sign === 10 ? 'Saturn and Rahu' : signLord(sign);
}

// ---- Nakshatra aspects and latta ----
/**
 * Counted in the 28-star scheme from the planet's own star (offset 0 = own star);
 * offsets reproduce JHora's table on all 18 golden charts. Latta: Sun 12th forward,
 * Moon 22nd backward, Mars 3rd forward, Mercury 7th backward, Jupiter 6th forward,
 * Venus 5th backward, Saturn 8th forward, Rahu 9th backward.
 */
const LATTA_OFFSET: Partial<Record<Graha, number>> = { Sun: 11, Moon: -21, Mars: 2, Mercury: -6, Jupiter: 5, Venus: -4, Saturn: 7, Rahu: -8 };
const STAR_ASPECTS: Partial<Record<Graha, number[]>> = {
  Sun: [13, 14], Moon: [13, 14], Mars: [0, 2, 6, 7, 14], Mercury: [0, 14], Jupiter: [9, 14, 18], Venus: [0, 14], Saturn: [2, 4, 14, 18], Rahu: [],
};
export function nakshatraAspects(p: Positions): { planet: Graha; latta: string; star: string; aspected: string[] }[] {
  return (Object.keys(LATTA_OFFSET) as Graha[]).map((g) => {
    const own = nakshatra28Of(p.grahas[g].lon);
    return {
      planet: g,
      latta: NAK28[(own + LATTA_OFFSET[g]! + 28) % 28],
      star: NAK28[own],
      aspected: STAR_ASPECTS[g]!.map((o) => NAK28[(own + o) % 28]),
    };
  });
}

// ---- Drekkana types (Parasara's drekkana descriptions) ----
/** Classification of each of the 36 drekkanas as JHora labels them (sign-major, Aries first). */
const DREKKANA_TYPES: string[][] = [
  ['Ayudha (weapon), Kroora (cruel)', 'Mriga (animal), Subha (auspicious)', 'Ayudha (weapon), Misra (mixed)'],
  ['Agni (fire), Misra (mixed)', 'Mriga (animal)', '-'],
  ['-', 'Pakshi (bird)', 'Ayudha (weapon)'],
  ['Chatushpada (quadruped)', 'Sarpa (snake)', 'Sarpa (snake)'],
  ['Chatushpada (quadruped), Kroora (cruel), Pakshi (bird)', 'Ayudha (weapon)', 'Ayudha (weapon), Kroora (cruel)'],
  ['Agni (fire)', '-', '-'],
  ['-', 'Pakshi (bird)', 'Ayudha (weapon), Chatushpada (quadruped)'],
  ['Sarpa (snake), Kroora (cruel)', 'Sarpa (snake), Kroora (cruel)', 'Chatushpada (quadruped), Kroora (cruel)'],
  ['Ayudha (weapon), Chatushpada (quadruped)', '-', 'Ayudha (weapon)'],
  ['Nigala, Kroora (cruel), Chatushpada (quadruped)', '-', 'Ayudha (weapon)'],
  ['Pakshi (bird), Kroora (cruel)', 'Agni (fire)', '-'],
  ['-', '-', 'Sarpa (snake)'],
];
export function drekkanaType(lon: number): string {
  const sign = signOf(lon);
  return DREKKANA_TYPES[sign][Math.floor((lon - sign * 30) / 10)];
}

// ---- Special tithis ----
const TITHI_NAMES = ['Pratipat', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Sapthami', 'Ashtami', 'Navami', 'Dasami', 'Ekadasi', 'Dwadasi', 'Trayodasi', 'Chaturdasi'];
const TITHI_LORDS: Graha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const TITHI_DEITIES = ['Kaameswari', 'Bhaga Maalini', 'Nitya Klinna', 'Bherunda', 'Vahni Vaasini', 'Vajreswari', 'Siva Dooti', 'Tvarita', 'Kula Sundari', 'Nitya', 'Neela Pataaka', 'Vijaya', 'Sarva Mangala', 'Jwaalaa Maalini', 'Chitra'];
const SPECIAL_TITHI_NAMES = ['Janma', 'Dhana', 'Bhratri', 'Matri', 'Putra', 'Satru', 'Kalatra', 'Mrityu', 'Bhagya', 'Karma', 'Laabha', 'Vyaya'];
/** JHora prints these seed labels for rows 31-36 (its own quirk, identical on every chart). */
const SEED_LABELS_31_36 = ['3', '6', '4', '2', '1', '4'];

export interface TithiInfo { index: number; name: string; lord: Graha; deity: string; left: number }
/** Tithi of a Moon-Sun elongation: 1-based index 1..30, name, lord, deity and fraction left. */
export function tithiOf(elong: number): TithiInfo {
  const t = norm360(elong) / 12;
  const index = Math.floor(t) + 1;
  const inPaksha = (index - 1) % 15; // 0..14
  const name = index === 30 ? 'Amavasya' : index === 15 ? 'Pournimasya' : (index <= 15 ? 'Sukla ' : 'Krishna ') + TITHI_NAMES[inPaksha];
  return { index, name, lord: index === 30 ? 'Rahu' : TITHI_LORDS[inPaksha], deity: TITHI_DEITIES[inPaksha], left: 1 - (t - Math.floor(t)) };
}

export function specialTithis(p: Positions): { name: string; seed: string; tithi: TithiInfo }[] {
  const elong = norm360(p.grahas.Moon.lon - p.grahas.Sun.lon);
  return Array.from({ length: 36 }, (_, i) => {
    const n = i + 1, cycle = Math.floor(i / 12) + 1;
    return {
      name: SPECIAL_TITHI_NAMES[i % 12] + ' tithi' + (cycle > 1 ? ' (cycle ' + cycle + ')' : ''),
      seed: n > 30 ? SEED_LABELS_31_36[n - 31] : String(n),
      tithi: tithiOf(elong * n),
    };
  });
}
