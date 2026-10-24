// Naisargika dasa (FUN_004128b0) with JHora 8.0's default options:
//  - fixed sequence from birth (no balance): Moon 1, Mars 2, Mercury 9,
//    Venus 20, Jupiter 18, Sun 20, Saturn 50, Lagna ("Asc") 12 - 132 years.
//    (The builder also computes a Moola-style start sign; it is never used.)
//  - antardasas (explicit fractions, obj+0x8fa8c = 1): the planets Sun..Saturn
//    (nodes and lagna skipped) of the signs taken kendras, panaparas, apoklimas
//    zodiacally from the dasa lord's sign, each group ordered by FUN_004abbb0
//    and each sign's planets by dignity; weights by house h from the lord's
//    sign: h=1 1/2 for other planets (the lord itself is dropped:
//    NaisargikaDasaNoADForMDLord = 1, else 1), 4th/8th 1/4, 5th/9th 1/3,
//    7th 1/7, 3rd/10th 1 (none if NaisargikaDasa3rd10thNoAD), 2nd/6th/11th/12th
//    1 (none if NaisargikaDasaOthersNoAD); shares = weights over their sum.
//    For the Lagna dasa the lagna's sign is the reference.
//  - deeper levels divide a sub-period of planet X like X's maha dasa.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { signOf } from '../zodiac';
import { rasiCtx } from './rasiCommon';
import { BODY, bodyId, bodyPeriod, expandDasa, kendradiPlanets, mod12, type SubPeriod } from './otherCommon';

export const NAISARGIKA_TITLE = 'Naisargika Dasa (dasa of the nature)';

const SEQ: [number, number][] = [[2, 1], [3, 2], [4, 9], [6, 20], [5, 18], [1, 20], [7, 50], [0, 12]];

export function naisargikaDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  const noAdForLord = (chart.ini.NaisargikaDasaNoADForMDLord ?? 1) !== 0;
  const no3rd10th = (chart.ini.NaisargikaDasa3rd10thNoAD ?? 0) !== 0;
  const noOthers = (chart.ini.NaisargikaDasaOthersNoAD ?? 0) !== 0;
  const signOfId = (id: number) => (id === 0 ? signOf(chart.positions.ascendant) : ctx.sign(BODY[id]!));
  const subs = (lord: number): SubPeriod[] => {
    const ref = signOfId(lord);
    const out: SubPeriod[] = [];
    for (const g of kendradiPlanets(ref, 1, ctx)) {
      const id = bodyId(g);
      if (id < 1 || id > 7) continue;
      let w: number | null;
      switch (mod12(ctx.sign(g) - ref)) {
        case 0: w = id === lord ? (noAdForLord ? null : 1) : 0.5; break;
        case 2: case 9: w = no3rd10th ? null : 1; break;
        case 3: case 7: w = 0.25; break;
        case 4: case 8: w = 1 / 3; break;
        case 6: w = 1 / 7; break;
        default: w = noOthers ? null : 1;
      }
      if (w !== null) out.push({ id, frac: w });
    }
    const total = out.reduce((a, s) => a + s.frac, 0);
    return out.map((s) => ({ id: s.id, frac: s.frac / total }));
  };
  return expandDasa({ mds: SEQ.map(([id, years]) => ({ id, years })), subs, make: bodyPeriod }, levels);
}
