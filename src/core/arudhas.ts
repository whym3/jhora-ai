// Arudha padas (Jaimini) on sign positions in any varga, as jhora.exe computes
// them (FUN_004a3800): bhava arudhas count house -> lord -> same again; sign
// ("graha") arudhas count planet -> sign -> same again; "P's Arudha" uses the
// stronger of P's own signs. Scorpio and Aquarius take Ketu/Rahu as lord when
// stronger (NodesInArudhas), via the Jaimini strength rules in signStrength.ts.
import { SIGN_LORD } from './lords';
import type { Graha } from './positions';
import { signLordJaimini, strongerSign, type VargaCtx } from './signStrength';

export interface ArudhaOptions {
  /** Parasara's exception for bhava arudhas: arudha in the house or its 7th -> 10th from the arudha */
  bhavaExceptions: boolean;
  /** the same exception for graha arudhas */
  grahaExceptions: boolean;
  /** Rahu/Ketu as lords of Aquarius/Scorpio when stronger */
  nodesAsLords: boolean;
}

export const DEFAULT_ARUDHA: ArudhaOptions = { bhavaExceptions: true, grahaExceptions: true, nodesAsLords: true };

const mod12 = (x: number) => ((x % 12) + 12) % 12;

function withException(arudha: number, from: number, on: boolean): number {
  if (!on) return arudha;
  const rel = mod12(arudha - from);
  return rel === 0 || rel === 6 ? mod12(arudha + 9) : arudha;
}

export function lordOf(sign: number, ctx: VargaCtx, opt: ArudhaOptions): Graha {
  return opt.nodesAsLords ? signLordJaimini(sign, ctx) : SIGN_LORD[sign];
}

/** Arudha of a house whose sign is `houseSign`. */
export function bhavaArudha(houseSign: number, ctx: VargaCtx, opt: ArudhaOptions = DEFAULT_ARUDHA): number {
  const lordSign = ctx.sign(lordOf(houseSign, ctx, opt));
  const arudha = mod12(2 * lordSign - houseSign);
  return withException(arudha, houseSign, opt.bhavaExceptions);
}

/**
 * Arudha of `sign` counted from the planet `planet` (its lord): "Mars's Ar Arudha".
 * JHora applies the exception against the planet's own position here (arudha in
 * the planet's sign or its 7th -> 10th from the arudha), not against `sign`.
 */
export function signArudha(sign: number, planet: Graha, ctx: VargaCtx, opt: ArudhaOptions = DEFAULT_ARUDHA): number {
  const planetSign = ctx.sign(planet);
  const arudha = mod12(2 * sign - planetSign);
  return withException(arudha, planetSign, opt.grahaExceptions);
}

/** Own signs of a planet as JHora pairs them (first is the one tried first in the tie-break). */
export const OWN_SIGNS: Record<Graha, [number, number]> = {
  Sun: [4, 4], Moon: [3, 3], Mars: [0, 7], Mercury: [5, 2], Jupiter: [8, 11], Venus: [6, 1], Saturn: [10, 9], Rahu: [10, 10], Ketu: [7, 7],
};

/** "P's Arudha": the arudha of the stronger of P's own signs, counted from P. */
export function grahaArudha(planet: Graha, ctx: VargaCtx, opt: ArudhaOptions = DEFAULT_ARUDHA): number {
  const [a, b] = OWN_SIGNS[planet];
  const sign = a === b ? a : strongerSign(a, b, ctx);
  return signArudha(sign, planet, ctx, opt);
}

// ---------------------------------------------------------------- longitude based bhava arudhas

/**
 * Arudha Pada Calculation options of dialog 2059 (Preferences 33245, FUN_004e82a0)
 * beyond the exceptions and node lordship above.
 */
export interface BhavaArudhaOptions extends ArudhaOptions {
  /** LongitudeBasedBhavaArudhas (0x8a4c18): arudhas of houses from exact longitudes */
  longitudeBased: boolean;
  /** ArudhaBasePlanet (0x8a4c14): body index the houses are counted from (0 Lagna, 1..9 Su..Ke, 13 Bhava Lagna) */
  base: number;
  /** DivLongsInBhavaArudhas (0x8a4c19): longitude based arudhas of a varga from its own varga longitudes */
  divLongs: boolean;
}

/** Body indices (JHora's internal order) of the arudha base choices, in dialog 2059's combo order. */
export const ARUDHA_BASES: [string, number][] = [
  ['Lagna', 0], ['Sun', 1], ['Moon', 2], ['Mars', 3], ['Mercury', 4], ['Jupiter', 5], ['Venus', 6], ['Saturn', 7],
  ['Rahu', 8], ['Ketu', 9], ['Bhavalagna', 13],
];

const GRAHA_ORDER: Graha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const n360 = (x: number) => ((x % 360) + 360) % 360;

/**
 * FUN_004a3800, LongitudeBasedBhavaArudhas branch: the 12 bhava arudha longitudes
 * (bodies 59..70, AL .. UL) counted from body `base`. House h starts at the base's
 * longitude + 30 h (Rahu/Ketu as base: - 30 h, signs counted backwards); its lord
 * (Jaimini co-lord when NodesInArudhas) is found by the house's sign, and the arudha
 * lies 2 x norm(lord - house) beyond the house; with the bhava exceptions an arudha
 * within 15 deg of the house or of its 7th (2d in [345, 15) or [165, 195)) moves 270 deg on.
 * `lon(b)` gives longitudes of body b (base, grahas) in the chart reckoned
 * (rasi, or the varga itself with DivLongsInBhavaArudhas); `ctx` its signs.
 */
export function longitudeBhavaArudhas(lon: (b: number) => number, base: number, ctx: VargaCtx, opt: ArudhaOptions): number[] {
  const bl = lon(base);
  const bs = Math.trunc(bl / 30) % 12;
  const node = base === 8 || base === 9;
  return Array.from({ length: 12 }, (_, h) => {
    const sign = node ? mod12(bs - h) : (bs + h) % 12;
    const house = node ? bl - 30 * h + 360 : 30 * h + bl;
    const lord = lordOf(sign, ctx, opt);
    let d = n360(lon(GRAHA_ORDER.indexOf(lord) + 1) - house) * 2;
    while (d >= 360) d -= 360;
    if (opt.bhavaExceptions && (d >= 345 || d < 15 || (d >= 165 && d < 195))) d += 270;
    return n360(d + house);
  });
}
