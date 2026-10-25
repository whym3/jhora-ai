// Yoga Vimsottari dasa (FUN_00412ed0), natal chart:
//  - seed: the yoga index trunc(((Moon + Sun) mod 360) * 0.075) (chart+0x123b0)
//    whose lord is 0x5860e0[index mod 9]: Saturn, Mercury, Ketu, Venus, Sun,
//    Moon, Mars, Rahu, Jupiter (Vishkambha = Saturn, ...);
//  - Vimsottari's cycle and years from that lord, the first dasa reduced to
//    the unelapsed fraction of the yoga (chart+0x123a0); ten maha dasas are
//    listed (the cycle plus the first lord again);
//  - antardasas from the dasa lord, in proportion to the years (of 120).
// Tajaka chart with ProgressDasaSeedInTajaka[70] (0x412faa): the lord's body id is
// advanced by the completed years n, ((n + id - 1) mod 9) + 1.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { NAK_LORD, VIMSOTTARI_YEARS } from '../lords';
import { cycleIndex, seededCycleDasa, yogaOf } from './otherCommon';

export const YOGA_VIMSOTTARI_TITLE = 'Yoga Vimsottari Dasa (useful especially in Yoga Pravesha charts)';
/** Yoga lords by index mod 9, as JHora body ids (0x5860e0). */
export const YOGA_LORD = [7, 4, 9, 6, 1, 2, 3, 8, 5];

/** @param progress Tajaka: completed years n added to the lord (ProgressDasaSeedInTajaka) */
export function yogaVimsottariDasa(chart: Chart, levels = 2, progress?: number): Period[] {
  const cycle = NAK_LORD.map((g): [Graha, number] => [g, VIMSOTTARI_YEARS[g]]);
  const y = yogaOf(chart);
  const lord = progress === undefined ? YOGA_LORD[y.index % 9] : ((progress + YOGA_LORD[y.index % 9] - 1) % 9) + 1;
  return seededCycleDasa(cycle, cycleIndex(cycle, lord), y.remaining, 10, false, levels);
}
