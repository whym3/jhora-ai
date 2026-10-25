// Divisional charts (vargas). Each D-n maps a rasi longitude to a divisional
// longitude: the sign holding the division, plus the position inside the
// division stretched to 30 degrees.
//
// The default variants below are the ones JHora 8.0 uses with its default
// settings; each rule was checked against all 772 positions of the bundled
// sample charts ("All Divisional Longitudes" table). The other variants of
// JHora's chart menu ("Choose hora / drekkana / ...", ini keys HoraPreference,
// D3Preference .. D108Preference) and the research charts (custom D-n, D-m x n)
// are 'jh' specs built from the ini by vargaOptions.ts (vargasOf / vargaSpec).
//
// 'jh' follows jhora.exe's own split (FUN_004a0a90 / FUN_004a0e40): a varga's
// sign comes from its sign routine (FUN_004a78b0 D-9, FUN_004a7bc0 D-2, ...),
// while the divisional longitude inside that sign is generic: n * longitude
// mod 30 (n = table 0x591ed4), counted from the end of the sign in even signs
// when DivLongFromEndToo is set and the chosen variant reverses (FUN_0049fea0),
// or the proportional D-30 degree of FUN_004b6be0 when Use1DegInD30ForDivLong
// is 0.

export type VargaSpec =
  | { kind: 'zero' }                                    // JHora's empty "D-0" research slot: everything at 0 Aries
  | { kind: 'cyclic'; n: number; evenReverse?: boolean } // parivritti: (sign * n + part) mod 12
  | { kind: 'start'; n: number; start: (sign: number) => number; evenReverse?: boolean }
  | { kind: 'parasara-d30' }
  | { kind: 'standard-d5' }
  | { kind: 'compose'; inner: VargaSpec; outer: VargaSpec }
  /** JHora's generic form: sign from a sign routine, degrees n * lon mod 30 (see header) */
  | { kind: 'jh'; n: number; sign: (lon: number) => number; reverse?: boolean; d30Prop?: boolean };

const odd = (s: number) => s % 2 === 0;               // Ar=0 is an odd sign
const modality = (s: number) => s % 3;               // 0 movable, 1 fixed, 2 dual

export const VARGAS = {
  D1: { kind: 'start', n: 1, start: (s) => s },
  // Parasara hora with parivritti and even-sign reversal (Uma-Shambhu), JHora's default
  D2: { kind: 'cyclic', n: 2, evenReverse: true },
  D3: { kind: 'start', n: 3, start: (s) => s },        // s, s+4, s+8 via the 4-sign stride below
  D4: { kind: 'start', n: 4, start: (s) => s },
  D5: { kind: 'standard-d5' },
  D6: { kind: 'start', n: 6, start: (s) => (odd(s) ? 0 : 6) },
  D7: { kind: 'start', n: 7, start: (s) => (odd(s) ? s : s + 6) },
  D8: { kind: 'start', n: 8, start: (s) => [0, 8, 4][modality(s)] },
  D9: { kind: 'cyclic', n: 9 },
  D10: { kind: 'start', n: 10, start: (s) => (odd(s) ? s : s + 8) },
  D11: { kind: 'cyclic', n: 11 },
  D12: { kind: 'start', n: 12, start: (s) => s },
  D16: { kind: 'start', n: 16, start: (s) => [0, 4, 8][modality(s)] },
  D20: { kind: 'start', n: 20, start: (s) => [0, 8, 4][modality(s)] },
  D24: { kind: 'start', n: 24, start: (s) => (odd(s) ? 4 : 3) },
  D27: { kind: 'start', n: 27, start: (s) => [0, 3, 6, 9][s % 4] },
  D30: { kind: 'parasara-d30' },
  D40: { kind: 'start', n: 40, start: (s) => (odd(s) ? 0 : 6) },
  D45: { kind: 'start', n: 45, start: (s) => [0, 4, 8][modality(s)] },
  D60: { kind: 'start', n: 60, start: (s) => s },
  D81: { kind: 'cyclic', n: 81 },
} satisfies Record<string, VargaSpec>;

const D12 = VARGAS.D12 as VargaSpec;
export const COMPOSITE_VARGAS = {
  D108: { kind: 'compose', inner: VARGAS.D9, outer: D12 },   // D-12 of D-9 (JHora default)
  D144: { kind: 'compose', inner: D12, outer: D12 },          // dwadasa-dwadasamsa
  /** JHora's default sub-divisional research chart "D-10 x D-9": the D-9 of the D-10 */
  D10xD9: { kind: 'compose', inner: VARGAS.D10, outer: VARGAS.D9 as VargaSpec },
  D0: { kind: 'zero' },
} satisfies Record<string, VargaSpec>;

