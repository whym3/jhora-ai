// Shared helpers for the derived-chart tabs (Tithi Pravesha, Mundane, Miscellany).
//
// JHora's form views all follow the Tajaka pattern (see tajaka/annual.ts): the
// form is copied into globals, a search routine finds a moment (or fixes some
// longitudes), the document's active chart pointer doc+0x76d00 is set to the
// derived chart doc+0x279e0 with a kind code at doc+0x76d04 (1 Tajaka, 2 Tithi
// Pravesha, ...), and every view shows that chart until "Back to Natal Chart"
// (handler 0x48ae20). The derived chart keeps the natal place and zone
// (FUN_0049d250 copies the location of the natal record).
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { BirthData, PositionOverride } from '../jhd';
import type { Table } from '../../engine/protocol';
import { siderealLongitude, norm360, type Graha } from '../positions';
import type { Settings } from '../settings';
import { formatDasaTime } from '../dasas/format';
import { birthAt } from '../tajaka/annual';

export { birthAt };

/** An asynchronous table job (engine/jobs.ts ASYNC_TABLES signature). */
export type AsyncTableFn = (chart: Chart, params: Record<string, unknown>, swe: Sweph) => Promise<Table>;

/** Signed difference a - b folded into (-180, 180]. */
export const wrap180 = (x: number) => { let d = x % 360; if (d > 180) d -= 360; else if (d <= -180) d += 360; return d; };

/** Body longitude for root finding: grahas or the lagna (needs geo). */
export type AngleFn = (jdUt: number) => { lon: number; speed: number };

export function grahaAngle(swe: Sweph, body: Graha, s: Settings): AngleFn {
  return (jd) => siderealLongitude(swe, jd, body, s);
}

/**
 * Moment near `guess` when `f` reaches `target` (degrees), by secant/Newton steps
 * on the wrapped difference. `f` returns an angle and its speed (deg/day).
 * Converges to < 1e-9 deg; throws when the speed vanishes (stationary bodies).
 */
export function solveAngle(f: AngleFn, target: number, guess: number, maxIter = 60): number {
  let t = guess;
  for (let i = 0; i < maxIter; i++) {
    const { lon, speed } = f(t);
    const d = wrap180(target - lon);
    if (Math.abs(d) < 1e-9) return t;
    if (!speed) throw new Error('angle search: zero speed');
    let step = d / speed;
    if (Math.abs(step) > 20) step = Math.sign(step) * 20;
    t += step;
  }
  return t;
}

/** JD (UT) of a local clock date/time in a zone (east-positive hours). */
export function localToJd(swe: Sweph, y: number, m: number, d: number, hour: number, tzHours: number): number {
  return swe.julday(y, m, d, hour - tzHours);
}

/** "date time" in JHora's dasa date format, in the natal zone. */
export function whenText(swe: Sweph, natal: Chart, jd: number): string {
  return formatDasaTime(jd, natal.birth.tzHours, (x) => swe.revjul(x));
}

/** Birth data of a derived chart that fixes some longitudes (Prasna, progressions). */
export function birthWithOverride(natalBirth: BirthData, override: PositionOverride, at?: BirthData): BirthData {
  return { ...(at ?? natalBirth), legacy: null, override };
}

/**
 * The result of a "find chart" job: a one-row table (label, moment) whose `text`
 * holds the derived chart's birth data as JSON, as 'tajaka.find' does.
 */
export function derivedTable(swe: Sweph, natal: Chart, label: string, birth: BirthData, jd: number, extra: { headers?: string[]; rows?: string[][]; notes?: string[] } = {}): Table {
  return {
    caption: label,
    headers: extra.headers ?? ['Chart', 'Moment'],
    rows: extra.rows ?? [[label, whenText(swe, natal, jd)]],
    notes: extra.notes,
    text: [JSON.stringify({ birth, label })],
  };
}

export { norm360 };
