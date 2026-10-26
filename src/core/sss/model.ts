// Sri Surya Siddhanta (SSS) planetary model as jhora.exe 8.0 implements it
// (ini CalculationPreferences/Siddhanta=1, global DAT_008a4c34). Pure maths, no
// Swiss Ephemeris. Every routine below is a transcription of the x87 code; the
// addresses are those of jhora.exe, constants are the literal doubles it loads.
//
// Time: "A" is JHora's ahargana, civil days since the Kali epoch reckoned in
// local mean time of the place (FUN_0049aaa0):
//    A = ((jd_ut - 2415022.0) + 1826556.5) + lon_east / 360        (588465.5 = Kali)
//    dl = lon_east - 75.7684565                                       (desantara, Ujjain)
//
// FUN_004bf030(A, dl, i) - mean planet, mandocca and kendra, then dispatches to
// the true-longitude routines (planet index i: 1 Sun, 2 Moon, 3 Mars,
// 4 Mercury, 5 Jupiter, 6 Venus, 7 Saturn, 8 Moon's node):
//  * years = A * 0.002737785151635919 (1 / 365.2587565 sidereal days)
//  * Y = years + 1955880000 (years from creation; computed as
//    years - (I+3179) + I + 1955883179 with I = trunc(years - 3179))
//  * mean = norm(frac(A / (1577917828 / R_i)) * 360 + BEEJA_i * Y * 1e-10)
//           - R_i * 2.3148148148148148e-07 * dl/360            (desantara)
//    R_i = revolutions per mahayuga (Sun 4320000, Moon 57753336, Mars 2296832,
//    Mercury's sighra 17937060, Jupiter 364220, Venus' sighra 7022376,
//    Saturn 146568, node -232238). The beeja (bija) term is hard-coded and
//    always applied; there is no Makaranda or "no beeja" option in 8.0.
//  * mandocca = norm(frac(P_i * Y * 2.3148148148148147e-10) * 360), P_i =
//    revolutions per kalpa (387, 488203000, 204, 368, 900, 535, 39, -); the
//    Moon's apogee also gets -Y*7.80380064202824e-10 - dl/360*0.1130099537037037.
//  * kendra: Sun/Moon/node mandocca - mean; Mars/Jupiter/Saturn sun - mean;
//    Mercury/Venus mean(sighrocca) - sun (sun = the Sun's mean incl. desantara).
//  * the node's "mean" counts from the Kali epoch, where the SSS node stood at
//    180 deg, so FUN_0049aaa0 adds 180 for Rahu and uses it as is for Ketu.
// FUN_004be510 Sun, FUN_004be5b0 Moon: one manda correction (closed forms below).
// FUN_004be650 star planets: the classical four steps (half sighra, half manda,
//    full manda on the mean planet, full sighra) with epicycles varying between
//    even/odd quadrant values (Mars 75/72 & 235/232, Mercury 30/28 & 133/132,
//    Jupiter 33/32 & 70/72, Venus 12/11 & 262/260, Saturn 49/48 & 39/40) and a
//    JHora-specific "bhuja + c*sin(bhuja)" argument for the manda steps.
//    Retrograde iff the final sighra kendra (folded to 0..180) >= RETRO_LIMIT.
// FUN_0049a290 SSS ayanamsa: 27 deg libration with a 7200-year period, 0 at Kali.
// FUN_004be460 equation of time; FUN_004bf640 converts A to apparent time.
// FUN_004bf760 SSS sunrise (hours of local apparent time, ascensional
//    difference only); FUN_004bfa50/FUN_004bf960 oblique ascension ("rising
//    time" in minutes of time); FUN_004bfd60 lagna by iteration on rising times.

export const KALI_EPOCH_JD = 588465.5; // 2415022.0 - 1826556.5
export const UJJAIN_LON = 75.7684565;
export const CIVIL_DAYS_PER_MAHAYUGA = 1577917828;
const YEARS_PER_DAY = 0.002737785151635919;       // FUN_004bf030
const YEARS_PER_DAY_AYANAMSA = 0.002737785151635915; // FUN_0049a290 (sic)
const DEG_PER_DAY_FRACTION = 0.002777777777777778; // 1/360
const D2R = 0.017453292519943295;
const R2D = 57.29577951308232;
const RADIUS = 3437.746770784939; // radius in arc-minutes

