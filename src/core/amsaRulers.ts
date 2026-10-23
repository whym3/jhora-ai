// Nadiamsa (D-150) rulers, as JHora's "Amsa rulers" view shows them.
// Ported from jhora.exe: FUN_004a9ae0 fills the nadiamsa number of every body
// using unequal nadiamsas (150 boundaries per sign in 1/504 degree units; the
// equal 12' scheme is the alternative branch), FUN_00495cc0 derives the index
// in the name list (movable signs direct, fixed signs reversed, dual signs
// from the 76th) and FUN_00493230 holds the 150 names in index order.
import NADIAMSA_BOUNDS from './data/nadiamsa-bounds.json';
import NADIAMSA_NAMES from './data/nadiamsa.json';

export { NADIAMSA_NAMES };

/** 0-based nadiamsa number (0..149) of a degree inside its sign. */
export function nadiamsaDivision(degInSign: number, unequal = true): number {
  if (!unequal) return Math.min(149, Math.floor(degInSign * 5));
  let k = 0;
  for (let i = 1; i < NADIAMSA_BOUNDS.length; i++) {
    if (NADIAMSA_BOUNDS[i] / 504 <= degInSign) k++;
    else break;
  }
  return k;
}

/** 0-based index into NADIAMSA_NAMES for a sign and 0-based division. */
export function nadiamsaIndex(sign: number, division: number): number {
  const m = sign % 3;
  if (m === 0) return division;
  if (m === 1) return 149 - division;
  return (division + 75) % 150;
}

export interface AmsaRuler { division: number; index: number; name: string }

export function amsaRuler(lon: number, unequal = true): AmsaRuler {
  const sign = Math.floor(lon / 30) % 12;
  const division = nadiamsaDivision(lon - sign * 30, unequal);
  const index = nadiamsaIndex(sign, division);
  return { division, index, name: NADIAMSA_NAMES[index] };
}
