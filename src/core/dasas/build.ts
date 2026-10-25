// One dasa of the Dasas tab, built the way JHora's dispatcher FUN_00408d90 does
// for the chart shown: the system's slot (yearDefinition.ts), its builder, and
// what a derived chart changes.
//
// Nakshatra dasas (FUN_0040beb0 Vimsottari, FUN_0040dc90 .. FUN_00410420): on a
// Tajaka chart (doc+0x76d04 = 1) the seed's chart is the NATAL one (doc+0x50)
// when UseDasaSeedFromNatalInTajaka[slot] is set (bytes 0x8a184c + slot), and
// with ProgressDasaSeedInTajaka[slot] (0x8a1800 + slot) as well the seed star is
// advanced by the completed years n (doc+0x76d10); the fraction of the star is
// kept. Vimsottari is then titled "Mudda/Vimsottari Dasa" (flag of slot 0).
// Saptarshi (slot 12) is seeded by the lagna's star, Kalachakra (slot 2) has no
// such flags. All of them are timed from the chart shown (obj+0x77410).
// The maha dasa counts of Yogini, Shattrimsa (24 -> 8) and the other
// COMPRESSED_COUNT dasas change when DAT_008a4b68 is set.
// Per-slot options (ini arrays of 25): NakshatraDasaStartPoint (seed, nakshatra.ts
// nakshatraSeedLon; Saptarshi's default 4 = lagna), NakshatraDasaShift (all but
// Kalachakra and Saptarshi here), NaksDasaADMethodPreference (all but Kalachakra and
// Saptarshi), AntiZodiacalDasa (Vimsottari only). On a Tajaka chart the grouped dasas
// (Ashtottari FUN_0040dc90, Shashtihayani) rotate their 28-star scheme by n instead of
// moving the seed (0x40ddd4). Further:
//  - Tribhagi (DasaOptions.tribhagi): tribhagi.ts;
//  - the nakshatra dasa varga (DasaOptions.nakVarga, dialog 2055's "Choose the divisional
//    chart", DAT_00597ed8, global and not saved): every builder reads its seed from
//    FUN_004a1260(varga), i.e. the bodies' longitudes in that varga (nakshatra.ts);
//  - FUN_0049a930's offset (DasaOptions.nakShift) is added to the seed bodies (FUN_004a4b10);
//  - the title's extra part obj+0x76d38, printed as "title (extra):" by the copy (0x44c5f6):
//    Vimsottari "reverse", then "using <varga name 0x8a2874>", then "shift of <n> stars" joined
//    by ", " (FUN_0040beb0 0x40c235..0x40c2e9); the other nakshatra dasas the last two (e.g.
//    FUN_0040e150 0x40e380..); Kalachakra "From <seed name> of <varga>, ..." (FUN_0040c540
//    0x40dbf6, kalachakra.ts);
//  - Saptarshi (FUN_00410420) reads NakshatraDasaShift[12] for the title only: the star list
//    always starts at the seed star (0x410535 .. 0x410651).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { vimsottari } from './vimsottari';
import { NAKSHATRA_DASAS, nakshatraDasa, nakshatraSeedLon, SAPTARSHI_TITLE, saptarshiDasa } from './nakshatra';
import { DEFAULTS } from '../../settings/generated';
import { kalachakraDasa } from './kalachakra';
import { OTHER_DASAS, RASI_DASAS, tajakaSeedFlags, type DasaOptions } from './registry';
import { COMPRESSED_COUNT, dasaSlot, type DasaTableId } from './yearDefinition';
import { NAKSHATRAS } from '../zodiac';
import { MUDDA_TITLE } from '../tajaka/mudda';
import { SEED_TITLE_NAMES, type SeedOptions } from './nakshatra';
import { tribhagi, tribhagiVimsottari, TRIBHAGI_EXCLUDED, TRIBHAGI_SUFFIX } from './tribhagi';
import { vargaLabel } from './overrides';

const NAK = 360 / 27;
const n360 = (x: number) => ((x % 360) + 360) % 360;

export interface BuiltSlotDasa { slot: number; title: string; periods: Period[]; drill: boolean }

/** The per-slot nakshatra dasa options of the chart's ini. */
export function nakshatraSlotOptions(chart: Chart, slot: number) {
  const pick = (k: 'NakshatraDasaStartPoint' | 'NakshatraDasaShift' | 'NaksDasaADMethodPreference' | 'AntiZodiacalDasa') =>
    chart.ini[k]?.[slot] ?? DEFAULTS[k][slot] ?? 0;
  return { point: pick('NakshatraDasaStartPoint'), shift: pick('NakshatraDasaShift'), adMethod: pick('NaksDasaADMethodPreference'), reverse: pick('AntiZodiacalDasa') !== 0 };
}

