// Sidereal positions of the grahas and the lagna, following jhora.exe's
// planet routine FUN_0049aaa0:
//
// * Planets: swe_calc at ET (jd_ut + swe_deltat) with the sidereal mode of the
//   user's ayanamsa (sid-mode table FUN_0049a3a0), less DeltaFromUserSelectedAyanamsa.
//   The star ayanamsas then shift every longitude so that their star (computed with
//   the same flags) sits at its fixed longitude: for Spica at 180 deg this is
//   algebraically  tropical(planet) - tropical(Spica) + 180.
// * Lagna: tropical ascendant from swe_houses minus the ayanamsa JHora stores
//   at doc+0x1680 (FUN_0049a370 + the star shift). That value comes from
//   swe_get_ayanamsa (mean, no nutation), so the lagna is effectively reduced by
//   the nutation-free star longitude.
import { SE, type Position, type Sweph } from '../sweph';
import type { AyanamsaId, Settings } from './settings';
import { jhoraDeltaT } from './deltat';
import { jhoraStarName } from './engine';
import { apparentAhargana, computePositionsSSS, sssAyanamsa, UJJAIN_LON } from './sss';

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

const SE_SIDBIT_SSY_PLANE = 512;
/** Swiss sid mode of each ayanamsa as FUN_0049a3a0 sets it (null: its "tropical" flag DAT_008a1ecc). */
const SID_MODE: Record<Exclude<AyanamsaId, 'custom-star'>, number | null> = {
  'lahiri': 1, 'jagannatha': 0 | SE_SIDBIT_SSY_PLANE, 'raman': 3, 'deva-datta': 1, 'kp': 5,
  'usha-shashi': 4, 'yukteshwar': 7, 'jn-bhasin': 8, 'chandra-hari': null, 'fagan': 0, 'deluce': 2,
  'djwhal-khul': 6, 'aldebaran-15ta': 14, 'galactic-center': 17, 'hipparchos': 15, 'sassanian': 16,
  'tropical': null, 'true-chitrapaksha': 1, 'sss': null, 'rohini-paksha': 1, 'pushya-paksha': 1,
};

/**
 * Swiss 2.02.01's own definitions (t0 as ET, ayanamsa at t0) of the sid modes JHora
 * uses, read from swedll32.dll's ayanamsa table (file offset 0x40198). Swiss 2.10
 * redefined several of them (Lahiri, Fagan, De Luce, Raman, KP, Aldebaran, the
 * galactic centre), so they are set as SE_SIDM_USER with these values.
 */
const SWISS_202_SID: Record<number, [number, number]> = {
  0: [2433282.5, 24.042044444], 1: [2435553.5, 23.245522556], 2: [2415020.0, 26.41305],
  3: [2415020.0, 21.01443999999998], 4: [2415020.0, 18.66095999999999], 5: [2415020.0, 22.363888999999972],
  6: [2415020.0, 26.963097600000026], 7: [2415020.0, 21.082222], 8: [2415020.0, 21.365556000000026],
  14: [1684532.5, -4.44088389], 15: [1674484.0, -9.33333], 16: [1927135.8747793, 0], 17: [1746447.518, 0],
};
const SE_SIDM_USER = 255;

/** swe_set_sid_mode as the 2.02.01 DLL understood JHora's mode number. */
function setSidMode(swe: Sweph, sid: number): void {
  const d = SWISS_202_SID[sid];
  if (d) swe.setSidMode(SE_SIDM_USER, d[0], d[1]);
  else swe.setSidMode(sid);
}

/** Deva-datta: FUN_0049a3a0 takes 0 22' 37" off the user's correction (FUN_0049a730 adds it back when saving). */
const DEVA_DATTA = 0.37694444444444447;

/**
 * The star FUN_0049aaa0 holds at a fixed sidereal longitude (FUN_0049a930 for
 * Spica): fixstars.cat search string and longitude. The constants are the
 * doubles at 0x546be0 (180), 0x551710 (46.666...), 0x551708 (106), 0x551700 (240);
 * the custom one is CustomStarCode / CustomStarLongitude.
 */
export function ayanamsaStar(s: Settings): { star: string; lon: number } | null {
  switch (s.ayanamsa) {
    case 'true-chitrapaksha': case 'jagannatha': return { star: 'Spica', lon: 180 };
    case 'rohini-paksha': return { star: 'Aldebaran', lon: 46.666666666666664 };
    case 'pushya-paksha': return { star: ',deCnc', lon: 106 };
    case 'chandra-hari': return { star: 'Shaula', lon: 240 };
    case 'custom-star': return { star: s.customStar?.code ?? ',alVir', lon: s.customStar?.lon ?? 180 };
    default: return null;
  }
}

