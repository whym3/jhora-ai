// Kalachakra dasa (FUN_0040c540). The builder works on a 216-entry sign table
// T (local_634[0x12..], ROWS below: 24 rows of nine, rows 0-11 savya, 12-23
// apasavya) and the row R(p) of each nakshatra pada p (local_634[0xea..], row
// p mod 24 with Rohini 4 / Mrigasira 1 swapped unless KCDRohini4NavamsaInLeo,
// DAT_00575184). Every period is an entry t of T (its owner: sign T[t],
// labelled with the pada t stands for), lasting its sign's years; the nine
// sub-periods of an entry t are the entries S(t) (table 0x78b40), each lasting
// the parent times its years over their total (0x8fdf0).
// KalachakraDasaCalculation (DAT_00575180, dialog 2057 combo 1004, default 5)
// picks the maha dasas, the first dasa's balance and S:
//  - first dasa: "full cycle fraction" (0, 2, 6; 0x40d424 / 0x40d4f4) spreads
//    the elapsed fraction of the seed's pada over the whole row R(p) and starts
//    with the row entry it falls in, keeping what is left of it; the others
//    start with the first entry of R(p) (method 5: entry p) and keep the
//    unelapsed fraction of the pada (0x40d4e1);
//  - maha dasas (0x40d9a9): 0..4 the entries after the first, wrapping inside
//    its half of T (0..107 / 108..215); 6 wrapping inside its row; 5 the
//    entries p, p+1, ... mod 108 (the classical chakra read straight through,
//    successive padas giving successive dasas);
//  - S(t) (0x40d745): 0, 1 the row of t rotated to start at t; 2, 3 the nine
//    entries from t on, wrapping inside its half; 4, 5, 6 for t < 108 the row
//    R(t), otherwise the reversed row of the pada t mirrors (padaOf);
//  - the header's Deha/Jiva are the first/last sign of R(p) (swapped in
//    apasavya), Paramayush the sum of the nine maha dasa years.
import type { Period } from './vimsottari';
import { NAKSHATRAS, SIGNS } from '../zodiac';

/** Kalachakra years of Aries..Pisces */
export const KALACHAKRA_YEARS = [7, 16, 9, 21, 5, 9, 16, 7, 10, 4, 4, 10];

/** KalachakraDasaCalculation 0..6: dialog 2057's combo 1004 (DLGINIT). */
export const KALACHAKRA_METHODS = [
  'Full cycle fraction, continuous MDs, ADs strictly from dasa cycle (Santhanam)',
  'First dasa fraction, ADs strictly from MDs (Dr. Raman)',
  'Full cycle fraction, continuous MDs & ADs (JHora 5.0)',
  'First dasa fraction, continuous ADs',
  'First dasa fraction, continuous MDs, ADs from MD like MDs from navamsa (Rao & Rath)',
  'Navamsa progression, standard cycles used for ADs instead of MDs (Raghavacharya)',
  'Full cycle fraction, MDs strictly from cycle, ADs from MD like MDs from navamsa (SM Singh)',
];
/** The dialog's explanation (static 1058) of each method (FUN_004d2790, strings 0x58b430 .. 0x58ae08). */
export const KALACHAKRA_METHOD_EXPLANATIONS = [
  'Apply dasa sesham fraction to the full cycle associated with the navamsa. At the end of cycle, mahadasas go to the next cycle for continuity. Antardasas are strictly from the 9 signs of dasa cycle.\nThis was taught by Sri R Santhanam in his translation of BPHS.',
  'Apply dasa sesham fraction to the first dasa in the cycle associated with the navamsa. The 9 signs in the dasa cycle are taken to be antardasa signs.\nThis was apparently taught by Dr BV Raman.',
  'Apply dasa sesham fraction to the full cycle associated with the navamsa. Antardasas can jump into the next dasa cycle to maintain continuity, just like mahadasas.\nThis was taught by author in 1990s and programmed in Jagannatha Hora 5.0.',
  'Apply dasa sesham fraction to the first dasa in the cycle associated with the navamsa. Antardasas can jump into the next dasa cycle to maintain continuity.',
  'Apply dasa sesham fraction to the first dasa in the cycle associated with the navamsa. Antardasas are found from mahadasa by iteration, i.e. treating mahadasa as the navamsa and using the dasa cycle associated with that navamsa.\nThis was taught by author & his guru Pt S Rath at an SJC conference.',
  "Kalachakra dasa is the progression of Moon's navamsa. Nine Kalachakra navamsas from the navamsa sign (of seed) are taken as mahadasas. Antardasas are found from mahadasa by iteration, i.e. treating mahadasa as the navamsa and using the dasa cycle associated with that navamsa.\nThis is based on author's understanding of a book by Sri TSV Raghavacharya.",
  'Apply dasa sesham fraction to the full cycle associated with the navamsa. At the end of cycle, go back to the beginning of the same cycle (i.e. no continuity && we get leaps not mentioned by Pararsara). Antardasas are found from mahadasa just like mahadasas are found from navamsa.\nThis was taught in a book by Sri SM Singh.',
];

