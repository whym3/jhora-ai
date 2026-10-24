// Tithi Yogini dasa (FUN_004125e0), natal chart, default Janma tithi
// (harmonic DAT_008a4b7c = 0):
//  - seed: the tithi of chart+0x12034 (trunc(((Moon - Sun) mod 360) / 12)) and
//    its lord (TITHI_LORD, 0x591cf4);
//  - the Yogini cycle with planets (Moon 1, Sun 2, Jupiter 3, Mars 4,
//    Mercury 5, Saturn 6, Venus 7, Rahu 8) from that lord, the first dasa
//    reduced to the unelapsed fraction of the tithi (chart+0x120c8); 24 maha
//    dasas (three cycles; 8 when JHora's DAT_008a4b68 flag is set);
//  - antardasas from the dasa lord round the cycle, in proportion (of 36).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { NAKSHATRA_DASAS } from './nakshatra';
import { cycleIndex, seededCycleDasa, TITHI_LORD, tithiOf } from './otherCommon';
import { TITHI_HARMONICS } from './tithiAshtottari';

export const tithiYoginiTitle = (harmonic = 0) => `Tithi Yogini Dasa of ${TITHI_HARMONICS[harmonic]} (based on tithis instead of nakshatras)`;
export const TITHI_YOGINI_TITLE = tithiYoginiTitle();

export function tithiYoginiDasa(chart: Chart, levels = 2, harmonic = 0): Period[] {
  const cycle = NAKSHATRA_DASAS.Yogini.lords;
  const t = tithiOf(chart, harmonic);
  return seededCycleDasa(cycle, cycleIndex(cycle, TITHI_LORD[t.index]), t.remaining, 24, false, levels);
}