/** revolutions per mahayuga, index 1..8 (FUN_004bf030 stack table) */
export const REVOLUTIONS = [0, 4320000, 57753336, 2296832, 17937060, 364220, 7022376, 146568, -232238] as const;
/** beeja coefficients, deg per 1e10 years since creation (FUN_004bf030) */
// (the stack table at 0x4bf0f5..0x4bf19e has three leading zeros: Sun and Moon get none)
export const BEEJA = [0, 0, 0, 7.1151017357437, 31.215202568113, -15.6076012840565, -23.4114019260847,
  23.4114019260847, -7.80380064202824] as const;
/** mandocca revolutions per kalpa (FUN_004bf030) */
export const APOGEE_REVOLUTIONS = [0, 387, 488203000, 204, 368, 900, 535, 39, 0] as const;

/** FUN_004be650 tables, rows Mars, Mercury, Jupiter, Venus, Saturn; columns are the four steps. */
const EPI_EVEN = [[235, 75, 75, 235], [133, 30, 30, 133], [70, 33, 33, 70], [262, 12, 12, 262], [39, 49, 49, 39]];
const EPI_ODD = [[232, 72, 72, 232], [132, 28, 28, 132], [72, 32, 32, 72], [260, 11, 11, 260], [40, 48, 48, 40]];
const EPI_ARG = [
  [0, 5.769713121, 5.769713121, 0], [0, 2.229731213, 2.229731213, 0], [0, 2.547318183, 2.547318183, 0],
  [0, 0.8753862433, 0.8753862433, 0], [0, 3.822553729, 3.822553729, 0],
];
/** retrograde window of the folded sighra kendra (FUN_004be650) */
export const RETRO_LIMIT = [169.392457108346, 145.003089170517, 123.999650368356, 167.0, 114.8] as const;
const RETRO_LIMIT_HI = [190.607542891654, 214.996910829483, 236.000349631644, 193.0, 245.2];

/** FUN_004ae800 */
export function norm(x: number): number {
  while (x < 0) x += 360;
  while (x >= 360) x -= 360;
  return x;
}

// ---- exact products (the x87 code keeps 64-bit intermediates) ----
function split(a: number): [number, number] {
  const c = 134217729 * a;
  const hi = c - (c - a);
  return [hi, a - hi];
}
function twoProd(a: number, b: number): [number, number] {
  const p = a * b;
  const [ah, al] = split(a);
  const [bh, bl] = split(b);
  return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl];
}
/**
 * A / (C / R) rounded to double. JHora divides in extended precision and stores
 * the quotient as a double, i.e. it gets A*R/C correctly rounded; a plain double
 * division (C/R rounded first) can be 1 ulp (0.02" for the Moon) off.
 */
function revolutionsElapsed(a: number, r: number): number {
  const [p, e] = twoProd(a, r);
  const c = CIVIL_DAYS_PER_MAHAYUGA;
  const q0 = p / c;
  const [m, me] = twoProd(q0, c);
  return q0 + (((p - m) - me) + e) / c;
}
/** frac(x*y*z) with x*y*z kept to ~106 bits; y, z doubles, x = hi + lo. */
function fracProduct3(hi: number, lo: number, y: number, z: number): number {
  const fracDD = (h: number, l: number) => (h - Math.trunc(h)) + l;
  // (hi + lo) * y
  const [p1, e1] = twoProd(hi, y);
  const l1 = e1 + lo * y;
  // * z
  const [p2, e2] = twoProd(p1, z);
  const l2 = e2 + l1 * z;
  let f = fracDD(p2, l2);
  f -= Math.trunc(f);
  return f;
}

export interface MeanState {
  /** mean longitude (sighrocca for Mercury/Venus), not normalised after the desantara term */
  mean: number;
  /** mandocca */
  apogee: number;
  /** kendra as FUN_004bf030 stores it (param_9), 0..360 */
  kendra: number;
}

/** years since creation as FUN_004bf030 forms it */
export function yearsSinceCreation(a: number): number {
  const years = a * YEARS_PER_DAY;
  const i = Math.trunc(years - 3179.0);
  return years - (i + 3179.0) + i + 1955883179.0;
}

