// Calculation settings consumed by the core, derived from JHora's ini keys.
// Defaults are the values JHora 8.0 writes to jhcore/jhora.ini on first run
// (golden/jhora-defaults.ini, typed in src/settings/generated.ts).
//
// Ayanamsa: UserSelectedAyanamsa is stored unchanged in jhora.exe's ayanamsa
// record (DAT_008a1ec8, ini reader FUN_004e0690) and interpreted by the sid-mode
// table FUN_0049a3a0; dialog 155 (FUN_004e6d00) shows the choices in its own
// order through two index tables. See positions.ts ayanamsa() for each mode.
import { DEFAULTS, type JhoraIni } from '../settings/generated';

export type AyanamsaId =
  | 'lahiri'              //  0 Traditional Lahiri: Swiss SE_SIDM_LAHIRI
  | 'jagannatha'          //  1 Spica at 180 on the solar-system plane (Fagan mode | SE_SIDBIT_SSY_PLANE)
  | 'raman'               //  2 SE_SIDM_RAMAN
  | 'deva-datta'          //  3 Lahiri - 0 22' 37"
  | 'kp'                  //  4 Krishnamoorthy: SE_SIDM_KRISHNAMURTI
  | 'usha-shashi'         //  5 SE_SIDM_USHASHASHI
  | 'yukteshwar'          //  6 SE_SIDM_YUKTESHWAR
  | 'jn-bhasin'           //  7 SE_SIDM_JN_BHASIN
  | 'chandra-hari'        //  8 Shaula (lambda Sco, true position) at 0 Sg, tropical
  | 'fagan'               //  9 SE_SIDM_FAGAN_BRADLEY
  | 'deluce'              // 10 SE_SIDM_DELUCE
  | 'djwhal-khul'         // 11 SE_SIDM_DJWHAL_KHUL
  | 'aldebaran-15ta'      // 12 SE_SIDM_ALDEBARAN_15TAU
  | 'galactic-center'     // 13 SE_SIDM_GALCENT_0SAG
  | 'hipparchos'          // 14 SE_SIDM_HIPPARCHOS
  | 'sassanian'           // 15 SE_SIDM_SASSANIAN
  | 'tropical'            // 16 sayana
  | 'true-chitrapaksha'   // 17 Spica at 180 deg (true position of date), JHora's default
  | 'sss'                 // 18 Sri Surya Siddhanta ayanamsa (src/core/sss)
  | 'custom-star'         // 19 CustomStarCode at CustomStarLongitude
  | 'rohini-paksha'       // 20 Aldebaran at 16 Ta 40'
  | 'pushya-paksha';      // 21 delta Cancri (Asellus Australis) at 16 Cn

/** Ayanamsa modes by UserSelectedAyanamsa (the index of jhora.exe's ayanamsa record). */
export const AYANAMSA_BY_INDEX: readonly AyanamsaId[] = [
  'lahiri', 'jagannatha', 'raman', 'deva-datta', 'kp', 'usha-shashi', 'yukteshwar', 'jn-bhasin',
  'chandra-hari', 'fagan', 'deluce', 'djwhal-khul', 'aldebaran-15ta', 'galactic-center', 'hipparchos',
  'sassanian', 'tropical', 'true-chitrapaksha', 'sss', 'custom-star', 'rohini-paksha', 'pushya-paksha',
];

/**
 * Dialog 155's combo box in display order (its dlginit strings), each with the
 * UserSelectedAyanamsa it stores (FUN_004e6d00's position -> index table).
 */
