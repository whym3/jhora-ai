// Sahamas (Tajaka sensitive points). Each is A - B + C with the day formula;
// by night A and B are swapped unless the sahama is marked fixed. JHora's
// correction (verified on all 18 golden charts): if the lagna does not lie
// between B and A, going zodiacally from B to A, 30 degrees are added.
import { norm360, type Graha, type Positions } from './positions';
import { signLord } from './lords';
import { signOf } from './zodiac';

export interface SahamaDef { name: string; meaning: string; day: [Term, Term, Term]; night?: [Term, Term, Term]; fixed?: boolean; ifMarsOwnsLagna?: [Term, Term, Term] }
type Term = Graha | 'Lagna' | 'Punya' | 'Sastra' | { cusp: number } | { lordOfCusp: number } | { lordOfSign: Graha } | { deg: number };

const swap = (t: [Term, Term, Term]): [Term, Term, Term] => [t[1], t[0], t[2]];

export const SAHAMAS: SahamaDef[] = [
  { name: 'Punya', meaning: 'Fortune, good deeds', day: ['Moon', 'Sun', 'Lagna'] },
  { name: 'Vidya', meaning: 'Learning', day: ['Sun', 'Moon', 'Lagna'] },
  { name: 'Yasas', meaning: 'Fame', day: ['Jupiter', 'Punya', 'Lagna'] },
  { name: 'Mitra', meaning: 'Friend', day: ['Jupiter', 'Punya', 'Venus'] },
  { name: 'Mahatmya', meaning: 'Greatness', day: ['Punya', 'Mars', 'Lagna'] },
  { name: 'Asha', meaning: 'Hopes, desires', day: ['Saturn', 'Mars', 'Lagna'] },
  // when Mars itself owns the lagna, Jupiter - Mars + Lagna is used instead
  { name: 'Samartha', meaning: 'Enterprise', day: ['Mars', { lordOfCusp: 1 }, 'Lagna'], ifMarsOwnsLagna: ['Jupiter', 'Mars', 'Lagna'] },
  { name: 'Bhratru', meaning: 'Brother', day: ['Jupiter', 'Saturn', 'Lagna'], fixed: true },
  { name: 'Gaurava', meaning: 'Respect', day: ['Jupiter', 'Moon', 'Sun'] },
  { name: 'Pitru', meaning: 'Father', day: ['Saturn', 'Sun', 'Lagna'] },
  { name: 'Rajya', meaning: 'Kingdom', day: ['Saturn', 'Sun', 'Lagna'] },
  { name: 'Matru', meaning: 'Mother', day: ['Moon', 'Venus', 'Lagna'] },
  { name: 'Putra', meaning: 'Children', day: ['Jupiter', 'Moon', 'Lagna'] },
  { name: 'Jeeva', meaning: 'Life', day: ['Saturn', 'Jupiter', 'Lagna'] },
  { name: 'Karma', meaning: 'Activities (profession)', day: ['Mars', 'Mercury', 'Lagna'] },
  { name: 'Roga', meaning: 'Diseases', day: ['Lagna', 'Moon', 'Lagna'], fixed: true },
  { name: 'Kali', meaning: 'Misfortune', day: ['Jupiter', 'Mars', 'Lagna'] },
  { name: 'Sastra', meaning: 'Sciences', day: ['Jupiter', 'Saturn', 'Mercury'] },
  { name: 'Bandhu', meaning: 'Relatives', day: ['Mercury', 'Moon', 'Lagna'] },
  { name: 'Mrityu', meaning: 'Death', day: [{ cusp: 8 }, 'Moon', 'Lagna'], fixed: true },
  { name: 'Paradesa', meaning: 'Foreign countries', day: [{ cusp: 9 }, { lordOfCusp: 9 }, 'Lagna'], fixed: true },
  { name: 'Artha', meaning: 'Wealth', day: [{ cusp: 2 }, { lordOfCusp: 2 }, 'Lagna'], fixed: true },
  { name: 'Paradara', meaning: 'Adultery', day: ['Venus', 'Sun', 'Lagna'] },
  { name: 'Vanik', meaning: 'Trade', day: ['Moon', 'Mercury', 'Lagna'] },
  { name: 'Karyasiddhi', meaning: 'Fructification of projects', day: ['Saturn', 'Sun', { lordOfSign: 'Sun' }], night: ['Saturn', 'Moon', { lordOfSign: 'Moon' }] },
  { name: 'Vivaha', meaning: 'Marriage', day: ['Venus', 'Saturn', 'Lagna'] },
  { name: 'Santapa', meaning: 'Sadness', day: ['Saturn', 'Moon', { cusp: 6 }] },
  { name: 'Sraddha', meaning: 'Dedication', day: ['Venus', 'Mars', 'Lagna'] },
  { name: 'Preeti', meaning: 'Love, affection', day: ['Sastra', 'Punya', 'Lagna'] },
  { name: 'Jadya', meaning: 'Sluggishness', day: ['Mars', 'Saturn', 'Mercury'] },
  { name: 'Vyapara', meaning: 'Business', day: ['Mars', 'Saturn', 'Lagna'], fixed: true },
  { name: 'Satru', meaning: 'Enemies', day: ['Mars', 'Saturn', 'Lagna'] },
  { name: 'Jalapatana', meaning: 'Crossing ocean', day: [{ deg: 105 }, 'Saturn', 'Lagna'] },
  { name: 'Bandhana', meaning: 'Imprisonment', day: ['Punya', 'Saturn', 'Lagna'] },
  { name: 'Apamrityu', meaning: 'Untimely death (bad death)', day: [{ cusp: 8 }, 'Mars', 'Lagna'] },
  { name: 'Labha', meaning: 'Gains', day: [{ cusp: 11 }, { lordOfCusp: 11 }, 'Lagna'], fixed: true },
];

