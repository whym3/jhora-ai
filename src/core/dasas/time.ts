// Dasa time: periods are measured in dasa years from the birth moment and
// turned into Julian days according to JHora's year definition.
// The per-dasa definitions (ini YearDefinition / YearLength, 75 slots) and the
// clocks of the other definitions are in yearDefinition.ts.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import { siderealLongitude } from '../positions';
import { calcSettingsFromIni } from '../settings';
import { jhoraCrossing, recordRoundTrip, SUN_SEARCH } from '../tajaka/search';

export type YearDefinition =
  | 'mean-tropical' | 'savana' | 'user' | 'true-sidereal' | 'tithi-360' | 'lunar' | 'mean-sidereal' | 'true-tropical';

/**
 * JHora's YearDefinition ini values, by value: menu ids 32882 -> 0, 32883 -> 1, 32884 -> 2,
 * 32885 -> 3, 32886 -> 4, 33418 -> 6, 33419 -> 7 (handlers 0x450220..0x450280 -> FUN_00450290).
 * Value 5 (FUN_0049e1b0, a Moon-based year) is not reachable from the menu.
 */
export const YEAR_DEFINITIONS: YearDefinition[] = ['mean-tropical', 'savana', 'user', 'true-sidereal', 'tithi-360', 'lunar', 'mean-sidereal', 'true-tropical'];

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
      // tithi, true tropical and lunar years: yearDefinition.ts yearClock
      throw new Error(`year definition ${def}: use yearClock (dasas/yearDefinition.ts)`);
  }
}
