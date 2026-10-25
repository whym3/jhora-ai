// Edit > "Change timezone" (33200, dialog 2052 "Enter the time zone to be used").
//
// jhora.exe: the handler FUN_00406d80 (dialog FUN_004d0ff0, DDX FUN_004d1030: combo 1003
// "Use the timezone of birth" / "Use the timezone entered below" -> DAT_008a4bba, edits
// 100/101 hours and minutes, combo 1004 "East of GMT" / "West of GMT") keeps the birth
// zone in DAT_008a4bc0 and the chosen zone in DAT_008a4bc8 (JHora's sign: negative = east),
// then FUN_004a6ff0(zone) re-expresses the chart record in that zone: the same UT moment,
// local date and time moved, every calculation then shown in that zone. The birth data
// itself is not changed (Edit > Birthdata first switches the record back to the birth
// zone, FUN_00403d80) and the choice is not saved in the .jhd file.

import type { BirthData } from './jhd';

/** The display zone the dialog's fields describe (east-positive hours). */
export function zoneFromFields(hours: number, minutes: number, west: boolean): number {
  const z = minutes * 0.016666666666666666 + hours;
  return west ? -z : z;
}

/** Hours, minutes and side of a zone, as dialog 2052 shows it (FUN_004c1b00 split). */
export function zoneFields(tz: number): { hours: number; minutes: number; west: boolean } {
  const x = Math.abs(tz);
  const hours = Math.trunc(x);
  const minutes = Math.round((x - hours) * 60);
  return minutes === 60 ? { hours: hours + 1, minutes: 0, west: tz < 0 } : { hours, minutes, west: tz < 0 };
}

const leap = (y: number) => (y < 1582 ? y % 4 === 0 : (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0);
const monthDays = (y: number, m: number) => [31, leap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** The next/previous calendar day (Julian before 15 Oct 1582, as Swiss Ephemeris' revjul). */
function shiftDay(y: number, m: number, d: number, step: 1 | -1): [number, number, number] {
  if (step === 1) {
    if (y === 1582 && m === 10 && d === 4) return [1582, 10, 15];
    if (d < monthDays(y, m)) return [y, m, d + 1];
    return m === 12 ? [y + 1, 1, 1] : [y, m + 1, 1];
  }
  if (y === 1582 && m === 10 && d === 15) return [1582, 10, 4];
  if (d > 1) return [y, m, d - 1];
  return m === 1 ? [y - 1, 12, 31] : [y, m - 1, monthDays(y, m - 1)];
}

/** FUN_004a6ff0: the birth record expressed in another zone (same moment). */
export function birthInZone(b: BirthData, tz: number): BirthData {
  if (tz === b.tzHours) return b;
  let hour = b.hour - b.tzHours + tz;
  let y = b.year, m = b.month, d = b.day;
  while (hour < 0) { hour += 24; [y, m, d] = shiftDay(y, m, d, -1); }
  while (hour >= 24) { hour -= 24; [y, m, d] = shiftDay(y, m, d, 1); }
  return { ...b, year: y, month: m, day: d, hour, tzHours: tz };
}

/** The birth data every view computes from: converted when a display zone is chosen. */
export function displayBirth(b: BirthData, displayTz: number | null | undefined): BirthData {
  return displayTz === null || displayTz === undefined ? b : birthInZone(b, displayTz);
}
