// Kalachakra dasa as jhora.exe shows it by default (FUN_0040c540): the maha
// dasa of a nakshatra pada p is the sign seq[p mod 108] of the classical
// chakra table read straight through, so successive padas give successive
// dasas; the Moon's pada starts with the elapsed fraction of the pada. The
// header's Deha/Jiva come from the classical row of the Moon's pada.
// Antardasas (KalachakraDasaCalculation 5): the nine signs of the maha pada's
// own row, labelled with the pada each entry stands for, each lasting the maha
// times its sign years over the row's total; a sub-period with id t < 108 is
// divided by row t, otherwise by the reversed row of its mirror pada.
import type { Period } from './vimsottari';
import { NAKSHATRAS, SIGNS } from '../zodiac';

/** Kalachakra years of Aries..Pisces */
export const KALACHAKRA_YEARS = [7, 16, 9, 21, 5, 9, 16, 7, 10, 4, 4, 10];

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
/**
 * Classical row of a pada within a 6-star cycle. JHora's static table swaps
 * Rohini 4 and Mrigasira 1; its KCDRohini4NavamsaInLeo option (on by default)
 * puts them back.
 */
const padaRow = (p: number, rohini4InLeo: boolean) => {
  const k = p % 24;
  return !rohini4InLeo && (k === 15 || k === 16) ? 31 - k : k;
};

export interface Kalachakra { title: string; periods: Period[] }

/** Pada an entry of the 216-entry table stands for (the naming loop's mirror). */
const padaOf = (t: number) => (t < 108 ? t : t < 180 ? 179 - t : 287 - t);
const padaLabel = (t: number, sign: number) => { const q = padaOf(t); return `${SIGNS[sign]} (${NAKSHATRAS[Math.floor(q / 4)]}${(q % 4) + 1})`; };

/** Table entries dividing the period with id `t` (a pada for mahas, a table index below). */
function subEntries(t: number, rohini4InLeo: boolean, maha: boolean): number[] {
  if (maha || t < 108) { const base = 9 * padaRow(t, rohini4InLeo); return Array.from({ length: 9 }, (_, j) => base + j); }
  const base = 9 * padaRow(padaOf(t), rohini4InLeo);
  return Array.from({ length: 9 }, (_, j) => base + 8 - j);
}

function divide(p: Period, id: number, maha: boolean, levels: number, rohini4InLeo: boolean): Period {
  if (levels <= 0) return p;
  const entries = subEntries(id, rohini4InLeo, maha);
  const total = entries.reduce((a, t) => a + KALACHAKRA_YEARS[SEQ[t]], 0);
  let t0 = p.start;
  const len = p.end - p.start;
  const children = entries.map((t) => {
    const end = t0 + (len * KALACHAKRA_YEARS[SEQ[t]]) / total;
    const q = divide({ lord: 'Sun', label: padaLabel(t, SEQ[t]), start: t0, end }, t, false, levels - 1, rohini4InLeo);
    t0 = end;
    return q;
  });
  return { ...p, children };
}

export function kalachakraDasa(moonLon: number, count = 9, rohini4InLeo = true, levels = 2): Kalachakra {
  const PADA = 360 / 108;
  const p0 = Math.floor(moonLon / PADA);
  const frac = (moonLon - p0 * PADA) / PADA;
  const periods: Period[] = [];
  let t = 0;
  for (let i = 0; i < count; i++) {
    const p = p0 + i;
    const sign = SEQ[p % 108];
    const years = KALACHAKRA_YEARS[sign];
    if (i === 0) t = -frac * years;
    const star = Math.floor(p / 4) % 27;
    periods.push(divide({ lord: 'Sun', label: `${SIGNS[sign]} (${NAKSHATRAS[star]}${(p % 4) + 1})`, start: t, end: t + years }, p % 108, true, levels - 1, rohini4InLeo));
    t += years;
  }
  const row = padaRow(p0, rohini4InLeo);
  const first = SEQ[row * 9], last = SEQ[row * 9 + 8];
  const savya = Math.floor(p0 / 12) % 2 === 0;
  const [deha, jiva] = savya ? [first, last] : [last, first];
  const paramayush = periods.reduce((a, q) => a + (q.end - q.start), 0);
  return {
    title: `Kalachakra Dasa (From Moon of D-1, ${savya ? 'Savya' : 'Apasavya'}, Paramayush: ${Math.round(paramayush)} yr, Deha: ${SIGNS[deha]}, Jiva: ${SIGNS[jiva]})`,
    periods,
  };
}