export interface Sahama { name: string; meaning: string; lon: number; terms: [number, number, number]; raw: number }

/** The three longitudes A, B, C of a sahama (A - B + C) for this chart. */
export function sahamaTerms(d: SahamaDef, p: Positions, isDay: boolean, computed: Map<string, number>): [number, number, number] {
  const cusp = (h: number) => norm360(p.ascendant + 30 * (h - 1));
  const value = (t: Term): number => {
    if (typeof t === 'string') {
      if (t === 'Lagna') return p.ascendant;
      if (t === 'Punya' || t === 'Sastra') return computed.get(t)!;
      return p.grahas[t].lon;
    }
    if ('cusp' in t) return cusp(t.cusp);
    if ('lordOfCusp' in t) return p.grahas[signLord(signOf(cusp(t.lordOfCusp)))].lon;
    if ('lordOfSign' in t) return p.grahas[signLord(signOf(p.grahas[t.lordOfSign].lon))].lon;
    return t.deg;
  };
  let terms = d.day;
  if (d.ifMarsOwnsLagna && signLord(signOf(p.ascendant)) === 'Mars') terms = d.ifMarsOwnsLagna;
  if (!isDay && !d.fixed) terms = d.night ?? swap(terms);
  return terms.map(value) as [number, number, number];
}

export function sahamas(p: Positions, isDay: boolean): Sahama[] {
  const computed = new Map<string, number>();
  const out: Sahama[] = [];
  for (const d of SAHAMAS) {
    const [a, b, c] = sahamaTerms(d, p, isDay, computed);
    const raw = norm360(a - b + c);
    let lon = raw;
    // lagna between B and A, going zodiacally from B to A?
    const between = norm360(p.ascendant - b) <= norm360(a - b);
    if (!between) lon = norm360(lon + 30);
    computed.set(d.name, lon);
    out.push({ name: `${d.name} Sahama`, meaning: d.meaning, lon, terms: [a, b, c], raw });
  }
  return out;
}
