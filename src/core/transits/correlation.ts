// Longitude Correlation: CTranResearchFormView (RTC 0x54f610, dialog 2069) and
// CTranResearchView (RTC 0x54f848, list; columns FUN_00487280; OnUpdate 0x487240).
//
// Button 1000 "Show Natal Points Aspected in Transit" (0x486520) stores the form;
// FUN_004205e0 casts the transit chart for the entered date/time in the FORM's
// time zone (re-expressed in the natal zone; natal place) and, for each transit
// planet in the fixed order Ju Sa Ra Ke Ma Su Ve Me Mo, tests its D-1 longitude T
// against 25 natal points (Lagna, Sun..Ketu, AL, A2..A11, UL, Bhava/Hora/Ghati
// lagna) in the natal vargas D1 D9 D7 D10 D11 D12 D16 D20 D24 D30 D60 (natal point
// outer loop, varga inner), keeping at most 100 matches per planet:
//   mode 0 (radio 201): trunc(|aspectPercent(N, T, planet)|) >= 1022 (80)
//   mode 1 (radio 202): FUN_004b3120 named aspects within orb 1023 (4)
//   mode 2 (radio 203): FUN_004b35e0 conjunction/quadrants within orb 1024 (4)
//   mode 3 (radio 204): FUN_004b34a0 conjunction/trines/7th within orb 1025 (4)
// Combo 1012 ("Divisional chart to be used in transit") is stored but never used.
// << / >> (0x486940 / 0x486670) move the date by combo 1080 (Year, 3 Months,
// Month, 10 Days, 5 Days, Day, Hour; default Month) and recompute.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { Table } from '../../engine/protocol';
import { aspectPercent } from '../aspects';
import { norm360, type Graha } from '../positions';
import { ALL_VARGAS, vargaLongitude } from '../vargas';
import { formatLongitude } from '../zodiac';
import { arudhaLongitudes, bodyLon, BODY_NAMES, graha, VARGA_ORDER, type TransitDate } from './common';

/** Varga names of this list (the "(Trd)"/"(US)" table, as in the Rasis-in-vargas columns), by JHora varga index. */
export const CORRELATION_VARGA_LABEL = ['D-1', 'D-9', 'D-2 (US)', 'D-3 (Trd)', 'D-4', 'D-5', 'D-6', 'D-7 (Trd)', 'D-8', 'D-10 (Trd)', 'D-11', 'D-12 (Trd)', 'D-16 (Trd)',
  'D-20 (Trd)', 'D-24 (Trd)', 'D-27 (Trd)', 'D-30', 'D-40', 'D-45', 'D-60 (Trd)', 'D-81', 'D-108', 'D-144'];

export const CORRELATION_PLANETS = [5, 7, 8, 9, 3, 1, 6, 4, 2];
/** Mean daily motion used for the "Speed" column (speed / mean). */
const MEAN_SPEED = [0, 1, 13.3333, 0.5, 1, 1 / 12, 1, 1 / 30, 1 / 18, 1 / 18];
/** Natal vargas (JHora varga indices) tested. */
export const CORRELATION_VARGAS = [0, 1, 7, 9, 10, 11, 12, 13, 14, 16, 19];
export const NATAL_POINTS = [...BODY_NAMES, 'AL', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'UL', 'Bhava Lagna', 'Hora Lagna', 'Ghati Lagna'];
export const STEPS = ['Year', '3 Months', 'Month', '10 Days', '5 Days', 'Day', 'Hour'];

export interface CorrelationOptions {
  /** radio 201..204 (default 0) */
  mode?: number;
  /** 1022 percent threshold (80), 1023 / 1024 / 1025 orbs (4) */
  minPercent?: number;
  orbAspect?: number;
  orbQuadrant?: number;
  orbTrine?: number;
  /**
   * Speeds (deg/day) by body index for the "Speed" column. JHora's stored speeds
   * (chart+0x1530, FUN_0049aaa0) carry no nutation rate (they equal swe_calc speeds
   * with SEFLG_NONUT, checked on the goldens); default: the chart's own speeds.
   */
  speeds?: number[];
}

/** FUN_004b3120: named aspect of body b at T on N within `orb`; returns [orb, name]. */
export function namedAspect(N: number, T: number, b: number, orb: number): [number, string] {
  let d = norm360(N - T);
  if (b === 8) d = 360 - d;
  if (b === 9) return [d, 'None'];
  const near = (x: number) => d >= x - orb && d < x + orb;
  if (d < orb) return [d, 'Full'];
  if (d >= 360 - orb) return [360 - d, 'Full'];
  if (near(180)) return [Math.abs(d - 180), 'Full'];
  if (near(330)) return [Math.abs(d - 60), b === 8 ? 'Full' : 'None'];   // JHora measures from 60 here
  if (near(60)) return [Math.abs(d - 60), b === 7 ? 'Full' : '1/4'];
  if (near(90)) return [Math.abs(d - 90), b === 3 ? 'Full' : '3/4'];
  if (near(120)) return [Math.abs(d - 120), b === 5 || b === 8 ? 'Full' : '1/2'];
  if (near(210)) return [Math.abs(d - 210), b === 3 ? 'Full' : '3/4'];
  if (near(240)) return [Math.abs(d - 240), b === 5 || b === 8 ? 'Full' : '1/2'];
  if (near(270)) return [Math.abs(d - 270), b === 7 ? 'Full' : '1/4'];
  return [d, 'None'];
}

