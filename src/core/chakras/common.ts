// Shared data for the Chakras sub-tabs (Kalachakra, Sarvatobhadra, Kota,
// Surya/Chandra Kalanala, Sudarsana, Shoola, Tripataki, Mixed 2-Vargas).
//
// jhora.exe facts used by every chakra:
// * View classes are MFC CRuntimeClass objects (no C++ RTTI): name string ->
//   CRuntimeClass -> GetRuntimeClass (vtable slot 0) -> vtable; OnDraw is
//   vtable slot 60 (+0xf0), OnUpdate slot 56, GetMessageMap slot 10.
//     CKalaChakraView        RTC 0x54bd40 vtbl 0x54be98 OnDraw 0x455260
//     CSarvatobhadraChakraView RTC 0x54da30 vtbl 0x54dde0 OnDraw 0x471c20 (OnUpdate 0x471b70)
//     CKotaChakraView        RTC 0x54bfa0 vtbl 0x54c050 OnDraw 0x457ad0
//     CSKChakraView (Surya Kalanala)  RTC 0x54e448 vtbl 0x54e5a0 OnDraw 0x47a920 (OnUpdate 0x47a900)
//     CCKChakraView (Chandra Kalanala) RTC 0x5499a0 vtbl 0x549af8 OnDraw 0x444c20
//     CSudarsanaChakraView   RTC 0x54ecc0 vtbl 0x54eda0 OnDraw 0x481580
//     CShoolaChakraView      RTC 0x54e1e8 vtbl 0x54e340 OnDraw 0x4784a0
//     CTripatakiChakraView   RTC 0x550658 vtbl 0x550780 OnDraw 0x490ff0
//     CMixedChartView        RTC 0x54ca58 vtbl 0x54cad8 OnDraw 0x45cc40
// * None of these views has a copy-to-clipboard command in its message map
//   (32974 belongs to CCoreInfoView/CDasaSignTransitView/CHoroscopeMatchView,
//   33366 to CTranResearchView); golden output must come from screenshots or
//   from reading the drawn text.
// * Internal body indices (runtime name tables 0x8a49bc long / 0x8a4684 short,
//   filled at 0x4ef180): see JHORA_BODIES below. The per-chart nakshatra byte
//   of body b (28-star scheme, Abhijit = 21) is at chart+0x1705+b.
import type { Chart, ChartBody } from '../chart';
import type { NamedBody } from '../longitudes';
import type { Positions } from '../positions';
import { GRAHAS, norm360 } from '../positions';
import { nakshatra28Of, NAK28, signOf } from '../zodiac';
import { weekdayOf } from '../bodies';

/**
 * The chart data a chakra needs. A full core `Chart` satisfies it; so does the
 * worker's `ChartResult` ({ positions, bodies }) - builders then skip bodies
 * that need `longitudes` (special lagnas, upagrahas, sphutas) or `day`/`birth`
 * (weekday).
 */
export type ChakraChart = Pick<Chart, 'positions' | 'bodies'> & Partial<Pick<Chart, 'longitudes' | 'day' | 'birth' | 'ini'>>;

