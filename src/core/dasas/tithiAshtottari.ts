// Tithi Ashtottari dasa (FUN_004109a0), natal chart, defaults: Janma tithi
// (harmonic DAT_008a4b74 = 0) of the D-1 chart (DAT_008a4b78 = 0):
//  - seed: the tithi index trunc(((Moon - Sun) mod 360) / 12) (FUN_004a4110),
//    its lord from 0x591cf4 (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn,
//    Rahu repeating, Purnima Saturn, Amavasya Rahu - see TITHI_LORD);
//  - the Ashtottari cycle (Sun 6, Moon 15, Mars 8, Mercury 17, Saturn 10,
//    Jupiter 19, Rahu 12, Venus 21) from that lord; the first dasa keeps the
//    unelapsed fraction of the tithi (FUN_004a41b0); nine maha dasas are
//    listed (the cycle plus the first lord again);
//  - antardasas start from the lord AFTER the dasa lord and end with it, in
//    proportion to the years (of 108).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { NAKSHATRA_DASAS } from './nakshatra';
import { cycleIndex, seededCycleDasa, TITHI_LORD, tithiOf } from './otherCommon';
import { JHORA_VARGA_NAMES } from './rasiCommon';

/** Names of the harmonic tithis (0x8a25dc). */
export const TITHI_HARMONICS = [0, 1, 2].flatMap((c) =>
  ['Janma', 'Dhana', 'Bhratri', 'Matri', 'Putra', 'Satru', 'Kalatra', 'Mrityu', 'Bhagya', 'Karma', 'Laabha', 'Vyaya']
    .map((x) => `${x} tithi${c ? ` (cycle ${c + 1})` : ''}`));

export const tithiAshtottariTitle = (harmonic = 0, vargaIndex = 0) =>
  `Tithi Ashtottari Dasa of ${TITHI_HARMONICS[harmonic]} in ${JHORA_VARGA_NAMES[vargaIndex]} (useful especially in Tithi Pravesha charts)`;
export const TITHI_ASHTOTTARI_TITLE = tithiAshtottariTitle();

export function tithiAshtottariDasa(chart: Chart, levels = 2, harmonic = 0): Period[] {
  const cycle = NAKSHATRA_DASAS.Ashtottari.lords;
  const t = tithiOf(chart, harmonic);
  return seededCycleDasa(cycle, cycleIndex(cycle, TITHI_LORD[t.index]), t.remaining, 9, true, levels);
}
