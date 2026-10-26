// Graha and lagna positions under JHora's Sri Surya Siddhanta option
// (CalculationPreferences/Siddhanta=1), following the SSS branches of the planet
// routine FUN_0049aaa0 (DAT_008a4c34 == 1):
//
//  1. A  = ((jd_ut - 2415022) + 1826556.5) + lon/360, dl = lon - 75.7684565.
//  2. The ayanamsa at doc+0x1680 is first set as usual (FUN_0049a370, or the
//     SSS ayanamsa of A plus DeltaFromUserSelectedAyanamsa when
//     UserSelectedAyanamsa=18), then FUN_004bf640 turns A into apparent time
//     A' = A + EoT(A + EoT(A)). The SSS ayanamsa is re-evaluated at A'
//     (doc+0x1688) and the user ayanamsa recomputed and Spica-corrected exactly
//     as in the drik path (so it equals Positions.ayanamsaMean of computePositions).
//  3. Grahas: FUN_004bf030(A', dl, i). Rahu = node + 180, Ketu = node (the SSS
//     node is counted from 180 at Kali). Each longitude is then moved into the
//     user's zodiac:  lon = SSS_lon + (sss_ayanamsa(A') - user_ayanamsa_mean).
//     With UserSelectedAyanamsa=18 that shift is just -Delta.
//     JHora zeroes latitude and all speeds (doc+0x1490/0x14e0/0x1530/... = 0);
//     the retrograde flag comes from the SSS sighra kendra (FUN_004be650); Sun,
//     Moon and the nodes get flag 0.
//  4. Lagna: SSS sunrise (FUN_004bf760) of the civil day of the apparent local
//     time T = jd_ut + lon/360 + (A' - A); if T is before it, the previous
//     sunrise is used. x = (T - sunrise) * 34560 / (sunrise-to-sunrise hours) is
//     the time since sunrise in minutes of a 1440-minute day; FUN_004bfd60
//     iterates on oblique-ascension rising times (FUN_004bfa50) with the true Sun
//     at sunrise and now. Shifted into the user's zodiac like the grahas. JHora
//     never calls swe_houses here; the SSS house cusps (trisection between lagna
//     and the FUN_004bfc00 MC) are sssHouseCusps below.
//  5. Uranus/Neptune/Pluto are not part of SSS: FUN_0049aaa0 computes them with
//     swe_calc as in the drik path (with ayanamsa 18 they are reduced by the SSS
//     ayanamsa + Delta instead).
//
// Differences from computePositions' output shape/semantics:
//  - grahas[*].lat and .speed are 0 (as JHora stores them under SSS);
//  - Rahu/Ketu keep retrograde=true like the drik path does (JHora's own flag is 0
//    for nodes in both paths);
//  - ayanamsa = ayanamsaMean = the user ayanamsa at doc+0x1680 (the value the SSS
//    longitudes are reduced by); the outer planets still use the drik true-equinox
//    ayanamsa internally;
//  - the extra `sss` field carries the intermediate SSS quantities.
import type { Sweph } from '../../sweph';
import type { Settings } from '../settings';
import { jhoraDeltaT } from '../deltat';
import { computePositions, swissAyanamsa, type BodyPosition, type Graha, type OuterPlanet, type Positions } from '../positions';
import {
  apparentAhargana, dayLength, lagna, midheaven, norm, sssAyanamsa, sunriseHours, trueLongitude, UJJAIN_LON,
} from './model';

export * from './model';

export interface SSSDetails {
  /** ahargana in local mean time */
  ahargana: number;
  /** ahargana in local apparent time (A') used for all longitudes */
  aharganaApparent: number;
  /** desantara, degrees east of Ujjain */
  desantara: number;
  /** SSS ayanamsa at A' (doc+0x1688) */
  sssAyanamsa: number;
  /** SSS sidereal longitudes before the shift into the user's zodiac */
  sssLongitudes: Record<Graha, number>;
  sssLagna: number;
  /** JD (UT-based local apparent reckoning) of the SSS sunrise preceding the moment */
  sunriseLocalJd: number;
  /** minutes since sunrise in a 1440-minute day */
  minutesSinceSunrise: number;
  /** the lagna's other inputs, kept for the house cusps (FUN_0049aaa0 stack slots) */
  lagnaInputs: { day: number; riseHours: number; tApp: number; sunNow: number; sunRise: number };
}