const ROWS = [
  // savya: Aswini 1-4, Bharani 1-4, Krittika 1-4
  'Ar Ta Ge Cn Le Vi Li Sc Sg', 'Cp Aq Pi Sc Li Vi Cn Le Ge', 'Ta Ar Pi Aq Cp Sg Ar Ta Ge', 'Cn Le Vi Li Sc Sg Cp Aq Pi',
  'Sc Li Vi Cn Le Ge Ta Ar Pi', 'Aq Cp Sg Ar Ta Ge Cn Le Vi', 'Li Sc Sg Cp Aq Pi Sc Li Vi', 'Cn Le Ge Ta Ar Pi Aq Cp Sg',
  'Ar Ta Ge Cn Le Vi Li Sc Sg', 'Cp Aq Pi Sc Li Vi Cn Le Ge', 'Ta Ar Pi Aq Cp Sg Ar Ta Ge', 'Cn Le Vi Li Sc Sg Cp Aq Pi',
  // apasavya: Rohini 1-4, Mrigasira 1-4, Ardra 1-4
  'Sg Cp Aq Pi Ar Ta Ge Le Cn', 'Vi Li Sc Pi Aq Cp Sg Sc Li', 'Vi Le Cn Ge Ta Ar Sg Cp Aq', 'Pi Ar Ta Ge Le Cn Vi Li Sc',
  'Pi Aq Cp Sg Sc Li Vi Le Cn', 'Ge Ta Ar Sg Cp Aq Pi Ar Ta', 'Ge Le Cn Vi Li Sc Pi Aq Cp', 'Sg Sc Li Vi Le Cn Ge Ta Ar',
  'Pi Aq Cp Sg Sc Li Vi Le Cn', 'Ge Ta Ar Sg Cp Aq Pi Ar Ta', 'Ge Le Cn Vi Li Sc Pi Aq Cp', 'Sg Sc Li Vi Le Cn Ge Ta Ar',
];
const SEQ: number[] = ROWS.flatMap((r) => r.split(' ').map((s) => SIGNS.indexOf(s as (typeof SIGNS)[number])));
const years = (t: number) => KALACHAKRA_YEARS[SEQ[t]];
/**
 * Classical row of a pada within a 6-star cycle. JHora's static table swaps
 * Rohini 4 and Mrigasira 1; its KCDRohini4NavamsaInLeo option (on by default)
 * puts them back.
 */
const padaRow = (p: number, rohini4InLeo: boolean) => {
  const k = p % 24;
  return !rohini4InLeo && (k === 15 || k === 16) ? 31 - k : k;
};
/** R(p): the first table entry of pada p's row. */
const rowStart = (p: number, rohini4InLeo: boolean) => 9 * padaRow(p, rohini4InLeo);
/** Entry `t` kept inside the half (0..107 or 108..215) of entry `ref`. */
const inHalf = (t: number, ref: number) => { const b = ref < 108 ? 0 : 108; return b + ((((t - b) % 108) + 108) % 108); };
/** Entry `t` kept inside the row of entry `ref`. */
const inRow = (t: number, ref: number) => { const b = 9 * Math.floor(ref / 9); return b + ((((t - b) % 9) + 9) % 9); };

export interface Kalachakra { title: string; periods: Period[] }

/** Pada an entry of the 216-entry table stands for (the naming loop's mirror). */
const padaOf = (t: number) => (t < 108 ? t : t < 180 ? 179 - t : 287 - t);
const padaLabel = (t: number) => { const q = padaOf(t); return `${SIGNS[SEQ[t]]} (${NAKSHATRAS[Math.floor(q / 4)]}${(q % 4) + 1})`; };

