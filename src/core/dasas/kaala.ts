// Kaala dasa (FUN_00411820). With the day frame of FUN_004a1350 in ghatis
// (t = birth - sunrise, s = birth - sunset, D = day length, N = night length,
// chart+0x9758/0x9760/0x9768/0x9770; see day.ts) JHora finds a factor k:
//   t <  D/6            (dawn sandhya)   k = (N + D) (t + N/6) / 225
//   t <  5D/6           (day)            k = D (t - D/6) / 225
//   t <  D + N/6        (dusk sandhya)   k = (N + D) (t - 5D/6) / 225
//   s <  5N/6           (night)          k = N (s - N/6) / 225
//   otherwise           (dawn sandhya)   k = (N + D) (s - 5N/6) / 225
// (the first case uses the coming night's length, as JHora does).
//  - 18 maha dasas from birth (no balance): Sun..Ketu with i*k years
//    (i = 1..9), then Sun..Ketu again with i*(8/3 - k) years - 120 in all;
//  - antardasas (explicit, obj+0x8fa8c): for every dasa the same 18 entries
//    (Sun..Ketu twice), each its maha dasa's years / 120 of the period.
// KaalaInDayNightSeparate is not read by this builder.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { bodyPeriod, expandDasa } from './otherCommon';

export const KAALA_TITLE = 'Kaala Dasa (a versatile phalita rasi dasa)';

/** Ghati quantities of the birth's day frame (chart+0x9758..0x9770). */
export function dayGhatis(chart: Chart): { t: number; s: number; D: number; N: number } {
  const d = chart.day, jd = chart.positions.jdUt;
  return { t: (jd - d.sunrise) * 60, s: (jd - d.sunset) * 60, D: (d.sunset - d.sunrise) * 60, N: (d.nextSunrise - d.sunset) * 60 };
}

export function kaalaFactor(chart: Chart): number {
  const { t, s, D, N } = dayGhatis(chart);
  const c = 0.0044444444444444444;
  if (t < D / 6) return (N + D) * (N / 6 + t) * c;
  if (t < D * (5 / 6)) return (t - D / 6) * D * c;
  if (t < N / 6 + D) return (N + D) * (t - D * (5 / 6)) * c;
  if (s < N * (5 / 6)) return (s - N / 6) * N * c;
  return (N + D) * (s - N * (5 / 6)) * c;
}

export function kaalaDasa(chart: Chart, levels = 2): Period[] {
  const k = kaalaFactor(chart);
  const mds = [
    ...Array.from({ length: 9 }, (_, i) => ({ id: i + 1, years: (i + 1) * k })),
    ...Array.from({ length: 9 }, (_, i) => ({ id: i + 1, years: (i + 1) * (2.6666666666666665 - k) })),
  ];
  const subs = () => mds.map((m) => ({ id: m.id, frac: m.years * 0.008333333333333333 }));
  return expandDasa({ mds, subs, make: bodyPeriod }, levels);
}