/** Mean longitude of planet i (1..8) at ahargana a, desantara dl (FUN_004bf030 first half). */
export function meanLongitude(a: number, dl: number, i: number): number {
  const r = REVOLUTIONS[i];
  const y = yearsSinceCreation(a);
  const revs = revolutionsElapsed(a, r);
  const frac = revs - Math.trunc(revs);
  return norm(frac * 360.0 + BEEJA[i] * y * 1e-10) - r * 2.3148148148148148e-07 * (dl * DEG_PER_DAY_FRACTION);
}

/** Mandocca of planet i (FUN_004bf030 second half). */
export function apogeeLongitude(a: number, dl: number, i: number): number {
  const years = a * YEARS_PER_DAY;
  // fld P; fld years; fadd 1955880000 (exact in the 64-bit register); fmul 1/4.32e9; fmulp
  let ap = norm(fracProduct3(1955880000.0, years, 2.3148148148148147e-10, APOGEE_REVOLUTIONS[i]) * 360.0);
  if (i === 2) ap = (ap - yearsSinceCreation(a) * 7.80380064202824e-10) - (dl * DEG_PER_DAY_FRACTION) * 0.1130099537037037;
  return ap;
}

export function meanState(a: number, dl: number, i: number): MeanState {
  const mean = meanLongitude(a, dl, i);
  const apogee = apogeeLongitude(a, dl, i);
  let k: number;
  if (i === 1 || i === 2 || i === 8) k = apogee - mean;
  else {
    const sun = meanLongitude(a, dl, 1); // the cached Sun of DAT_008970c0
    k = i === 4 || i === 6 ? mean - sun : sun - mean;
  }
  return { mean, apogee, kendra: norm(k) };
}

/** FUN_004be510: Sun's equation of centre; b = bhuja 0..90. */
function sunTrue(mean: number, b: number, sign: number): number {
  const x = b * D2R;
  const t1 = (6383.39600310841 / (1.0 - Math.cos(x) * 0.8860136684023698)) * 0.00015665642543765852;
  const s = Math.sin(x) * ((b * 0.02276247586910956 + 4904.05431317952) + (13.962634015954622 - b * 0.003325821600036921) * t1) * 7.71604938271605e-06;
  return norm(Math.atan(s / Math.sqrt(1.0 - s * s)) * R2D * sign + mean);
}

/** Equation of an epicycle with JHora's corrected argument (FUN_004be5b0, FUN_004be650). */
function epicycle(bhuja: number, even: number, odd: number, argCoef: number): number {
  const b = bhuja === 0 ? 1e-11 : bhuja;
  const s = Math.sin(b * D2R);
  const u = (s * argCoef + b) * D2R;
  const r = (even - (even - odd) * s) * DEG_PER_DAY_FRACTION * RADIUS;
  return Math.atan((Math.sin(u) * r) / (Math.cos(u) * r + RADIUS)) * R2D;
}

/** FUN_004be5b0: Moon, epicycle 32 deg .. 31 deg 40'. */
function moonTrue(mean: number, b: number, sign: number): number {
  const bb = b === 0 ? 1e-11 : b;
  const s = Math.sin(bb * D2R);
  const u = (s * 5.046428631 + bb) * D2R;
  const r = (32.0 - s * 0.33333333333333215) * DEG_PER_DAY_FRACTION * RADIUS;
  const eq = Math.atan((Math.sin(u) * r) / (Math.cos(u) * r + RADIUS));
  return norm(eq * R2D * sign + mean);
}

/** fold to 0..180 with the sign of the sine, as FUN_004be650 does between its steps */
function fold180(x: number, sign: number): [number, number] {
  if (x <= 180.0) return [x, 1];
  if (x < 360.0) sign = -1;
  return [x > 180.0 ? 360.0 - x : x, sign];
}

/**
 * FUN_004be650: true longitude of a star planet.
 * meanP = mean planet, sighrocca, mandocca; b/sign = folded sighra kendra.
 */
