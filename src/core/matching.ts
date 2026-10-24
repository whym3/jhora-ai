// Horoscope matching for marriage (Ashtakoota / Guna Milan), as JHora 8.0 does it.
//
// Recovered from jhora.exe:
// * Command 33320 "Horoscope matching score for marriage, given the nakshatra of another
//   person" (handler FUN_004e8db0, message map entry 0x557580) opens dialog 2067:
//   "Consider a [Bride|Bridegroom] with the following nakshatra [..] for the native,
//   and the following pada (quarter) [..]". JHora does NOT compare two chart files: the
//   other person is only a nakshatra + pada. The dialog remembers the last nakshatra and
//   pada (globals 0x897dc0 / 0x897dc4); the Bride/Bridegroom choice defaults to
//   "Bridegroom" when the native's gender (doc+0x128, .jhd field 18: 0 unknown, 1 male,
//   2 female) is female, else "Bride".
// * The native's nakshatra and pada are the Moon's (doc+0x16ee / doc+0x17c0: per-body
//   byte arrays at 0x16ec / 0x17be, index 2 = Moon; pada 0-based).
// * FUN_004b3b10(otherIsGroom, otherNak, otherPada, nativeNak, nativePada) maps each
//   (nakshatra, pada) to one of 36 nakshatra-rasi segments (FUN_004b37a0: 108-entry table)
//   and returns a precomputed 36 x 36 gunanka table entry, row = bride's segment,
//   column = groom's segment. No koota break-up exists in JHora.
// * Level (FUN_004e8db0): < 18 Below Average, < 22 Average, < 26 Fair, <= 30 Good,
//   > 30 Excellent. The result is shown in a message box titled "Result of Horoscope
//   Matching for Marriage" with the format string at 0x591a3c (see matchHoroscopes).

/** Nakshatra names of JHora's runtime table 0x8a4038 (used in the result text). */
export const MATCH_NAKSHATRA_NAMES = [
  'Aswini', 'Bharani', 'Krittika', 'Rohini', 'Mrigasira', 'Aardra', 'Punarvasu', 'Pushyami', 'Aasresha',
  'Magha', 'Poorva Phalguni', 'Uttara Phalguni', 'Hastha', 'Chitra', 'Swaati', 'Visakha', 'Anuraadha', 'Jyeshtha',
  'Moola', 'Poorvashadha', 'Uttarashadha', 'Sravanam', 'Dhanishtha', 'Satabhishak', 'Poorvabhadra', 'Uttarabhadra', 'Revati',
];
const PADA_ORDINAL = ['1st', '2nd', '3rd', '4th'];

/** FUN_004b37a0: segment (0..35) of nakshatra*4 + pada; a new segment starts at every nakshatra or sign boundary. */
export const SEGMENT_OF_PADA: readonly number[] = [
  0, 0, 0, 0, 1, 1, 1, 1, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13, 13, 13, 14, 15, 15, 15, 16, 16, 16, 16, 17, 17,
  18, 18, 19, 19, 19, 19, 20, 20, 20, 21, 22, 22, 22, 22, 23, 23, 23, 23, 24, 24, 24, 24, 25, 25, 25, 25, 26, 27, 27, 27, 28, 28, 28, 28, 29, 29, 30, 30, 31, 31, 31, 31, 32, 32, 32, 33, 34, 34, 34, 34, 35, 35, 35, 35,
];