/** Swiss sid mode for SEFLG_SIDEREAL calculations, or null when JHora computes tropically. */
function sidMode(s: Settings): number | null {
  if (s.ayanamsa === 'custom-star') return s.customStar?.fixedPlane ? SE_SIDBIT_SSY_PLANE : 1;
  return SID_MODE[s.ayanamsa];
}

/** The ayanamsa of a chart, degrees. */
export interface AyanamsaValue {
  /** subtracted from tropical (true equinox of date) longitudes of the planets */
  trueEq: number;
  /** subtracted from the tropical lagna and house cusps: doc+0x1680 */
  mean: number;
  /**
   * Solar-system-plane modes (Jagannatha, custom star with a fixed plane): Swiss
   * projects each planet onto that plane, so planets are not tropical - trueEq but
   * swe_calc(SEFLG_SIDEREAL, sidMode) + shift (bodyLongitude); trueEq is then the
   * value for a body on the ecliptic (the Sun).
   */
  plane?: { sidMode: number; shift: number };
}

/**
 * FUN_0049a370: swe_get_ayanamsa(jd) for the current sid mode (0 for the tropical
 * flag). FUN_0049aaa0 hands it the UT moment where the DLL expects ET; Swiss
 * 2.10's UT entry point adds delta-T, so evaluate it at the UT moment that many
 * days earlier (good to ~1e-11 day).
 */
function swissAyanamsaAtUt(swe: Sweph, jdUt: number, jdEt: number, sid: number | null): number {
  if (sid === null) return 0;
  setSidMode(swe, sid);
  return swe.ayanamsaUt(2 * jdUt - jdEt, SE.FLG_SWIEPH | SE.FLG_NONUT);
}

/** FUN_0049a370 for the user's ayanamsa: swe_get_ayanamsa at the UT moment (0 when tropical) + correction. */
export function swissAyanamsa(swe: Sweph, jdUt: number, jdEt: number, s: Settings): number {
  return swissAyanamsaAtUt(swe, jdUt, jdEt, sidMode(s)) + s.ayanamsaDelta - (s.ayanamsa === 'deva-datta' ? DEVA_DATTA : 0);
}

const norm180 = (x: number) => norm360(x + 180) - 180;

/**
 * Ayanamsa for planets and for the lagna, in degrees (FUN_0049aaa0's doc+0x1680
 * and the shift it applies to swe_calc's longitudes). `geoLon` (east positive)
 * only matters for the SSS ayanamsa, which is taken at local apparent time.
 */
export function ayanamsa(swe: Sweph, jdUt: number, jdEt: number, s: Settings, geoLon = 0): AyanamsaValue {
  const flags = calcFlags(s);
  const delta = s.ayanamsaDelta - (s.ayanamsa === 'deva-datta' ? DEVA_DATTA : 0);
  if (s.ayanamsa === 'tropical') return { trueEq: delta, mean: delta };
  if (s.ayanamsa === 'sss') {
    // index 18 without Siddhanta=1: FUN_0049a290 at the ahargana A, then at A' (FUN_004bf640)
    const a = ((jdUt - 2415022.0) + 1826556.5) + geoLon * 0.002777777777777778;
    const ay = sssAyanamsa(apparentAhargana(a, geoLon - UJJAIN_LON, sssAyanamsa(a) + delta)) + delta;
    return { trueEq: ay, mean: ay };
  }
  const sid = sidMode(s);
  const star = ayanamsaStar(s);
  const name = star ? jhoraStarName(star.star) : '';
  if (sid === null) {
    // Chandra Hari: tropical Shaula, always the true position (FUN_0049aaa0 ors in SEFLG_TRUEPOS)
    const t = star ? norm180(swe.fixstarEt(name, jdEt, flags | SE.FLG_TRUEPOS).lon - star.lon) : 0;
    return { trueEq: t + delta, mean: t + delta };
  }
  if (sid & SE_SIDBIT_SSY_PLANE) {
    // star and planets projected on the plane; doc+0x1680 = swe_get_ayanamsa - (lon - star)
    swe.setSidMode(sid);
    const shift = star!.lon - swe.fixstarEt(name, jdEt, flags | SE.FLG_SIDEREAL).lon;
    const sun = swe.calcEt(jdEt, SE.SUN, flags | SE.FLG_SIDEREAL).lon;
    const trueEq = norm180(swe.calcEt(jdEt, SE.SUN, flags).lon - sun - shift) + delta;
    const mean = norm180(swissAyanamsaAtUt(swe, jdUt, jdEt, sid) - shift) + delta;
    return { trueEq, mean, plane: { sidMode: sid, shift: shift - delta } };
  }
  // ecliptic sid modes: Swiss's sidereal longitudes are the nutation-free tropical
  // ones less the mean ayanamsa at ET; the true-equinox ayanamsa adds nutation back
  const lag = swissAyanamsaAtUt(swe, jdUt, jdEt, sid);
  if (!star) {
    const etTrue = swe.ayanamsaUt(jdUt, SE.FLG_SWIEPH | (flags & SE.FLG_NONUT));
    return { trueEq: etTrue + delta, mean: lag + delta };
  }
  // star at its longitude (JHora's catalogue record, data/sefstars.txt): tropical
  // star less its longitude; doc+0x1680 = swe_get_ayanamsa(UT) - (lon - sidereal
  // star), the sidereal star being nutation-free with the ayanamsa at ET subtracted
  const etMean = swe.ayanamsaUt(jdUt, SE.FLG_SWIEPH | SE.FLG_NONUT);
  const t = swe.fixstarEt(name, jdEt, flags).lon - star.lon;
  const m = swe.fixstarEt(name, jdEt, flags | SE.FLG_NONUT).lon - star.lon + lag - etMean;
  return { trueEq: norm180(t) + delta, mean: norm180(m) + delta };
}

