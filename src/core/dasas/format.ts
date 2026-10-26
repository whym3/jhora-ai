// JHora's dasa text ("Copy to clipboard" 32972 of a dasa pane, FUN_0044c9b2) and the dates-only
// copy ("Copy to clipboard (only dates)" 33236, FUN_0044c5a0): the same lines with each period
// as label + ":  " + start date + "  -  " + end date (0x57c6d4 / 0x57c6cc), no times.
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import type { DasaClock } from './time';

export const DASA_ABBR: Record<Graha, string> = {
  Sun: 'Sun', Moon: 'Moon', Mars: 'Mars', Mercury: 'Merc', Jupiter: 'Jup', Venus: 'Ven', Saturn: 'Sat', Rahu: 'Rah', Ketu: 'Ket',
};

/** "1869-08-17 (18:43:07)" in the chart's time zone; JHora prints the hour without padding. */
export function formatDasaTime(jdUt: number, tzHours: number, revjul: (jd: number) => { year: number; month: number; day: number; hour: number }): string {
  const r = revjul(jdUt + tzHours / 24);
  let secs = Math.floor(r.hour * 3600 + 1e-6);
  const h = Math.floor(secs / 3600); secs -= h * 3600;
  const m = Math.floor(secs / 60); const s = secs - m * 60;
  const p2 = (x: number) => String(x).padStart(2, '0');
  return `${r.year}-${p2(r.month)}-${p2(r.day)} (${h}:${p2(m)}:${p2(s)})`;
}

export interface DasaTextCtx { clock: DasaClock; tz: number; revjul: (jd: number) => { year: number; month: number; day: number; hour: number } }

/** The dasa pane's level names (its list header). */
export const DASA_LEVEL = ['Maha Dasas', 'Antardasas', 'Pratyantardasas', 'Sookshma-antardasas', 'Prana-antardasas', 'Deha-antardasas'];

export const periodLabel = (p: Period) => p.label ?? DASA_ABBR[p.lord];

/**
 * The cycle buttons (FUN_0044bff0 / FUN_0044c0e0) on the rows of a dasa table:
 * `<` acts while the first period shown starts after the year -5255 (doc+0x9f150), `>` while the
 * last one ends before 5255 (its end record's year).
 */
export function canStepCycle(rows: string[][], dir: -1 | 1): boolean {
  if (!rows.length) return false;
  const year = parseInt(dir < 0 ? rows[0][1] : rows[rows.length - 1][2], 10);
  return dir < 0 ? year > -5255 : year < 5255;
}

const span = (p: Period, c: DasaTextCtx) => `${formatDasaTime(c.clock.toJd(p.start), c.tz, c.revjul)} - ${formatDasaTime(c.clock.toJd(p.end), c.tz, c.revjul)}`;
/** "1869-08-17" of formatDasaTime. */
const dateOnly = (jd: number, c: DasaTextCtx) => {
  const f = formatDasaTime(jd, c.tz, c.revjul);
  return f.slice(0, f.indexOf(' ('));
};
/** A period line: "label: start - end", or with `datesOnly` "label:  date  -  date". */
const line = (p: Period, c: DasaTextCtx, datesOnly: boolean) => (datesOnly
  ? `${periodLabel(p)}:  ${dateOnly(c.clock.toJd(p.start), c)}  -  ${dateOnly(c.clock.toJd(p.end), c)}`
  : `${periodLabel(p)}: ${span(p, c)}`);

export function mahaDasaText(title: string, periods: Period[], c: DasaTextCtx, datesOnly = false): string[] {
  return [`${title}:`, '', ' Maha Dasas:', '', ...periods.map((p) => ` ${line(p, c, datesOnly)}`), '', ''];
}

export function antarDasaText(title: string, md: Period, c: DasaTextCtx, datesOnly = false): string[] {
  const head = datesOnly ? `${periodLabel(md)} MD:  ${dateOnly(c.clock.toJd(md.start), c)}  -  ${dateOnly(c.clock.toJd(md.end), c)}` : `${periodLabel(md)} MD: ${span(md, c)}`;
  return [`${title}:`, '', ` ${head}`, '', '  Antardasas in this MD:', '',
    ...(md.children ?? []).map((p) => `  ${line(p, c, datesOnly)}`), '', ''];
}

/** The dates-only copy of a full dasa text (same lines; the dates are the full copy's). */
export function datesOnlyLines(lines: string[]): string[] {
  const t = / \(\d+:\d\d:\d\d\)/g;
  return lines.map((l) => (/\d{4}-\d\d-\d\d \(/.test(l) ? l.replace(t, '').replace(/^(\s*\S.*?): (-?\d)/, '$1:  $2').replace(/(\d) - (-?\d)/, '$1  -  $2') : l));
}