/** FUN_004b3b10: gunanka (out of 36), GUNANKA[bride segment][groom segment]. */
export const GUNANKA: readonly (readonly number[])[] = [
  [28, 33, 28, 18, 21, 22, 26, 17, 18, 22, 31, 27, 21, 26, 17, 11, 9, 13, 22, 26, 22, 19, 26, 15, 13, 27, 24, 26, 24, 21, 21, 15, 16, 14, 24, 26],
  [34, 28, 29, 19, 22, 15, 18, 26, 26, 30, 23, 24, 21, 19, 28, 21, 19, 6, 14, 29, 22, 19, 17, 19, 20, 20, 27, 28, 26, 10, 10, 20, 24, 22, 16, 28],
  [27, 27, 28, 17, 9, 15, 19, 20, 21, 25, 26, 23, 17, 21, 22, 15, 15, 18, 27, 15, 19, 16, 20, 26, 24, 19, 14, 15, 10, 25, 25, 27, 19, 17, 19, 11],
  [18, 18, 19, 28, 19, 25, 16, 17, 18, 22, 23, 20, 19, 23, 24, 21, 21, 23, 22, 10, 14, 21, 25, 31, 20, 13, 9, 14, 10, 23, 29, 31, 23, 20, 22, 14],
  [23, 23, 10, 19, 28, 36, 27, 23, 23, 27, 26, 13, 12, 26, 28, 25, 26, 20, 19, 15, 9, 16, 30, 24, 14, 20, 11, 17, 18, 20, 26, 24, 30, 27, 26, 19],
  [22, 13, 15, 27, 34, 28, 20, 25, 23, 26, 19, 22, 21, 17, 25, 23, 27, 13, 10, 25, 17, 23, 22, 25, 15, 11, 18, 21, 24, 13, 19, 27, 29, 26, 17, 27],
  [27, 18, 21, 18, 25, 20, 28, 33, 31, 19, 10, 15, 24, 20, 28, 30, 34, 21, 14, 27, 19, 14, 11, 13, 23, 18, 24, 20, 25, 12, 13, 21, 23, 27, 17, 27],
  [19, 27, 21, 18, 24, 26, 34, 28, 25, 13, 20, 13, 23, 29, 22, 24, 24, 27, 20, 27, 20, 13, 17, 4, 16, 27, 27, 22, 22, 17, 18, 11, 16, 19, 27, 27],
  [19, 26, 22, 19, 23, 24, 32, 24, 28, 16, 23, 16, 22, 27, 21, 23, 24, 25, 18, 27, 21, 13, 20, 5, 13, 26, 27, 27, 23, 17, 18, 11, 17, 19, 27, 28],
  [21, 28, 23, 20, 24, 25, 19, 10, 14, 28, 35, 28, 15, 20, 14, 18, 18, 20, 20, 27, 20, 19, 26, 10, 8, 20, 21, 28, 27, 21, 12, 7, 11, 17, 25, 25],
  [30, 21, 26, 23, 24, 17, 10, 18, 21, 35, 28, 30, 18, 14, 23, 26, 27, 12, 11, 26, 21, 20, 19, 22, 17, 11, 22, 26, 25, 13, 4, 14, 18, 24, 18, 27],
  [25, 23, 22, 19, 12, 21, 13, 12, 15, 28, 28, 28, 15, 15, 17, 20, 20, 26, 25, 11, 16, 15, 20, 26, 22, 16, 8, 12, 13, 27, 18, 18, 12, 18, 20, 12],
  [21, 21, 17, 18, 11, 19, 22, 22, 21, 16, 18, 16, 28, 30, 26, 16, 16, 22, 25, 11, 17, 24, 26, 34, 24, 21, 11, 5, 4, 18, 24, 25, 18, 17, 18, 12],
  [27, 19, 21, 22, 25, 17, 20, 28, 27, 22, 16, 16, 30, 28, 34, 24, 22, 8, 11, 25, 19, 26, 24, 24, 19, 19, 27, 21, 18, 4, 11, 19, 24, 23, 16, 24],
  [18, 27, 22, 23, 27, 25, 28, 21, 21, 16, 25, 18, 26, 34, 28, 18, 16, 14, 17, 26, 17, 24, 32, 19, 10, 27, 28, 22, 20, 11, 18, 12, 16, 15, 26, 24],
  [13, 21, 16, 21, 25, 23, 30, 23, 23, 19, 28, 21, 17, 25, 19, 28, 25, 24, 16, 25, 16, 18, 27, 13, 15, 28, 29, 26, 25, 16, 16, 10, 14, 18, 29, 27],
  [11, 20, 16, 21, 26, 26, 33, 23, 23, 19, 28, 21, 17, 22, 17, 26, 28, 27, 19, 36, 17, 19, 26, 12, 14, 26, 27, 23, 24, 19, 19, 7, 14, 19, 27, 27],
  [13, 6, 19, 25, 20, 12, 19, 26, 24, 20, 12, 26, 23, 9, 15, 24, 27, 28, 20, 19, 26, 28, 11, 25, 28, 13, 21, 17, 19, 18, 18, 24, 18, 22, 11, 21],
  [22, 15, 28, 23, 20, 12, 13, 20, 18, 20, 12, 26, 25, 10, 17, 17, 20, 21, 28, 27, 34, 24, 7, 21, 28, 13, 21, 25, 27, 26, 20, 26, 20, 15, 4, 13],
  [27, 29, 17, 12, 16, 27, 27, 26, 26, 28, 28, 15, 13, 25, 25, 25, 27, 21, 28, 28, 20, 10, 23, 18, 23, 26, 18, 22, 23, 27, 21, 20, 25, 19, 20, 13],
  [22, 22, 20, 15, 10, 18, 19, 21, 21, 22, 21, 19, 17, 19, 18, 17, 18, 27, 34, 18, 28, 18, 17, 21, 28, 21, 13, 17, 17, 32, 26, 26, 22, 16, 13, 5],
  [16, 16, 14, 19, 14, 22, 13, 14, 14, 19, 18, 15, 21, 23, 21, 18, 19, 28, 23, 8, 17, 28, 27, 31, 23, 17, 9, 12, 12, 27, 27, 26, 22, 21, 18, 9],
  [24, 14, 19, 24, 27, 20, 11, 16, 21, 26, 18, 21, 24, 20, 29, 26, 27, 12, 7, 22, 17, 28, 28, 31, 16, 14, 22, 25, 26, 12, 12, 22, 24, 24, 18, 27],
  [12, 18, 24, 29, 22, 22, 13, 3, 6, 10, 20, 26, 31, 23, 16, 13, 12, 25, 20, 17, 20, 31, 30, 28, 15, 17, 17, 20, 20, 25, 25, 18, 11, 9, 21, 21],
  [12, 20, 24, 19, 13, 14, 21, 15, 12, 8, 17, 24, 25, 19, 9, 13, 13, 27, 27, 21, 27, 24, 26, 16, 28, 27, 25, 15, 15, 21, 25, 21, 11, 17, 25, 27],
  [27, 20, 19, 13, 20, 12, 18, 26, 26, 23, 13, 17, 21, 19, 27, 27, 26, 11, 11, 26, 19, 18, 18, 19, 27, 28, 34, 24, 23, 8, 15, 22, 29, 32, 23, 32],
  [25, 27, 14, 8, 11, 18, 24, 26, 26, 23, 24, 9, 11, 27, 28, 28, 27, 20, 20, 19, 12, 11, 25, 19, 25, 34, 28, 18, 15, 15, 22, 22, 28, 31, 32, 23],
  [28, 29, 16, 14, 17, 22, 20, 22, 22, 27, 28, 13, 6, 22, 23, 26, 25, 17, 24, 23, 16, 14, 28, 22, 16, 25, 19, 28, 25, 25, 17, 17, 23, 30, 32, 23],
  [27, 26, 13, 10, 17, 26, 23, 21, 23, 28, 26, 15, 17, 18, 20, 23, 25, 18, 25, 23, 16, 14, 28, 23, 17, 25, 15, 24, 28, 30, 20, 18, 23, 32, 31, 24],
  [20, 10, 26, 23, 20, 12, 8, 17, 17, 22, 13, 28, 18, 5, 12, 16, 18, 16, 24, 26, 30, 28, 14, 28, 21, 9, 16, 25, 21, 28, 18, 23, 21, 26, 15, 22],
  [20, 11, 26, 30, 27, 19, 10, 19, 19, 14, 5, 20, 25, 11, 19, 17, 21, 18, 19, 22, 25, 28, 12, 26, 29, 16, 13, 18, 21, 20, 28, 33, 28, 18, 7, 14],
  [15, 21, 28, 32, 25, 25, 18, 10, 10, 7, 15, 20, 26, 20, 13, 11, 8, 26, 26, 19, 26, 26, 21, 19, 22, 23, 23, 18, 18, 25, 33, 28, 19, 9, 17, 16],
  [18, 25, 20, 24, 31, 31, 24, 17, 17, 13, 20, 14, 19, 25, 17, 15, 17, 18, 19, 28, 21, 21, 27, 12, 15, 30, 29, 24, 25, 20, 27, 19, 28, 18, 23, 20],
  [14, 21, 16, 19, 26, 26, 25, 18, 18, 18, 25, 18, 16, 22, 14, 16, 18, 19, 12, 20, 14, 21, 27, 11, 15, 31, 30, 28, 30, 25, 17, 7, 16, 28, 33, 30],
  [24, 15, 18, 21, 25, 17, 16, 25, 27, 26, 19, 20, 17, 15, 25, 27, 26, 9, 3, 19, 12, 19, 20, 22, 24, 22, 31, 29, 29, 14, 6, 16, 21, 33, 28, 34],
  [25, 24, 11, 14, 17, 26, 25, 24, 25, 24, 27, 13, 12, 22, 22, 24, 26, 20, 13, 11, 5, 12, 27, 22, 27, 30, 21, 19, 22, 22, 14, 16, 18, 29, 33, 28],
];

