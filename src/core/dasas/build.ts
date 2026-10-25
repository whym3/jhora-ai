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
// moving the seed (0x40ddd4). Not ported: the Tribhagi variation (DAT_008a4b60, menu 32971),
// the nakshatra-dasa varga (DAT_00597ed8) and Saptarshi's shift.
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
  if (!t || !f!.natal) return { lon: nakshatraSeedLon(chart, point), natal: false, n: 0 };
  const n = f!.progress ? t.years : 0;
  const lon = nakshatraSeedLon(t.natal, point);
  return rotate ? { lon, natal: true, n } : { lon: n360(lon + n * NAK), natal: true, n: 0 };
}

export function buildDasa(chart: Chart, table: DasaTableId, system: string, levels: number, opts: DasaOptions = {}): BuiltSlotDasa {
  const slot = dasaSlot(table, system);
  let title: string, periods: Period[], drill = true;
  if (table === 'dasas.nakshatra') {
    const o = nakshatraSlotOptions(chart, slot);
    if (system === 'Kalachakra') {
      const kc = kalachakraDasa(nakshatraSeedLon(chart, o.point), 9, chart.ini.KCDRohini4NavamsaInLeo !== 0, levels);
      ({ title, periods } = kc);
      drill = levels < 3;
    } else if (system === 'Saptarshi nakshatra') {
      const s = nakshatraSeed(chart, slot, o.point, opts);
      title = SAPTARSHI_TITLE;
      periods = saptarshiDasa(s.lon, levels, NAKSHATRAS);
    } else {
      const def = NAKSHATRA_DASAS[system];
      const s = nakshatraSeed(chart, slot, o.point, opts, !!def?.groups);
      if (def) {
        title = def.title;
        periods = nakshatraDasa(def, s.lon, levels, { shift: o.shift, adMethod: o.adMethod, rotate: s.n });
      } else {
        title = s.natal ? MUDDA_TITLE : 'Vimsottari Dasa';
        periods = vimsottari(s.lon, levels, { shift: o.shift, adMethod: o.adMethod, reverse: o.reverse });
      }
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