/** JHora's internal body index order (long name, short label). */
export const JHORA_BODIES: [string, string][] = [
  ['Lagna', 'As'], ['Sun', 'Su'], ['Moon', 'Mo'], ['Mars', 'Ma'], ['Mercury', 'Me'], ['Jupiter', 'Ju'],
  ['Venus', 'Ve'], ['Saturn', 'Sa'], ['Rahu', 'Ra'], ['Ketu', 'Ke'], ['Uranus', 'Ur'], ['Neptune', 'Ne'],
  ['Pluto', 'Pl'], ['Bhava Lagna', 'BL'], ['Hora Lagna', 'HL'], ['Ghati Lagna', 'GL'], ['Vighati Lagna', 'VG'],
  ['Pranapada Lagna', 'PP'], ['Sree Lagna', 'SL'], ['Indu Lagna', 'IL'], ['Bhrigu Bindu', 'BB'], ['Kunda', 'Ku'],
  ['Dhooma', 'Dh'], ['Vyatipata', 'Vy'], ['Parivesha', 'PV'], ['Indra Chapa', 'IC'], ['Upaketu', 'UK'],
  ['Kaala', 'Kl'], ['Mrityu', 'Mri'], ['Artha Prahara', 'AP'], ['Yama Ghantaka', 'YG'], ['Maandi', 'Md'],
  ['Gulika', 'Gk'], ['Prana Sphuta', 'PS'], ['Deha Sphuta', 'DS'], ['Mrityu Sphuta', 'MS'],
  ['Sookshma TriSphuta', 'STS'], ['Tithi Sphuta', 'TS'], ['Yoga Sphuta (Sun-Moon)', 'YS'],
  ['Rahu Tithi Sphuta', 'RTS'], ['Kshetra Sphuta', 'KS'], ['Beeja Sphuta', 'BS'], ['TriSphuta', 'TS'],
  ['ChatusSphuta', 'CS'], ['PanchaSphuta', 'PS'], ['Yoga Sphuta', 'YO'], ['Avayoga Sphuta', 'AY'],
  ['Varnada Lagna', 'VL'],
];

/** A body placed in a chakra. `transit` marks positions from the transit chart. */
export interface ChakraBody {
  /** JHora internal body index (see JHORA_BODIES), or -1 for non-body points (sahamas etc.) */
  index: number;
  label: string;
  lon: number;
  retrograde: boolean;
  transit?: boolean;
}

/** Longitude of internal body `index`, or null when the chart data lacks it. */
export function bodyLongitude(chart: ChakraChart, index: number): number | null {
  if (index === 0) return chart.positions.ascendant;
  if (index >= 1 && index <= 9) return chart.positions.grahas[GRAHAS[index - 1]].lon;
  if (index >= 10 && index <= 12) return chart.positions.outer[(['Uranus', 'Neptune', 'Pluto'] as const)[index - 10]].lon;
  const name = JHORA_BODIES[index]?.[0];
  const hit = chart.longitudes?.find((b: NamedBody) => b.name === name);
  return hit ? hit.lon : null;
}

/** The body as a ChakraBody (null when unavailable). Retrograde marks only Ma..Sa as JHora's charts do. */
export function chakraBody(chart: ChakraChart, index: number, transit = false): ChakraBody | null {
  const lon = bodyLongitude(chart, index);
  if (lon === null) return null;
  const g = index >= 1 && index <= 7 ? chart.positions.grahas[GRAHAS[index - 1]] : null;
  return { index, label: JHORA_BODIES[index][1].trim(), lon: norm360(lon), retrograde: !!g?.retrograde, transit };
}

/** Bodies 0..9 (lagna and the nine grahas) - JHora's "Show Planets" set. */
export function planetBodies(chart: ChakraChart, transit = false): ChakraBody[] {
  return Array.from({ length: 10 }, (_, i) => chakraBody(chart, i, transit)!);
}

/** Bodies by internal index, skipping those the chart data lacks. */
export function bodiesByIndex(chart: ChakraChart, indices: number[], transit = false): ChakraBody[] {
  return indices.map((i) => chakraBody(chart, i, transit)).filter((b): b is ChakraBody => b !== null);
}

/** Weekday (0 = Sunday) of the chart's (sunrise-based) day, when the chart carries day + birth data. */
export function chartWeekday(chart: ChakraChart): number | null {
  if (!chart.day || !chart.birth) return null;
  return weekdayOf(chart.day.sunrise, chart.birth.tzHours);
}

/** Tithi index 0..29 (0 = Sukla Pratipat, 29 = Amavasya) from Moon - Sun. */
export function chartTithi(chart: ChakraChart): number {
  const g = chart.positions.grahas;
  return Math.trunc(norm360(g.Moon.lon - g.Sun.lon) / 12) % 30;
}

export { nakshatra28Of, NAK28, signOf };
export type { ChartBody };
