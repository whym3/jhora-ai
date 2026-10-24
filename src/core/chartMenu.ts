// What the chart's right-click menu highlights (JHora's "Highlight rasi(s)"
// and "Relationships" submenus), computed from sign positions in one varga.
import type { Graha } from './positions';
import { SIGN_LORD } from './lords';
import { DEBILITATION, EXALTATION } from './signStrength';
import { MOOLATRIKONA } from './deities';
import { grahaAspects, rasiAspects } from './aspects';
import { SIGN_NAMES } from './zodiac';

export type SignOf = (g: Graha) => number;
const ALL: number[] = Array.from({ length: 12 }, (_, s) => s);
const owns = (g: Graha, s: number) => SIGN_LORD[s] === g || (s === 10 && g === 'Rahu') || (s === 7 && g === 'Ketu');

export type SignHighlight = 'argala' | 'virodhargala' | 'grahaDrishti' | 'rasiDrishtiPlanet' | 'rasiDrishtiRasi' | 'owned' | 'moolatrikona' | 'exalted' | 'debilitated';

const ARGALA = [1, 3, 10, 4];
const VIRODHARGALA = [11, 9, 2, 8];

/**
 * Signs highlighted by one of the "Highlight rasi(s)" commands (handlers
 * 0x440690..0x440e80). Argala: 2nd, 4th, 11th and (secondary) 5th from the
 * rasi; virodhargala: 12th, 10th, 3rd, 9th; both swap when Ketu is in the
 * rasi. The planet commands use the clicked rasi as the planet's sign.
 */
export function highlightSigns(kind: SignHighlight, sign: SignOf, planet: Graha | null, rasi: number): number[] {
  const ketuIn = sign('Ketu') === rasi;
  switch (kind) {
    case 'argala': return (ketuIn ? VIRODHARGALA : ARGALA).map((k) => (rasi + k) % 12);
    case 'virodhargala': return (ketuIn ? ARGALA : VIRODHARGALA).map((k) => (rasi + k) % 12);
    case 'grahaDrishti': return planet ? ALL.filter((s) => s !== rasi && grahaAspects(planet, rasi, s)) : [];
    case 'rasiDrishtiPlanet':
    case 'rasiDrishtiRasi': return ALL.filter((s) => s !== rasi && rasiAspects(rasi, s));
    case 'owned': return planet ? ALL.filter((s) => owns(planet, s)) : [];
    case 'moolatrikona': return planet ? [MOOLATRIKONA[planet]] : [];
    case 'exalted': return planet ? [EXALTATION[planet]] : [];
    case 'debilitated': return planet ? [DEBILITATION[planet]] : [];
  }
}

export type RelationKind = 'permanent' | 'temporary' | 'compound';
const NINE: Graha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
/** Natural table 0x585ed8 (rows Sun..Ketu; Ketu's row is a copy of Rahu's, as in jhora.exe). */
const NAT: number[][] = [
  [0, 2, 2, 3, 2, 4, 4, 4, 4], [2, 0, 3, 2, 3, 3, 3, 4, 4], [2, 2, 0, 4, 2, 3, 3, 4, 2],
  [2, 4, 3, 0, 3, 2, 3, 3, 3], [2, 2, 2, 4, 0, 4, 3, 3, 3], [4, 4, 3, 2, 3, 0, 2, 2, 2],
  [4, 4, 4, 2, 3, 2, 0, 2, 4], [4, 4, 4, 3, 3, 2, 2, 0, 2], [4, 4, 4, 3, 3, 2, 2, 0, 2],
];
export const RELATION_CODE_NAMES = ['Self', 'Adhimitra', 'Mitra', 'Sama', 'Satru', 'Adhisatru'];

/**
 * JHora's relationship codes of `planet` towards Sun..Ketu (0 self, 1 adhimitra
 * .. 5 adhisatru; natural 2/3/4 = friend/neutral/enemy; temporary 2 or 4),
 * as FUN_004a34c0 precomputes them.
 */
export function relationCodes(kind: RelationKind, planet: Graha, sign: SignOf): number[] {
  const a = NINE.indexOf(planet);
  return NINE.map((q, b) => {
    const nat = NAT[a][b];
    if (kind === 'permanent' || a === b) return nat;
    const d = (((sign(q) - sign(planet)) % 12) + 12) % 12;
    const friend = [1, 2, 3, 9, 10, 11].includes(d);
    if (kind === 'temporary') return friend ? 2 : 4;
    return friend ? nat - 1 : nat + 1;
  });
}