export interface PositionsSSS extends Positions {
  sss: SSSDetails;
}

const SSS_INDEX: Record<Exclude<Graha, 'Rahu' | 'Ketu'>, number> = {
  Sun: 1, Moon: 2, Mars: 3, Mercury: 4, Jupiter: 5, Venus: 6, Saturn: 7,
};

/** Ayanamsa JHora holds at doc+0x1680 when FUN_004bf640 runs (before the Spica correction). */
function eotAyanamsa(swe: Sweph, jdUt: number, a: number, s: Settings): number {
  if (s.sssAyanamsa) return sssAyanamsa(a) + s.ayanamsaDelta;
  // FUN_0049a370: swe_get_ayanamsa (the user's sid mode, 0 when tropical) + delta
  return swissAyanamsa(swe, jdUt, jdUt + (jhoraDeltaT(jdUt) ?? swe.deltaT(jdUt)), s);
}

export function computePositionsSSS(
  jdUt: number, geo: { lat: number; lon: number; alt: number }, s: Settings, swe: Sweph,
): PositionsSSS {
  // drik pass for the user ayanamsa (doc+0x1680), jdEt and the outer planets
  const drik = computePositions(swe, jdUt, geo, { ...s, sss: false });

  const a = ((jdUt - 2415022.0) + 1826556.5) + geo.lon * 0.002777777777777778;
  const dl = geo.lon - UJJAIN_LON;
  const a2 = apparentAhargana(a, dl, eotAyanamsa(swe, jdUt, a, s));
  const sssAy = sssAyanamsa(a2);
  const userAy = s.sssAyanamsa ? sssAy + s.ayanamsaDelta : drik.ayanamsaMean;
  const shift = sssAy - userAy;

  const sssLon = {} as Record<Graha, number>;
  const grahas = {} as Record<Graha, BodyPosition>;
  for (const g of Object.keys(SSS_INDEX) as (keyof typeof SSS_INDEX)[]) {
    const t = trueLongitude(a2, dl, SSS_INDEX[g]);
    sssLon[g] = t.lon;
    grahas[g] = { lon: norm(shift + t.lon), lat: 0, speed: 0, retrograde: t.retro };
  }
  const node = trueLongitude(a2, dl, 8).lon;
  sssLon.Rahu = node + 180.0;
  sssLon.Ketu = node;
  grahas.Rahu = { lon: norm(shift + sssLon.Rahu), lat: 0, speed: 0, retrograde: true };
  grahas.Ketu = { lon: norm(shift + sssLon.Ketu), lat: 0, speed: 0, retrograde: true };

  // ---- lagna (FUN_0049aaa0, param_1 == 0) ----
  const tApp = (jdUt + geo.lon * 0.002777777777777778) + (a2 - a);
  const n = Math.trunc(a2);
  let rise = sunriseHours(n + 0.5, dl, geo.lat);
  // swe_revjul + swe_julday on the local apparent JD: start of its civil day + hours
  let riseJd = Math.floor(tApp + 0.5) - 0.5 + rise / 24.0;
  let next: number;
  if (!(tApp < riseJd)) next = sunriseHours(n + 1.5, dl, geo.lat);
  else {
    next = rise;
    rise = sunriseHours(n - 0.5, dl, geo.lat);
    riseJd = Math.floor(tApp - 1.0 + 0.5) - 0.5 + rise / 24.0;
  }
  const x = ((tApp - riseJd) * 34560.0) / ((next + 24.0) - rise);
  const sunRise = trueLongitude((riseJd - tApp) + a2, dl, 1).lon;
  const sunNow = trueLongitude(a2, dl, 1).lon;
  const lg = lagna(geo.lat, sunNow, sunRise, sssAy, x);

  let outer: Record<OuterPlanet, BodyPosition> = drik.outer;
  if (s.sssAyanamsa) {
    outer = {} as Record<OuterPlanet, BodyPosition>;
    for (const o of Object.keys(drik.outer) as OuterPlanet[]) {
      const p = drik.outer[o];
      outer[o] = { ...p, lon: norm(p.lon + drik.ayanamsa - userAy) };
    }
  }

  return {
    jdUt,
    jdEt: drik.jdEt,
    ayanamsa: userAy,
    ayanamsaMean: userAy,
    ascendant: norm(shift + lg),
    grahas,
    outer,
    sss: {
      ahargana: a,
      aharganaApparent: a2,
      desantara: dl,
      sssAyanamsa: sssAy,
      sssLongitudes: sssLon,
      sssLagna: lg,
      sunriseLocalJd: riseJd,
      minutesSinceSunrise: x,
      lagnaInputs: { day: n, riseHours: rise, tApp, sunNow, sunRise },
    },
  };
}

