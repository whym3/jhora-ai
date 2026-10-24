// Jaimini sign and planet strength, ported from jhora.exe:
//   FUN_004ab890 strongerSign(a, b), FUN_004ac110 strongerPlanet(p, q),
//   FUN_004acb90 aspectScore(sign), FUN_004ae3e0 rasiAspects(a, b).
// Everything works on sign positions in one varga, so the same code serves
// every divisional chart. Rahu and Ketu are planets 'Rahu'/'Ketu' here.
import type { Graha } from './positions';
import { SIGN_LORD } from './lords';

export const PLANETS: Graha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

/** Exaltation and debilitation signs as JHora's tables hold them (nodes: Ge/Sg and Sg/Ge). */
export const EXALTATION: Record<Graha, number> = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6, Rahu: 2, Ketu: 8 };
export const DEBILITATION: Record<Graha, number> = { Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0, Rahu: 8, Ketu: 2 };

const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** Rasi drishti: a sign aspects itself; movable<->fixed and dual<->dual, never the adjacent sign. */
export function rasiAspects(a: number, b: number): boolean {
  if (a === b) return true;
  const ma = a % 3, mb = b % 3;
  const ok = ma === 0 ? mb === 1 : ma === 1 ? mb === 0 : mb === 2;
  return ok && mod12(a + 1) !== b && mod12(b + 1) !== a;
}

/** Sign positions of the planets in one varga, plus their D-1 advancement for tie-breaks. */
export interface VargaCtx {
  sign: (g: Graha) => number;
  /** degrees inside the sign (0..30) in the rasi chart - JHora uses D-1 degrees whatever the varga */
  degree: (g: Graha) => number;
}

/** Number of {Mercury, Jupiter, lord (and node co-lord)} whose sign aspects or is `sign`. */
export function aspectScore(sign: number, ctx: VargaCtx): number {
  let n = 0;
  if (rasiAspects(sign, ctx.sign('Mercury'))) n++;
  if (rasiAspects(sign, ctx.sign('Jupiter'))) n++;
  if (rasiAspects(sign, ctx.sign(SIGN_LORD[sign]))) n++;
  else if (sign === 7 && rasiAspects(7, ctx.sign('Ketu'))) n++;
  else if (sign === 10 && rasiAspects(10, ctx.sign('Rahu'))) n++;
  return n;
}

const occupants = (sign: number, ctx: VargaCtx) => PLANETS.filter((g) => ctx.sign(g) === sign).length;

/**
 * Stronger of two co-lords (Saturn/Rahu for Aquarius, Mars/Ketu for Scorpio), as
 * jhora.exe FUN_004abeb0 decides the lord used in arudhas. (FUN_004ac110/4ac420/
 * 4ac5a0 are variants with other final tie-breaks, used by dasa options.)
 */
export function strongerPlanet(p: Graha, q: Graha, ctx: VargaCtx): Graha {
  const own = (g: Graha) => (g === 'Saturn' || g === 'Rahu' ? 10 : g === 'Mars' || g === 'Ketu' ? 7 : -1);
  const sp = ctx.sign(p), sq = ctx.sign(q);
  // JHora: when one of them sits in the co-owned sign and the other does not, the other one is taken
  if (sp === own(p)) { if (sq !== own(q)) return q; } else if (sq === own(q)) return p;
  const np = occupants(sp, ctx), nq = occupants(sq, ctx);
  if (np > nq) return p;
  if (nq > np) return q;
  const ap = aspectScore(sp, ctx), aq = aspectScore(sq, ctx);
  if (ap > aq) return p;
  if (aq > ap) return q;
  const ep = EXALTATION[p] === sp, eq = EXALTATION[q] === sq;
  if (ep && !eq) return p;
  if (!ep && eq) return q;
  const dp = DEBILITATION[p] === sp, dq = DEBILITATION[q] === sq;
  if (!dp && dq) return p;
  if (dp && !dq) return q;
  if (sp % 3 > sq % 3) return p;
  if (sq % 3 > sp % 3) return q;
  // last: the one further advanced in its rasi-chart sign (nodes count backwards)
  const adv = (g: Graha) => (g === 'Rahu' || g === 'Ketu' ? 30 - ctx.degree(g) : ctx.degree(g));
  return adv(p) < adv(q) ? q : p;
}

/** Lord of a sign with JHora's node co-lordship (NodesInArudhas / Jaimini). */
export function signLordJaimini(sign: number, ctx: VargaCtx): Graha {
  if (sign === 10) return strongerPlanet('Saturn', 'Rahu', ctx);
  if (sign === 7) return strongerPlanet('Mars', 'Ketu', ctx);
  return SIGN_LORD[sign];
}

