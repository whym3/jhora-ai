// Karaka dasa (FUN_004139a0), default 8-karaka scheme (chart+0x18000 = 8):
//  - one dasa per chara karaka in karaka order (AK, AmK, BK, MK, PiK, PK, GK,
//    DK), labelled "<karaka> <planet>" with JHora's two-letter planet names
//    (format "%s %s", tables 0x8a2314 / 0x8a4684), e.g. "AK Su";
//  - years: houses from the lagna to the karaka minus one (D-1 signs), 12 when
//    it is in the lagna; a second cycle follows with 12 minus those years;
//    from birth, no balance;
//  - antardasas (explicit): first cycle - the karakas starting from the next
//    one and ending with the dasa's own karaka, each its years over the
//    first-cycle total; second cycle - the same order, shares (12 - years)
//    over (12 n - total).
// With 7 karakas the builder walks the karaka slots chart+0x17fe0 skipping PiK
// when CharaKarakaDefinition (0x8a4ba8) = 1, else PK. FUN_004a4c30 fills those
// slots (karakaSlots below) from Sun..Saturn (and Rahu, counted from the end of
// its sign, in the 8-karaka scheme) sorted by advancement, ties keeping the body
// order: definition 0: the 8 karakas; 1: slots AK..MK the first four, PiK empty,
// PK, GK, DK the rest; 2: PiK the fifth planet and PK repeating MK, so the dasas
// are the same planets with the fifth labelled PiK. Definition 3 sorts the seven
// planets and, unless two consecutive ones have the same whole degree
// (trunc), fills the slots as 2; with such a tie it switches to 8 karakas
// (chart+0x18000 = 8): Rahu is inserted before the first planet with less
// advancement, then for k = 0..5, when slots k+1 and k+2 hold planets of the
// same whole degree, the planet in k+1 moves down to k+2 and k+1 takes the
// natural karaka of that slot: AmK Mercury, BK Mars, MK the stronger of Moon and
// Mars, PiK the stronger of Sun and Venus, PK Saturn, GK Mercury (stack table at
// 0x4a4da7; "stronger" = FUN_004ac960: more planets in its sign, then
// FUN_004ac7d0's dignity order, deities.ts strongerByDignity). A planet can so
// appear twice.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { KARAKA_NAMES } from '../basics';
import { signOf } from '../zodiac';
import { strongerByDignity } from '../deities';
import type { VargaCtx } from '../signStrength';
import { BODY, expandDasa, mod12 } from './otherCommon';

export const KARAKA_TITLE = 'Karaka Dasa (chara karaka effects)';

const TWO: Record<Graha, string> = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };

/** FUN_004ac960: the stronger of two planets (D-1): more of the nine planets in its sign, then by dignity. */
function strongerConjoined(a: Graha, b: Graha, chart: Chart): Graha {
  const sign = (g: Graha) => signOf(chart.positions.grahas[g].lon);
  const count = (s: number) => (BODY.slice(1) as Graha[]).filter((g) => sign(g) === s).length;
  const ca = count(sign(a)), cb = count(sign(b));
  if (cb < ca) return a;
  if (ca < cb) return b;
  const ctx: VargaCtx = { sign, degree: (g) => chart.positions.grahas[g].lon % 30 };
  return strongerByDignity(a, b, ctx);
}

/** FUN_004a4c30: the eight karaka slots chart+0x17fe0 (JHora body ids, 0 = empty) and chart+0x18000. */
export function karakaSlots(chart: Chart): { scheme: 7 | 8; slots: number[] } {
  const g = chart.positions.grahas;
  const def = chart.ini.CharaKarakaDefinition ?? 0;
  const deg = (id: number) => (id === 8 ? 30 - (g.Rahu.lon - Math.floor(g.Rahu.lon / 30) * 30) : g[BODY[id]!].lon - Math.floor(g[BODY[id]!].lon / 30) * 30);
  const insert = (a: number[], id: number) => {
    const k = a.findIndex((x) => deg(x) < deg(id));
    if (k < 0) a.push(id); else a.splice(k, 0, id);
  };
  const sorted = (count: number) => {
    const a = [1];
    for (let id = 2; id <= count; id++) insert(a, id);
    return a;
  };
  if (def !== 3) {
    const a = sorted(def === 0 ? 8 : 7);
    if (def === 0) return { scheme: 8, slots: a };
    return { scheme: 7, slots: [a[0], a[1], a[2], a[3], def === 1 ? 0 : a[4], def === 1 ? a[4] : a[3], a[5], a[6]] };
  }
  const a = sorted(7);
  const whole = (id: number) => Math.trunc(deg(id));
  let tie = false;
  for (let k = 0; k < 6; k++) if (whole(a[k + 1]) === whole(a[k])) tie = true;
  if (!tie) return { scheme: 7, slots: [a[0], a[1], a[2], a[3], a[4], a[3], a[5], a[6]] };
  insert(a, 8);
  const id = (x: Graha) => BODY.indexOf(x);
  const natural = [4, 3, id(strongerConjoined('Moon', 'Mars', chart)), id(strongerConjoined('Sun', 'Venus', chart)), 7, 4];
  for (let k = 0; k < 6; k++) {
    if (whole(a[k + 2]) === whole(a[k + 1])) { a[k + 2] = a[k + 1]; a[k + 1] = natural[k]; }
  }
  return { scheme: 8, slots: a };
}

export function karakaDasa(chart: Chart, levels = 2): Period[] {
  const p = chart.positions;
  const { scheme, slots } = karakaSlots(chart);
  // FUN_004139a0: all eight slots, or seven skipping PiK (definition 1) / PK (otherwise)
  const skip = scheme === 8 ? -1 : chart.ini.CharaKarakaDefinition === 1 ? 4 : 5;
  const ks = slots.flatMap((b, i) => (i === skip ? [] : [{ karaka: KARAKA_NAMES[i][0], planet: BODY[b]! }]));
  const n = ks.length;
  const lagna = signOf(p.ascendant);
  const years = ks.map((k) => mod12(signOf(p.grahas[k.planet].lon) - lagna) || 12);
  const total = years.reduce((a, y) => a + y, 0);
  const mds = [
    ...years.map((y, i) => ({ id: i, years: y })),
    ...years.map((y, i) => ({ id: i + n, years: 12 - y })),
  ];
  const subs = (id: number) => {
    const i = id % n, second = id >= n;
    return Array.from({ length: n }, (_, k) => {
      const j = (i + 1 + k) % n;
      return second ? { id: j + n, frac: (12 - years[j]) / (12 * n - total) } : { id: j, frac: years[j] / total };
    });
  };
  const make = (id: number, start: number, end: number): Period => {
    const k = ks[id % n];
    return { lord: k.planet, label: `${k.karaka} ${TWO[k.planet]}`, start, end };
  };
  return expandDasa({ mds, subs, make }, levels);
}
