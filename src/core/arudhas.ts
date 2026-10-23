// Arudha padas (Jaimini), computed on sign positions in any varga.
import { signLord } from './lords';
import type { Graha } from './positions';

export interface ArudhaOptions {
  /** Parasara's exceptions: arudha in the house itself -> 10th from it; in the 7th -> 4th from the 7th */
  exceptions: boolean;
  /** Scorpio/Aquarius lords: use Ketu/Rahu when stronger (needs a strength rule; null = never) */
  coLord: ((sign: number) => Graha) | null;
}

export const DEFAULT_ARUDHA: ArudhaOptions = { exceptions: true, coLord: null };

const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** Arudha of a house (sign index) given the signs of all planets. */
export function arudhaOfSign(houseSign: number, planetSign: (g: Graha) => number, opt: ArudhaOptions = DEFAULT_ARUDHA): number {
  const lord = opt.coLord ? opt.coLord(houseSign) : signLord(houseSign);
  const lordSign = planetSign(lord);
  const count = mod12(lordSign - houseSign);          // 0 = lord in its own sign
  let arudha = mod12(lordSign + count);
  if (opt.exceptions) {
    const rel = mod12(arudha - houseSign);
    if (rel === 0) arudha = mod12(arudha + 9);          // same sign -> 10th from it
    else if (rel === 6) arudha = mod12(arudha + 9);     // 7th -> 10th from the arudha (= 4th from house)
  }
  return arudha;
}

/** Graha arudha of a planet: arudha of the sign it occupies, counted via that sign's lord... (candidate; verified by tests). */
export function grahaArudha(planet: Graha, planetSign: (g: Graha) => number, opt: ArudhaOptions = DEFAULT_ARUDHA): number {
  return arudhaOfSign(planetSign(planet), planetSign, opt);
}
