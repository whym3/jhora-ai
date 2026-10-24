// Moola dasa (FUN_00410cd0), a graha dasa with JHora 8.0's default rules:
//  - the dasas start from the sign with most planets among the lagna (counted
//    with one extra), the Moon's sign and the Sun's sign; ties go to the
//    stronger sign (FUN_004abbb0);
//  - from it the kendras, panaparas and apoklimas follow, zodiacally from an odd
//    sign and backwards from an even one; each group of four is ordered by
//    strength, and the planets in each sign by dignity (FUN_004ac7d0);
//  - years (FUN_004ad280): n = signs from the planet to its moolatrikona sign
//    (12 in it; +1 exalted, -1 debilitated), years = |vimsottari years - n|, or
//    the full vimsottari years when that is 0; the second cycle gives each
//    planet the rest of its vimsottari years;
//  - antardasas run through the same planet order starting from the dasa lord,
//    in proportion to the first-cycle years.
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { DEBILITATION, EXALTATION, PLANETS, sortByStrength, strongerSignDignityFirst, type VargaCtx } from '../signStrength';
import { strongerByDignity } from '../deities';

const mod12 = (x: number) => ((x % 12) + 12) % 12;
/** FUN_004ad280's moolatrikona table (0x591eac): the nodes' signs are Aquarius and Scorpio here. */
const MOOLATRIKONA: Record<Graha, number> = { Sun: 4, Moon: 1, Mars: 0, Mercury: 5, Jupiter: 8, Venus: 6, Saturn: 10, Rahu: 10, Ketu: 7 };
const VIMS: Record<Graha, number> = { Sun: 6, Moon: 10, Mars: 7, Mercury: 17, Jupiter: 16, Venus: 20, Saturn: 19, Rahu: 18, Ketu: 7 };

export const MOOLA_TITLE = 'Moola Dasa (dasa showing the root of events - past karma)';

export function moolaYears(g: Graha, ctx: VargaCtx): number {
  const s = ctx.sign(g);
  let n = mod12(MOOLATRIKONA[g] - s);
  if (MOOLATRIKONA[g] === s) n = 12;
  else if (EXALTATION[g] === s && n < 12) n++;
  else if (DEBILITATION[g] === s && n > 0) n--;
  const y = VIMS[g] - n;
  return y < 0 ? -y : y === 0 ? VIMS[g] : y;
}

/** The nine planets in Moola dasa order. */
export function moolaOrder(lagna: number, ctx: VargaCtx): Graha[] {
  const occ = (s: number) => PLANETS.filter((g) => ctx.sign(g) === s).length;
  let best = occ(lagna) + 1;
  let cands = [lagna];
  for (const s of [ctx.sign('Moon'), ctx.sign('Sun')]) {
    const n = occ(s);
    if (n > best) { best = n; cands = [s]; } else if (n === best) cands.push(s);
  }
  const strongerSign = (a: number, b: number) => strongerSignDignityFirst(a, b, ctx);
  const start = sortByStrength(cands, strongerSign)[0];
  const dir = start % 2 === 0 ? 1 : -1;
  const signs = Array.from({ length: 12 }, (_, u) => mod12(start + dir * ((u % 4) * 3 + Math.floor(u / 4))));
  const ordered = [0, 4, 8].flatMap((i) => sortByStrength(signs.slice(i, i + 4), strongerSign));
  return ordered.flatMap((s) => sortByStrength(PLANETS.filter((g) => ctx.sign(g) === s), (p, q) => strongerByDignity(p, q, ctx)));
}

export function moolaDasa(lagna: number, ctx: VargaCtx, levels = 2): Period[] {
  const order = moolaOrder(lagna, ctx);
  const first = order.map((g) => moolaYears(g, ctx));
  const total = first.reduce((a, x) => a + x, 0);
  const sub = (p: Period, k: number, depth: number): Period => {
    if (depth <= 0) return p;
    let t = p.start;
    const len = p.end - p.start;
    const children = order.map((_, j) => {
      const i = (k + j) % 9;
      const q: Period = { lord: order[i], start: t, end: t + (len * first[i]) / total };
      t = q.end;
      return sub(q, i, depth - 1);
    });
    return { ...p, children };
  };
  const out: Period[] = [];
  let t = 0;
  for (let cycle = 0; cycle < 2; cycle++) {
    order.forEach((g, k) => {
      const years = cycle === 0 ? first[k] : VIMS[g] - first[k];
      out.push(sub({ lord: g, start: t, end: t + years }, k, levels - 1));
      t += years;
    });
  }
  return out;
}