export const MATCH_LEVELS = ['Below Average', 'Average', 'Fair', 'Good', 'Excellent'] as const;
export type MatchLevel = (typeof MATCH_LEVELS)[number];

/** Level of a gunanka score (FUN_004e8db0). */
export function matchLevel(score: number): MatchLevel {
  return MATCH_LEVELS[score < 18 ? 0 : score < 22 ? 1 : score < 26 ? 2 : score > 30 ? 4 : 3];
}

export interface NakPada { nak: number; pada: number }

/** Nakshatra (0..26) and 0-based pada of a longitude (the Moon's for a native). */
export function nakshatraPada(lon: number): NakPada {
  const l = ((lon % 360) + 360) % 360;
  const p = Math.floor(l / (10 / 3)) % 108;
  return { nak: Math.floor(p / 4), pada: p % 4 };
}

export const segmentOf = (x: NakPada) => SEGMENT_OF_PADA[x.nak * 4 + x.pada];

/** Gunanka of a couple from the bride's and the groom's Moon nakshatra and 0-based pada. */
export function gunanka(bride: NakPada, groom: NakPada): number {
  return GUNANKA[segmentOf(bride)][segmentOf(groom)];
}

export interface MatchInput {
  native: NakPada;
  other: NakPada;
  /** the dialog's "Consider a Bridegroom" (true) or "Consider a Bride" (false) */
  otherIsGroom: boolean;
}