/** S(t): the table entries dividing a period with entry `t` (0x40d745). */
function subEntries(t: number, rohini4InLeo: boolean, method: number): number[] {
  const j9 = Array.from({ length: 9 }, (_, j) => j);
  if (method === 0 || method === 1) return j9.map((j) => inRow(t + j, t));
  if (method === 2 || method === 3) return j9.map((j) => inHalf(t + j, t));
  if (t < 108) { const base = rowStart(t, rohini4InLeo); return j9.map((j) => base + j); }
  const base = rowStart(padaOf(t), rohini4InLeo);
  return j9.map((j) => base + 8 - j);
}

function divide(p: Period, id: number, levels: number, rohini4InLeo: boolean, method: number): Period {
  if (levels <= 0) return p;
  const entries = subEntries(id, rohini4InLeo, method);
  const total = entries.reduce((a, t) => a + years(t), 0);
  let t0 = p.start;
  const len = p.end - p.start;
  const children = entries.map((t) => {
    const end = t0 + (len * years(t)) / total;
    const q = divide({ lord: 'Sun', label: padaLabel(t), start: t0, end }, t, levels - 1, rohini4InLeo, method);
    t0 = end;
    return q;
  });
  return { ...p, children };
}

/** One level below a period with table entry `id`: the sub-periods and their entries. */
export function kalachakraLevel(p: Period, id: number, _maha: boolean, rohini4InLeo = true, method = 5): { period: Period; id: number }[] {
  const ids = subEntries(id, rohini4InLeo, method);
  return (divide(p, id, 1, rohini4InLeo, method).children ?? []).map((period, j) => ({ period, id: ids[j] }));
}

const PADA = 360 / 108;

/** The first maha dasa's entry and the years of it already elapsed at the seed (0x40d405..0x40d5eb). */
function firstDasa(moonLon: number, rohini4InLeo: boolean, method: number): { p0: number; first: number; elapsed: number } {
  const p0 = Math.floor(moonLon / PADA);
  const frac = (moonLon - p0 * PADA) / PADA;
  const r = rowStart(p0, rohini4InLeo);
  if (method === 0 || method === 2 || method === 6) {
    // the elapsed part of the whole cycle, walked through its entries
    let total = 0;
    for (let j = 0; j < 9; j++) total += years(r + j);
    let rem = frac * total, k = 0, y = years(r);
    for (; k < 9; k++) { y = years(r + k); if (rem < y) break; rem -= y; }
    const balance = (y - rem) / y;
    return { p0, first: r + Math.min(k, 8), elapsed: (1 - balance) * y };
  }
  const first = method === 5 ? p0 % 108 : r;
  return { p0, first, elapsed: frac * years(first) };
}

/** Table entry of the i-th maha dasa (method 5: the pada, mod 108). */
export function kalachakraMahaId(moonLon: number, i: number, rohini4InLeo = true, method = 5): number {
  const { p0, first } = firstDasa(moonLon, rohini4InLeo, method);
  if (method === 5) return (p0 + i) % 108;
  return method === 6 ? inRow(first + i, first) : inHalf(first + i, first);
}

/**
 * @param from the seed name (SEED_TITLE_NAMES) and the varga name of the title's
 *   "From %s of %s, ..." (FUN_0040c540 0x40dbf6, the obj+0x76d38 extra)
 * @param method KalachakraDasaCalculation 0..6 (others: 5)
 */
export function kalachakraDasa(moonLon: number, count = 9, rohini4InLeo = true, levels = 2, from = { seed: 'Moon', varga: 'D-1' }, method = 5): Kalachakra {
  const m = Number.isInteger(method) && method >= 0 && method <= 6 ? method : 5;
  const { p0, elapsed } = firstDasa(moonLon, rohini4InLeo, m);
  const periods: Period[] = [];
  let t = -elapsed;
  for (let i = 0; i < count; i++) {
    const id = kalachakraMahaId(moonLon, i, rohini4InLeo, m);
    const y = years(id);
    periods.push(divide({ lord: 'Sun', label: padaLabel(id), start: t, end: t + y }, id, levels - 1, rohini4InLeo, m));
    t += y;
  }
  const r = rowStart(p0, rohini4InLeo);
  const first = SEQ[r], last = SEQ[r + 8];
  const savya = Math.floor(p0 / 12) % 2 === 0;
  const [deha, jiva] = savya ? [first, last] : [last, first];
  const paramayush = periods.reduce((a, q) => a + (q.end - q.start), 0);
  return {
    title: `Kalachakra Dasa (From ${from.seed} of ${from.varga}, ${savya ? 'Savya' : 'Apasavya'}, Paramayush: ${Math.round(paramayush)} yr, Deha: ${SIGNS[deha]}, Jiva: ${SIGNS[jiva]})`,
    periods,
  };
}
