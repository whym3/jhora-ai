// Transit Calendar: CTranCalenFormView (dialog 2048, button 1000 -> 0x485bd0)
// opens CTransitCalenView (RTC 0x54fa40, a CScrollView drawn by OnDraw 0x487e50).
// Rows are computed by FUN_00488c80: row i is the natal chart re-cast at the
// entered clock time + i*step days (natal place and zone; the form's time zone is
// ignored), for N rows (edit 1011, clamped to 100). Each row has nine planet
// columns (Su..Ke) of up to six small cells, in checkbox order 1040..1045:
//
//   1040 house from natal Moon (+ vedha)   1041 house from natal lagna (+ vedha)
//   1042 transit tara                      1043 murthi (not for the Moon)
//   1044 ashtakavarga score                1045 kakshya lord and its bindu
//
// Natal reference signs are in the natal varga (combo 1009), transit signs in
// the transit varga (combo 1012). Both combos lack D-81 but their index is used
// directly as JHora's varga index, so "Ashtottaramsa (D-108)" gives D-81 and
// "D-144" gives D-108 (quirk, reproduced: pass the combo index).
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { computePositions, siderealLongitude, type Positions } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { birthJdUt } from '../jhd';
import { signOf } from '../zodiac';
import type { Table } from '../../engine/protocol';
import {
  addDays, BODY_ABBR, bodyLon, bodySign, clockText, GOOD_HOUSE, graha, KAKSHYA_LORD, kakshyaOf, MURTHI_BY_HOUSE,
  nak27, transitBirth, VARGA_TITLE, VEDHA_HOUSE, type TransitDate,
} from './common';
import { natalAv } from './basic';
import { lastIngress, murthiOf } from './murthi';

/** Good taras of the calendar (0x57e9b4): Janma counts as good. */
export const CALENDAR_GOOD_TARA = [1, 1, 0, 1, 0, 1, 0, 1, 1];
export const CALENDAR_ITEMS = ['Houses from natal Moon and vedhas', 'Houses from natal lagna and vedhas', 'Transit taras (stars)', 'Murthis (idol/form)', 'Ashtakavarga scores', 'Kakshya details'] as const;
export const MURTHI_SHORT = ['Swarna', 'Rajata', 'Taamra', 'Loha'];

export interface CalendarOptions {
  start: TransitDate;
  /** edit 1007, days between rows (default 1) */
  stepDays?: number;
  /** edit 1011, rows (default 15, at most 100) */
  rows?: number;
  /** combo indices 1009 / 1012 (= JHora varga index, default 0) */
  natalVarga?: number;
  transitVarga?: number;
  /** checkboxes 1040..1045 (default all on) */
  items?: boolean[];
}

export interface CalendarCell {
  houseMoon: number; goodMoon: boolean; vedhaMoon: boolean;
  houseLagna: number; goodLagna: boolean; vedhaLagna: boolean;
  /** 1-based tara and whether it is good */
  tara: number; goodTara: boolean;
  murthi: number;
  av: number;
  kakshyaLord: number; kakshyaBindu: boolean;
}
export interface CalendarRow { date: TransitDate; label: string; cells: CalendarCell[] }

const PARTNER: Record<number, number> = { 1: 7, 7: 1, 2: 4, 4: 2 };

/** FUN_00487b20: is a good house h (from refSign) of body B obstructed in the transit varga? */
export function calendarVedha(p: Positions, B: number, h: number, ref: number, tv: number): boolean {
  const vSign = (ref + VEDHA_HOUSE[B][h] - 1 + 12) % 12;
  const occ: number[] = [];
  for (let b = 1; b <= 9; b++) if (bodySign(p, b, tv) === vSign) occ.push(b);
  if (occ.length === 1 && PARTNER[B] === occ[0]) return false;
  return occ.length > 0;
}

