// The Bhava/Chalit chakra: JHora's varga index 28 (chart menu 103 "Bhava chakra or Chalit chakra",
// 33330..33362 "Based on rasi (D-1)" .. "Based on dwadasa-dwadasamsa (D-144)", 33353 options;
// menus 138/153 item 33009).
//
// jhora.exe facts:
// * FUN_004a76b0 (part of the chart calculation) writes the "sign" of every body 0..104 in the
//   bhava chart to chart+0x17f3+b*0x1d (the varga-28 column of the per-varga sign table
//   chart+0x17d7). Globals: BhavaChartVarga DAT_008a4b8c (JHora varga index 0..22, the chart the
//   bhavas are taken from), BhavaChartRef DAT_00592338 (body index 0..46 of the reference),
//   HouseCuspsInMiddle DAT_005922bd, HousesFromNodesReversed DAT_0059233c (ini loader 0x4e07e8..
//   0x4e08d2, all read and written as they are).
//   - BhavaChartVarga 0 and BhavaChartRef 0 (Lagna): the house spans of the chosen house system
//     (doc+0x21bb8, 12 x 0x98: start at +0x28, end at +0x88; FUN_004a30c0 = core/kpHouses.ts
//     houseSpans) are searched in order 1..12 with FUN_004ba9e0, "body in house" =
//     (lon - start) mod 360 <= (end - start) mod 360 (both ends inclusive, the first match wins);
//     the lagna is always house 1. Sign = (lagna's rasi + house - 1) mod 12.
//   - otherwise: sign = the body's sign in that varga (chart+0x17d7+varga), then shifted by the
//     degrees inside the sign in the varga chart (FUN_004a1260 + FUN_004c1ac0: deg + min/60 +
//     sec/3600) of the body (d) and of the reference (r):
//       HouseCuspsInMiddle:  r < 15: +1 when d >= r + 15;  r >= 15: -1 when d < r - 15
//       else, HousesFromNodesReversed and the reference is Rahu or Ketu: +1 when d > r
//       else:                -1 when d < r
//     i.e. 30-degree bhavas beginning at (or centred on) the reference's degree.
//   Bodies without a longitude of their own (arudhas 59..104 with the default sign-based
//   arudhas, DAT_008a4c18 = 0: FUN_004a3800 writes only their sign bytes) keep the zero
//   longitude the chart constructor (0x4a1320) gives every body: in the house path they fall in
//   the house holding 0 deg Aries, in the varga path their degree is 0. Ported as JHora does it.
// * The varga-28 captions (0x405319): long name "Bhava/Chalit" (0x8a4110[28]), short name
//   "D-<n> (<ref>)" from the per-varga prefixes "D-1 (", "D-9 (", ... and the reference's short
//   name (0x8a44e8: 0x8a4350 "Asc", "Sun", "Moon", ... or, with Sanskrit names 0x8a4ba4, 0x8a41b8
//   "Lag", "Sury", ...), e.g. "D-1 (Moon)" with the defaults.
// * Command 33353 (CMainFrame 0x4e9330) opens dialog 2068 "Choose the Reference for Bhava/Chalit
//   Chakra" (class 0x4cfa40, DDX 0x4cfb30, OnInitDialog 0x4cfbb0): combo 1003 = BhavaChartRef
//   (CBIndex; filled with the body names 0x8a4b54[0..46], 0..70 with longitude based arudhas),
//   combo 1004 = BhavaChartVarga (DLGINIT "Rasi (D-1)" .. "Dwadasamsa-Dwadasamsa (D-144)"),
//   check 1001 = HouseCuspsInMiddle, check 1002 = HousesFromNodesReversed. On OK the four
//   globals are stored and every chart is recomputed (0x403060).
// * Dialog 2060 "Choose the reference for houses" (33248, 0x454ff0) is a different setting
//   (DAT_008846d0, not saved, reset when a chart is opened); not ported (houses from lagna).
// * Defaults (static data / first jhora.ini): BhavaChartVarga 0, BhavaChartRef 2 (Moon),
//   HouseCuspsInMiddle 1, HousesFromNodesReversed 1. "Restore default calculation options"
//   (0x4e5bc7) sets BhavaChartRef 0 instead.
import type { ChakraChart } from './chakras/common';
import { bodyLongitude, JHORA_BODIES } from './chakras/common';
import type { Chart } from './chart';
import { BODY_COUNT, bodySigns } from './chartBodies';
import { houseOptions, houseSpans, type HouseSpan } from './kpHouses';
import { norm360 } from './positions';
import { vargaLongitude } from './vargas';
import { VARGA_INDEX, VARGA_PARTS, vargaSpec } from './vargaOptions';
import type { Sweph } from '../sweph';
import { DEFAULTS, type JhoraIni } from '../settings/generated';

