// Delta-T (TT - UT) exactly as computed by JHora 8.0's swedll32.dll, i.e.
// swe_deltat() of Swiss Ephemeris 2.02.01 (swephlib.c: calc_deltat,
// deltat_aa, deltat_espenak_meeus_1620, deltat_longterm_morrison_stephenson,
// adjust_for_tidacc) in its default configuration:
// * delta-T model SEMOD_DELTAT_ESPENAK_MEEUS_2006 (astro_models[] unset), so
//   before 1633 the Espenak & Meeus polynomials apply and the
//   Stephenson/Morrison 1600 table and 1600-1620 bridge are never reached;
// * no swe_deltat.txt / sedeltat.txt in the ephemeris path, so the built-in
//   table (1620-2019, "Dieter Koch, 18 dec 2013") is used as is;
// * tidal acceleration -25.80 ("/cy^2, SE_TIDAL_DE431): the DLL's
//   swe_get_tid_acc() returns it once swe_set_ephe_path() has been called,
//   before and after any swe_calc(), because every Moon file (semo*.se1) is
//   DE431.
// Arithmetic follows the C expression order, so results agree with the DLL
// to rounding.

const J2000 = 2451545.0;
const TID_ACC = -25.8;

const TABSTART = 1620;
/* table dt[] of swephlib.c 2.02.01, in seconds: 1620.0 through 2019.0 */
const DT: readonly number[] = [
  /* 1620.0 thru 1659.0 */
  124.0, 119.0, 115.0, 110.0, 106.0, 102.0, 98.0, 95.0, 91.0, 88.0,
  85.0, 82.0, 79.0, 77.0, 74.0, 72.0, 70.0, 67.0, 65.0, 63.0,
  62.0, 60.0, 58.0, 57.0, 55.0, 54.0, 53.0, 51.0, 50.0, 49.0,
  48.0, 47.0, 46.0, 45.0, 44.0, 43.0, 42.0, 41.0, 40.0, 38.0,
  /* 1660.0 thru 1699.0 */
  37.0, 36.0, 35.0, 34.0, 33.0, 32.0, 31.0, 30.0, 28.0, 27.0,
  26.0, 25.0, 24.0, 23.0, 22.0, 21.0, 20.0, 19.0, 18.0, 17.0,
  16.0, 15.0, 14.0, 14.0, 13.0, 12.0, 12.0, 11.0, 11.0, 10.0,
  10.0, 10.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0,
  /* 1700.0 thru 1739.0 */
  9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 9.0, 10.0, 10.0,
  10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 11.0, 11.0, 11.0,
  11.0, 11.0, 11.0, 11.0, 11.0, 11.0, 11.0, 11.0, 11.0, 11.0,
  11.0, 11.0, 11.0, 11.0, 12.0, 12.0, 12.0, 12.0, 12.0, 12.0,
  /* 1740.0 thru 1779.0 */
  12.0, 12.0, 12.0, 12.0, 13.0, 13.0, 13.0, 13.0, 13.0, 13.0,
  13.0, 14.0, 14.0, 14.0, 14.0, 14.0, 14.0, 14.0, 15.0, 15.0,
  15.0, 15.0, 15.0, 15.0, 15.0, 16.0, 16.0, 16.0, 16.0, 16.0,
  16.0, 16.0, 16.0, 16.0, 16.0, 17.0, 17.0, 17.0, 17.0, 17.0,
  /* 1780.0 thru 1799.0 */
  17.0, 17.0, 17.0, 17.0, 17.0, 17.0, 17.0, 17.0, 17.0, 17.0,
  17.0, 17.0, 16.0, 16.0, 16.0, 16.0, 15.0, 15.0, 14.0, 14.0,
  /* 1800.0 thru 1819.0 */
  13.7, 13.4, 13.1, 12.9, 12.7, 12.6, 12.5, 12.5, 12.5, 12.5,
  12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.5, 12.4, 12.3, 12.2,
  /* 1820.0 thru 1859.0 */
  12.0, 11.7, 11.4, 11.1, 10.6, 10.2, 9.6, 9.1, 8.6, 8.0,
  7.5, 7.0, 6.6, 6.3, 6.0, 5.8, 5.7, 5.6, 5.6, 5.6,
  5.7, 5.8, 5.9, 6.1, 6.2, 6.3, 6.5, 6.6, 6.8, 6.9,
  7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.7, 7.8, 7.8,
  /* 1860.0 thru 1899.0 */
  7.88, 7.82, 7.54, 6.97, 6.4, 6.02, 5.41, 4.1, 2.92, 1.82,
  1.61, 0.1, -1.02, -1.28, -2.69, -3.24, -3.64, -4.54, -4.71, -5.11,
  -5.4, -5.42, -5.2, -5.46, -5.46, -5.79, -5.63, -5.64, -5.8, -5.66,
  -5.87, -6.01, -6.19, -6.64, -6.44, -6.47, -6.09, -5.76, -4.66, -3.74,
  /* 1900.0 thru 1939.0 */
  -2.72, -1.54, -0.02, 1.24, 2.64, 3.86, 5.37, 6.14, 7.75, 9.13,
  10.46, 11.53, 13.36, 14.65, 16.01, 17.2, 18.24, 19.06, 20.25, 20.95,
  21.16, 22.25, 22.41, 23.03, 23.49, 23.62, 23.86, 24.49, 24.34, 24.08,
  24.02, 24.0, 23.87, 23.95, 23.86, 23.93, 23.73, 23.92, 23.96, 24.02,
  /* 1940.0 thru 1979.0 */
  24.33, 24.83, 25.3, 25.7, 26.24, 26.77, 27.28, 27.78, 28.25, 28.71,
  29.15, 29.57, 29.97, 30.36, 30.72, 31.07, 31.35, 31.68, 32.18, 32.68,
  33.15, 33.59, 34.0, 34.47, 35.03, 35.73, 36.54, 37.43, 38.29, 39.2,
  40.18, 41.17, 42.23, 43.37, 44.49, 45.48, 46.46, 47.52, 48.53, 49.59,
  /* 1980.0 thru 1999.0 */
  50.54, 51.38, 52.17, 52.96, 53.79, 54.34, 54.87, 55.32, 55.82, 56.3,
  56.86, 57.57, 58.31, 59.12, 59.98, 60.78, 61.63, 62.3, 62.97, 63.47,
  /* 2000.0 thru 2009.0 */
  63.83, 64.09, 64.3, 64.47, 64.57, 64.69, 64.85, 65.15, 65.46, 65.78,
  /* 2010.0 thru 2015.0 */
  66.07, 66.32, 66.6, 66.907, 67.281, 67.644,
  /* Extrapolated values, 2016 - 2019 */
  68.01, 68.5, 69.0, 69.5,
];
/* init_dt() without an external file: the count of entries up to the first 0 */
const TABSIZ = DT.length;
const TABEND = TABSTART + TABSIZ - 1;