/** FUN_004b35e0 (windows 90/180/270) and FUN_004b34a0 (120/240/180): orb, or 360 when none. */
export function windowOrb(N: number, T: number, b: number, orb: number, windows: number[]): number {
  let d = norm360(N - T);
  if (b === 8 || b === 9) d = 360 - d;
  if (d < orb) return d;
  if (d >= 360 - orb) return 360 - d;
  for (const x of windows) if (d >= x - orb && d < x + orb) return Math.abs(d - x);
  return 360;
}

export interface CorrelationMatch { point: string; varga: number; natalLon: number; value: number; name?: string }
export interface CorrelationRow { planet: number; lon: number; speed: number; matches: CorrelationMatch[] }

/**
 * Natal point longitudes (D-1), in NATAL_POINTS order. JHora only stores bhava
 * arudha longitudes when DivLongsInBhavaArudhas is on (default off); otherwise the
 * slots hold 0 (0 Ar 00', mapped through the vargas as such - see the goldens).
 */
export function natalPoints(natal: Chart): number[] {
  const p = natal.positions;
  const named = (n: string) => natal.longitudes.find((x) => x.name === n)!.lon;
  const arudhas = natal.ini.DivLongsInBhavaArudhas ? arudhaLongitudes(natal) : Array<number>(12).fill(0);
  return [...BODY_NAMES.map((_, b) => bodyLon(p, b)), ...arudhas, named('Bhava Lagna'), named('Hora Lagna'), named('Ghati Lagna')];
}

export function longitudeCorrelation(natal: Chart, transit: Chart, o: CorrelationOptions = {}): CorrelationRow[] {
  const mode = o.mode ?? 0;
  const points = natalPoints(natal);
  // FUN_004a1260(v) returns the natal chart itself for D-1 but builds every other
  // varga chart from the chart just computed (the transit chart), so for v > 0 the
  // "natal" points are the transit chart's (bug-compatible; matches the goldens).
  const transitPoints = natalPoints(transit);
  return CORRELATION_PLANETS.map((b) => {
    const g: Graha = graha(b);
    const T = transit.positions.grahas[g].lon;
    const matches: CorrelationMatch[] = [];
    for (let k = 0; k < points.length && matches.length < 100; k++) {
      for (const v of CORRELATION_VARGAS) {
        if (matches.length >= 100) break;
        const N = v === 0 ? points[k] : vargaLongitude(transitPoints[k], ALL_VARGAS[VARGA_ORDER[v]]);
        const m = { point: NATAL_POINTS[k], varga: v, natalLon: N };
        if (mode === 0) {
          const pct = aspectPercent(N, T, g);
          if (Math.trunc(Math.abs(pct)) >= (o.minPercent ?? 80)) matches.push({ ...m, value: pct });
        } else if (mode === 1) {
          const [orb, name] = namedAspect(N, T, b, o.orbAspect ?? 4);
          if (name !== 'None' && name !== '1/4') matches.push({ ...m, value: orb, name });
        } else {
          const orb = mode === 2 ? windowOrb(N, T, b, o.orbQuadrant ?? 4, [90, 180, 270]) : windowOrb(N, T, b, o.orbTrine ?? 4, [120, 240, 180]);
          if (orb < 360) matches.push({ ...m, value: orb });
        }
      }
    }
    return { planet: b, lon: T, speed: (o.speeds?.[b] ?? transit.positions.grahas[g].speed) / MEAN_SPEED[b], matches };
  });
}

/** The list as CTranResearchView fills it (FUN_00487280). */
export function correlationTable(rows: CorrelationRow[], mode = 0): Table {
  const out: string[][] = [];
  for (const r of rows) {
    r.matches.forEach((m, i) => {
      const value = mode === 0 ? m.value.toFixed(2) : mode === 1 ? `${m.value.toFixed(1)} (${m.name})` : m.value.toFixed(1);
      out.push([i === 0 ? BODY_NAMES[r.planet] : '', i === 0 ? formatLongitude(r.lon) : '', i === 0 ? r.speed.toFixed(4) : '',
        `${m.point} in ${CORRELATION_VARGA_LABEL[m.varga]}`, value, formatLongitude(m.natalLon)]);
    });
  }
  return { headers: ['Transit Planet', 'Transit Longitude', 'Speed', 'Natal Point', mode === 0 ? 'Aspect %' : 'Aspect Orb (deg)', 'Natal Longitude'], rows: out };
}

/** << / >> stepping of the form date (combo 1080); calendar steps for the first three, JD steps otherwise. */
export function stepDate(swe: Sweph, d: TransitDate, step: number, dir: 1 | -1): TransitDate {
  if (step === 0) return { ...d, year: d.year + dir };
  if (step === 1 || step === 2) {
    const m0 = d.month - 1 + dir * (step === 1 ? 3 : 1);
    const y = d.year + Math.floor(m0 / 12);
    return { ...d, year: y, month: ((m0 % 12) + 12) % 12 + 1 };
  }
  const days = [0, 0, 0, 10, 5, 1, 1 / 24][step] * dir;
  const r = swe.revjul(swe.julday(d.year, d.month, d.day, d.hour) + days);
  return { year: r.year, month: r.month, day: r.day, hour: r.hour };
}
