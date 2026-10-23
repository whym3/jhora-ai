// One-call chart computation used by the UI: birth data -> positions in any varga.
import type { Sweph } from '../sweph';
import { birthJdUt, type BirthData } from './jhd';
import { computePositions, GRAHAS, type Graha, type Positions } from './positions';
import { DEFAULT_SETTINGS, type Settings } from './settings';
import { ALL_VARGAS, vargaLongitude, type VargaName } from './vargas';

export interface ChartBody { id: Graha | 'Lagna'; label: string; lon: number; retrograde: boolean }

export interface Chart {
  birth: BirthData;
  positions: Positions;
  /** D-1 bodies: Lagna first, then the nine grahas */
  bodies: ChartBody[];
}

export const SHORT_LABEL: Record<Graha | 'Lagna', string> = {
  Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
  Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

export async function computeChart(swe: Sweph, birth: BirthData, settings: Settings = DEFAULT_SETTINGS): Promise<Chart> {
  const jd = birthJdUt(birth, (y, m, d, h) => swe.julday(y, m, d, h));
  await swe.ensureEphemeris(jd);
  const positions = computePositions(swe, jd, { lat: birth.lat, lon: birth.lon, alt: birth.altitudeM }, settings);
  const bodies: ChartBody[] = [
    { id: 'Lagna', label: SHORT_LABEL.Lagna, lon: positions.ascendant, retrograde: false },
    ...GRAHAS.map((g) => ({
      id: g, label: SHORT_LABEL[g], lon: positions.grahas[g].lon,
      retrograde: positions.grahas[g].retrograde && g !== 'Rahu' && g !== 'Ketu',
    })),
  ];
  return { birth, positions, bodies };
}

/** Bodies grouped by the sign they occupy in a varga (index 0 = Aries). */
export function signsInVarga(chart: Chart, varga: VargaName): ChartBody[][] {
  const out: ChartBody[][] = Array.from({ length: 12 }, () => []);
  for (const b of chart.bodies) {
    const lon = vargaLongitude(b.lon, ALL_VARGAS[varga]);
    out[Math.floor(lon / 30) % 12].push({ ...b, lon });
  }
  return out;
}
