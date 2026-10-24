// One-call chart computation used by the UI: birth data -> positions in any varga.
import type { Sweph } from '../sweph';
import { birthJdUt, type BirthData } from './jhd';
import { computePositions, GRAHAS, type Graha, type Positions } from './positions';
import { calcSettingsFromIni } from './settings';
import { ALL_VARGAS, vargaLongitude, type VargaName } from './vargas';
import { DEFAULTS, type JhoraIni } from '../settings/generated';
import { allBodies, type NamedBody } from './longitudes';
import { dayFrame, type DayFrame } from './day';

export interface ChartBody { id: Graha | 'Lagna'; label: string; lon: number; retrograde: boolean }

export interface Chart {
  birth: BirthData;
  /** complete settings in effect for this chart (JHora ini keys) */
  ini: JhoraIni;
  positions: Positions;
  /** D-1 bodies: Lagna first, then the nine grahas */
  bodies: ChartBody[];
  /** the 56 bodies of JHora's Longitudes table, in its order */
  longitudes: NamedBody[];
  /** sunrise/sunset frame of the birth */
  day: DayFrame;
}

export const SHORT_LABEL: Record<Graha | 'Lagna', string> = {
  Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
  Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

export async function computeChart(swe: Sweph, birth: BirthData, iniOverrides: Partial<JhoraIni> = {}): Promise<Chart> {
  const ini: JhoraIni = { ...DEFAULTS, ...iniOverrides };
  const jd = birthJdUt(birth, (y, m, d, h) => swe.julday(y, m, d, h));
  await swe.ensureEphemeris(jd);
  const geo = { lat: birth.lat, lon: birth.lon, alt: birth.altitudeM };
  const settings = calcSettingsFromIni(ini);
  const positions = applyOverride(computePositions(swe, jd, geo, settings), birth);
  const day = dayFrame(swe, jd, geo, settings, ini.SunriseDefinition);
  const longitudes = allBodies(swe, positions, geo, birth.tzHours, settings, ini, day);
  const bodies: ChartBody[] = [
    { id: 'Lagna', label: SHORT_LABEL.Lagna, lon: positions.ascendant, retrograde: false },
    ...GRAHAS.map((g) => ({
      id: g, label: SHORT_LABEL[g], lon: positions.grahas[g].lon,
      retrograde: positions.grahas[g].retrograde && g !== 'Rahu' && g !== 'Ketu',
    })),
  ];
  return { birth, ini, positions, bodies, longitudes, day };
}

/** Substitute a derived chart's fixed longitudes (BirthData.override) into computed positions. */
export function applyOverride(p: Positions, birth: BirthData): Positions {
  const o = birth.override;
  if (!o) return p;
  const grahas = { ...p.grahas };
  for (const [g, lon] of Object.entries(o.grahas ?? {}) as [Graha, number][]) {
    if (lon === undefined) continue;
    grahas[g] = { ...grahas[g], lon: ((lon % 360) + 360) % 360 };
  }
  return { ...p, grahas, ascendant: o.ascendant === undefined ? p.ascendant : ((o.ascendant % 360) + 360) % 360 };
}

/** Bodies grouped by the sign they occupy in a varga (index 0 = Aries). */
export function signsInVarga(chart: Pick<Chart, 'bodies'>, varga: VargaName): ChartBody[][] {
  const out: ChartBody[][] = Array.from({ length: 12 }, () => []);
  for (const b of chart.bodies) {
    const lon = vargaLongitude(b.lon, ALL_VARGAS[varga]);
    out[Math.floor(lon / 30) % 12].push({ ...b, lon });
  }
  return out;
}
