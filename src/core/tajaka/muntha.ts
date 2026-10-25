// Muntha of a Tajaka chart, ported from the second half of jhora.exe's
// FUN_0041a940 (stores the longitude at doc+0x39e10 and one sign per varga at
// doc+0x39e80[29]; the chart shows it under the label "Muntha").
//
// Everything is taken from the NATAL chart (doc+0x50): the base body is
// DAT_00597f10 (0 = lagna, the default; 1 = Sun, 2 = Moon are set by three doc
// commands at 0x406fa0/0x407030/0x4070c0), its longitude doc+0x150+0x30*base and
// its varga signs doc+0x1827+29*base.  MunthaPreference (dialog 2040, combo 1005;
// default 1) picks the rule:
//   0 "Muntha of rasi chart shown in all vargas":
//       lon = baseLon + 30 * startYears (continuous, 2.5 deg per Tajaka month);
//       every varga shows floor(lon / 30) mod 12.
//   1 "Muntha from each varga chart, with antardasas starting from dasa sign":
//       count = n + month + 60h + 5h + 25m + 2m offsets (TajakaPeriod.signCount);
//       lon = baseLon + 30 * count; varga v shows (natal base sign in v + count) mod 12.
//   2 "... with antardasas starting from dasa lord":
//       varga v: s = (base sign in v + n) mod 12, then for each selected level
//       s = (sign of lord(s) in v + offset) mod 12 (lords via DAT_00591de4);
//       lon = baseLon + 30 * (s_D1 - baseSign_D1).
import type { Chart } from '../chart';
import { norm360, type Graha } from '../positions';
import { SIGN_LORD } from '../lords';
import { vargaSign, type VargaName } from '../vargas';
import { vargaSpec } from '../vargaOptions';
import type { TajakaPeriod } from './annual';

export type MunthaBase = 'Lagna' | 'Sun' | 'Moon';

const mod12 = (x: number) => ((x % 12) + 12) % 12;

function natalLon(natal: Chart, b: Graha | 'Lagna'): number {
  return b === 'Lagna' ? natal.positions.ascendant : natal.positions.grahas[b].lon;
}

export interface Muntha {
  /** muntha longitude (doc+0x39e10) */
  lon: number;
  /** rasi sign 0..11 */
  sign: number;
  /** sign shown in a varga chart */
  signIn(varga: VargaName): number;
}

export function muntha(natal: Chart, period: TajakaPeriod, preference = natal.ini.MunthaPreference, base: MunthaBase = 'Lagna'): Muntha {
  const baseLon = natalLon(natal, base);
  const signOf = (b: Graha | 'Lagna', v: VargaName) => vargaSign(natalLon(natal, b), vargaSpec(v, natal.ini));

  if (preference === 0) {
    const raw = baseLon + 30 * period.startYears;
    const s = mod12(Math.trunc(raw / 30));
    return { lon: norm360(raw), sign: s, signIn: () => s };
  }
  if (preference === 1) {
    const signIn = (v: VargaName) => mod12(signOf(base, v) + period.signCount);
    return { lon: norm360(baseLon + 30 * period.signCount), sign: signIn('D1'), signIn };
  }
  const offs = [period.month, period.sixtyHour, period.fiveHour, period.twentyFiveMin, period.twoMin];
  const signIn = (v: VargaName) => {
    let s = mod12(signOf(base, v) + period.years);
    for (const o of offs) {
      if (o === null) break;
      s = mod12(signOf(SIGN_LORD[s], v) + o);
    }
    return s;
  };
  const s1 = signIn('D1');
  return { lon: norm360(baseLon + 30 * (s1 - signOf(base, 'D1'))), sign: s1, signIn };
}