export function transitCalendar(swe: Sweph, natal: Chart, o: CalendarOptions): { rows: CalendarRow[]; title: string } {
  const step = o.stepDays ?? 1;
  const n = Math.max(0, Math.min(100, Math.trunc(o.rows ?? 15)));
  const nv = o.natalVarga ?? 0, tv = o.transitVarga ?? 0;
  const np = natal.positions;
  const nMoon = bodySign(np, 2, nv), nLag = bodySign(np, 0, nv);
  const nMoonD1 = bodySign(np, 2, 0);       // murthi reference: varga DAT_008a4b84 (default D-1)
  const moon27 = nak27(np, 2);
  const av = natalAv(natal, nv);
  const avNext = nv + 1 < VARGA_TITLE.length ? natalAv(natal, nv + 1) : null;
  // Rahu/Ketu read past their varga's AV block into the next varga's Lagna/Sun (quirk)
  const bav = (B: number, s: number) => (B <= 7 ? av.bav(B, s) : avNext ? avNext.bav(B - 8, s) : 0);
  const bindu = (B: number, s: number, c: number) => (B <= 7 ? av.bindu(B, s, c) : avNext ? avNext.bindu(B - 8, s, c) : false);
  const settings = calcSettingsFromIni(natal.ini);
  const geo = { lat: natal.birth.lat, lon: natal.birth.lon, alt: natal.birth.altitudeM };
  // Ketu's murthi slot is never refreshed: it keeps the natal chart's value (= natal Rahu's murthi) (quirk)
  const ketuMurthi = murthiOf(swe, natal, 'Rahu', nMoonD1);
  const prevHouse = Array(10).fill(-1), prevMurthi = Array(10).fill(0);
  const rows: CalendarRow[] = [];
  for (let i = 0; i < n; i++) {
    const date = addDays(swe, o.start, i * step);
    const jd = birthJdUt(transitBirth(natal.birth, date), (y, m, d, h) => swe.julday(y, m, d, h));
    const p = computePositions(swe, jd, geo, settings);
    const cells: CalendarCell[] = [];
    for (let B = 1; B <= 9; B++) {
      const ts = bodySign(p, B, tv);
      const hM = (ts - nMoon + 12) % 12, hL = (ts - nLag + 12) % 12;
      const goodMoon = GOOD_HOUSE[B][hM] > 0, goodLagna = GOOD_HOUSE[B][hL] > 0;
      const t = (nak27(p, B) - moon27 + 27) % 9;
      let murthi = prevMurthi[B];
      if (B === 9) murthi = ketuMurthi;
      else if (hM !== prevHouse[B]) {
        const tIn = lastIngress(swe, natal, graha(B), jd);
        const ms = signOf(siderealLongitude(swe, tIn, 'Moon', settings).lon);
        murthi = MURTHI_BY_HOUSE[(ms - nMoonD1 + 12) % 12];
      }
      prevHouse[B] = hM; prevMurthi[B] = murthi;
      const lord = KAKSHYA_LORD[kakshyaOf(bodyLon(p, B))];
      cells.push({
        houseMoon: hM + 1, goodMoon, vedhaMoon: goodMoon && calendarVedha(p, B, hM, nMoon, tv),
        houseLagna: hL + 1, goodLagna, vedhaLagna: goodLagna && calendarVedha(p, B, hL, nLag, tv),
        tara: t + 1, goodTara: CALENDAR_GOOD_TARA[t] === 1,
        murthi, av: bav(B, ts), kakshyaLord: lord, kakshyaBindu: bindu(B, ts, lord),
      });
    }
    const label = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')} (${clockText(date.hour)})`;
    rows.push({ date, label, cells });
  }
  const title = `${VARGA_TITLE[tv]} chart transits of planets with respect to natal ${VARGA_TITLE[nv]} chart`;
  return { rows, title };
}

/** Text of one planet cell: the enabled items in checkbox order. */
export function calendarCellText(c: CalendarCell, B: number, items: boolean[]): string {
  const g = (ok: boolean) => (ok ? '+' : '-');
  const parts: string[] = [];
  if (items[0]) parts.push(`M${c.houseMoon}${g(c.goodMoon)}${c.vedhaMoon ? 'v' : ''}`);
  if (items[1]) parts.push(`L${c.houseLagna}${g(c.goodLagna)}${c.vedhaLagna ? 'v' : ''}`);
  if (items[2]) parts.push(`T${c.tara}${g(c.goodTara)}`);
  if (items[3] && B !== 2) parts.push(MURTHI_SHORT[c.murthi].slice(0, 2));
  if (items[4]) parts.push(`${c.av}${c.av > 4 ? '+' : c.av < 4 ? '-' : '='}`);
  if (items[5]) parts.push(`${BODY_ABBR[c.kakshyaLord]}${g(c.kakshyaBindu)}`);
  return parts.join(' ');
}

/** Legend (0x488680), as text. */
export const CALENDAR_LEGEND = [
  'M5+ / M5- / M5+v: house from natal Moon, good / bad / good but under vedha',
  'L5+ / L5- / L5+v: house from natal lagna, good / bad / good but under vedha',
  'T8+ / T5-: tara counted from the natal Moon star, good / bad',
  'Sw Ra Ta Lo: Swarna (very good), Rajata (good), Taamra (bad), Loha (very bad) murthi',
  '5+ / 4= / 3-: ashtakavarga score of the sign (good above 4, neutral at 4, bad below)',
  'Ma+ / Ju-: kakshya lord, and whether it gives a bindu to the planet in that sign',
];

export function calendarTable(cal: { rows: CalendarRow[]; title: string }, items: boolean[] = [true, true, true, true, true, true]): Table {
  return {
    caption: cal.title,
    headers: ['Date', ...BODY_ABBR.slice(1)],
    rows: cal.rows.map((r) => [r.label, ...r.cells.map((c, k) => calendarCellText(c, k + 1, items))]),
    cellClasses: cal.rows.map((r) => [undefined, ...r.cells.map((c) => {
      const score = (c.goodMoon && !c.vedhaMoon ? 1 : -1) + (c.goodTara ? 1 : -1);
      return score > 0 ? 'good' : score < 0 ? 'bad' : undefined;
    })]),
    notes: CALENDAR_LEGEND,
  };
}
