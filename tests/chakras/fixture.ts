// Synthetic ChakraChart for the chakra tests (no ephemeris).
import type { ChakraChart } from '../../src/core/chakras/common';
import { GRAHAS, type Positions } from '../../src/core/positions';

/** lons = Sun..Ketu sidereal longitudes; retro = graha names drawn retrograde (nodes always). */
export function fixtureChart(lons: number[], asc = 100, retro: string[] = []): ChakraChart {
  const body = (lon: number, r = false) => ({ lon, lat: 0, speed: r ? -0.1 : 1, retrograde: r });
  const grahas = Object.fromEntries(GRAHAS.map((g, i) => [g, body(lons[i], retro.includes(g) || g === 'Rahu' || g === 'Ketu')])) as Positions['grahas'];
  const positions: Positions = {
    jdUt: 2451545, jdEt: 2451545, ayanamsa: 23.8, ayanamsaMean: 23.8, ascendant: asc, grahas,
    outer: { Uranus: body(10), Neptune: body(20), Pluto: body(30) },
  };
  return { positions, bodies: [] };
}
