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