/** Sidereal longitude of a body from swe_calc at ET, as FUN_0049aaa0 reduces it. */
export function bodyLongitude(swe: Sweph, jdEt: number, body: number, flags: number, ay: AyanamsaValue): Position {
  if (!ay.plane) {
    const p = swe.calcEt(jdEt, body, flags);
    return { ...p, lon: norm360(p.lon - ay.trueEq) };
  }
  swe.setSidMode(ay.plane.sidMode);
  const p = swe.calcEt(jdEt, body, flags | SE.FLG_SIDEREAL);
  return { ...p, lon: norm360(p.lon + ay.plane.shift) };
}

/**
 * FUN_0049a930: with the tropical zodiac and SiderealNaksharasInTropical, the
 * amount JHora adds to longitudes before finding nakshatras (and nakshatra
 * dasas): 180 - tropical Spica at ET. Zero otherwise.
 */
export function nakshatraShift(swe: Sweph, jdUt: number, s: Settings): number {
  if (s.ayanamsa !== 'tropical' || !s.siderealNakshatras) return 0;
  const jdEt = jdUt + (jhoraDeltaT(jdUt) ?? swe.deltaT(jdUt));
  return 180 - swe.fixstarEt(jhoraStarName('Spica'), jdEt, calcFlags(s)).lon;
}

/** Place of a chart; pressure (mbar) and temperature (C) are the birth data's (used by refraction). */
export interface GeoAtmo { lat: number; lon: number; alt: number; pressure?: number; temperature?: number }

const D2R = Math.PI / 180;
const degnorm = (x: number) => ((x % 360) + 360) % 360;
/** swe_cotrans: rotate polar coordinates (deg) about the x axis by eps (deg). */
function cotrans(lon: number, lat: number, eps: number): [number, number] {
  const cl = Math.cos(lat * D2R);
  const x = cl * Math.cos(lon * D2R), y = cl * Math.sin(lon * D2R), z = Math.sin(lat * D2R);
  const se = Math.sin(eps * D2R), ce = Math.cos(eps * D2R);
  const y2 = y * ce + z * se, z2 = -y * se + z * ce;
  return [degnorm(Math.atan2(y2, x) / D2R), Math.atan2(z2, Math.sqrt(x * x + y2 * y2)) / D2R];
}
/** swe_refrac(inalt, atpress, attemp, SE_TRUE_TO_APP): Bennett's refraction of a true altitude. */
export function refracTrueToApp(alt: number, press: number, temp: number): number {
  const pt = (press / 1010.0) * 283.0 / (273.0 + temp);
  let r = 0;
  if (alt > 15) {
    const a = Math.tan((90 - alt) * D2R);
    r = ((58.276 * a - 0.0824 * a * a * a) * pt) / 3600.0;
  } else if (alt > -5) {
    const a = alt + 10.3 / (alt + 5.11);
    r = a + 1e-10 >= 90 ? 0 : ((1.02 / Math.tan(a * D2R)) * pt) / 60.0;
  }
  return alt + r > 0 ? alt + r : alt;
}

/**
 * ApparentRefraction (dialog 149) in FUN_0049aaa0 (0x49b882, only without TruePositions):
 * the tropical ecliptic position from swe_calc goes through swe_azalt (SE_ECL2HOR), its
 * true altitude through swe_refrac (TRUE_TO_APP, the chart's pressure and temperature) and
 * back with swe_azalt_rev (SE_HOR2ECL); the ayanamsa is subtracted afterwards. Returns the
 * new tropical longitude and latitude (swe_azalt / swe_azalt_rev transcribed: ARMC from
 * swe_sidtime, true obliquity from SE_ECL_NUT).
 */
