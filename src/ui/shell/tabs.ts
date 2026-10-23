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
  ['All Divisional Longitudes', 33265, null],
  ['Rasis occupied in all vargas', 32823, null],
  ['Nava Taras (from Moon)', 32902, null],
  ['Nava Taras (from lagna)', 33197, null],
  ['Special Taras/Nakshatras (from Moon)', 32903, null],
  ['Special Taras/Nakshatras (from lagna)', 33198, null],
  ['Nakshatra Aspects & Latta', 32824, null],
  ['Yogi, Sahayogi and Avayogi Planets', 33286, null],
  ['Pushkaramsas and Pushkara Bhagas', 33393, null],
  ['Special Tithis', 32893, null],
  ['Chara Karakas', 32825, null],
  ['Combustion', 33167, null],
  ['Graha Yuddha (planetary war)', 33168, null],
  ['Brahma, Rudra, Maheswara', 33039, null],
  ['Distances from Mrityu Bhaga', 33072, null],
  ['Planetary drekkanas', 33158, null],
  ['Lords of 64th navamsa and 22nd drekkana', 33159, null],
  ['Sahamas (sahams)', 32901, null],
];
