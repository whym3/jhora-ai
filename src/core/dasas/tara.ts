// Tara dasa (FUN_00411060) with JHora 8.0's defaults (TaraDasaParasara = 0,
// TaraDasaDirectionFromStar = 0, TaraDasaUseSesham = 1,
// TaraDasaSeshamRevApasavya = 0):
//  - the nine planets of the signs taken kendras, panaparas, apoklimas from
//    the lagna, in the lagna's direction (zodiacal from an odd sign, backwards
//    from an even one, with the Saturn/Ketu flags chart+0x173d0 =
//    sequenceDirection); each group of four ordered by FUN_004abbb0, the
//    planets of a sign by dignity (as Moola dasa);
//  - years: Vimsottari years, one cycle of 120 years;
//  - balance ("sesham"): the builder means to pick the strongest of lagna,
//    Moon and Sun, but its compiled comparison always ends on the Moon's sign;
//    the elapsed fraction of the Moon's nakshatra (the lagna's nakshatra when
//    the Moon is in the lagna's sign) is taken off the first dasa;
//  - antardasas: the same nine planets starting from the dasa lord, in
//    proportion to their Vimsottari years.
// (TaraDasaParasara = 1 switches to a nakshatra-based variant, not ported.)
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { VIMSOTTARI_YEARS } from '../lords';
import { sequenceDirection } from './narayana';
import { rasiCtx } from './rasiCommon';
import { bodyId, bodyPeriod, expandDasa, kendradiPlanets, yearFractions } from './otherCommon';

export const TARA_TITLE = 'Tara Dasa (applicable if all the four quadrants are occupied)';
const NAK = 360 / 27;

export function taraDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  const order = kendradiPlanets(ctx.lagna, sequenceDirection(ctx.lagna, ctx), ctx);
  const mds = order.map((g) => ({ id: bodyId(g), years: VIMSOTTARI_YEARS[g] }));
  const lon = ctx.sign('Moon') === ctx.lagna ? chart.positions.ascendant : chart.positions.grahas.Moon.lon;
  const elapsedFrac = (lon - Math.floor(lon / NAK) * NAK) / NAK;
  const frac = yearFractions(mds, 9);
  const ids = mds.map((m) => m.id);
  const subs = (id: number) => {
    const k = ids.indexOf(id);
    return ids.map((_, j) => ({ id: ids[(k + j) % 9], frac: frac(ids[(k + j) % 9]) }));
  };
  return expandDasa({ mds, elapsed: elapsedFrac * mds[0].years, subs, make: bodyPeriod }, levels);
}