/** Stronger of two signs (JHora FUN_004ab890). */
export function strongerSign(a: number, b: number, ctx: VargaCtx): number {
  const na = occupants(a, ctx), nb = occupants(b, ctx);
  if (na > nb) return a;
  if (nb > na) return b;
  const sa = aspectScore(a, ctx), sb = aspectScore(b, ctx);
  if (sa > sb) return a;
  if (sb > sa) return b;
  const exalted = (s: number) => PLANETS.filter((g) => ctx.sign(g) === s && EXALTATION[g] === s).length;
  const ea = exalted(a), eb = exalted(b);
  if (ea > eb) return a;
  if (eb > ea) return b;
  const debil = (s: number) => PLANETS.filter((g) => ctx.sign(g) === s && DEBILITATION[g] === s).length;
  const da = debil(a), db = debil(b);
  if (da < db) return a;
  if (db < da) return b;
  const la = signLordJaimini(a, ctx), lb = signLordJaimini(b, ctx);
  // the lord in a sign of the other parity counts as stronger
  const pa = ctx.sign(la) % 2 !== a % 2, pb = ctx.sign(lb) % 2 !== b % 2;
  if (pa && !pb) return a;
  if (pb && !pa) return b;
  if (a % 3 > b % 3) return a;
  if (b % 3 > a % 3) return b;
  const adv = (g: Graha) => (g === 'Rahu' || g === 'Ketu' ? 30 - ctx.degree(g) : ctx.degree(g));
  return adv(la) < adv(lb) ? b : a;
}

/**
 * Stronger co-lord as FUN_004ac110 decides (dasa variants): like strongerPlanet,
 * but the last tie-break counts signs from the co-owned sign (Aquarius backwards,
 * Scorpio forwards), +1 if exalted, -1 if debilitated; the larger count wins.
 */
export function strongerPlanetByDistance(p: Graha, q: Graha, ctx: VargaCtx): Graha {
  const own = (g: Graha) => (g === 'Saturn' || g === 'Rahu' ? 10 : g === 'Mars' || g === 'Ketu' ? 7 : 0);
  const sp = ctx.sign(p), sq = ctx.sign(q);
  if (sp === own(p)) { if (sq !== own(q)) return q; } else if (sq === own(q)) return p;
  const np = occupants(sp, ctx), nq = occupants(sq, ctx);
  if (np > nq) return p;
  if (nq > np) return q;
  const ap = aspectScore(sp, ctx), aq = aspectScore(sq, ctx);
  if (ap > aq) return p;
  if (aq > ap) return q;
  const ep = EXALTATION[p] === sp, eq = EXALTATION[q] === sq;
  if (ep && !eq) return p;
  if (!ep && eq) return q;
  const dp = DEBILITATION[p] === sp, dq = DEBILITATION[q] === sq;
  if (!dp && dq) return p;
  if (dp && !dq) return q;
  if (sp % 3 > sq % 3) return p;
  if (sq % 3 > sp % 3) return q;
  const count = (g: Graha) => {
    const o = own(g), s = ctx.sign(g);
    let n = mod12(Math.floor(o / 3) % 2 === 0 ? s - o : o - s);
    if (EXALTATION[g] === s && n < 12) n++;
    if (DEBILITATION[g] === s && n > 0) n--;
    return n;
  };
  return count(p) < count(q) ? q : p;
}

/** Lord of a sign with the co-lords decided by FUN_004ac110. */
export function signLordByDistance(sign: number, ctx: VargaCtx): Graha {
  if (sign === 10) return strongerPlanetByDistance('Saturn', 'Rahu', ctx);
  if (sign === 7) return strongerPlanetByDistance('Mars', 'Ketu', ctx);
  return SIGN_LORD[sign];
}

/**
 * Stronger of two signs as FUN_004abbb0 decides (used by Moola dasa): more
 * planets, more exalted planets, fewer debilitated ones, aspect score, lord in
 * a sign of the other parity, modality (dual > fixed > movable), finally the
 * lord further advanced in its sign. Ties go to a.
 */