/** JHora's varga index of the Bhava/Chalit chakra (DisplayVarga value). */
export const BHAVA_VARGA_INDEX = 28;
/** Long name (0x8a4110[28]). */
export const BHAVA_LONG_NAME = 'Bhava/Chalit';

/** Reference short names (0x8a4350, the table used without Sanskrit names). */
export const BHAVA_REF_SHORT = [
  'Asc', 'Sun', 'Moon', 'Mars', 'Merc', 'Jup', 'Ven', 'Sat', 'Rah', 'Ket', 'Ura', 'Nep', 'Plu', 'BL', 'HL', 'GL', 'VGL', 'PPL',
  'SL', 'IL', 'BB', 'Ku', 'Dhu', 'Vya', 'PaV', 'ICh', 'UpK', 'Kal', 'Mri', 'APr', 'YGh', 'Mnd', 'Glk', 'PS', 'DS', 'MS', 'STS',
  'TS', 'YS', 'RTS', 'KS', 'BS', 'TS', 'CS', 'PS', 'YO', 'AY', 'VL',
];

/** Dialog 2068 combo 1004 (DLGINIT), by JHora varga index. */
export const BHAVA_VARGA_LABELS = [
  'Rasi (D-1)', 'Navamsa (D-9)', 'Hora (D-2)', 'Drekkana (D-3)', 'Chaturthamsa (D-4)', 'Panchamsa (D-5)', 'Shashthamsa (D-6)',
  'Saptamsa (D-7)', 'Ashtamsa (D-8)', 'Dasamsa (D-10)', 'Rudramsa (D-11)', 'Dwadasamsa (D-12)', 'Shodasamsa (D-16)',
  'Vimsamsa (D-20)', 'Siddhamsa (D-24)', 'Nakshatramsa (D-27)', 'Trimsamsa (D-30)', 'Khavedamsa (D-40)', 'Akshavedamsa (D-45)',
  'Shashtyamsa (D-60)', 'Navanavamsa (D-81)', 'Ashtottaramsa (D-108)', 'Dwadasamsa-Dwadasamsa (D-144)',
];

/** Dialog 2068 combo 1003: body names 0x8a4b54[0..46]. */
export const BHAVA_REF_LABELS = JHORA_BODIES.slice(0, 47).map(([name]) => name);

/** The controls of dialog 2068, in dialog order, with the ini key each one edits. */
export const BHAVA_DIALOG = {
  title: 'Choose the Reference for Bhava/Chalit Chakra',
  ref: { id: 1003, key: 'BhavaChartRef', options: BHAVA_REF_LABELS },
  middle: {
    id: 1001, key: 'HouseCuspsInMiddle',
    label: 'Lagna is in the middle of the first house.\n(Leave it unchecked if you want lagna at the beginning of the first house.)',
  },
  nodes: { id: 1002, key: 'HousesFromNodesReversed', label: 'Bhavas from Rahu and Ketu are reckoned anti-zodiacally.' },
  varga: { id: 1004, key: 'BhavaChartVarga', options: BHAVA_VARGA_LABELS },
} as const;

export interface BhavaSettings {
  /** JHora varga index 0..22 */
  varga: number;
  /** reference body index 0..46 */
  ref: number;
  middle: boolean;
  nodesReversed: boolean;
}

const num = (ini: Partial<JhoraIni>, k: keyof JhoraIni) => Number(ini[k] ?? DEFAULTS[k]);

