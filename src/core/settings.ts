// Calculation settings consumed by the core, derived from JHora's ini keys.
// Defaults are the values JHora 8.0 writes to jhcore/jhora.ini on first run
// (golden/jhora-defaults.ini, typed in src/settings/generated.ts).
import { DEFAULTS, type JhoraIni } from '../settings/generated';

export type AyanamsaId =
  | 'true-chitrapaksha'   // JHora index 17: Spica at 180 deg (true position of date)
  | 'lahiri'              // Swiss SE_SIDM_LAHIRI
  | 'tropical';

export interface Settings {
  ayanamsa: AyanamsaId;
  /** added to the ayanamsa, degrees (DeltaFromUserSelectedAyanamsa) */
  ayanamsaDelta: number;
  /** TruePositions: geometric positions without light-time and aberration */
  truePositions: boolean;
  topocentric: boolean;
  noNutation: boolean;
  noAberration: boolean;
  noGravDeflection: boolean;
  /** TrueNodes: true (osculating) instead of mean nodes */
  trueNodes: boolean;
}

/**
 * JHora's UserSelectedAyanamsa indices handled so far (jhora.exe FUN_0049a3a0:
 * 1 and 17 fix Spica at 180 deg; the rest are Swiss sidereal modes or SSS).
 * Unknown indices fall back to JHora's default until their mode is ported.
 */
function ayanamsaFromIndex(i: number): AyanamsaId {
  switch (i) {
    case 1: case 17: return 'true-chitrapaksha';
    case 19: return 'tropical';
    default: return 'true-chitrapaksha';
  }
}

export function calcSettingsFromIni(ini: Partial<JhoraIni>): Settings {
  const s = { ...DEFAULTS, ...ini };
  return {
    ayanamsa: ayanamsaFromIndex(s.UserSelectedAyanamsa),
    ayanamsaDelta: s.DeltaFromUserSelectedAyanamsa,
    truePositions: s.TruePositions !== 0,
    topocentric: s.TopocentricPositions !== 0,
    noNutation: s.NoNutation !== 0,
    noAberration: s.NoAberration !== 0,
    noGravDeflection: s.NoGravDeflection !== 0,
    trueNodes: s.TrueNodes !== 0,
  };
}

export const DEFAULT_SETTINGS: Settings = calcSettingsFromIni({});
