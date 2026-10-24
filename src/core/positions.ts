// Sidereal positions of the grahas and the lagna, following jhora.exe's
// planet routine FUN_0049aaa0:
//
// * Planets: swe_calc at ET (jd_ut + swe_deltat) with Lahiri sidereal mode,
//   then shifted so that Spica (computed with the same flags) sits at 180 deg.
//   Algebraically this is  tropical(planet) - tropical(Spica) + 180.
// * Lagna: tropical ascendant from swe_houses minus the ayanamsa JHora stores
//   at doc+0x1680. That value comes from swe_get_ayanamsa (mean, no nutation),
//   so the lagna is effectively reduced by the nutation-free Spica longitude.
import { SE, type Sweph } from '../sweph';
import type { Settings } from './settings';
import { jhoraDeltaT } from './deltat';
import { JHORA_SPICA } from './engine';

export const GRAHAS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
export type Graha = (typeof GRAHAS)[number];

const SWE_ID: Record<Exclude<Graha, 'Rahu' | 'Ketu'>, number> = {
  Sun: SE.SUN, Moon: SE.MOON, Mars: SE.MARS, Mercury: SE.MERCURY,
  Jupiter: SE.JUPITER, Venus: SE.VENUS, Saturn: SE.SATURN,
};

export interface BodyPosition {
  lon: number;        // sidereal longitude, 0..360
  lat: number;
  speed: number;      // deg/day in longitude
  retrograde: boolean;
}

export type OuterPlanet = 'Uranus' | 'Neptune' | 'Pluto';
const OUTER_ID: Record<OuterPlanet, number> = { Uranus: SE.URANUS, Neptune: SE.NEPTUNE, Pluto: SE.PLUTO };

export interface Positions {
  jdUt: number;
  jdEt: number;
  /** ayanamsa applied to planets (true equinox of date) */
  ayanamsa: number;
  /** ayanamsa applied to the lagna and house cusps (no nutation) */
  ayanamsaMean: number;
  ascendant: number;
  grahas: Record<Graha, BodyPosition>;
  outer: Record<OuterPlanet, BodyPosition>;
}

export const norm360 = (x: number) => ((x % 360) + 360) % 360;

export function calcFlags(s: Settings): number {
  let f = SE.FLG_SWIEPH;
  if (s.truePositions) f |= SE.FLG_TRUEPOS;
  if (s.noNutation) f |= SE.FLG_NONUT;
  if (s.noAberration) f |= SE.FLG_NOABERR;
  if (s.noGravDeflection) f |= SE.FLG_NOGDEFL;
  if (s.topocentric) f |= SE.FLG_TOPOCTR;
  return f;
}

/** Ayanamsa for planets and for the lagna, in degrees. */
export function ayanamsa(swe: Sweph, jdUt: number, jdEt: number, s: Settings): { trueEq: number; mean: number } {
  const flags = calcFlags(s);
  switch (s.ayanamsa) {
    case 'tropical':
      return { trueEq: s.ayanamsaDelta, mean: s.ayanamsaDelta };
    case 'lahiri': {
      swe.setSidMode(1);
      const mean = swe.ayanamsaUt(jdUt, SE.FLG_SWIEPH | SE.FLG_NONUT);
      return { trueEq: mean + s.ayanamsaDelta, mean: mean + s.ayanamsaDelta };
    }
    case 'true-chitrapaksha': {
      // JHora's own Spica record (see data/sefstars.txt); Swiss 2.10's built-in
      // Spica has slightly different proper motion (~0.04" in 1863).
      const t = swe.fixstarEt(JHORA_SPICA, jdEt, flags).lon - 180;
      const m = swe.fixstarEt(JHORA_SPICA, jdEt, flags | SE.FLG_NONUT).lon - 180;
      return { trueEq: t + s.ayanamsaDelta, mean: m + s.ayanamsaDelta };
    }
  }
}

export function computePositions(
  swe: Sweph, jdUt: number, geo: { lat: number; lon: number; alt: number }, s: Settings,
): Positions {
  const flags = calcFlags(s);
  if (s.topocentric) swe.setTopo(geo.lon, geo.lat, geo.alt);
  const jdEt = jdUt + (jhoraDeltaT(jdUt) ?? swe.deltaT(jdUt));
  const ay = ayanamsa(swe, jdUt, jdEt, s);

  const grahas = {} as Record<Graha, BodyPosition>;
  for (const g of Object.keys(SWE_ID) as (keyof typeof SWE_ID)[]) {
    const p = swe.calcEt(jdEt, SWE_ID[g], flags);
    grahas[g] = { lon: norm360(p.lon - ay.trueEq), lat: p.lat, speed: p.speedLon, retrograde: p.speedLon < 0 };
  }
  const node = swe.calcEt(jdEt, s.trueNodes ? SE.TRUE_NODE : SE.MEAN_NODE, flags);
  grahas.Rahu = { lon: norm360(node.lon - ay.trueEq), lat: node.lat, speed: node.speedLon, retrograde: true };
  grahas.Ketu = { lon: norm360(node.lon - ay.trueEq + 180), lat: -node.lat, speed: node.speedLon, retrograde: true };

  const outer = {} as Record<OuterPlanet, BodyPosition>;
  for (const o of Object.keys(OUTER_ID) as OuterPlanet[]) {
    const p = swe.calcEt(jdEt, OUTER_ID[o], flags);
    outer[o] = { lon: norm360(p.lon - ay.trueEq), lat: p.lat, speed: p.speedLon, retrograde: p.speedLon < 0 };
  }

  const houses = swe.houses(jdUt, 0, geo.lat, geo.lon, 'P');
  return {
    jdUt, jdEt,
    ayanamsa: ay.trueEq,
    ayanamsaMean: ay.mean,
    ascendant: norm360(houses.ascmc[0] - ay.mean),
    grahas,
    outer,
  };
}

/** Sidereal longitude and speed of one body (as computePositions does it), for root finding. */
export function siderealLongitude(swe: Sweph, jdUt: number, body: Graha, s: Settings): { lon: number; speed: number } {
  const flags = calcFlags(s);
  const jdEt = jdUt + (jhoraDeltaT(jdUt) ?? swe.deltaT(jdUt));
  const ay = ayanamsa(swe, jdUt, jdEt, s);
  const id = body === 'Rahu' || body === 'Ketu' ? (s.trueNodes ? SE.TRUE_NODE : SE.MEAN_NODE) : SWE_ID[body];
  const p = swe.calcEt(jdEt, id, flags);
  return { lon: norm360(p.lon - ay.trueEq + (body === 'Ketu' ? 180 : 0)), speed: p.speedLon };
}
