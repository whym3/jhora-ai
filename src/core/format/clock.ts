// TimeDisplayWithAmPm (DAT_008a4b88, ini DisplayPreferences, default 0): every place jhora.exe
// reads the flag. Each one picks between a 24-hour and a 12-hour formatter of the same HMS
// object (FUN_004c1b00 split):
//   FUN_004c1f00 "h:mm:ss"  <->  FUN_004c1e20 "h:mm:ss am"   (seconds rounded, no carry)
//   FUN_004c1d40 "h:mm"     <->  FUN_004c1c10 "h:mm am"      (mode 2: seconds >= 30 round the
//                                minute up, carrying into the hour; am/pm from the rounded hour)
// 12-hour hours are (h + 11) % 12 + 1, "pm" from 12:00 on (strings 0x57e12c "am", 0x586e0c "pm").
//
// Readers:
// * FUN_004b1400 (Key Info copy, 0x4b15e0 / 0x4b1b80 / 0x4b1cd1) and FUN_004ae890 (the Key Info
//   pane and the entry chart window's info block, 0x4af343 / 0x4afa8d / 0x4afc03): the Time line
//   and sunrise / sunset - core/keyInfo.ts clockTime.
// * FUN_004b2370 (0x4b2492): "%s (%s %d, %d)" contact times of Mundane > Eclipse Mode
//   (FUN_0040b2a0) - core/derived/mundane.ts contactTime.
// * CTransitCalenView::OnDraw 0x487e50 (0x48847a): the row label "%d-%02d-%02d (%s)" with
//   FUN_004c1d20 / FUN_004c1bf0 - calendarLabelAmPm below (TransitsView.tsx).
// * FUN_00403d80 (dialog 2005 "Enter Birthdata"): with the flag set the hours edit shows the
//   12-hour value and combo 1080 (DLGINIT "am", "pm", "0-24 hrs") am or pm, else "0-24 hrs";
//   on OK "0-24 hrs" clears the flag and keeps the hour, am / pm set it and store
//   hour % 12 (+ 12 for pm) - birthTimeFields / birthHourFromFields (BirthForm.tsx).
// * FUN_00401620 (0x401764, the period engine of FUN_00401c20: dasa period start texts) and
//   CDasaView FUN_0044a330 (0x44afa2.., column offsets 0x1d6 / 0x186 + 20 px when set): the Dasas
//   tab, not handled here.
// * FUN_004b00c0 (0x4b045f) and FUN_004b0780 (0x4b0f22, print page FUN_004479c0 via the print
//   dispatcher FUN_00418cc0): info blocks of printed pages (printing is not ported).
// * The ini loader / writer FUN_004df940 / 0x4e4c56 and both "restore defaults" routines
//   0x4e5870 / 0x4e5fa0 (flag = 0).

const amPm = (h: number) => (h < 12 ? 'am' : 'pm');
const hour12 = (h: number) => ((h + 11) % 12) + 1;

/**
 * FUN_004c1c10(.., 2) applied to an "h:mm" text of FUN_004c1d40(.., 2) (same rounding, so the
 * conversion is exact): "h:mm am".
 */
export function hmToAmPm(text: string): string {
  const m = /^(\d+):(\d\d)$/.exec(text);
  if (!m) return text;
  const h = Number(m[1]);
  return `${hour12(h)}:${m[2]} ${amPm(h)}`;
}

/** The transit calendar's row label "yyyy-mm-dd (h:mm)" with the 12-hour clock (0x48847a). */
export const calendarLabelAmPm = (label: string) => label.replace(/\((\d+:\d\d)\)$/, (_, t: string) => `(${hmToAmPm(t)})`);

/** Combo 1080 of dialog 2005, in CBIndex order. */
export const BIRTH_AMPM_OPTIONS = ['am', 'pm', '0-24 hrs'] as const;
export type BirthAmPm = 0 | 1 | 2;

/**
 * FUN_00403d80 filling dialog 2005: the hour shown in the hours edit and combo 1080's index
 * (2 = "0-24 hrs" when TimeDisplayWithAmPm is off).
 */
export function birthTimeFields(hour: number, ampm: boolean): { hour: number; mode: BirthAmPm } {
  const h = Math.trunc(hour);
  return ampm ? { hour: hour12(h) + (hour - h), mode: h >= 12 ? 1 : 0 } : { hour, mode: 2 };
}

/**
 * FUN_00403d80 on OK: the clock hour stored and the new TimeDisplayWithAmPm. With am / pm the
 * whole hours are taken mod 12 (12 am = 0 h) and pm adds 12.
 */
export function birthHourFromFields(hour: number, mode: BirthAmPm): { hour: number; ampm: boolean } {
  if (mode === 2) return { hour, ampm: false };
  const h = Math.trunc(hour);
  return { hour: (h % 12) + (mode === 1 ? 12 : 0) + (hour - h), ampm: true };
}