/**
 * SSS house system (HouseTypeWanted 11, only with Siddhanta=1): sidereal cusps 1..12 as
 * FUN_0049aaa0's lagna branch stores them at doc+0x1620 (0x49b2a2..0x49b614).
 *  - D = FUN_004bfec0(lat, A', dl, 180), the length of the day in minutes of the lagna's
 *    1440-minute day. Before midday (x < D/2, 0x49b2f6) the previous day is used: its
 *    sunrise (FUN_004bf760(trunc(A') - 0.5)) and the stored one as the "next" sunrise give
 *    x again, and D = FUN_004bfec0(A' - 1); the Sun at sunrise is not recomputed.
 *  - MC = FUN_004bfc00(lat, Sun now, Sun at sunrise, sss ayanamsa, x - D/2, flag 1).
 *  - c1 = lagna, c10 = MC, both + (doc+0x1688 - doc+0x1680) and not normalised; c4 = c10 + 180,
 *    c2 / c3 trisect c1..c4, c5 = c4 + 2 (30 - (c4 - c1)/6), c6 = c5 + the same, and
 *    c7..c9, c11, c12 = c1..c3, c5, c6 + 180 (each FUN_004ae800-normalised).
 * doc+0x1690 (sidereal time) is set to 6.5 h; nothing here reads it.
 */
export function sssHouseCusps(p: PositionsSSS, lat: number): number[] {
  const d = p.sss;
  const L = d.lagnaInputs;
  const dl = d.desantara;
  let x = d.minutesSinceSunrise;
  let day = dayLength(lat, d.aharganaApparent, dl);
  if (day * 0.5 > x) {
    const next = L.riseHours;
    const rise = sunriseHours(L.day - 0.5, dl, lat);
    const riseJd = Math.floor(L.tApp - 1.0 + 0.5) - 0.5 + rise / 24.0;
    x = ((L.tApp - riseJd) * 34560.0) / ((next + 24.0) - rise);
    day = dayLength(lat, d.aharganaApparent - 1.0, dl);
  }
  const mc = midheaven(lat, L.sunNow, L.sunRise, d.sssAyanamsa, x - day * 0.5);
  const shift = d.sssAyanamsa - p.ayanamsaMean;
  const c1 = shift + d.sssLagna;
  const c10 = shift + mc;
  const c4 = norm(c10 + 180.0);
  const q = norm(c4 - c1);
  const c2 = norm(q * 0.3333333333333333 + c1);
  const c3 = norm(q * 0.3333333333333333 + c2);
  const g = 30.0 - q * 0.16666666666666666;
  const c5 = norm(g + g + c4);
  const c6 = norm(g + g + c5);
  return [norm(c1), c2, c3, c4, c5, c6, norm(c1 + 180.0), norm(c2 + 180.0), norm(c3 + 180.0), norm(c10), norm(c5 + 180.0), norm(c6 + 180.0)];
}