export function strongerSignDignityFirst(a: number, b: number, ctx: VargaCtx): number {
  const na = occupants(a, ctx), nb = occupants(b, ctx);
  if (na > nb) return a;
  if (nb > na) return b;
  const exalted = (s: number) => PLANETS.filter((g) => ctx.sign(g) === s && EXALTATION[g] === s).length;
  const ea = exalted(a), eb = exalted(b);
  if (ea > eb) return a;
  if (eb > ea) return b;
  const debil = (s: number) => PLANETS.filter((g) => ctx.sign(g) === s && DEBILITATION[g] === s).length;
  const da = debil(a), db = debil(b);
  if (da < db) return a;
  if (db < da) return b;
  const sa = aspectScore(a, ctx), sb = aspectScore(b, ctx);
  if (sa > sb) return a;
  if (sb > sa) return b;
  const la = signLordByDistance(a, ctx), lb = signLordByDistance(b, ctx);
  const pa = ctx.sign(la) % 2 !== a % 2, pb = ctx.sign(lb) % 2 !== b % 2;
  if (pa && !pb) return a;
  if (pb && !pa) return b;
  if (a % 3 > b % 3) return a;
  if (b % 3 > a % 3) return b;
  const adv = (g: Graha) => (g === 'Rahu' || g === 'Ketu' ? 30 - ctx.degree(g) : ctx.degree(g));
  return adv(la) < adv(lb) ? b : a;
}

/** JHora's insertion sort (FUN_004ab650/FUN_004ab780): strongest first, ties keep their order. */
export function sortByStrength<T>(items: T[], stronger: (x: T, y: T) => T): T[] {
  const out: T[] = [];
  for (const it of items) {
    const i = out.findIndex((x) => stronger(x, it) === it && x !== it);
    if (i < 0) out.push(it); else out.splice(i, 0, it);
  }
  return out;
}

/** Co-owned sign of a co-lord as JHora's co-lord comparisons set it (Saturn/Rahu Aq, Mars/Ketu Sc). */
const coOwn = (g: Graha) => (g === 'Saturn' || g === 'Rahu' ? 10 : g === 'Mars' || g === 'Ketu' ? 7 : 0);

/**
 * Stronger co-lord as FUN_004ac420 decides (KN Rao's chara dasa, table
 * chart+0x179b4/0x17b84): the one outside the co-owned sign when the other is
 * in it, then more planets in its sign, finally the higher rasi-chart degree
 * in the sign (nodes not reversed). Ties go to p.
 */
export function strongerPlanetByDegree(p: Graha, q: Graha, ctx: VargaCtx): Graha {
  const sp = ctx.sign(p), sq = ctx.sign(q);
  if (sp === coOwn(p)) { if (sq !== coOwn(q)) return q; } else if (sq === coOwn(q)) return p;
  const np = occupants(sp, ctx), nq = occupants(sq, ctx);
  if (np > nq) return p;
  if (nq > np) return q;
  return ctx.degree(p) < ctx.degree(q) ? q : p;
}

/**
 * Stronger co-lord as FUN_004ac5a0 decides (Parasara chara dasa, table
 * chart+0x17a28/0x17bf8): co-owned-sign rule, more planets, then the sign of
 * LOWER modality (movable beats fixed beats dual - JHora's code compares this
 * way round), finally the count from the co-owned sign of FUN_004ac110 (+1
 * exalted, -1 debilitated), the larger winning. Ties go to p.
 */
export function strongerPlanetByModality(p: Graha, q: Graha, ctx: VargaCtx): Graha {
  const sp = ctx.sign(p), sq = ctx.sign(q);
  if (sp === coOwn(p)) { if (sq !== coOwn(q)) return q; } else if (sq === coOwn(q)) return p;
  const np = occupants(sp, ctx), nq = occupants(sq, ctx);
  if (np > nq) return p;
  if (nq > np) return q;
  if (sq % 3 > sp % 3) return p;
  if (sp % 3 > sq % 3) return q;
  const count = (g: Graha) => {
    const o = coOwn(g), s = ctx.sign(g);
    const d = Math.floor(o / 3) % 2 === 0 ? s - o : o - s;
    let n = mod12(d) === 0 ? 12 : mod12(d);
    if (EXALTATION[g] === s && n < 12) n++;
    if (DEBILITATION[g] === s && n > 0) n--;
    return n;
  };
  return count(q) <= count(p) ? p : q;
}

/** Lord of a sign with the co-lords decided by FUN_004ac420 (FUN_004ad430). */
export function signLordByDegree(sign: number, ctx: VargaCtx): Graha {
  if (sign === 10) return strongerPlanetByDegree('Saturn', 'Rahu', ctx);
  if (sign === 7) return strongerPlanetByDegree('Mars', 'Ketu', ctx);
  return SIGN_LORD[sign];
}

/** Lord of a sign with the co-lords decided by FUN_004ac5a0 (FUN_004ad470). */
export function signLordByModality(sign: number, ctx: VargaCtx): Graha {
  if (sign === 10) return strongerPlanetByModality('Saturn', 'Rahu', ctx);
  if (sign === 7) return strongerPlanetByModality('Mars', 'Ketu', ctx);
  return SIGN_LORD[sign];
}
