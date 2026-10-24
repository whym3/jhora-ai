// Sudarsana Chakra dasa (FUN_004133e0), default chart D-1 (SCDasaVarga = 0)
// and SudarsanaChakraDasaAD = 1:
//  - three parallel sign columns (obj+0x78ab0, +0x804c4, +0x87ed8): dasa i
//    (i = 0..11, one year each, from birth) is the i-th sign from the lagna,
//    from the Moon's sign and from the Sun's sign; JHora's text shows them
//    together as "Lagna:Moon:Sun";
//  - antardasas of a dasa sign x: twelve signs zodiacally from the sign
//    occupied by x's (plain) lord - from x itself when SudarsanaChakraDasaAD
//    is 0 - each a twelfth (obj+0x8fa18); the same rule for every column.
// sudarsanaChakraDasa returns the three columns; `periods` labels each
// period "<lagna sign>:<Moon sign>:<Sun sign>" with the lagna column's
// sub-periods (the three columns' sub-periods follow their own signs).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { SIGN_LORD } from '../lords';
import { JHORA_VARGA_NAMES, rasiCtx } from './rasiCommon';
import { expandDasa, mod12, signPeriod } from './otherCommon';

export const sudarsanaChakraTitle = (vargaIndex = 0) => `Sudarsana Chakra Dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (Lagna:Moon:Sun)`;
export const SUDARSANA_CHAKRA_TITLE = sudarsanaChakraTitle();

export interface SudarsanaChakra { lagna: Period[]; moon: Period[]; sun: Period[]; periods: Period[] }

export function sudarsanaChakraDasa(chart: Chart, levels = 2, vargaIndex = chart.ini.SCDasaVarga ?? 0): SudarsanaChakra {
  const ctx = rasiCtx(chart, vargaIndex);
  const adFromLord = (chart.ini.SudarsanaChakraDasaAD ?? 1) !== 0;
  const subs = (x: number) => {
    const from = adFromLord ? ctx.sign(SIGN_LORD[x]) : x;
    return Array.from({ length: 12 }, (_, i) => ({ id: mod12(from + i), frac: 1 / 12 }));
  };
  const column = (start: number) =>
    expandDasa({ mds: Array.from({ length: 12 }, (_, i) => ({ id: mod12(start + i), years: 1 })), subs, make: signPeriod }, levels);
  const lagna = column(ctx.lagna), moon = column(ctx.sign('Moon')), sun = column(ctx.sign('Sun'));
  const periods = lagna.map((p, i) => ({ ...p, label: `${p.label}:${moon[i].label}:${sun[i].label}` }));
  return { lagna, moon, sun, periods };
}
