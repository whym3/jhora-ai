// Dasa time: periods are measured in dasa years from the birth moment and
// turned into Julian days according to JHora's year definition.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { siderealLongitude } from '../positions';
import { calcSettingsFromIni } from '../settings';

export type YearDefinition =
  | 'mean-tropical' | 'savana' | 'user' | 'true-sidereal' | 'tithi-360' | 'mean-sidereal' | 'true-tropical';

/** JHora's YearDefinition ini values (menu ids 32882..32886, then 33418/33419). */
export const YEAR_DEFINITIONS: YearDefinition[] = ['mean-tropical', 'savana', 'user', 'true-sidereal', 'tithi-360', 'mean-sidereal', 'true-tropical'];

export interface DasaClock { toJd(years: number): number }

export function dasaClock(swe: Sweph, chart: Chart, def: YearDefinition = 'true-sidereal', userDays = 365.24219): DasaClock {
  const birth = chart.positions.jdUt;
  const fixed = (days: number): DasaClock => ({ toJd: (y) => birth + y * days });
  switch (def) {
    case 'mean-tropical': return fixed(365.24219);
    case 'mean-sidereal': return fixed(365.256364);
    case 'savana': return fixed(360);
    case 'user': return fixed(userDays);
    case 'true-sidereal': {
      const settings = calcSettingsFromIni(chart.ini);
      const sun0 = chart.positions.grahas.Sun.lon;
      return {
        toJd(years) {
          // the Sun moves 360 sidereal degrees per dasa year
          const target = sun0 + years * 360;
          let t = birth + years * 365.256364;
          for (let i = 0; i < 8; i++) {
            const { lon, speed } = siderealLongitude(swe, t, 'Sun', settings);
            let d = (target - lon) % 360;
            if (d > 180) d -= 360; else if (d < -180) d += 360;
            t += d / speed;
            if (Math.abs(d) < 1e-9) break;
          }
          return t;
        },
      };
    }
    default:
      throw new Error(`year definition ${def} not implemented yet`);
  }
}
