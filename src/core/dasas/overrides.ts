// Temporary rasi dasa strengths of the dasa pane's "Options" dialogs (Narayana 2006, Paryaaya
// 2011, Rasi dasa options 2022, Sudasa 2049, Lagnamsaka 2053, Padanaathaamsa 2054, Drigdasa
// 2064): "When you edit birthdata or re-open the chart, strengths will be automatically computed
// again. Until then, what you enter below will be used temporarily." The dialog class
// (FUN_004d4990 / load FUN_004d4b30 / store FUN_004d4c40, and the Narayana-family copies) edits
// the strength tables of the chart shown (doc+0x76d00), per varga:
//  - "Lord of Aquarius" Saturn (7) or Rahu (8), "Lord of Scorpio" Mars (3) or Ketu (9):
//    chart+0x17940/0x17b10 [varga] (0x179b4/0x17b84 for Chara K.N. Rao, 0x17a28/0x17bf8 for
//    Chara Parasara), read by the dasa lord FUN_004ad3f0;
//  - "Stronger of Ar & Li" .. "Vi & Pi": chart+0x5b98 + varga*12 [pair], the table strong7
//    (FUN_004ab810) reads;
//  - "Start dasas from": chart+0x17eb4 [dasa] (Narayana family chart+0x17ce0 [varga]), 12 = the
//    computed sign;
//  - "Does Saturn or Ketu exception apply?": the SK flag (chart+0x173d0 + varga*0x30) of that
//    start sign.
// Here they are a DasaOptions.overrides object the pane keeps until the chart changes; the
// rasi dasa helpers of rasiCommon.ts and narayana.ts consult it through the VargaCtx (dasa lord,
// strong7 / stronger of a sign and its 7th, Saturn/Ketu flag) and the Narayana-type builders
// (Narayana, Lagnamsaka, Padanaathaamsa) take the start sign. Builders that compare signs with
// signStrength.ts directly are not affected.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { VargaCtx } from '../signStrength';
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

/** The overridden Saturn/Ketu flag of the start sign. */
export function skOverride(sign: number, ctx: VargaCtx): 0 | 1 | 2 | undefined {
  const o = ctxOverrides(ctx);
  return o && o.start === sign ? o.sk : undefined;
}

/** "Start dasas from", if set. */
export const startOverride = (ctx: VargaCtx): number | undefined => ctxOverrides(ctx)?.start;

/** The name of a JHora varga index in titles (the CString table 0x8a2874 as FUN_00405100 fills it). */
export function vargaLabel(varga: number, ini?: Partial<JhoraIni>): string {
  const name = JHORA_VARGAS[varga];
  return name ? vargaColumnLabel(name, ini) : JHORA_VARGA_NAMES[varga] ?? '';
}