function starTrue(meanP: number, sighrocca: number, mandocca: number, b: number, sign: number, i: number): { lon: number; retro: boolean } {
  const k = i - 3;
  const e = EPI_EVEN[k], o = EPI_ODD[k], c = EPI_ARG[k];
  // 1. half sighra on the mean planet
  const v1 = norm(epicycle(b, e[0], o[0], c[0]) * 0.5 * sign + meanP);
  let x = mandocca - v1;
  if (x < 0) x += 360.0;
  [b, sign] = fold180(x, sign);
  // 2. half manda on that; the result only feeds the next kendra
  x = mandocca - (epicycle(b, e[1], o[1], c[1]) * sign * 0.5 + v1);
  if (x >= 360.0) x -= 360.0;
  if (x < 0) x += 360.0;
  [b, sign] = fold180(x, sign);
  // 3. full manda on the mean planet
  let v3 = epicycle(b, e[2], o[2], c[2]) * sign + meanP;
  if (v3 >= 360.0) v3 -= 360.0;
  if (v3 < 0) v3 += 360.0;
  x = sighrocca - v3;
  if (x < 0) x += 360.0;
  [b, sign] = fold180(x, sign);
  const retro = !(b < RETRO_LIMIT[k]) && b < RETRO_LIMIT_HI[k];
  // 4. full sighra
  return { lon: norm(epicycle(b, e[3], o[3], c[3]) * sign + v3), retro };
}

export interface TrueState extends MeanState {
  /** true longitude in the SSS sidereal zodiac; for the node this is the unnormalised mean */
  lon: number;
  retro: boolean;
}

/** FUN_004bf030 complete: true longitude of planet i (1..8). */
export function trueLongitude(a: number, dl: number, i: number): TrueState {
  const st = meanState(a, dl, i);
  const kd = st.kendra;
  let b = kd;
  let sign = 0;
  if (i === 1 || i === 2 || i === 8) {
    if (kd <= 180.0) {
      if (kd > 90.0) b = 180.0 - kd;
      sign = 1;
    } else if (kd <= 270.0) {
      sign = -1;
      b = kd - 180.0;
    } else {
      sign = -1;
      b = 360.0 - kd;
    }
  } else if (kd <= 180.0 || kd > 360.0) sign = 1;
  else {
    sign = -1;
    b = 360.0 - kd;
  }
  switch (i) {
    case 1: return { ...st, lon: sunTrue(st.mean, b, sign), retro: false };
    case 2: return { ...st, lon: moonTrue(st.mean, b, sign), retro: false };
    case 3: case 5: case 7: {
      const r = starTrue(st.mean, meanLongitude(a, dl, 1), st.apogee, b, sign, i);
      return { ...st, lon: r.lon, retro: r.retro };
    }
    case 4: case 6: {
      const r = starTrue(meanLongitude(a, dl, 1), st.mean, st.apogee, b, sign, i);
      return { ...st, lon: r.lon, retro: r.retro };
    }
    default: return { ...st, lon: st.mean, retro: false };
  }
}

/** FUN_0049a290: SSS ayanamsa (tropical - SSS sidereal), degrees. */
export function sssAyanamsa(a: number): number {
  const y = a * YEARS_PER_DAY_AYANAMSA * 0.0001388888888888889;
  let f = (y - Math.trunc(y)) * 108.0;
  // transcription of the compare/branch ladder at 0x49a2b7..0x49a36b
  if (f > 0) {
    if (f <= 27.0) return -f;
    if (f <= 81.0) return f - 54.0;
    if (f <= 108.0) f = 108.0 - f;
  }
  if (f < 0) {
    if (f >= -27.0) f = -f;
  }
  if (f < -27.0) {
    if (f < -81.0) {
      if (f >= -108.0) f = -(f + 108.0);
      return f;
    }
    f += 54.0;
  }
  if (f < -81.0 && f >= -108.0) f = -(f + 108.0);
  return f;
}

/** FUN_004be460: equation of time in days; ayan = the ayanamsa JHora holds at doc+0x1680 at that point. */
export function equationOfTime(sunMean: number, kendra: number, ayan: number): number {
  const l = norm(sunMean + ayan) * D2R;
  const g = norm(kendra) * D2R;
  const t = Math.tan(0.20943951023931953);
  const y = t * t;
  const sg = Math.sin(g);
  let e = Math.sin(l + l) * y - Math.sin(l * 4.0) * y * y * 0.5;
  e -= sg * 0.037968001610174;
  e -= Math.sin(g + g) * 0.0004504903582094299;
  e += Math.cos(l + l) * sg * y * 0.075936003220348;
  return e * R2D * DEG_PER_DAY_FRACTION;
}

