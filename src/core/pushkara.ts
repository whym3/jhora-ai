// Pushkara navamsas, pushkara bhagas and mrityu bhagas.
//
// Options (jhora.exe):
// * PushkaraBhagaJP (Preferences 33392, dialog 2077, FUN_004e8000 -> FUN_004b92d0): the
//   pushkara bhaga table pointer DAT_00897f7c is 0x5921e0 (1, Jataka Parijatam, default)
//   or 0x592240 (0, Sri CS Patel, "Nadi & Navamsha Astrology").
// * Mrityu bhaga (Preferences 33079, dialog 2031, FUN_004e7950; view FUN_0042fb20):
//   MBTablePreference (0x65b180) 0 = Saravali / Jataka Parijatam / Sarvartha Chintamani
//   (tables 0x578990, houses 0x578d50), 1 = Phala Deepika / Brihat Prajapatyam (0x578db0 /
//   0x579170; only the Moon's row differs). MBLocationPreference (0x5791d0) places the
//   death-inflicting degree: 0 "starts there" (centre MB + 0.5), 1 "mid-point there" (MB),
//   2 "the 19th degree" (MB - 0.5, default).
import { norm360, type Graha } from './positions';
import { signOf } from './zodiac';

const NAV = 30 / 9;
/** Pushkara navamsas by element: 1-based navamsa numbers within the sign. */
const PUSHKARA_NAVAMSAS: [number, number][] = [[7, 9], [3, 5], [6, 8], [1, 3]]; // fire, earth, air, water
/** Pushkara bhaga degree per sign (Aries first); the bhaga is the degree ending there. */
export const PUSHKARA_BHAGA = [21, 14, 18, 8, 19, 9, 24, 11, 23, 14, 19, 9];
/** Sri CS Patel's pushkara bhagas (PushkaraBhagaJP = 0, table 0x592240). */
export const PUSHKARA_BHAGA_PATEL = [21, 14, 24, 7, 21, 14, 24, 7, 21, 14, 24, 7];

export function inPushkaramsa(lon: number): boolean {
  const sign = signOf(lon);
  const nav = Math.floor((lon - sign * 30) / NAV) + 1;
  return PUSHKARA_NAVAMSAS[sign % 4].includes(nav);
}

/** Signed distance from the centre of the sign's pushkara-bhaga degree (jp: PushkaraBhagaJP). */
export function fromPushkaraBhaga(lon: number, jp = true): number {
  const sign = signOf(lon);
  return (lon - sign * 30) - ((jp ? PUSHKARA_BHAGA : PUSHKARA_BHAGA_PATEL)[sign] - 0.5);
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

/** The Moon's row of the Phala Deepika / Brihat Prajapatyam table (MBTablePreference = 1, 0x578db0). */
export const MRITYU_BHAGA_MOON_PD = [26, 12, 13, 25, 24, 11, 26, 14, 13, 25, 5, 12];

export interface MrityuBhagaOptions {
  /** MBTablePreference */
  table: number;
  /** MBLocationPreference */
  location: number;
}

/** Signed distance of a body from the centre of its mrityu-bhaga degree in its sign. */
export function fromMrityuBhaga(body: keyof typeof MRITYU_BHAGA, lon: number, o: MrityuBhagaOptions = { table: 0, location: 2 }): number {
  const sign = signOf(lon);
  const mb = (o.table === 1 && body === 'Moon' ? MRITYU_BHAGA_MOON_PD : MRITYU_BHAGA[body])[sign];
  const centre = o.location === 0 ? mb + 0.5 : o.location === 1 ? mb : mb - 0.5;
  return (lon - sign * 30) - centre;
}

export const within = (d: number) => Math.abs(norm360(d + 180) - 180) < 0.5;