export function bhavaSettings(ini: Partial<JhoraIni>): BhavaSettings {
  return {
    varga: num(ini, 'BhavaChartVarga'),
    ref: num(ini, 'BhavaChartRef'),
    middle: num(ini, 'HouseCuspsInMiddle') !== 0,
    nodesReversed: num(ini, 'HousesFromNodesReversed') !== 0,
  };
}

/** Short caption of varga 28 (0x405319): "D-1 (Moon)". */
export function bhavaShortName(ini: Partial<JhoraIni>): string {
  const s = bhavaSettings(ini);
  return `D-${VARGA_PARTS[s.varga] ?? 1} (${BHAVA_REF_SHORT[s.ref] ?? ''})`;
}

/** True when the bhava chart comes from the house cusps (D-1 and reference Lagna). */
export const usesHouseSpans = (ini: Partial<JhoraIni>) => {
  const s = bhavaSettings(ini);
  return s.varga === 0 && s.ref === 0;
};

/** True when those spans need the ephemeris (house systems other than 0..2). */
export const needsCusps = (ini: Partial<JhoraIni>) => usesHouseSpans(ini) && ![0, 1, 2].includes(num(ini, 'HouseTypeWanted'));

/** The house spans FUN_004a76b0 uses (doc+0x21bb8): core/kpHouses.ts houseSpans with this ini. */
export function bhavaSpans(chart: ChakraChart, ini: Partial<JhoraIni>, swe?: Sweph): HouseSpan[] {
  const full = { ...chart, ini: { ...DEFAULTS, ...(chart.ini ?? {}), ...ini } } as Chart;
  return houseSpans(full, houseOptions(full), swe);
}

/** Longitude as the bhava routine sees it: bodies without one of their own read 0 (see header). */
const lonOf = (chart: ChakraChart, i: number): number | null => {
  const lon = bodyLongitude(chart, i);
  if (lon !== null) return norm360(lon);
  return i >= 59 ? 0 : null;
};

export interface BhavaOptions {
  /** house spans for the cusp path (needed when needsCusps(ini); else computed from the ascendant) */
  spans?: HouseSpan[];
  swe?: Sweph;
}

/**
 * FUN_004a76b0: the sign (0 = Aries) of every body index 0..104 in the Bhava/Chalit chakra,
 * null where the chart data lacks the body. Pass it as chartSigns(chart, 'D1', { signs }).
 */
export function bhavaSigns(chart: ChakraChart, ini: Partial<JhoraIni> = chart.ini ?? {}, opts: BhavaOptions = {}): (number | null)[] {
  const all = { ...(chart.ini ?? {}), ...ini };
  const s = bhavaSettings(all);
  const varga = VARGA_INDEX[s.varga] ?? 'D1';
  if (s.varga === 0 && s.ref === 0) {
    const spans = opts.spans ?? bhavaSpans(chart, all, opts.swe);
    const lagnaSign = Math.floor(norm360(chart.positions.ascendant) / 30);
    let house = 0;   // FUN_004a76b0 keeps the last house found for a body in none (cannot happen: the spans cover 360)
    return Array.from({ length: BODY_COUNT }, (_, i) => {
      const lon = lonOf(chart, i);
      if (lon === null) return null;
      if (i === 0) house = 0;
      else {
        const k = spans.findIndex((h) => norm360(lon - h.start + 360) <= norm360(h.end - h.start + 360));
        if (k >= 0) house = k;
      }
      return (lagnaSign + house) % 12;
    });
  }
  const signs = bodySigns(chart, varga, all);
  const spec = vargaSpec(varga, all);
  const degree = (lon: number) => vargaLongitude(lon, spec) % 30;
  const refLon = lonOf(chart, s.ref);
  if (refLon === null) return signs.map(() => null);
  const r = degree(refLon);
  return signs.map((sign, i) => {
    const lon = lonOf(chart, i);
    if (sign === null || lon === null) return null;
    const d = degree(lon);
    let shift = 0;
    if (s.middle) {
      if (r < 15) { if (d >= r + 15) shift = 1; } else if (d < r - 15) shift = -1;
    } else if (s.nodesReversed && (s.ref === 8 || s.ref === 9)) {
      if (d > r) shift = 1;
    } else if (d < r) shift = -1;
    return (sign + shift + 12) % 12;
  });
}