/* 1633 AD: below this, the default model uses Espenak & Meeus 2006 */
const ESPENAK_MEEUS_END_JD = 2317746.13090277789;

/** Astronomical Almanac correction of pre-1955 values to the tidal acceleration (AA K8). */
function adjustForTidacc(ans: number, Y: number, tidAcc: number): number {
  if (Y < 1955.0) {
    const B = Y - 1955.0;
    ans += -0.000091 * (tidAcc + 26.0) * B * B;
  }
  return ans;
}

/** Morrison & Stephenson 2004 long-term parabola, seconds. */
function deltatLongtermMorrisonStephenson(tjd: number): number {
  const Ygreg = 2000.0 + (tjd - J2000) / 365.2425;
  const u = (Ygreg - 1820) / 100.0;
  return -20 + 32 * u * u;
}

/** Espenak & Meeus 2006 polynomials (used before 1633 here), days. */
function deltatEspenakMeeus1620(tjd: number, tidAcc: number): number {
  let ans = 0;
  let u: number;
  const Ygreg = 2000.0 + (tjd - J2000) / 365.2425;
  if (Ygreg < -500) {
    ans = deltatLongtermMorrisonStephenson(tjd);
  } else if (Ygreg < 500) {
    u = Ygreg / 100.0;
    ans = (((((0.0090316521 * u + 0.022174192) * u - 0.1798452) * u - 5.952053) * u + 33.78311) * u - 1014.41) * u + 10583.6;
  } else if (Ygreg < 1600) {
    u = (Ygreg - 1000) / 100.0;
    ans = (((((0.0083572073 * u - 0.005050998) * u - 0.8503463) * u + 0.319781) * u + 71.23472) * u - 556.01) * u + 1574.2;
  } else if (Ygreg < 1700) {
    u = Ygreg - 1600;
    ans = 120 - 0.9808 * u - 0.01532 * u * u + (u * u * u) / 7129.0;
  } else if (Ygreg < 1800) {
    u = Ygreg - 1700;
    ans = (((-u / 1174000.0 + 0.00013336) * u - 0.0059285) * u + 0.1603) * u + 8.83;
  } else if (Ygreg < 1860) {
    u = Ygreg - 1800;
    ans = ((((((0.000000000875 * u - 0.0000001699) * u + 0.0000121272) * u - 0.00037436) * u + 0.0041116) * u + 0.0068612) * u - 0.332447) * u + 13.72;
  } else if (Ygreg < 1900) {
    u = Ygreg - 1860;
    ans = ((((u / 233174.0 - 0.0004473624) * u + 0.01680668) * u - 0.251754) * u + 0.5737) * u + 7.62;
  } else if (Ygreg < 1920) {
    u = Ygreg - 1900;
    ans = (((-0.000197 * u + 0.0061966) * u - 0.0598939) * u + 1.494119) * u - 2.79;
  } else if (Ygreg < 1941) {
    u = Ygreg - 1920;
    ans = 21.2 + 0.84493 * u - 0.0761 * u * u + 0.0020936 * u * u * u;
  } else if (Ygreg < 1961) {
    u = Ygreg - 1950;
    ans = 29.07 + 0.407 * u - (u * u) / 233.0 + (u * u * u) / 2547.0;
  } else if (Ygreg < 1986) {
    u = Ygreg - 1975;
    ans = 45.45 + 1.067 * u - (u * u) / 260.0 - (u * u * u) / 718.0;
  } else if (Ygreg < 2005) {
    u = Ygreg - 2000;
    ans = ((((0.00002373599 * u + 0.000651814) * u + 0.0017275) * u - 0.060374) * u + 0.3345) * u + 63.86;
  }
  ans = adjustForTidacc(ans, Ygreg, tidAcc);
  return ans / 86400.0;
}

