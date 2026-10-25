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
// slots from Sun..Saturn by advancement: with definition 1 slots AK..MK take
// the first four, PiK is empty and PK, GK, DK the rest (the 7-karaka list of
// basics.ts); with 2 (and 3 when no two degrees tie) PiK takes the fifth planet
// and PK repeats MK, so the dasas are the same planets with the fifth labelled
// PiK. (Definition 3 with tied degrees switches to 8 karakas with natural
// karaka substitutes; not ported.)
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
  const scheme = karakaScheme(chart);
  const pikFifth = scheme === 7 && chart.ini.CharaKarakaDefinition !== 1;
  const ks = charaKarakas(p, scheme).map((k) => (pikFifth && k.karaka === 'PK' ? { ...k, karaka: 'PiK' } : k));
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
