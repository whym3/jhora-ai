// Karana Chaturaseeti sama dasa (FUN_00413160), natal chart:
//  - seed: the karana (chart+0x123b4, see karanaOf) and its lord
//    (FUN_004ae850): the movable karanas Bava..Vishti -> Sun..Saturn; the
//    fixed ones -> the lord of a house from the lagna: Shakuni 1st,
//    Chatushpada 4th, Naga 7th, Kimstughna 10th (plain lords, 0x591de4);
//  - the seven planets Sun..Saturn, 12 years each, from that lord; the first
//    dasa reduced to the unelapsed part of the karana (chart+0x123a8); seven
//    maha dasas (8 when JHora's DAT_008a4b68 flag is set);
//  - antardasas from the dasa lord, a seventh each.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { SIGN_LORD } from '../lords';
import { signOf } from '../zodiac';
import { NAKSHATRA_DASAS } from './nakshatra';
import { bodyId, cycleIndex, karanaOf, mod12, seededCycleDasa } from './otherCommon';

export const KARANA_CHATURASEETI_TITLE = 'Karana Chaturaseeti sama dasa (useful especially in Tithi/Karana Pravesha charts)';

/** FUN_004ae850: body id of the karana's lord. */
export function karanaLord(chart: Chart, id: number): number {
  if (id < 7) return id + 1;
  return bodyId(SIGN_LORD[mod12(signOf(chart.positions.ascendant) + 3 * (id - 7))]);
}

export function karanaChaturaseetiDasa(chart: Chart, levels = 2): Period[] {
  const cycle = NAKSHATRA_DASAS['Chaturaseeti sama'].lords;
  const k = karanaOf(chart);
  return seededCycleDasa(cycle, cycleIndex(cycle, karanaLord(chart, k.id)), k.remaining, 7, false, levels);
}
