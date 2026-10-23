// Pushkara navamsas, pushkara bhagas and mrityu bhagas.
import { norm360, type Graha } from './positions';
import { signOf } from './zodiac';

const NAV = 30 / 9;
/** Pushkara navamsas by element: 1-based navamsa numbers within the sign. */
const PUSHKARA_NAVAMSAS: [number, number][] = [[7, 9], [3, 5], [6, 8], [1, 3]]; // fire, earth, air, water
/** Pushkara bhaga degree per sign (Aries first); the bhaga is the degree ending there. */
export const PUSHKARA_BHAGA = [21, 14, 18, 8, 19, 9, 24, 11, 23, 14, 19, 9];

export function inPushkaramsa(lon: number): boolean {
  const sign = signOf(lon);
  const nav = Math.floor((lon - sign * 30) / NAV) + 1;
  return PUSHKARA_NAVAMSAS[sign % 4].includes(nav);
}

/** Signed distance from the centre of the sign's pushkara-bhaga degree. */
export function fromPushkaraBhaga(lon: number): number {
  const sign = signOf(lon);
  return (lon - sign * 30) - (PUSHKARA_BHAGA[sign] - 0.5);
}

/**
 * Mrityu bhaga degrees (BPHS) per body and sign, Aries first. Houses use the
 * lagna row. Moon has two classical versions; this is JHora's default one.
 */
export const MRITYU_BHAGA: Record<Graha | 'Maandi' | 'Lagna', number[]> = {
  Sun: [20, 9, 12, 6, 8, 24, 16, 17, 22, 2, 3, 23],
  Moon: [8, 25, 22, 22, 21, 1, 4, 23, 18, 20, 20, 10],
  Mars: [19, 28, 25, 23, 29, 28, 14, 21, 2, 15, 11, 6],
  Mercury: [15, 14, 13, 12, 8, 18, 20, 10, 21, 22, 7, 5],
  Jupiter: [19, 29, 12, 27, 6, 4, 13, 10, 17, 11, 15, 28],
  Venus: [28, 15, 11, 17, 10, 13, 4, 6, 27, 12, 29, 19],
  Saturn: [10, 4, 7, 9, 12, 16, 3, 18, 28, 14, 13, 15],
  Rahu: [14, 13, 12, 11, 24, 23, 22, 21, 10, 20, 18, 8],
  Ketu: [8, 18, 20, 10, 21, 22, 23, 24, 11, 12, 13, 14],
  Maandi: [23, 24, 11, 12, 13, 14, 8, 18, 20, 10, 21, 22],
  Lagna: [1, 9, 22, 22, 25, 2, 4, 23, 18, 20, 24, 10],
};

/** Signed distance of a body from the centre of its mrityu-bhaga degree in its sign. */
export function fromMrityuBhaga(body: keyof typeof MRITYU_BHAGA, lon: number): number {
  const sign = signOf(lon);
  return (lon - sign * 30) - (MRITYU_BHAGA[body][sign] - 0.5);
}

export const within = (d: number) => Math.abs(norm360(d + 180) - 180) < 0.5;
