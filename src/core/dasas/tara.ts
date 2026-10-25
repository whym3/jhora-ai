// Tara dasa (FUN_00411060). JHora 8.0's defaults are TaraDasaParasara = 0,
// TaraDasaDirectionFromStar = 0, TaraDasaUseSesham = 1,
// TaraDasaSeshamRevApasavya = 0 (ini flags 0x8a4c40, 0x8a4c41, 0x5923d8,
// 0x8a4c42):
//  - the nine planets of the signs taken kendras, panaparas, apoklimas from
//    the lagna, in the lagna's direction (zodiacal from an odd sign, backwards
//    from an even one, with the Saturn/Ketu flags chart+0x173d0 =
//    sequenceDirection); each group of four ordered by FUN_004abbb0, the
//    planets of a sign by dignity (as Moola dasa);
//  - DirectionFromStar = 1: the direction comes instead from the nakshatra of
//    the first planet (by dignity) of the strongest occupied kendra, the Moon
//    when all four are empty: zodiacal when trunc(nakshatra / 3) is even;
//  - years: Vimsottari years, one cycle of 120 years;
//  - balance ("sesham", applied only with UseSesham = 1, obj+0x8fa08): the
//    builder means to pick the strongest of lagna, Moon and Sun, but its
//    compiled comparison always ends on the Moon's sign; the elapsed fraction
//    of the Moon's nakshatra (the lagna's nakshatra when the Moon is in the
//    lagna's sign) is taken off the first dasa; with SeshamRevApasavya = 1 and
//    trunc(nakshatra / 3) odd, the elapsed and remaining parts swap;
//  - antardasas: the same nine planets starting from the dasa lord, in
//    proportion to their Vimsottari years.
// TaraDasaParasara = 1 (the builder's second branch) keeps the years,
// antardasas and balance but orders the planets as in Vimsottari (Ketu,
// Venus, Sun, ...), starting from the first planet (by dignity) of the
// strongest occupied kendra; the balance always comes from the Moon's
// nakshatra and the other three flags are ignored. With all kendras empty the
// builder goes on to read uninitialised signs; we keep the value it seeds
// first, the Moon's star lord.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { NAK_LORD, VIMSOTTARI_YEARS, nakshatraLord } from '../lords';
import { sequenceDirection } from './narayana';
import { rasiCtx } from './rasiCommon';
import { bodyId, bodyPeriod, expandDasa, kendradiPlanets, mod12, yearFractions } from './otherCommon';

export const TARA_TITLE = 'Tara Dasa (applicable if all the four quadrants are occupied)';
const NAK = 360 / 27;

export interface TaraOptions { parasara: boolean; directionFromStar: boolean; useSesham: boolean; seshamRevApasavya: boolean }

export const taraOptions = (chart: Chart): TaraOptions => ({
  parasara: (chart.ini.TaraDasaParasara ?? 0) !== 0,
  directionFromStar: (chart.ini.TaraDasaDirectionFromStar ?? 0) !== 0,
  useSesham: (chart.ini.TaraDasaUseSesham ?? 1) !== 0,
  seshamRevApasavya: (chart.ini.TaraDasaSeshamRevApasavya ?? 0) !== 0,
});

export function taraDasa(chart: Chart, levels = 2, opts: TaraOptions = taraOptions(chart)): Period[] {
  const ctx = rasiCtx(chart, 0);
  const p = chart.positions;
  const lonOf = (g: Graha) => p.grahas[g].lon;
  // first planet of the strongest occupied kendra (lagna, 4th, 7th, 10th sorted by FUN_004ab650 mode 2, then FUN_004ab730)
  const kendras = [0, 3, 6, 9].map((k) => mod12(ctx.lagna + k));
  const kendraLead = kendradiPlanets(ctx.lagna, 1, ctx).find((g) => kendras.includes(ctx.sign(g)));
  let order: Graha[], lon: number, swap = false;
  if (opts.parasara) {
    const k = NAK_LORD.indexOf(kendraLead ?? nakshatraLord(Math.floor(lonOf('Moon') / NAK)));
    order = NAK_LORD.map((_, j) => NAK_LORD[(k + j) % 9]);
    lon = lonOf('Moon');
  } else {
    let dir = sequenceDirection(ctx.lagna, ctx);
    if (opts.directionFromStar) dir = Math.floor(Math.floor(lonOf(kendraLead ?? 'Moon') / NAK) / 3) % 2 ? -1 : 1;
    order = kendradiPlanets(ctx.lagna, dir, ctx);
    lon = ctx.sign('Moon') === ctx.lagna ? p.ascendant : lonOf('Moon');
    swap = opts.seshamRevApasavya && Math.floor(Math.floor(lon / NAK) / 3) % 2 === 1;
  }
  const mds = order.map((g) => ({ id: bodyId(g), years: VIMSOTTARI_YEARS[g] }));
  const elapsedFrac = (lon - Math.floor(lon / NAK) * NAK) / NAK;
  const elapsed = opts.parasara || opts.useSesham ? (swap ? 1 - elapsedFrac : elapsedFrac) * mds[0].years : 0;
  const frac = yearFractions(mds, 9);
  const ids = mds.map((m) => m.id);
  const subs = (id: number) => {
    const k = ids.indexOf(id);
    return ids.map((_, j) => ({ id: ids[(k + j) % 9], frac: frac(ids[(k + j) % 9]) }));
  };
  return expandDasa({ mds, elapsed, subs, make: bodyPeriod }, levels);
}