export function refractEcliptic(swe: Sweph, jdUt: number, jdEt: number, lon: number, lat: number, geo: GeoAtmo): [number, number] {
  const armc = degnorm(swe.sidtime(jdUt) * 15 + geo.lon);
  const eps = swe.calcEt(jdEt, SE.ECL_NUT, 0).lon;
  // swe_azalt
  const [ra, dec] = cotrans(lon, lat, -eps);
  const mdd = degnorm(ra - armc);
  const [h0, alt] = cotrans(degnorm(mdd - 90), dec, 90 - geo.lat);
  const az = 360 - degnorm(h0 + 90);
  const app = refracTrueToApp(alt, geo.pressure ?? 1013.25, geo.temperature ?? 20);
  // swe_azalt_rev
  const [h1, d1] = cotrans(degnorm(360 - az - 90), app, geo.lat - 90);
  return cotrans(degnorm(h1 + armc + 90), d1, eps);
}

export function computePositions(
  swe: Sweph, jdUt: number, geo: GeoAtmo, s: Settings,
): Positions {
  // Siddhanta=1: FUN_0049aaa0 branches to its Sri Surya Siddhanta code (src/core/sss)
  if (s.sss) return computePositionsSSS(jdUt, geo, s, swe);
  const flags = calcFlags(s);
  if (s.topocentric) swe.setTopo(geo.lon, geo.lat, geo.alt);
  const jdEt = jdUt + (jhoraDeltaT(jdUt) ?? swe.deltaT(jdUt));
  const ay = ayanamsa(swe, jdUt, jdEt, s, geo.lon);

  // ApparentRefraction: the refracted shift is applied to the reduced longitude (refractEcliptic)
  const refr = s.refraction && !s.truePositions;
  const calc = (body: number): Position => {
    const p = bodyLongitude(swe, jdEt, body, flags, ay);
    if (!refr) return p;
    const trop = swe.calcEt(jdEt, body, flags);
    const [lon, lat] = refractEcliptic(swe, jdUt, jdEt, trop.lon, trop.lat, geo);
    return { ...p, lon: norm360(p.lon + lon - trop.lon), lat };
  };
  const grahas = {} as Record<Graha, BodyPosition>;
  for (const g of Object.keys(SWE_ID) as (keyof typeof SWE_ID)[]) {
    const p = calc(SWE_ID[g]);
    grahas[g] = { lon: p.lon, lat: p.lat, speed: p.speedLon, retrograde: p.speedLon < 0 };
  }
  // Ketu: JHora computes the node again and adds 180 to the (refracted) result
  const node = calc(s.trueNodes ? SE.TRUE_NODE : SE.MEAN_NODE);
  grahas.Rahu = { lon: node.lon, lat: node.lat, speed: node.speedLon, retrograde: true };
  grahas.Ketu = { lon: norm360(node.lon + 180), lat: -node.lat, speed: node.speedLon, retrograde: true };

  const outer = {} as Record<OuterPlanet, BodyPosition>;
  for (const o of Object.keys(OUTER_ID) as OuterPlanet[]) {
    const p = calc(OUTER_ID[o]);
    outer[o] = { lon: p.lon, lat: p.lat, speed: p.speedLon, retrograde: p.speedLon < 0 };
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

/** Sidereal lagna at a moment (as computePositions does it), for root finding. */
export function siderealAscendant(swe: Sweph, jdUt: number, geo: { lat: number; lon: number }, s: Settings): number {
  const jdEt = jdUt + (jhoraDeltaT(jdUt) ?? swe.deltaT(jdUt));
  return norm360(swe.houses(jdUt, 0, geo.lat, geo.lon, 'P').ascmc[0] - ayanamsa(swe, jdUt, jdEt, s, geo.lon).mean);
}

/** Sidereal longitude and speed of one body (as computePositions does it), for root finding. */
export function siderealLongitude(swe: Sweph, jdUt: number, body: Graha, s: Settings): { lon: number; speed: number } {
  const flags = calcFlags(s);
  const jdEt = jdUt + (jhoraDeltaT(jdUt) ?? swe.deltaT(jdUt));
  const ay = ayanamsa(swe, jdUt, jdEt, s);
  const id = body === 'Rahu' || body === 'Ketu' ? (s.trueNodes ? SE.TRUE_NODE : SE.MEAN_NODE) : SWE_ID[body];
  const p = bodyLongitude(swe, jdEt, id, flags, ay);
  return { lon: norm360(p.lon + (body === 'Ketu' ? 180 : 0)), speed: p.speedLon };
}
