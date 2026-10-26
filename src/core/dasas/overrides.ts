// Temporary rasi dasa strengths of the dasa pane's "Options" dialogs (Narayana 2006, Paryaaya
// 2011, Rasi dasa options 2022, Sudasa 2049, Lagnamsaka 2053, Padanaathaamsa 2054, Drigdasa
// 2064): "When you edit birthdata or re-open the chart, strengths will be automatically computed
// again. Until then, what you enter below will be used temporarily." The dialog classes (load /
// store: 2006 FUN_004d3a70 / FUN_004d3b40, 2049 FUN_004d5340 / FUN_004d5400, 2022 FUN_004d4b30 /
// 0x4d4d06.., loads of 2053 0x4d3320, 2054 0x4d3f80, 2011 0x4d44a0, 2064 0x4d2e40) edit the
// strength tables of the chart shown (doc+0x76d00), per varga:
//  - "Lord of Aquarius" Saturn (7) or Rahu (8), "Lord of Scorpio" Mars (3) or Ketu (9):
//    chart+0x17940/0x17b10 [varga], read by the dasa lord FUN_004ad3f0; for Chara K.N. Rao (slot
//    34) the dialog edits 0x179b4/0x17b84 (FUN_004ad430, read by its years), for Chara Parasara
//    (33) 0x17a28/0x17bf8 (FUN_004ad470, read by its years and by Drigdasa's non-Parasara years);
//  - "Stronger of Ar & Li" .. "Vi & Pi": chart+0x5b98 + varga*0x30 [pair], the table strong7
//    (FUN_004ab810) reads (FUN_004ab890, the direct comparison, is never overridden), and next to
//    each pair a "No / Saturn / Ketu exception" combo: the SK flag (chart+0x173d0 + varga*0x30)
//    of the sign chosen as the stronger;
//  - "Start dasas from" (12 "Use the default"): Narayana chart+0x17ce0 [varga], Lagnamsaka
//    0x17d54 [varga], Padanaathaamsa 0x17dc8 [varga], Paryaaya 0x17e40, Sudasa 0x17e3c, the 2022
//    dasas chart+0x17eb4 [dasa slot]. The builders that read them: Narayana (FUN_00414060
//    0x414251), Lagnamsaka (0x414edf), Padanaathaamsa (0x415393), Paryaaya (0x41635d ..),
//    Sudasa (0x415888, the first group only), and from 0x17eb4: Lagna Kendradi (0x415c14),
//    AK Kendradi (0x415fb2), Chara Parasara (0x41734d), Chara K.N. Rao (0x417b0c), Yogardha
//    (0x4177e9), Niryaana Shoola (0x4080a3), Brahma (0x408395), Navamsa (0x407c36). Trikona,
//    Chara (Rangacharya) and Drigdasa read none (Drigdasa's dialog has no such combo); Sthira
//    (FUN_00408580 0x40860f) reads Narayana's D-1 start chart+0x17ce0[0] instead of its own;
//  - "Does Saturn or Ketu exception apply?" (3 "Last setting"): the SK flag of that start sign.
//    The store writes it BEFORE the six pair combos, so for a sign that is the stronger of its
//    pair the pair combo (which holds the SK flag of the stronger sign when the dialog opened)
//    wins.
// Here they are a DasaOptions.overrides object the pane keeps until the chart changes; the
// rasi dasa helpers of rasiCommon.ts and narayana.ts consult it through the VargaCtx (dasa lord,
// strong7 / stronger of a sign and its 7th, Saturn/Ketu flag) and the builders listed above take
// the start sign. Builders that compare signs with signStrength.ts directly are not affected,
// as in JHora. JHora's tables are per chart and varga (shared by every dasa of that varga, the
// start tables excepted); here the pane keeps one object per chart and dasa.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import { strongerSign, type VargaCtx } from '../signStrength';
import type { JhoraIni } from '../../settings/generated';
import { vargaColumnLabel } from '../vargaOptions';
import { JHORA_VARGA_NAMES, JHORA_VARGAS } from './rasiCommon';

