// Narayana dasa (Jaimini), with the rules JHora 8.0 applies by default:
//  - the dasas start from the stronger of lagna and the 7th;
//  - the sequence follows FUN_00414060's tables (rasiCommon
//    narayanaTypeSequence): movable signs go sign by sign, fixed signs every 6th
//    sign, dual signs take the trines and then move on; Saturn in the start sign
//    forces zodiacal sign-by-sign order, Ketu reverses the direction;
//  - years = signs counted from the dasa sign to its lord (forward for odd-
//    footed signs Ar..Ge and Li..Sg, backward for the others) minus one, 12 if
//    the lord is in the sign, +1 exalted, -1 debilitated; the second cycle is
//    12 minus the first;
//  - antardasas run sign by sign from the sign holding the lord of the stronger
//    of the dasa sign and its 7th, in that sign's parity direction with the
//    Saturn/Ketu flag of the stronger sign, each a twelfth of the dasa.
// The combo "Normal / Paka / Sama / Ayur Narayana Dasa" of dialog 2006 (control 1013,
// FUN_0044dca0; session globals DAT_00597eec Paka, DAT_00597eed Sama, DAT_00597eee Ayur, not in
// jhora.ini) changes FUN_00414060:
//  - Paka (0x414233, 0x414506, 0x414560): no strong7 - the dasas start from the lagna (or the
//    D-n seed sign) itself, the years are FUN_004ace40's (pakaYears) and the antardasas start
//    from the lord of the dasa sign itself (the SK flag of the dasa sign); title "Paka " + title;
//  - Sama (0x4144f5, 0x414429): every dasa lasts 10 years and only the 12 dasas of the first
//    cycle are listed (obj+0x78aa8 = 12); title "Sama " + title;
//  - Ayur (0x44dd8b): the normal dasa, but OK rewrites the nodes' exaltation / debilitation
//    entries (0x591e54/58/7c/80) to Ta / Le / Sc / Aq unless NodalExaltationParasara is set
//    (DAT_008a4c43), and puts the default back (FUN_004b9280(0)) when another kind is chosen.
//    JHora's tables are global, so every later calculation follows; here only the Narayana
//    dasa built with kind 3 sees them.
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { SIGNS } from '../zodiac';
import { DEBILITATION, EXALTATION, signLordByDistance, strongerSign, type VargaCtx } from '../signStrength';
import { narayanaTypeSequence, skFlag } from './rasiCommon';
import { lordOverride, pairOverride, startOverride } from './overrides';

/** strongerSign / signLordByDistance with the temporary strengths of overrides.ts. */
const stronger = (a: number, b: number, ctx: VargaCtx) => pairOverride(a, b, ctx) ?? strongerSign(a, b, ctx);
const lordOf = (sign: number, ctx: VargaCtx): Graha => lordOverride(sign, ctx) ?? signLordByDistance(sign, ctx);

const mod12 = (x: number) => ((x % 12) + 12) % 12;
const ODD_FOOTED = new Set([0, 1, 2, 6, 7, 8]);

export function narayanaYears(sign: number, ctx: VargaCtx): number {
  const lord: Graha = lordOf(sign, ctx);
  const ls = ctx.sign(lord);
  if (ls === sign) return 12;
  let n = ODD_FOOTED.has(sign) ? mod12(ls - sign) : mod12(sign - ls);
  if (EXALTATION[lord] === ls) n += 1;
  if (DEBILITATION[lord] === ls) n -= 1;
  return mod12(n) === 0 && n !== 0 ? 12 : n;
}

/**
 * FUN_004ace40, the Paka dasa years: counted from the lord's sign p to the dasa sign (forward when
 * floor(p/3) is even, else backward), 12 if the lord is in the sign, 10 if the sign is the 7th from
 * the lord, +1 exalted (below 12), -1 debilitated (above 0).
 */
export function pakaYears(sign: number, ctx: VargaCtx): number {
  const lord = lordOf(sign, ctx);
  const p = ctx.sign(lord);
  const d = Math.floor(p / 3) % 2 === 0 ? sign - p : p - sign;
  let y = mod12(d) === 0 ? 12 : mod12(d);
  if (mod12(p + 6) === sign) y = 10;
  if (EXALTATION[lord] === p && y < 12) y++;
  if (DEBILITATION[lord] === p && y > 0) y--;
  return y;
}

