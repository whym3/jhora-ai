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
// The dasa pane's Options button opens dialog 2034 (FUN_0044e9f0, session globals, not
// saved): "Select the tithi that you want to be used as the seed" (combo 1027, the 36
// harmonics DAT_008a4b74), "Choose the divisional chart" (combo 1005, DAT_008a4b78: the
// longitudes come from FUN_004a1260(varga)) and "the two planets used in tithi
// computation" (combos 1003 / 1004, Lagna..Ketu, DAT_005922cc = 1 Sun and DAT_005922d0
// = 2 Moon): FUN_004a4110 / FUN_004a41b0 take ((second - first) mod 360) * (harmonic + 1).
// Tajaka chart with ProgressDasaSeedInTajaka[69] (0x410aa6): the lord's body id is
// advanced by the completed years n, ((n + id - 1) mod 8) + 1, before the cycle lookup.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { GRAHAS } from '../positions';
import { vargaLongitude } from '../vargas';
import { vargaSpec } from '../vargaOptions';
import { NAKSHATRA_DASAS } from './nakshatra';
import { cycleIndex, seededCycleDasa, TITHI_LORD, tithiOf } from './otherCommon';
import { JHORA_VARGA_NAMES, JHORA_VARGAS } from './rasiCommon';

/** Names of the harmonic tithis (0x8a25dc). */
export const TITHI_HARMONICS = [0, 1, 2].flatMap((c) =>
  ['Janma', 'Dhana', 'Bhratri', 'Matri', 'Putra', 'Satru', 'Kalatra', 'Mrityu', 'Bhagya', 'Karma', 'Laabha', 'Vyaya']
    .map((x) => `${x} tithi${c ? ` (cycle ${c + 1})` : ''}`));

export const tithiAshtottariTitle = (harmonic = 0, vargaIndex = 0) =>
  `Tithi Ashtottari Dasa of ${TITHI_HARMONICS[harmonic]} in ${JHORA_VARGA_NAMES[vargaIndex]} (useful especially in Tithi Pravesha charts)`;
export const TITHI_ASHTOTTARI_TITLE = tithiAshtottariTitle();

/** Dialog 2034's choices (all optional: Janma tithi of Sun and Moon in D-1). */
export interface TithiSeedOptions {
  /** DAT_008a4b74: harmonic tithi 0..35 */
  harmonic?: number;
  /** DAT_008a4b78: JHora varga index */
  varga?: number;
  /** DAT_005922cc / DAT_005922d0: JHora body ids (0 Lagna, 1 Sun .. 9 Ketu) */
  bodies?: [number, number];
}

/** FUN_004a4110 / FUN_004a41b0 with dialog 2034's bodies and varga. */
export function tithiOfBodies(chart: Chart, harmonic = 0, varga = 0, bodies: [number, number] = [1, 2]): { index: number; remaining: number } {
  if (!varga && bodies[0] === 1 && bodies[1] === 2) return tithiOf(chart, harmonic);
  const name = JHORA_VARGAS[varga];
  if (!name) throw new Error(`tithi dasa varga ${varga} not supported`);
  const spec = varga ? vargaSpec(name, chart.ini) : null;
  const lonOf = (b: number) => {
    const lon = b === 0 ? chart.positions.ascendant : chart.positions.grahas[GRAHAS[b - 1]].lon;
    return spec ? vargaLongitude(lon, spec) : lon;
  };
  const n360 = (x: number) => ((x % 360) + 360) % 360;
  const d = n360(n360(lonOf(bodies[1]) - lonOf(bodies[0])) * (harmonic + 1));
  const index = Math.trunc(d / 12);
  return { index, remaining: (12 * (index + 1) - d) / 12 };
}

/**
 * @param progress Tajaka: completed years n added to the lord (ProgressDasaSeedInTajaka)
 * @param o dialog 2034's varga and bodies (its harmonic is `harmonic`)
 */
export function tithiAshtottariDasa(chart: Chart, levels = 2, harmonic = 0, progress?: number, o: TithiSeedOptions = {}): Period[] {
  const cycle = NAKSHATRA_DASAS.Ashtottari.lords;
  const t = tithiOfBodies(chart, harmonic, o.varga ?? 0, o.bodies ?? [1, 2]);
  const lord = progress === undefined ? TITHI_LORD[t.index] : ((progress + TITHI_LORD[t.index] - 1) % 8) + 1;
  return seededCycleDasa(cycle, cycleIndex(cycle, lord), t.remaining, 9, true, levels);
}
