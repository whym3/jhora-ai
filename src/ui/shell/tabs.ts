// JHora's screen structure: 9 top tabs; most have sub-tabs (same names as the program).
export const TOP_TABS = ['Chakras', 'Basics', 'Strengths', 'Dasas', 'Transits', 'Tajaka', 'Tithi Pravesha', 'Mundane', 'Miscellany'] as const;
export type TopTab = (typeof TOP_TABS)[number];

export const SUB_TABS: Partial<Record<TopTab, readonly string[]>> = {
  Chakras: ['Many Vargas', 'Mixed 2-Vargas', 'Kalachakra', 'Sarvatobhadra', 'Kota Chakra', 'Surya Kalanala', 'Chandra Kalanala', 'Sudarsana', 'Shoola', 'Tripataki'],
  Basics: ['Key Info', 'Houses', 'Amsa rulers', 'KP'],
  Strengths: ['Ashtakavarga', 'Other strengths', 'Bar graphs'],
  Dasas: ['Nakshatra dasas', 'Rasi dasas', 'Other dasas'],
  Transits: ['Basic Transit Results', 'Transit Calendar', 'Special Search', 'Longitude Correlation'],
  Miscellany: ['Angular Return', 'Progressions', 'Prasna (Horary)', 'Panchanga', 'Laghu Parasari'],
};

/** Key Info table modes: JHora's menu 105 (label, command id). */
export const KEY_INFO_MODES: [string, number, string | null][] = [
  ['Longitudes & Basic Info', 32822, 'basics.longitudes'],
  ['Latitudes, speeds etc (co-ordinates)', 33071, 'basics.coordinates'],
  ['All Divisional Longitudes', 33265, 'basics.allDivisionalLongitudes'],
  ['Rasis occupied in all vargas', 32823, 'basics.rasisInVargas'],
  ['Nava Taras (from Moon)', 32902, 'basics.navaTarasMoon'],
  ['Nava Taras (from lagna)', 33197, 'basics.navaTarasLagna'],
  ['Special Taras/Nakshatras (from Moon)', 32903, 'basics.specialTarasMoon'],
  ['Special Taras/Nakshatras (from lagna)', 33198, 'basics.specialTarasLagna'],
  ['Nakshatra Aspects & Latta', 32824, 'basics.nakshatraAspects'],
  ['Yogi, Sahayogi and Avayogi Planets', 33286, 'basics.yogi'],
  ['Pushkaramsas and Pushkara Bhagas', 33393, 'basics.pushkara'],
  ['Special Tithis', 32893, 'basics.specialTithis'],
  ['Chara Karakas', 32825, 'basics.charaKarakas'],
  ['Combustion', 33167, 'basics.combustion'],
  ['Graha Yuddha (planetary war)', 33168, 'basics.grahaYuddha'],
  ['Brahma, Rudra, Maheswara', 33039, 'basics.deities'],
  ['Distances from Mrityu Bhaga', 33072, 'basics.mrityuBhaga'],
  ['Planetary drekkanas', 33158, 'basics.drekkanas'],
  ['Lords of 64th navamsa and 22nd drekkana', 33159, 'basics.malicious'],
  ['Sahamas (sahams)', 32901, 'basics.sahamas'],
];

/** Strengths > Other strengths modes, in JHora's order (view mode index, table id). */
export const OTHER_STRENGTH_MODES: [string, number, string | null][] = [
  ['Shadbala Summary', 0, 'strengths.shadbalaSummary'],
  ['Shadbala Break-up', 1, 'strengths.shadbalaBreakup'],
  ['Sthana Bala', 2, 'strengths.sthana'],
  ['Kaala Bala', 3, 'strengths.kaala'],
  ['Dig Bala', 4, 'strengths.dig'],
  ['Cheshta Bala', 5, 'strengths.cheshta'],
  ['Drig Bala', 6, 'strengths.drig'],
  ['Naisargika Bala', 7, 'strengths.naisargika'],
  ['Bhava Balas', 8, 'strengths.bhava'],
  ['Ishta-Kashta Phala', 9, 'strengths.ishtaKashta'],
  ['Rashmis', 10, 'strengths.rashmis'],
];

/** Strengths > Ashtakavarga modes (menu 106, ids 32829-32842); the job takes the label. */
export const AV_MODES = [
  'BAVs and SAV', 'SoAV', 'PAV of Sun', 'PAV of Moon', 'PAV of Mars', 'PAV of Mercury', 'PAV of Jupiter', 'PAV of Venus', 'PAV of Saturn',
  'PAV of Lagna', 'Sodhya pindas',
] as const;
export const AV_MODE_LABELS: Record<(typeof AV_MODES)[number], string> = {
  'BAVs and SAV': 'BAVs and SAV', SoAV: 'SoAV - sodhita (reduced) ashtakavargas', 'PAV of Sun': 'PAV of Sun', 'PAV of Moon': 'PAV of Moon',
  'PAV of Mars': 'PAV of Mars', 'PAV of Mercury': 'PAV of Mercury', 'PAV of Jupiter': 'PAV of Jupiter', 'PAV of Venus': 'PAV of Venus',
  'PAV of Saturn': 'PAV of Saturn', 'PAV of Lagna': 'PAV of Lagna', 'Sodhya pindas': 'Sodhya pindas',
};

/** Strengths > Other strengths, second (vimsopaka) pane modes in JHora's order. */
export const VIMSOPAKA_PANE_MODES: [string, string][] = [
  ['Vimsopaka Balas', 'strengths.vimsopaka'],
  ['Amsa Balas', 'strengths.amsaBalas'],
  ['Basic Avasthas', 'strengths.basicAvasthas'],
  ['Sayanadi Avasthas', 'strengths.sayanadi'],
  ['Pancha-vargeeya Bala', 'strengths.panchaVargeeya'],
  ['Dwadasa-vargeeya Bala', 'strengths.dwadasaVargeeya'],
  ['Harsha Bala', 'strengths.harsha'],
];
