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
//     and the FUN_004bfc00 MC) are not ported because Positions has no cusps.
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
import { SE, type Sweph } from '../../sweph';
import type { Settings } from '../settings';
import { computePositions, type BodyPosition, type Graha, type OuterPlanet, type Positions } from '../positions';
import {
  apparentAhargana, lagna, norm, sssAyanamsa, sunriseHours, trueLongitude, UJJAIN_LON,
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
  if (s.ayanamsa === 'tropical') return s.ayanamsaDelta;
  // FUN_0049a370: swe_get_ayanamsa_ut (Lahiri mode for the Spica ayanamsas) + delta
  swe.setSidMode(1);
  return swe.ayanamsaUt(jdUt, SE.FLG_SWIEPH | SE.FLG_NONUT) + s.ayanamsaDelta;
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
    },
  };
}

