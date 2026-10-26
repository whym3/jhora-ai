// One-call chart computation used by the UI: birth data -> positions in any varga.
import type { Sweph } from '../sweph';
import { birthJdUt, type BirthData } from './jhd';
import { computePositions, GRAHAS, nakshatraShift, type Graha, type Positions } from './positions';
import { applyNodalExaltation } from './signStrength';
import { calcSettingsFromIni } from './settings';
import { vargaLongitude, type VargaName } from './vargas';
import { vargaSpec, type VargaIni } from './vargaOptions';
import { DEFAULTS, type JhoraIni } from '../settings/generated';
import { allBodies, type NamedBody } from './longitudes';
import { dayFrame, type DayFrame } from './day';
import { userPoints, type UserPoint } from './userPoints';
import { varnada } from './bodies';

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
  /**
   * FUN_0049a930's offset added to body longitudes before their nakshatras are found
   * (SiderealNaksharasInTropical with the tropical zodiac; 0 otherwise). positions.ts nakshatraShift.
   */
  nakshatraShift?: number;
  /** Edit menu's special point and planetary special lagna, when on (src/core/userPoints.ts) */
  userPoints?: UserPoint[];
}

export const SHORT_LABEL: Record<Graha | 'Lagna', string> = {
  Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju',
  Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};

export async function computeChart(swe: Sweph, input: BirthData, iniOverrides: Partial<JhoraIni> = {}): Promise<Chart> {
  const ini: JhoraIni = { ...DEFAULTS, ...iniOverrides };
  // NodalExaltationParasara: JHora patches its exaltation tables when the option is set (FUN_004b9280)
  applyNodalExaltation(ini.NodalExaltationParasara !== 0);
  // a file without an altitude field gets DefaultAltitude, in the calculations too (it moves
  // e.g. a local eclipse's contacts: 0.16 s for 425 m)
  const birth = input.altitudeGiven === false ? { ...input, altitudeM: ini.DefaultAltitude } : input;
  const jd = birthJdUt(birth, (y, m, d, h) => swe.julday(y, m, d, h));
  await swe.ensureEphemeris(jd);
  const geo = { lat: birth.lat, lon: birth.lon, alt: birth.altitudeM, pressure: birth.pressureMbar, temperature: birth.temperatureC };
  const settings = calcSettingsFromIni(ini);
  const raw = computePositions(swe, jd, geo, settings);
  const computed = applyOverride(raw, birth);
  const day = dayFrame(swe, jd, geo, settings, ini.SunriseDefinition);
  let computedBodies = allBodies(swe, birth.override?.afterBodies ? raw : computed, geo, birth.tzHours, settings, ini, day);
  if (birth.override?.afterBodies) {
    // ... but the varnadas are worked out from the replaced lagna
    const hl = computedBodies.find((b) => b.name === 'Hora Lagna')!.lon;
    computedBodies = computedBodies.map((b) => {
      const h = b.name === 'Varnada Lagna' ? 1 : /^V(\d+)$/.test(b.name) ? Number(b.name.slice(1)) : 0;
      return h ? { ...b, lon: varnada(norm(computed.ascendant + 30 * (h - 1)), norm(hl + 30 * (h - 1))) } : b;
    });
  }
  const sh = birth.override?.shift;
  const positions = sh === undefined ? computed : shiftPositions(computed, sh);
  const longitudes = sh === undefined ? computedBodies : computedBodies.map((b) => ({ ...b, lon: norm(b.lon + sh) }));
  const bodies: ChartBody[] = [
    { id: 'Lagna', label: SHORT_LABEL.Lagna, lon: positions.ascendant, retrograde: false },
    ...GRAHAS.map((g) => ({
      id: g, label: SHORT_LABEL[g], lon: positions.grahas[g].lon,
      retrograde: positions.grahas[g].retrograde && g !== 'Rahu' && g !== 'Ketu',
    })),
  ];
  const chart: Chart = { birth, ini, positions, bodies, longitudes, day };
  const shift = nakshatraShift(swe, jd, settings);
  if (shift) chart.nakshatraShift = shift;
  // the user points are bodies 103/104: computed unshifted like the rest, then shifted
  const points = userPoints(swe, sh === undefined ? chart : { ...chart, positions: computed, longitudes: computedBodies });
  chart.userPoints = sh === undefined ? points : points.map((u) => ({ ...u, lon: norm(u.lon + sh) }));
  return chart;
}

const norm = (lon: number) => ((lon % 360) + 360) % 360;

/** Positions with `shift` degrees added to the lagna, the grahas and the outer planets (PositionOverride.shift). */
function shiftPositions(p: Positions, shift: number): Positions {
  const grahas = { ...p.grahas };
  for (const g of GRAHAS) grahas[g] = { ...grahas[g], lon: norm(grahas[g].lon + shift) };
  const outer = { ...p.outer };
  for (const o of Object.keys(outer) as (keyof Positions['outer'])[]) outer[o] = { ...outer[o], lon: norm(outer[o].lon + shift) };
  return { ...p, grahas, outer, ascendant: norm(p.ascendant + shift) };
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
export function signsInVarga(chart: Pick<Chart, 'bodies'> & { ini?: VargaIni }, varga: VargaName): ChartBody[][] {
  const out: ChartBody[][] = Array.from({ length: 12 }, () => []);
  for (const b of chart.bodies) {
    const lon = vargaLongitude(b.lon, vargaSpec(varga, chart.ini));
    out[Math.floor(lon / 30) % 12].push({ ...b, lon });
  }
  return out;
}
