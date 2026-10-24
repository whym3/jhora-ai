// Chakra dasa (FUN_00411b70). With the ghati day frame of kaala.ts:
//  - day birth (D/6 <= t < 5D/6): dasas start from the sign holding the
//    lagna lord (plain lords, table 0x591de4);
//  - night birth (t >= D + N/6 and s < 5N/6): from the lagna;
//  - sandhya (otherwise): from the 2nd house;
//  - twelve signs zodiacally, 10 years each, from birth (no balance);
//  - antardasas: twelve signs zodiacally from, respectively, the sign holding
//    the dasa sign's lord / the dasa sign / the sign after it; each a twelfth
//    (obj+0x8fa18).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { SIGN_LORD } from '../lords';
import { rasiCtx } from './rasiCommon';
import { expandDasa, mod12, signPeriod } from './otherCommon';
import { dayGhatis } from './kaala';

export const CHAKRA_TITLE = 'Chakra Dasa (a versatile phalita rasi dasa)';

export function chakraDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  const { t, s, D, N } = dayGhatis(chart);
  let mode: 0 | 1 | 2 = 2;
  if (D / 6 <= t) {
    if (t < D * (5 / 6)) mode = 0;
    else if (N / 6 + D <= t && s < N * (5 / 6)) mode = 1;
  }
  const lordSign = (x: number) => ctx.sign(SIGN_LORD[x]);
  const start = mode === 0 ? lordSign(ctx.lagna) : mode === 1 ? ctx.lagna : mod12(ctx.lagna + 1);
  const mds = Array.from({ length: 12 }, (_, i) => ({ id: mod12(start + i), years: 10 }));
  const subs = (x: number) => {
    const from = mode === 1 ? x : mode === 2 ? mod12(x + 1) : lordSign(x);
    return Array.from({ length: 12 }, (_, i) => ({ id: mod12(from + i), frac: 1 / 12 }));
  };
  return expandDasa({ mds, subs, make: signPeriod }, levels);
}