/**
 * 1633 onwards: Bessel interpolation (to 4th differences, AA K11) in the
 * yearly table, then Stephenson 1997 with a 100-year linear blend, days.
 */
function deltatAa(tjd: number, tidAcc: number): number {
  let ans = 0;
  let B: number;
  const d = [0, 0, 0, 0, 0, 0];
  const Y = 2000.0 + (tjd - J2000) / 365.2425;
  if (Y <= TABEND) {
    let p = Math.floor(Y);
    const iy = Math.trunc(p - TABSTART);
    /* zeroth order estimate is value at start of year */
    ans = DT[iy];
    done: {
      let k = iy + 1;
      if (k >= TABSIZ) break done;
      /* fraction of tabulation interval */
      p = Y - p;
      /* first order */
      ans += p * (DT[k] - DT[iy]);
      if (iy - 1 < 0 || iy + 2 >= TABSIZ) break done;
      /* first differences */
      k = iy - 2;
      for (let i = 0; i < 5; i++) {
        d[i] = k < 0 || k + 1 >= TABSIZ ? 0 : DT[k + 1] - DT[k];
        k += 1;
      }
      /* second differences */
      for (let i = 0; i < 4; i++) d[i] = d[i + 1] - d[i];
      B = 0.25 * p * (p - 1.0);
      ans += B * (d[1] + d[2]);
      if (iy + 2 >= TABSIZ) break done;
      /* third differences */
      for (let i = 0; i < 3; i++) d[i] = d[i + 1] - d[i];
      B = (2.0 * B) / 3.0;
      ans += (p - 0.5) * B * d[1];
      if (iy - 2 < 0 || iy + 3 > TABSIZ) break done;
      /* fourth differences */
      for (let i = 0; i < 2; i++) d[i] = d[i + 1] - d[i];
      B = 0.125 * B * (p + 1.0) * (p - 2.0);
      ans += B * (d[0] + d[1]);
    }
    ans = adjustForTidacc(ans, Y, tidAcc);
    return ans / 86400.0;
  }
  /* after the table: Stephenson (1997; p. 507), blended in over 100 years */
  B = 0.01 * (Y - 1820);
  ans = -20 + 31 * B * B;
  if (Y <= TABEND + 100) {
    const B2 = 0.01 * (TABEND - 1820);
    const ans2 = -20 + 31 * B2 * B2;
    const ans3 = DT[TABSIZ - 1];
    const dd = ans2 - ans3;
    ans += dd * (Y - (TABEND + 100)) * 0.01;
  }
  return ans / 86400.0;
}

/**
 * Delta-T in days for a UT Julian day: swe_deltat(jdUt) of JHora's
 * swedll32.dll (Swiss Ephemeris 2.02.01). Defined for every date; the
 * nullable return type is kept for existing callers.
 */
export function jhoraDeltaT(jdUt: number): number | null {
  if (jdUt < ESPENAK_MEEUS_END_JD) return deltatEspenakMeeus1620(jdUt, TID_ACC);
  return deltatAa(jdUt, TID_ACC);
}