const PK_TYPES = ['Pachaka', 'Bodhaka', 'Karaka', 'Vedhaka'];
/** FUN_004a66d0: natural pachakadi planets of Sun..Saturn (1-based planet numbers) */
const NAT_PK = [[7, 3, 5, 6], [6, 3, 7, 1], [1, 2, 7, 4], [2, 5, 6, 3], [7, 3, 2, 1], [2, 4, 7, 1], [6, 2, 5, 3]];
/** FUN_004a6790: pachakadi sthanas as houses from the planet */
const STH_H = [[6, 7, 9, 11], [7, 9, 11, 3], [2, 6, 11, 12], [2, 4, 5, 3], [6, 5, 7, 12], [2, 6, 12, 4], [3, 11, 6, 7]];
const SEVEN = NINE.slice(0, 7);
const list = (xs: string[]) => (xs.length ? xs.join(', ') : 'none');
const sthana = (p: number, t: number, sign: SignOf) => (STH_H[p][t] + sign(SEVEN[p]) - 1) % 12;

/** Message text of "Pachakadi relationships of this rasi" (33110). */
export function pachakadiOfRasi(rasi: number, sign: SignOf): string[] {
  const out = [`    ${SIGN_NAMES[rasi]} is`, ''];
  PK_TYPES.forEach((t, k) => out.push(`      ${t} sthana from ${list(SEVEN.filter((_, p) => sthana(p, k, sign) === rasi))}    `));
  out.push('', `    ${SIGN_NAMES[rasi]} contains`, '');
  PK_TYPES.forEach((t, k) => out.push(`      Naisargika ${t} for ${list(SEVEN.filter((_, p) => sign(NINE[NAT_PK[p][k] - 1]) === rasi))}    `));
  return out;
}

/** Message text of "Pachakadi relationships of this planet" (33109); `rasi` is the clicked sign. */
export function pachakadiOfPlanet(planet: Graha, rasi: number, sign: SignOf): string[] {
  const P = SEVEN.indexOf(planet);
  if (P < 0) return [];
  const out = [`    For ${planet}`, ''];
  PK_TYPES.forEach((t, k) => out.push(`      Naisargika ${t}: ${NINE[NAT_PK[P][k] - 1]}    `));
  out.push('', `    For ${planet}`, '');
  PK_TYPES.forEach((t, k) => {
    const s = sthana(P, k, sign);
    const occ = NINE.filter((g) => sign(g) === s);
    out.push(`      ${t} sthana: ${SIGN_NAMES[s]}${occ.length ? ` (occupants: ${occ.join(', ')})` : ' (empty)'}    `);
  });
  out.push('', `    ${planet} is`, '');
  PK_TYPES.forEach((t, k) => out.push(`      Naisargika ${t} for ${list(SEVEN.filter((_, p) => NAT_PK[p][k] === P + 1))}    `));
  out.push('', `    ${planet} is in`, '');
  PK_TYPES.forEach((t, k) => out.push(`      ${t} sthana from ${list(SEVEN.filter((_, p) => sthana(p, k, sign) === rasi))}    `));
  return out;
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
const MKS: Partial<Record<Graha, number>> = { Sun: 12, Moon: 8, Mars: 7, Mercury: 7, Jupiter: 3, Venus: 6, Saturn: 1, Rahu: 9 };

/** Message text of "Planets in marana karaka sthana" (FUN_00442440); houses from the lagna of the varga. */
export function maranaKarakaSthana(lagnaSign: number, sign: SignOf, vargaShort: string): string[] {
  const out = ['', `Planets in marana karaka sthana in this ${vargaShort}:    `, ''];
  let any = false;
  for (const g of NINE.slice(0, 8)) {
    const h = (((sign(g) - lagnaSign) % 12) + 12) % 12 + 1;
    if (h !== MKS[g]) continue;
    any = true;
    const owned = ALL.filter((i) => owns(g, (lagnaSign + i) % 12)).map((i) => ORD[i]);
    out.push(`    ${g} in ${ORD[h - 1]} house (owns ${owned.length === 2 ? `${owned[0]} and ${owned[1]} houses` : `${owned[0]} house`})    `);
  }
  if (!any) out.push('    None    ');
  return out;
}
