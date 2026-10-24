// JHora's dasa text ("Copy to clipboard" of a dasa pane).
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

export const periodLabel = (p: Period) => p.label ?? DASA_ABBR[p.lord];

const span = (p: Period, c: DasaTextCtx) => `${formatDasaTime(c.clock.toJd(p.start), c.tz, c.revjul)} - ${formatDasaTime(c.clock.toJd(p.end), c.tz, c.revjul)}`;

export function mahaDasaText(title: string, periods: Period[], c: DasaTextCtx): string[] {
  return [`${title}:`, '', ' Maha Dasas:', '', ...periods.map((p) => ` ${periodLabel(p)}: ${span(p, c)}`), '', ''];
}

export function antarDasaText(title: string, md: Period, c: DasaTextCtx): string[] {
  return [`${title}:`, '', ` ${periodLabel(md)} MD: ${span(md, c)}`, '', '  Antardasas in this MD:', '',
    ...(md.children ?? []).map((p) => `  ${periodLabel(p)}: ${span(p, c)}`), '', ''];
}
