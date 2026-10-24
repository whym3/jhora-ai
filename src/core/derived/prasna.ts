// Miscellany > Prasna (Horary): CPrasnaFormView, dialog 2033, message map 0x54d460, DDX 0x470830.
//
// Form: edit 100 (+0x7c, 1..108) + button 1001 "Prasna-108 Mode" (0x4708f0 -> FUN_00418100),
//       edit 101 (+0x80, 1..249) + button 1004 "Prasna-249 Mode (KP)" (0x470940 -> FUN_00418280),
//       edit 1006 (+0x84, 1..1800) + button 1012 "Nadi Prasna Mode" (0x470990 -> FUN_004184e0),
//       radio 201 (+0x88) "Just replace lagna with Prasna Lagna" / 202 (+0x8c) "Leave lagna as it
//       is and show Prasna Lagna (PLag) as a separate body" -> ReplaceLagnaInPrasna (byte 0x884834,
//       default 0 = separate body), check 1002 (+0x90) "Compress dasas of the prasna chart" with
//       edits 102 (+0x98, years of 365.24219 days) and 103 (+0xa0, plus days), button 1000 Back.
// Each routine copies the NATAL chart (FUN_0049d660 on doc+0x50: same moment, the querent casts
// the chart for the time of the question), names it ("Prasna-108 (%d)" 0x577ef4, "Prasna-249 (%d)"
// 0x577f04, "Nadi Prasna (%d)" 0x577f14), sets kind doc+0x76d04 = 6, stores the compression
// span (years x 365.24219 + days -> DAT_005922b0, flag DAT_008a4b68) and the special point
// "Prasna Lagna" (0x577ee4, doc+0x39dd8) with longitude doc+0x39e10:
//   108:  k = n-1: sign k / 9, navamsa k % 9 -> 30 sign + (nav + 0.5) x 3deg20'   (navamsa centre)
//   249:  start of the n-th KP division: the 27 x 9 Vimsottari subs (years 7,20,6,10,7,18,16,19,17
//         of 1/9 degree, Ketu first) split at the 12 sign boundaries, 249 divisions in all
//   Nadi: sign k / 150; with D150Preference = 1 (default, unequal nadiamsas, 1/504 degree bounds)
//         the centre (b[i] + b[i+1]) / 1008 of nadiamsa i = k % 150, else i x 0.2 + 0.1
// FUN_00403120(replace) then replaces the lagna when ReplaceLagnaInPrasna is set.
import NADIAMSA_BOUNDS from '../data/nadiamsa-bounds.json';

export type PrasnaMode = '108' | '249' | 'nadi';
export const PRASNA_LIMIT: Record<PrasnaMode, number> = { '108': 108, '249': 249, nadi: 1800 };
export const PRASNA_LABEL: Record<PrasnaMode, (n: number) => string> = {
  '108': (n) => `Prasna-108 (${n})`,
  '249': (n) => `Prasna-249 (${n})`,
  nadi: (n) => `Nadi Prasna (${n})`,
};

const KP_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17];

/** FUN_00418280's table: start of each of the 249 KP divisions, in 1/9 degree. */
export const KP249: number[] = (() => {
  const b = [0];
  let boundary = 270, signStart = 0, sub = 0, nak = 0;
  while (b.length < 250) {
    const next = KP_YEARS[(sub + nak) % 9] + b[b.length - 1];
    if (boundary < next) { boundary += 270; signStart += 270; b.push(signStart); }
    else if (next === boundary) { signStart += 270; boundary += 270; }
    if (++sub > 8) { sub = 0; nak = (nak + 1) % 9; }
    b.push(next);
  }
  return b.slice(0, 249);
})();

/** Prasna Lagna longitude for a number (1-based). */
export function prasnaLagna(mode: PrasnaMode, n: number, d150Preference = 1): number {
  if (!Number.isInteger(n) || n < 1 || n > PRASNA_LIMIT[mode]) throw new Error(`Enter a number between 1 and ${PRASNA_LIMIT[mode]} (inclusive).`);
  const k = n - 1;
  if (mode === '108') return Math.trunc(k / 9) * 30 + ((k % 9) + 0.5) * 3.333333333333333;
  if (mode === '249') return KP249[k] * 0.1111111111111111;
  const i = k % 150;
  const deg = d150Preference === 0 ? i * 0.2 + 0.1 : ((NADIAMSA_BOUNDS[i + 1] ?? 15120) + NADIAMSA_BOUNDS[i]) * 0.000992063492063492;
  return Math.trunc(k / 150) * 30 + deg;
}

export interface PrasnaInput {
  mode: PrasnaMode;
  n: number;
  /** ReplaceLagnaInPrasna (radio 201); default from ini */
  replace?: boolean;
  /** check 1002 + edits 102/103 */
  compress?: { years: number; days: number } | null;
}

/** Compression span in days (edits 102/103). */
export const prasnaSpanDays = (c: { years: number; days: number }) => c.years * 365.24219 + c.days;