/**
 * The seed longitude of a nakshatra dasa: NakshatraDasaStartPoint[slot] of the chart, or on a
 * Tajaka chart of the natal one (per the slot's flags), advanced by n stars - or, with
 * `rotate` (grouped dasas), not moved and n returned to rotate the scheme.
 */
function nakshatraSeed(chart: Chart, slot: number, point: number, opts?: DasaOptions, rotate = false): { lon: number; natal: boolean; n: number } {
  const t = opts?.tajaka;
  const f = t ? tajakaSeedFlags(chart, slot) : null;
  const so: SeedOptions = { varga: opts?.nakVarga, shift: opts?.nakShift };
  if (!t || !f!.natal) return { lon: nakshatraSeedLon(chart, point, so), natal: false, n: 0 };
  const n = f!.progress ? t.years : 0;
  const lon = nakshatraSeedLon(t.natal, point, { varga: opts?.nakVarga, shift: opts?.natalNakShift });
  return rotate ? { lon, natal: true, n } : { lon: n360(lon + n * NAK), natal: true, n: 0 };
}

/** obj+0x76d38 of a nakshatra dasa other than Kalachakra (empty with the default options). */
export function nakshatraTitleExtra(chart: Chart, slot: number, varga = 0): string {
  const o = nakshatraSlotOptions(chart, slot);
  const parts: string[] = [];
  if (slot === 0 && o.reverse) parts.push('reverse');
  if (varga) parts.push(`using ${vargaLabel(varga, chart.ini)}`);
  if (o.shift) parts.push(`shift of ${o.shift} stars`);
  return parts.join(', ');
}

export function buildDasa(chart: Chart, table: DasaTableId, system: string, levels: number, opts: DasaOptions = {}): BuiltSlotDasa {
  const slot = dasaSlot(table, system);
  let title: string, periods: Period[], drill = true;
  if (table === 'dasas.nakshatra') {
    const o = nakshatraSlotOptions(chart, slot);
    const varga = opts.nakVarga ?? 0;
    // FUN_00408d90: Tribhagi when the pane's nakshatra dasa is shown (DasasView passes it)
    const tri = !!opts.tribhagi && !TRIBHAGI_EXCLUDED.has(slot);
    if (system === 'Kalachakra') {
      const kc = kalachakraDasa(nakshatraSeedLon(chart, o.point, { varga, shift: opts.nakShift }), 9, chart.ini.KCDRohini4NavamsaInLeo !== 0, levels,
        { seed: SEED_TITLE_NAMES[o.point] ?? 'Moon', varga: vargaLabel(varga, chart.ini) });
      ({ title, periods } = kc);
      drill = levels < 3;
    } else if (system === 'Saptarshi nakshatra') {
      const s = nakshatraSeed(chart, slot, o.point, opts);
      title = SAPTARSHI_TITLE;
      periods = saptarshiDasa(s.lon, levels, NAKSHATRAS);
      if (tri) periods = tribhagi(periods);
    } else {
      const def = NAKSHATRA_DASAS[system];
      const s = nakshatraSeed(chart, slot, o.point, opts, !!def?.groups);
      if (def) {
        title = def.title;
        periods = nakshatraDasa(def, s.lon, levels, { shift: o.shift, adMethod: o.adMethod, rotate: s.n });
        if (tri) periods = tribhagi(periods);
      } else {
        title = s.natal ? MUDDA_TITLE : 'Vimsottari Dasa';
        periods = tri ? tribhagiVimsottari(s.lon, levels, { shift: o.shift, reverse: o.reverse })
          : vimsottari(s.lon, levels, { shift: o.shift, adMethod: o.adMethod, reverse: o.reverse });
      }
    }
    if (system !== 'Kalachakra') {
      if (tri) title += TRIBHAGI_SUFFIX;
      const extra = nakshatraTitleExtra(chart, slot, varga);
      if (extra) title += ` (${extra})`;
    }
  } else {
    const reg = table === 'dasas.rasi' ? RASI_DASAS : OTHER_DASAS;
    const d = reg[system](chart, levels, opts);
    ({ title, periods } = d);
  }
  const count = opts.compressed ? COMPRESSED_COUNT[slot] : undefined;
  if (count) periods = periods.slice(0, count);
  return { slot, title, periods, drill };
}