/** Default of the Bride/Bridegroom choice: Bridegroom when the native is female (gender 2). */
export const defaultOtherIsGroom = (gender: number | null | undefined) => gender === 2;

export interface MatchResult { score: number; level: MatchLevel; bride: NakPada; groom: NakPada; text: string[] }

export const MATCH_TITLE = 'Result of Horoscope Matching for Marriage';

/** JHora's result (message box text of FUN_004e8db0, one entry per line). */
export function matchHoroscopes(m: MatchInput): MatchResult {
  const [bride, groom] = m.otherIsGroom ? [m.native, m.other] : [m.other, m.native];
  const score = gunanka(bride, groom);
  const level = matchLevel(score);
  const who = (x: NakPada) => `${MATCH_NAKSHATRA_NAMES[x.nak]} (${PADA_ORDINAL[x.pada]} pada)`;
  const text = [
    `Native: ${who(m.native)}`,
    `${m.otherIsGroom ? 'Bridegroom' : 'Bride'}: ${who(m.other)}`,
    '',
    `Gunanka score after matching ashta koota (group of eight factors) = ${score} (out of 36).`,
    '',
    `The level of match (below average/average/fair/good/excellent) = ${level}.`,
    '',
    'Please note that this thumbrule is a coarse indicator. You may want to',
    'consult a good astrologer to verify subjective factors manually.',
  ];
  return { score, level, bride, groom, text };
}
