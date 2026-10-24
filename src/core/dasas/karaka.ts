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
// With 7 karakas JHora skips PK (or PiK when CharaKarakaDefinition = 1); that
// path is approximated with the 7-karaka list of basics.ts.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import { charaKarakas } from '../basics';
import { signOf } from '../zodiac';
import { karakaScheme } from './akKendradiGraha';
import { expandDasa, mod12 } from './otherCommon';

export const KARAKA_TITLE = 'Karaka Dasa (chara karaka effects)';

const TWO: Record<Graha, string> = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };

export function karakaDasa(chart: Chart, levels = 2): Period[] {
  const p = chart.positions;
  const ks = charaKarakas(p, karakaScheme(chart));
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
