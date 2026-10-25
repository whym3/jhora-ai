// Modes > "Go to Nisheka/Aadhana Chakra" (menu 128, command 33291; handler 0x4e83d0 ->
// FUN_00407390 on the document). A calculation, not a drawing: JHora casts the chart of
// the conception moment and shows it in every view like the other derived charts (title
// "Nisheka Adhana", doc+0x76d04 = 5, dasas compressed: DAT_008a4b68 = 1, the period kept
// in DAT_005922b0).
//
// FUN_00407390, on the natal chart (doc+0x50):
//   Y = norm360(cusp 9 - cusp 1)                          (doc+0x16b0 / +0x1670: chart+0x1660 / +0x1620,
//                                                           the house cusps of the house system in use)
//     + |trunc(Maandi's degrees in sign - Saturn's degrees in sign)|
//     + (the lagna lord ahead of the lagna by [0, 180) deg, FUN_004ae540 ? Moon's degrees in sign : 0)
//     + 28.5
//   moment = natal + Y x (-1/365) "years" of FUN_0049dac0 mode 1 (a 360-day year),
//            i.e. natal JD - Y x 360 / 365 days; the period kept is Y.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { SIGN_LORD } from '../lords';
import { norm360 } from '../positions';
import { houseOptions, systemCusps } from '../kpHouses';

export interface NishekaMoment { jd: number; days: number; label: string }

const inSign = (lon: number) => lon - Math.floor(lon / 30) * 30;

export function nishekaMoment(swe: Sweph, natal: Chart): NishekaMoment {
  const p = natal.positions;
  const lon = (name: string) => natal.longitudes.find((b) => b.name === name)?.lon ?? 0;
  // cusps 1 and 9 as chart+0x1620 holds them (the house letter of HouseTypeWanted, 0x49b631)
  const cusps = systemCusps(natal, houseOptions(natal).type, swe);
  let y = norm360(cusps[8] - cusps[0]) + Math.abs(Math.trunc(inSign(lon('Maandi')) - inSign(p.grahas.Saturn.lon)));
  const lord = SIGN_LORD[Math.floor(p.ascendant / 30) % 12];
  const e = norm360(p.grahas[lord].lon - p.ascendant);
  if (e >= 0 && e < 180) y += inSign(p.grahas.Moon.lon);
  y += 28.5;
  return { jd: p.jdUt + (y * -0.0027397260273972603) * 360, days: y, label: 'Nisheka Adhana' };
}