/** FUN_004bf640: ahargana in local apparent time (two passes of the equation of time). */
export function apparentAhargana(a: number, dl: number, ayan: number): number {
  let s = meanState(a, dl, 1);
  const e1 = equationOfTime(s.mean, s.kendra, ayan);
  s = meanState(e1 + a, dl, 1);
  const e2 = equationOfTime(s.mean, s.kendra, ayan);
  return e2 + a;
}

/**
 * FUN_004bf760: SSS sunrise of the civil day containing ahargana t, in hours of
 * local apparent time (6h minus the ascensional difference of the true Sun
 * reckoned tropically with the SSS ayanamsa; no refraction, no disc).
 */
export function sunriseHours(t: number, dl: number, lat: number): number {
  const sinEps = Math.sin(0.41887902047863906); // 24 deg
  const tanLat = Math.tan(lat * D2R);
  let out = 6.0;
  for (let iter = 0; iter < 200; iter++) {
    t = Math.trunc(t) + out * 0.041666666666666664;
    const ay = sssAyanamsa(t);
    let l = trueLongitude(t, dl, 1).lon + ay;
    if (l > 360.0) l -= 360.0;
    let b: number;
    if (l <= 90.0) b = l;
    else if (l <= 180.0) b = 180.0 - l;
    else if (l <= 270.0) b = l - 180.0;
    else b = 360.0 - l;
    const sign = l > 180.0 ? -1 : 1;
    const sd = Math.sin(b * D2R) * sinEps;
    const decl = Math.atan(sd / Math.sqrt(1.0 - sd * sd));
    const z = Math.tan(decl * R2D * D2R) * tanLat;
    const cd = z < 1.0 ? Math.atan(z / Math.sqrt(1.0 - z * z)) * 572.9577951308232 : 900.0; // vighatis
    const prev = out;
    out = (60.0 - (cd * 0.016666666666666666 * sign + 45.0)) * 0.4;
    if (!(Math.abs(out - prev) > 1.1574074074074074e-6)) break;
  }
  return out;
}

/**
 * FUN_004bf960: oblique ascension of ecliptic arc `ang` from the equinox/solstice, minutes of
 * time; with flag 1 (raOnly) the ascensional difference is left out (right ascension only).
 */
function obliqueAscension(lat: number, ang: number, sgn: number, raOnly = false): number {
  const k = R2D;
  const sa = Math.sin(ang / k);
  const eps = 24.0 / k;
  const x = Math.sin(eps) * sa;
  const decl = Math.atan(x / Math.sqrt(1.0 - x * x));
  const y = Math.tan(lat / k) * Math.tan((decl * k) / k);
  const cd = Math.atan(y / Math.sqrt(1.0 - y * y)) * k * 4.0 * sgn;
  const z = (Math.cos(eps) * sa) / Math.cos((sa * 24.0) / k); // RA with declination ~ 24 sin(lambda)
  let ra: number;
  if (z === 1.0) ra = 360.0;
  else if (z === -1.0) ra = -360.0;
  else ra = Math.atan(z / Math.sqrt(1.0 - z * z)) * k * 4.0;
  return raOnly ? ra : ra + cd;
}

const QUAD_SIGN = [-1, 1, 1, -1, -1];
const QUAD_ADD = [true, false, true, false, true];

/**
 * FUN_004bfa50: rising time (minutes, 0..1440) of tropical longitude lon + ayan at latitude lat;
 * raOnly = flag 1 (right ascension, used for the SSS MC). The quadrant sums come from a cache
 * keyed on the latitude only (DAT_00586df8, DAT_00897088..); the lagna (flag 0) always fills
 * it first, and the ascensional differences cancel in the sums anyway.
 */
