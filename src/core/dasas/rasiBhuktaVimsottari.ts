// Rasi-Bhukta Vimsottari dasa (FUN_00411e20), natal chart, default seed Moon
// (DAT_008a1670 = 0) and chart D-1 (DAT_008a4b90 = 0):
//  - maha dasas: Vimsottari's nine from the seed's nakshatra lord with its
//    balance (chart+0x121f8 / +0x122f8), i.e. the regular Vimsottari dasas;
//  - antardasas: twelve signs zodiacally from the sign occupied by the dasa
//    lord, each a twelfth (obj+0x8fa18);
//  - pratyantardasas: FUN_00401c20 special-cases this dasa by its title and
//    lists the eight kakshya lords Saturn, Jupiter, Mars, Sun, Venus, Mercury,
//    Moon, Asc; it copies the duration of the parent level's first entry to
//    all eight, so each lasts as long as a whole antardasa (MD/12). That is
//    reproduced literally. Deeper levels are not meaningful in JHora (it lists
//    the maha dasa lords with maha dasa years) and are not built.
// The title's parenthesis is "of D-1 chart, " verbatim (obj+0x76d38); the
// seed name ("Moon") goes to a separate "Started from" caption.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { vimsottari } from './vimsottari';
import { SIGNS } from '../zodiac';
import { JHORA_VARGA_NAMES, rasiCtx } from './rasiCommon';
import { bodyPeriod, mod12 } from './otherCommon';

export const rasiBhuktaVimsottariTitle = (vargaIndex = 0) => `Rasi-Bhukta Vimsottari Dasa (of ${JHORA_VARGA_NAMES[vargaIndex]} chart, )`;
export const RASI_BHUKTA_VIMSOTTARI_TITLE = rasiBhuktaVimsottariTitle();

const KAKSHYA = [7, 5, 3, 1, 6, 4, 2, 0];

/** @param levels at most 3 (maha, antar, pratyantar) */
export function rasiBhuktaVimsottariDasa(chart: Chart, levels = 2, vargaIndex = 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  return vimsottari(chart.positions.grahas.Moon.lon, 1).map((md) => {
    if (levels < 2) return md;
    const len = (md.end - md.start) / 12;
    const from = ctx.sign(md.lord);
    const children = Array.from({ length: 12 }, (_, i): Period => {
      const ad: Period = { lord: 'Sun', label: SIGNS[mod12(from + i)], start: md.start + i * len, end: md.start + (i + 1) * len };
      if (levels >= 3) ad.children = KAKSHYA.map((id, k) => bodyPeriod(id, ad.start + k * len, ad.start + (k + 1) * len));
      return ad;
    });
    return { ...md, children };
  });
}
