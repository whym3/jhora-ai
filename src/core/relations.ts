// Planetary relationships as jhora.exe holds them: the natural table at
// 0x585efc (2 friend, 3 neutral, 4 enemy) and the temporary rule of
// FUN_004a34c0 (a planet in the 2nd, 3rd, 4th, 10th, 11th or 12th sign from
// another is its temporary friend). Here friend = +1, neutral = 0, enemy = -1
// so that compound = natural + temporary runs from -2 (adhisatru) to +2
// (adhimitra).
import type { Graha } from './positions';

export const SEVEN: Graha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const NINE: Graha[] = [...SEVEN, 'Rahu', 'Ketu'];

/** Natural relationship rows Sun..Ketu, columns Sun..Ketu (JHora's table). */
const NATURAL_RAW = [
  [0, 2, 2, 3, 2, 4, 4, 4, 4],
  [2, 0, 3, 2, 3, 3, 3, 4, 4],
  [2, 2, 0, 4, 2, 3, 3, 4, 2],
  [2, 4, 3, 0, 3, 2, 3, 3, 3],
  [2, 2, 2, 4, 0, 4, 3, 3, 3],
  [4, 4, 3, 2, 3, 0, 2, 2, 2],
  [4, 4, 4, 2, 3, 2, 0, 2, 4],
  [4, 4, 4, 2, 3, 2, 2, 0, 2],
  [4, 4, 4, 2, 3, 3, 2, 2, 0],
];

export type Relation = -2 | -1 | 0 | 1 | 2;

/**
 * The rows JHora uses at run time for Rahu and Ketu towards the seven planets
 * (fitted exactly from its vimsopaka output on 8 charts; the static table above
 * makes Mercury a friend and, for Ketu, Venus neutral).
 */
const NODE_ROW: Record<string, -1 | 0 | 1> = { Sun: -1, Moon: -1, Mars: -1, Mercury: 0, Jupiter: 0, Venus: 1, Saturn: 1 };

/** Natural relationship of p towards q: 1 friend, 0 neutral, -1 enemy. */
export function naturalRelation(p: Graha, q: Graha): -1 | 0 | 1 {
  if ((p === 'Rahu' || p === 'Ketu') && q in NODE_ROW) return NODE_ROW[q];
  const v = NATURAL_RAW[NINE.indexOf(p)][NINE.indexOf(q)];
  return v === 2 ? 1 : v === 4 ? -1 : 0;
}

/** Temporary relationship: q in the 2nd, 3rd, 4th, 10th, 11th or 12th sign from p is a friend. */
export function temporaryRelation(signP: number, signQ: number): -1 | 1 {
  const d = (((signQ - signP) % 12) + 12) % 12;
  return [1, 2, 3, 9, 10, 11].includes(d) ? 1 : -1;
}

/** Compound (panchadha) relationship of p towards q in a chart whose sign positions are given. */
export function compoundRelation(p: Graha, q: Graha, sign: (g: Graha) => number): Relation {
  if (p === q) return 2;
  return (naturalRelation(p, q) + temporaryRelation(sign(p), sign(q))) as Relation;
}

export const RELATION_NAMES: Record<Relation, string> = { 2: 'Adhimitra', 1: 'Mitra', 0: 'Sama', '-1': 'Satru', '-2': 'Adhisatru' };
