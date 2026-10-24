// AK Kendradi Graha dasa (FUN_00412160; not the AK Kendradi *Rasi* dasa of
// akKendradi.ts), default chart D-1 (varga index DAT_008a4b98 = 0):
//  - the planets of the signs taken kendras, panaparas, apoklimas from the
//    atmakaraka's sign (chart+0x17fe0[0]), in that sign's direction
//    (sequenceDirection with the Saturn/Ketu flags), groups ordered by
//    FUN_004abbb0 and planets of a sign by dignity; Ketu is dropped - 8 dasas;
//  - years (FUN_004ad100): for each sign the planet owns (Rahu Aquarius, Ketu
//    Scorpio) count from the planet's sign to it - forward from Ar/Ta/Ge/Li/
//    Sc/Sg, backward from the others - 1..12 (own sign = 12), +1 exalted
//    (below 12), -1 debilitated; the larger of the two counts;
//  - one cycle from birth, no balance;
//  - antardasas: JHora rebuilds the same list from the AK for every dasa, so
//    each dasa's antardasas run through the maha dasa order from its first
//    planet (not from the dasa lord), in proportion to the years.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { charaKarakas } from '../basics';
import { DEBILITATION, EXALTATION, type VargaCtx } from '../signStrength';
import { sequenceDirection } from './narayana';
import { JHORA_VARGA_NAMES, rasiCtx } from './rasiCommon';
import { bodyId, bodyPeriod, expandDasa, kendradiPlanets, mod12, yearFractions } from './otherCommon';

export const akKendradiGrahaTitle = (vargaIndex = 0) => `AK Kendradi Graha Dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (experiences of the soul)`;
export const AK_KENDRADI_GRAHA_TITLE = akKendradiGrahaTitle();

const OWN: Record<Graha, [number, number]> = {
  Sun: [4, 4], Moon: [3, 3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10], Rahu: [10, 10], Ketu: [7, 7],
};

/** FUN_004ad100. */
export function akKendradiGrahaYears(g: Graha, ctx: VargaCtx): number {
  const s = ctx.sign(g);
  const count = (o: number) => {
    let n = mod12(Math.floor(s / 3) % 2 === 0 ? o - s : s - o) || 12;
    if (EXALTATION[g] === s && n < 12) n++;
    if (DEBILITATION[g] === s && n > 0) n--;
    return n;
  };
  return Math.max(count(OWN[g][0]), count(OWN[g][1]));
}

/** Chara karaka scheme behind chart+0x18000 (CharaKarakaDefinition 0 = the 8-karaka scheme). */
export const karakaScheme = (chart: Chart): 7 | 8 => (chart.ini.CharaKarakaDefinition === 0 ? 8 : 7);

/** @param vargaIndex JHora varga index (DAT_008a4b98, default 0 = D-1) */
export function akKendradiGrahaDasa(chart: Chart, levels = 2, vargaIndex = 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const ak = charaKarakas(chart.positions, karakaScheme(chart))[0].planet;
  const akSign = ctx.sign(ak);
  const order = kendradiPlanets(akSign, sequenceDirection(akSign, ctx), ctx).filter((g) => g !== 'Ketu');
  const mds = order.map((g) => ({ id: bodyId(g), years: akKendradiGrahaYears(g, ctx) }));
  const frac = yearFractions(mds, 8);
  const subs = () => mds.map((m) => ({ id: m.id, frac: frac(m.id) }));
  return expandDasa({ mds, subs, make: bodyPeriod }, levels);
}
