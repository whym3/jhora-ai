// Buddhi Gati dasa (FUN_00413680), default chart D-1 (BuddhiGatiDasaVarga = 0):
//  - the nine planets ordered by key = 100 * a + (rasi-chart degrees in the
//    sign), a = 12 for the 4th house from the lagna, 11 for the 5th, ... 1 for
//    the 3rd (houses in the chosen varga, FUN_004a6160), largest key first
//    (insertion sort, ties keep Sun..Ketu order);
//  - the twelve dasa slots are those nine followed by the first three again
//    (JHora reads past its 9-entry array into the next locals, which hold
//    copies of the first three);
//  - years of slot i: (lagna sign - planet sign + i) mod 12, 12 for 0; a second
//    run of the twelve slots follows with 12 minus those years; from birth;
//  - antardasas: twelve slots round the same list starting at the slot where
//    the planet was last written (for the first three planets, slots 9..11),
//    each a twelfth (obj+0x8fa18).
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { PLANETS } from '../signStrength';
import { JHORA_VARGA_NAMES, rasiCtx } from './rasiCommon';
import { bodyPeriod, expandDasa, mod12 } from './otherCommon';

export const buddhiGatiTitle = (vargaIndex = 0) => `Buddhi Gati Dasa of ${JHORA_VARGA_NAMES[vargaIndex]} (from Agni Purana)`;
export const BUDDHI_GATI_TITLE = buddhiGatiTitle();

export function buddhiGatiDasa(chart: Chart, levels = 2, vargaIndex = chart.ini.BuddhiGatiDasaVarga ?? 0): Period[] {
  const ctx = rasiCtx(chart, vargaIndex);
  const key = (id: number) => {
    const g = PLANETS[id - 1];
    const h = mod12(ctx.sign(g) - ctx.lagna);
    return chart.positions.grahas[g].lon % 30 + 100 * (12 - ((h + 9) % 12));
  };
  const sorted: number[] = [];
  for (let id = 1; id <= 9; id++) {
    const k = sorted.findIndex((x) => key(x) < key(id));
    if (k < 0) sorted.push(id); else sorted.splice(k, 0, id);
  }
  const slots = [...sorted, sorted[0], sorted[1], sorted[2]];
  const years = slots.map((id, i) => mod12(ctx.lagna - ctx.sign(PLANETS[id - 1]) + i) || 12);
  const mds = [...slots.map((id, i) => ({ id, years: years[i] })), ...slots.map((id, i) => ({ id, years: 12 - years[i] }))];
  const lastSlot = new Map<number, number>();
  slots.forEach((id, i) => lastSlot.set(id, i));
  const subs = (id: number) => Array.from({ length: 12 }, (_, k) => ({ id: slots[(k + lastSlot.get(id)!) % 12], frac: 1 / 12 }));
  return expandDasa({ mds, subs, make: bodyPeriod }, levels);
}
