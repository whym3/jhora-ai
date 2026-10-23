// Calculation settings. Defaults are the values JHora 8.0 writes to
// jhcore/jhora.ini on first run (golden/jhora-defaults.ini).

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

export const DEFAULT_SETTINGS: Settings = {
  ayanamsa: 'true-chitrapaksha',
  ayanamsaDelta: 0,
  truePositions: true,
  topocentric: false,
  noNutation: false,
  noAberration: false,
  noGravDeflection: false,
  trueNodes: false,
};