export const AYANAMSA_CHOICES: readonly { index: number; label: string }[] = [
  { index: 17, label: 'True Lahiri/Chitrapaksha (Spica in the middle of Chitra always)' },
  { index: 0, label: 'Traditional Lahiri' },
  { index: 21, label: 'Pushya-paksha ayanamsa' },
  { index: 2, label: 'Raman' },
  { index: 4, label: 'Krishnamoorthy (KP)' },
  { index: 19, label: 'Fixed star based CUSTOM ayanamsa' },
  { index: 1, label: 'Jagannatha (Spica in the middle of Chitra always, fixed solar rotation plane)' },
  { index: 20, label: 'Rohini-paksha ayanamsa (Aldebaran in the middle of Rohini always)' },
  { index: 18, label: 'Sri Surya Siddhanta' },
  { index: 3, label: 'Deva-datta' },
  { index: 5, label: 'Usha-Shashi' },
  { index: 6, label: 'Yukteshwar' },
  { index: 7, label: 'JN Bhasin' },
  { index: 8, label: 'Chandra Hari' },
  { index: 9, label: 'Fagan' },
  { index: 10, label: 'Deluce' },
  { index: 11, label: 'Djwhal Khul' },
  { index: 12, label: 'Aldebaran at 15Ta0' },
  { index: 13, label: 'Galaxy center at 0Sg0' },
  { index: 14, label: 'Hipparchos' },
  { index: 15, label: 'Sassanian' },
  { index: 16, label: 'Tropical (sayana)' },
];

/** Display name of a mode (the dialog's label). */
export function ayanamsaLabel(id: AyanamsaId): string {
  const i = AYANAMSA_BY_INDEX.indexOf(id);
  return AYANAMSA_CHOICES.find((c) => c.index === i)?.label ?? id;
}

/** Fixed star based custom ayanamsa (dialog 2074). */
export interface CustomStar {
  /** JHora's fixstars.cat search string, ",alVir" style (CustomStarCode) */
  code: string;
  /** sidereal longitude the star is held at, degrees (CustomStarLongitude) */
  lon: number;
  /** FixedPlaneInCustomStarAyanamsa: measure on the solar-system plane, not the ecliptic of date */
  fixedPlane: boolean;
}

export interface Settings {
  ayanamsa: AyanamsaId;
  /** added to the ayanamsa, degrees (DeltaFromUserSelectedAyanamsa) */
  ayanamsaDelta: number;
  /** ayanamsa 19 (custom-star) only */
  customStar?: CustomStar;
  /**
   * SiderealNaksharasInTropical: with the tropical zodiac, nakshatras and nakshatra
   * dasas still use the Spica-fixed sidereal zodiac (FUN_0049a930); see
   * positions.ts nakshatraShift().
   */
  siderealNakshatras?: boolean;
  /** TruePositions: geometric positions without light-time and aberration */
  truePositions: boolean;
  topocentric: boolean;
  noNutation: boolean;
  noAberration: boolean;
  noGravDeflection: boolean;
  /** TrueNodes: true (osculating) instead of mean nodes */
  trueNodes: boolean;
  /** ApparentRefraction (dialog 149): refract apparent positions (ignored with TruePositions) */
  refraction?: boolean;
  /** Siddhanta=1: Sri Surya Siddhanta planetary model (src/core/sss) */
  sss?: boolean;
  /** UserSelectedAyanamsa=18: SSS ayanamsa (same as ayanamsa === 'sss') */
  sssAyanamsa?: boolean;
}

/** JHora's UserSelectedAyanamsa to our mode; an out-of-range index acts as JHora's default. */
export function ayanamsaFromIndex(i: number): AyanamsaId {
  return AYANAMSA_BY_INDEX[i] ?? 'true-chitrapaksha';
}

export function calcSettingsFromIni(ini: Partial<JhoraIni>): Settings {
  const s = { ...DEFAULTS, ...ini };
  const ayanamsa = ayanamsaFromIndex(s.UserSelectedAyanamsa);
  return {
    ayanamsa,
    ayanamsaDelta: s.DeltaFromUserSelectedAyanamsa,
    ...(ayanamsa === 'custom-star' ? {
      customStar: {
        code: s.CustomStarCode,
        lon: s.CustomStarLongitude,
        fixedPlane: s.FixedPlaneInCustomStarAyanamsa !== 0,
      },
    } : {}),
    siderealNakshatras: s.SiderealNaksharasInTropical !== 0,
    truePositions: s.TruePositions !== 0,
    topocentric: s.TopocentricPositions !== 0,
    noNutation: s.NoNutation !== 0,
    noAberration: s.NoAberration !== 0,
    noGravDeflection: s.NoGravDeflection !== 0,
    trueNodes: s.TrueNodes !== 0,
    refraction: s.ApparentRefraction !== 0,
    sss: s.Siddhanta === 1,
    sssAyanamsa: ayanamsa === 'sss',
  };
}

export const DEFAULT_SETTINGS: Settings = calcSettingsFromIni({});
