// Dasa time: periods are measured in dasa years from the birth moment and
// turned into Julian days according to JHora's year definition.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { siderealLongitude } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { jhoraCrossing, recordRoundTrip, SUN_SEARCH } from '../tajaka/search';

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
      // FUN_0049dae0 mode 3 -> FUN_0049dc20: JHora's search (tajaka/search.ts) for the Sun at
      // chartSun + 360 x years, backwards from chart + years x 365.24219 + 30 days; the found
      // moment is a record (tajaka/annual.ts sunSearch)
      const settings = calcSettingsFromIni(chart.ini);
      const sun0 = chart.positions.grahas.Sun.lon;
      const lon = (jd: number) => siderealLongitude(swe, jd, 'Sun', settings).lon;
      return {
        toJd: (years) => recordRoundTrip(swe, chart.birth.tzHours, jhoraCrossing(lon, years * 360 + sun0, birth + years * 365.24219 + 30, SUN_SEARCH)),
      };
    }
    default:
      throw new Error(`year definition ${def} not implemented yet`);
  }
}