export interface NarayanaDasa { title: string; periods: Period[] }
/** Dialog 2006's combo: 0 Normal, 1 Paka, 2 Sama, 3 Ayur Narayana Dasa. */
export type NarayanaKind = 0 | 1 | 2 | 3;
export const NARAYANA_KINDS = ['Normal Narayana Dasa', 'Paka Narayana Dasa', 'Sama Narayana Dasa', 'Ayur Narayana Dasa'];

/** Ayur Narayana dasa's node entries (0x44dd8b): exalted Ta / Le, debilitated Sc / Aq. */
function withAyurNodes<T>(f: () => T): T {
  const saved = [EXALTATION.Rahu, EXALTATION.Ketu, DEBILITATION.Rahu, DEBILITATION.Ketu];
  if (saved[0] === 1) return f(); // Rahu already in Ta: NodalExaltationParasara (DAT_008a4c43), left alone
  EXALTATION.Rahu = 1; EXALTATION.Ketu = 4; DEBILITATION.Rahu = 7; DEBILITATION.Ketu = 10;
  try { return f(); } finally { [EXALTATION.Rahu, EXALTATION.Ketu, DEBILITATION.Rahu, DEBILITATION.Ketu] = saved; }
}

/**
 * @param lagna the seed sign (D-1 lagna, Tajaka Muntha or the D-n sign of registry.ts narayanaOf)
 * @param kind  dialog 2006's Normal / Paka / Sama / Ayur combo
 */
export function narayanaDasa(lagna: number, ctx: VargaCtx, varga = 'D-1', levels = 2, kind: NarayanaKind = 0): NarayanaDasa {
  if (kind === 3) return withAyurNodes(() => narayanaDasa(lagna, ctx, varga, levels, 0));
  const paka = kind === 1, sama = kind === 2;
  const start = startOverride(ctx) ?? (paka ? lagna : stronger(lagna, mod12(lagna + 6), ctx));
  const seq = narayanaTypeSequence(start, ctx);
  const first = seq.map((s) => (sama ? 10 : paka ? pakaYears(s, ctx) : narayanaYears(s, ctx)));
  const periods: Period[] = [];
  let t = 0;
  for (let cycle = 0; cycle < (sama ? 1 : 2); cycle++) {
    seq.forEach((s, i) => {
      const years = cycle === 0 ? first[i] : 12 - first[i];
      periods.push(narayanaAntardasas({ lord: 'Sun', label: SIGNS[s], start: t, end: t + years }, s, ctx, levels - 1, paka));
      t += years;
    });
  }
  const title = `Narayana Dasa of ${varga} chart (a versatile phalita rasi dasa)`;
  return { title: paka ? `Paka ${title}` : sama ? `Sama ${title}` : title, periods };
}

/** @param paka Paka Narayana dasa: from the lord of the dasa sign itself (0x41457d) */
export function narayanaAntardasas(p: Period, sign: number, ctx: VargaCtx, levels: number, paka = false): Period {
  if (levels <= 0) return p;
  const low = sign % 6;
  const strong = paka ? sign : stronger(low, low + 6, ctx);
  const from = ctx.sign(lordOf(strong, ctx));
  const dir = sequenceDirection(from, ctx, strong);
  const len = (p.end - p.start) / 12;
  const children = Array.from({ length: 12 }, (_, i) => {
    const s = mod12(from + dir * i);
    return narayanaAntardasas({ lord: 'Sun', label: SIGNS[s], start: p.start + i * len, end: p.start + (i + 1) * len }, s, ctx, levels - 1, paka);
  });
  return { ...p, children };
}

/**
 * Parity direction of `sign` with the Saturn/Ketu flags of FUN_004ab2a0 for
 * `flagSign` (default the same sign): Saturn there forces forward, Ketu
 * reverses, both: the stronger by dignity decides.
 */
export function sequenceDirection(sign: number, ctx: VargaCtx, flagSign = sign): 1 | -1 {
  const dir: 1 | -1 = sign % 2 === 0 ? 1 : -1;
  const f = skFlag(flagSign, ctx);
  return f === 1 ? 1 : f === 2 ? (-dir as 1 | -1) : dir;
}