export function risingTime(lat: number, lon: number, ayan: number, raOnly = false): number {
  const t = norm(lon + ayan);
  const s = obliqueAscension(lat, 90.0, -1) + obliqueAscension(lat, 90.0, 1);
  const base = [0, s, s, s + s, s + s];
  const q = Math.trunc(t * 0.011111111111111112);
  let ang: number;
  switch (q) {
    case 1: ang = 180.0 - t; break;
    case 2: ang = t - 180.0; break;
    case 3: ang = 360.0 - t; break;
    case 4: ang = t - 360.0; break;
    default: ang = t;
  }
  const v = obliqueAscension(lat, ang, QUAD_SIGN[q], raOnly);
  return norm((QUAD_ADD[q] ? v + base[q] : base[q] - v) * 0.25) * 4.0;
}

/** FUN_004ae590 */
function angularDistance(a: number, b: number): number {
  let d = a - b;
  if (d < 0) d = -d;
  while (d >= 360.0) d -= 360.0;
  if (d > 180.0) d = 360.0 - d;
  return d;
}

/**
 * FUN_004bfd60: SSS lagna (SSS sidereal zodiac). x = minutes of time since
 * sunrise (scaled to a 1440-minute sunrise-to-sunrise day), sunNow/sunRise =
 * true Sun now and at sunrise, ayan = SSS ayanamsa. FUN_004bfc00 is the same
 * iteration with FUN_004bfa50's flag passed through (raOnly: the SSS "MC").
 * Not normalised: norm(l) + sunNow - sunRise.
 */
export function lagna(lat: number, sunNow: number, sunRise: number, ayan: number, x: number, raOnly = false): number {
  const k = risingTime(lat, sunRise, ayan, raOnly) + x;
  let l = norm(x * 0.25 + sunRise);
  let r = risingTime(lat, l, ayan, raOnly);
  const k4 = k * 0.25;
  for (let iter = 0; iter < 1000 && angularDistance(r * 0.25, k4) > 0.00020833333333333335; iter++) {
    l = norm((k - r) * 0.25 + l);
    r = risingTime(lat, l, ayan, raOnly);
  }
  return norm(l) + sunNow - sunRise;
}

/** FUN_004bfc00(..., flag 1): the SSS midheaven; x = minutes since the SSS midday. */
export function midheaven(lat: number, sunNow: number, sunRise: number, ayan: number, x: number): number {
  return lagna(lat, sunNow, sunRise, ayan, x, true);
}

/**
 * FUN_004bfec0(lat, t, dl, 180): length of the day in minutes of the 1440-minute
 * sunrise-to-sunrise day (k = 34560 / that day's hours): the rising-time difference of the
 * true Sun and the point 180 deg from it, the Sun taken at the estimated sunset. The sunrise
 * of t's civil day (local apparent) is turned into mean time with the equation of time
 * (FUN_004be460 three times with an unchanged mean Sun, i.e. once); the first estimate is
 * sunrise + 720 minutes, and each pass moves the estimate halfway to the result until the two
 * agree within 0.000208 (in quarter minutes, FUN_004ae590). FUN_004bfec0 also returns the
 * Sun's longitude and that + 180, unused by the house cusps.
 */
export function dayLength(lat: number, t: number, dl: number): number {
  const ang = 180.0;
  const rise = sunriseHours(t, dl, lat);
  const next = sunriseHours(t + 1.0, dl, lat);
  const k = 34560.0 / ((next + 24.0) - rise);
  const r0 = rise * 0.041666666666666664 + Math.trunc(t);
  const s0 = meanState(r0, dl, 1);
  const m0 = r0 - equationOfTime(s0.mean, s0.kendra, sssAyanamsa(r0));
  // (a FUN_004bfa50 call on the Sun at m0 follows; its result is dropped)
  const arc = (h: number) => {
    const t1 = h / k + m0;
    const ay = sssAyanamsa(t1);
    const sun = trueLongitude(apparentAhargana(t1, dl, ay), dl, 1).lon;
    let d = risingTime(lat, norm(sun + ang), ay) - risingTime(lat, norm(sun), ay);
    if (d < 0.0) d += k;
    return d;
  };
  let h = ang * 4.0;
  let d = arc(h);
  for (let iter = 0; iter < 1000 && angularDistance(d * 0.25, h * 0.25) > 0.00020833333333333335; iter++) {
    h = (d - h) * 0.5 + h;
    d = arc(h);
  }
  return d;
}