export type VargaName = keyof typeof VARGAS | keyof typeof COMPOSITE_VARGAS;
export const ALL_VARGAS: Record<VargaName, VargaSpec> = { ...VARGAS, ...COMPOSITE_VARGAS };

/** Signs a part index moves by, for the "start" family (D-3 and D-4 skip signs). */
function stride(n: number): number {
  if (n === 3) return 4;
  if (n === 4) return 3;
  return 1;
}

// Parasara trimsamsa: unequal portions ruled by Ma, Sa, Ju, Me, Ve (odd signs)
// and Ve, Me, Ju, Sa, Ma (even signs).
const D30_ODD: [number, number][] = [[5, 0], [10, 10], [18, 8], [25, 2], [30, 6]];
const D30_EVEN: [number, number][] = [[5, 1], [12, 5], [20, 11], [25, 9], [30, 7]];
const D5_ODD = [0, 10, 8, 2, 6];
const D5_EVEN = [1, 5, 11, 9, 7];

/**
 * FUN_004b6be0: the D-30 divisional degree with Use1DegInD30ForDivLong = 0 - the
 * position inside the unequal trimsamsa portion (5, 5, 8, 7, 5 degrees, mirrored in
 * even signs) stretched to 30 degrees.
 */
export function d30ProportionalDegree(inSign: number, evenSign: boolean): number {
  let x = evenSign ? 30 - inSign : inSign;
  let size = 5;
  if (x >= 5) {
    if (x >= 10) {
      if (x < 18) { x -= 10; size = 8; }
      else if (x < 25) { x -= 18; size = 7; }
      else x -= 25;
    } else x -= 5;
  }
  if (evenSign) x = size - x;
  return (x * 30) / size;
}

export function vargaLongitude(lon: number, spec: VargaSpec): number {
  const sign = Math.floor(lon / 30) % 12;
  const inSign = lon - sign * 30;
  switch (spec.kind) {
    case 'zero':
      return 0;
    case 'cyclic': {
      if (!spec.evenReverse || odd(sign)) return (lon * spec.n) % 360;
      // even signs: divisions counted backwards from the end of the sign
      const size = 30 / spec.n;
      const part = Math.min(spec.n - 1, Math.floor(inSign / size));
      const frac = (inSign - part * size) / size;
      return (((sign * spec.n + spec.n - 1 - part) % 12) * 30) + (1 - frac) * 30;
    }
    case 'start': {
      const size = 30 / spec.n;
      let part = Math.min(spec.n - 1, Math.floor(inSign / size));
      let frac = (inSign - part * size) / size;
      if (spec.evenReverse && !odd(sign)) { part = spec.n - 1 - part; frac = 1 - frac; }
      const target = (spec.start(sign) + part * stride(spec.n)) % 12;
      return target * 30 + frac * 30;
    }
    case 'parasara-d30': {
      // JHora default: each degree of the rasi maps to 30 deg of the D-30 sign.
      for (const [limit, target] of odd(sign) ? D30_ODD : D30_EVEN) {
        if (inSign < limit) return target * 30 + ((inSign * 30) % 30);
      }
      throw new Error('unreachable');
    }
    case 'standard-d5': {
      const part = Math.min(4, Math.floor(inSign / 6));
      return (odd(sign) ? D5_ODD : D5_EVEN)[part] * 30 + ((inSign - part * 6) / 6) * 30;
    }
    case 'compose':
      return vargaLongitude(vargaLongitude(lon, spec.inner), spec.outer);
    case 'jh': {
      // FUN_004a0a90: degrees from n * lon (or FUN_004b6be0), reversed in even signs,
      // normalised (FUN_004c1980), then the sign replaced by the sign routine's
      let deg = (spec.d30Prop ? d30ProportionalDegree(inSign, !odd(sign)) : spec.n * lon) % 30;
      if (spec.reverse && !odd(sign) && deg !== 0) deg = 30 - deg;
      return ((((spec.sign(lon) % 12) + 12) % 12) * 30) + deg;
    }
  }
}

export const vargaSign = (lon: number, spec: VargaSpec) => Math.floor(vargaLongitude(lon, spec) / 30) % 12;