export interface StrengthOverrides {
  /** "Start dasas from" (a sign; absent = computed) */
  start?: number;
  /** "Lord of Aquarius" */
  aqLord?: 'Saturn' | 'Rahu';
  /** "Lord of Scorpio" */
  scLord?: 'Mars' | 'Ketu';
  /** "Stronger of Ar & Li" .. "Vi & Pi": the stronger sign of pair i (i or i + 6), null = computed */
  stronger?: (number | null)[];
  /** "Does Saturn or Ketu exception apply?" for the start sign: 0 no, 1 Saturn's, 2 Ketu's */
  sk?: 0 | 1 | 2;
  /** the exception combo of pair i (the SK flag of its stronger sign), null = as computed */
  pairSk?: (0 | 1 | 2 | null)[];
  /** Narayana dasa's D-1 "Start dasas from" (chart+0x17ce0[0]), which Sthira dasa reads */
  narayanaStart?: number;
}

const OV = Symbol('strengthOverrides');
type WithOv<T> = T & { [OV]?: StrengthOverrides };

/** The chart with temporary strengths (none: the chart itself). */
export function withOverrides(chart: Chart, ov?: StrengthOverrides): Chart {
  return ov && Object.keys(ov).length ? ({ ...chart, [OV]: ov } as WithOv<Chart>) : chart;
}
export const chartOverrides = (chart: Chart): StrengthOverrides | undefined => (chart as WithOv<Chart>)[OV];

/** A VargaCtx carrying the chart's overrides. */
export function attachOverrides<T extends VargaCtx>(ctx: T, chart: Chart): T {
  const ov = chartOverrides(chart);
  return ov ? ({ ...ctx, [OV]: ov } as WithOv<T>) : ctx;
}
export const ctxOverrides = (ctx: VargaCtx): StrengthOverrides | undefined => (ctx as WithOv<VargaCtx>)[OV];

const mod12 = (x: number) => ((x % 12) + 12) % 12;

/** The overridden stronger of a sign and its 7th, if `a`, `b` are such a pair and it is set. */
export function pairOverride(a: number, b: number, ctx: VargaCtx): number | undefined {
  const s = ctxOverrides(ctx)?.stronger;
  if (!s || mod12(a - b) !== 6) return undefined;
  const v = s[mod12(a) % 6];
  return v === null || v === undefined ? undefined : v;
}

/** The overridden lord of Aquarius / Scorpio. */
export function lordOverride(sign: number, ctx: VargaCtx): Graha | undefined {
  const o = ctxOverrides(ctx);
  return sign === 10 ? o?.aqLord : sign === 7 ? o?.scLord : undefined;
}

/**
 * The overridden SK flag of `sign` (FUN_004d3b40's store order): the stronger sign of each pair
 * gets its pair combo (unset: the flag the combo was loaded with, i.e. that of the computed
 * stronger sign); otherwise the start sign gets "Does Saturn or Ketu exception apply?".
 * @param computed the SK flag without overrides (FUN_004ab2a0)
 */
export function skOverride(sign: number, ctx: VargaCtx, computed: (s: number) => 0 | 1 | 2): 0 | 1 | 2 | undefined {
  const o = ctxOverrides(ctx);
  if (!o) return undefined;
  const i = mod12(sign) % 6;
  const comp = strongerSign(i, i + 6, ctx);
  if (mod12(sign) === (o.stronger?.[i] ?? comp)) return o.pairSk?.[i] ?? computed(comp);
  return o.start === sign && o.sk !== undefined ? o.sk : undefined;
}

/** "Start dasas from", if set. */
export const startOverride = (ctx: VargaCtx): number | undefined => ctxOverrides(ctx)?.start;
/** Narayana dasa's D-1 start (chart+0x17ce0[0], read by Sthira dasa), if set. */
export const narayanaStartOverride = (ctx: VargaCtx): number | undefined => ctxOverrides(ctx)?.narayanaStart;

/** The name of a JHora varga index in titles (the CString table 0x8a2874 as FUN_00405100 fills it). */
export function vargaLabel(varga: number, ini?: Partial<JhoraIni>): string {
  const name = JHORA_VARGAS[varga];
  return name ? vargaColumnLabel(name, ini) : JHORA_VARGA_NAMES[varga] ?? '';
}
