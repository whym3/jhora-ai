// Preferences > JHora's option dialogs, as data: every control bound to its jhora.ini key.
// Generated from jhora.exe's RT_DIALOG / RT_DLGINIT resources (texts, control ids, combo
// items in order) and the handlers' DDX maps (each dialog's DoDataExchange, vtable slot
// 0x21, and the menu handler that copies the globals in and out); hand edits are fine
// but keep them in line with the exe.
//
// Rendered by OptionDialog.tsx. A field without read/write stores the control value
// (combo index, check 0/1, edit number or text) in its key unchanged, as the handlers do;
// the exceptions carry their own read/write, ported from the handler named in `port`:
// * 170: UpagrahaRiseMethod slots: 1010 Gulika = [5], 1011 Mandi = [4], 1012 Kaala,
//   Mrityu, Artha Prahara and Yama Ghantaka = [0..3] (shown from [0]).
// * 2030: combo 1004 = WeekdayDefinitionKaala - 1.
// * 2080 (also shown after 2065): combo 1003 = LunarYrDef / 2, combo 1004 = LunarYrDef in
//   {1, 3, 5}; OK stores 2 * month definition | tropical.
// * 2059: ArudhaBasePlanet > 9 shows item 10 (Bhavalagna); item 10 stores 13.
// * 157: the 11 checks are the bits of MaskedPrintPageMap (1001..1006, 1012, 1007..1010).
// * 2072: choosing SSS sets UserSelectedAyanamsa = 18 (SSS) with no correction, says why
//   and opens the Ayanamsa dialog; drik with HouseTypeWanted 11 (SSS houses) falls back to
//   3 (Porphyry) with a message (FUN_004e56f0 opens the Ayanamsa dialog either way).
// A combo whose stored value has no item (e.g. LifeCycleYearDefinition 7 written by
// "Set Calculation Options as recommended by author") shows an extra "(value n)" item.
import type { JhoraIni } from '../../settings/generated';

export type FieldValue = number | string;
export interface OptionField {
  /** control id in the dialog template */
  id: number;
  kind: 'combo' | 'check' | 'number' | 'text' | 'textarea';
  key: keyof JhoraIni;
  /** check box caption */
  label?: string;
  /** combo items in order (RT_DLGINIT) */
  items?: readonly string[];
  read?: (ini: JhoraIni) => FieldValue;
  write?: (v: FieldValue, ini: JhoraIni) => Partial<JhoraIni>;
  enabledWhen?: (values: Record<number, FieldValue>) => boolean;
  step?: number;
}
/** A static text, a control, a group box caption, or a row of them (one line in JHora). */
export type DialogItem = string | OptionField | { group: string } | (string | OptionField)[];
export interface AfterOk { patch?: Partial<JhoraIni>; message?: { title: string; text: string }; open?: 'ayanamsa' }
export interface OptionDialogDef {
  dialog: number;
  /** menu command that opens it */
  cmd: number;
  title: string;
  /** Preferences menu label */
  menu: string;
  /** jhora.exe routines ported */
  port: string;
  section: 'calc' | 'display';
  items: DialogItem[];
  /** dialog opened after OK (the Tithi Pravesha handler shows 2080 next) */
  then?: number;
  afterOk?: (ini: JhoraIni) => AfterOk | null;
}

const slots = (a: number[], idx: number[], v: FieldValue) => a.map((x, i) => (idx.includes(i) ? Number(v) : x));
const bit = (map: number, b: number, v: FieldValue) => (Number(v) ? map | (1 << b) : map & ~(1 << b));
const lunarTropical = (ini: JhoraIni) => ([1, 3, 5].includes(ini.LunarYrDef) ? 1 : 0);

/** FUN_004e56f0 after OK (`ini` already holds the new Siddhanta). */
function siddhantaAfterOk(ini: JhoraIni): AfterOk | null {
  if (ini.Siddhanta === 1) {
    return {
      patch: { UserSelectedAyanamsa: 18, DeltaFromUserSelectedAyanamsa: 0 },
      message: { title: 'Choose Ayanamsa', text: 'It is strongly recommended to select SSS (Sri Surya Siddhanta) ayanamsa when using SSS for planetary model. Other ayanamsas are supported with SSS planetary calculations to faciliate research, but use SSS ayanamsa with SSS planetary calculations for the best results.' },
      open: 'ayanamsa',
    };
  }
  if (ini.HouseTypeWanted === 11) {
    return {
      patch: { HouseTypeWanted: 3 },
      message: { title: 'SSS house system not available anymore', text: 'You are currently using SSS (Sri Surya Siddhanta) house system. Because you selected drik siddhanta now, SSS house system is not available. We are falling back to Porphyry houses, which are very close to SSS houses.' },
      open: 'ayanamsa',
    };
  }
  return { open: 'ayanamsa' };
}


export const OPTION_DIALOGS: OptionDialogDef[] = [
  {
    dialog: 2072, cmd: 33374, title: "Siddhanta (Planetary Model)", menu: "Siddhanta (Planetary Model) - Drik vs SSS (Sri Surya Siddhanta)",
    port: "FUN_004e56f0 (dialog FUN_004d7a10)", section: 'calc',
    afterOk: siddhantaAfterOk,
    items: [
      "Select the siddhanta (planetary model) you want to use",
      { id: 1003, kind: 'combo', key: 'Siddhanta', items: ["Drik Siddhanta (planetary positions as observed by modern planetariums)", "Sri Surya Siddhanta (SSS) - Generalized Makaranda Version"] },
      "Many people today use drik siddhanta, i.e. planetary positions based on observations made by modern planetariums.",
      "Some people believe that Sri Surya Siddhanta (SSS) should be used in astrology. It is an analytical model used by ancient Indian astrologers.",
      "Some people use SSS without beeja samskara following a modern western commentary on SSS, and some people use it with traditional beeja samskara methods from ancient and medieval times. among which the most ancient extant source is Makaranda Table.",
      "This software implements generalized formulas for Makaranda version converted into siddhantic mode so as to be correct for all eras. The same generalized formulas are used by many panchangas. Some examples are given below:",
      "- Aadityavaahini Panchaangam published by Sri Shankaracharya's Govardhana Matha at Sri Jagannatha Puri, India",
      "- Aaditya Panchaangam (Varanasi, India)",
      "- Sanskrit Academy Panchaangam published by Bihar Rajya Sanskrit Academy (HRD Ministry of Govt of Bihar, India)",
      "- Surya Panchaangam (Raipur, Chhattisgarh, India)",
      "- Prayaagraaja Panchaangam (Allahabad, India)",
      "- Mithilaa Panchaangam (Darbhanga, India)",
      "- Parmaartha Panchaangam (Mainpuri, Uttar Pradesh, India)",
      "- Paaraankusha Panchaangam (Gaya, Bihar, India)",
    ],
  },
  {
    dialog: 149, cmd: 32937, title: "Planet Calculation Options", menu: "Planet Calculation Options",
    port: "FUN_00406040 (dialog FUN_004d59f0, DDX FUN_004d5a30)", section: 'calc',
    items: [
      "NOTE: These preferences will be remembered and used until you change again. If you are just playing around, remember to change them back to your real preference.",
      "If you are using SSS (Sri Surya Siddhanta), changing these options will not make a difference. These options are relevant only when using drik siddhanta.",
      "Geocentric positions are calculated with respect to the center of earth. Topocentric positions are calculated with respect to the actual place of birth/event. What do you prefer?",
      { id: 1010, kind: 'combo', key: 'TopocentricPositions', items: ["Geocentric positions", "Topocentric positions"] },
      "True position is the position where the planet really is at the time of birth/event. Apparent position is the position where it appears to be. What do you prefer?",
      { id: 1011, kind: 'combo', key: 'TruePositions', items: ["Apparent positions", "True positions"] },
      "Use refraction in calculating \"apparent positions\"?",
      { id: 1016, kind: 'combo', key: 'ApparentRefraction', items: ["Don't use refraction", "Use refraction"] },
      "Use annual aberration of light in calculating \"apparent positions\"?",
      { id: 1014, kind: 'combo', key: 'NoAberration', items: ["Use annual aberration of light", "Don't use annual aberration of light"] },
      "Use gravitation deflection in calculationg \"apparent positions\"?",
      { id: 1015, kind: 'combo', key: 'NoGravDeflection', items: ["Use gravitational deflection", "Don't use gravitational deflection"] },
      "Use nutation (relevant only with \"tropical\" setting of ayanamsa)?",
      { id: 1013, kind: 'combo', key: 'NoNutation', items: ["Use nutation", "Don't use nutation"] },
      "Mean nodes have a more uniform motion than the wobbling true nodes. What do you prefer?",
      { id: 1012, kind: 'combo', key: 'TrueNodes', items: ["Mean nodes", "True nodes"] },
    ],
  },
  {
    dialog: 170, cmd: 32936, title: "Upagraha Calculation Options", menu: "Upagraha Calculation Options",
    port: "FUN_00405e00 (dialog FUN_004d8570, DDX FUN_004d85b0)", section: 'calc',
    items: [
      ["Dhuma-Vyatipata relation:", { id: 1013, kind: 'combo', key: 'VyatipataMethod', items: ["Vyatipata = 360 deg - Dhuma", "Vyatipata = Dhuma + 53 deg 20 min"] }],
      ["Gulika rises at the", { id: 1010, kind: 'combo', key: 'UpagrahaRiseMethod', items: ["beginning", "middle", "end"], read: (ini) => ini.UpagrahaRiseMethod[5], write: (v, ini) => ({ UpagrahaRiseMethod: slots(ini.UpagrahaRiseMethod, [5], v) }) }, "of", { id: 1014, kind: 'combo', key: 'GulikaInSaturnPortion', items: ["eighth", "Saturn's"] }, "portion."],
      ["Mandi rises at the", { id: 1011, kind: 'combo', key: 'UpagrahaRiseMethod', items: ["beginning", "middle", "end"], read: (ini) => ini.UpagrahaRiseMethod[4], write: (v, ini) => ({ UpagrahaRiseMethod: slots(ini.UpagrahaRiseMethod, [4], v) }) }, "of", { id: 1015, kind: 'combo', key: 'MandiInSaturnPortion', items: ["eighth", "Saturn's"] }, "portion."],
      ["Kala, Mrityu etc rise at the", { id: 1012, kind: 'combo', key: 'UpagrahaRiseMethod', items: ["beginning", "middle", "end"], read: (ini) => ini.UpagrahaRiseMethod[0], write: (v, ini) => ({ UpagrahaRiseMethod: slots(ini.UpagrahaRiseMethod, [0, 1, 2, 3], v) }) }, "of respective portions\n(Sun, Mars etc)."],
      "Start/end times of day and night are needed for computing\nupagrahas like Gulika and Mandi. What are the definitions\nof the start of day and night? Select your preference.",
      { id: 1003, kind: 'combo', key: 'UpagrahaDayDefinition', items: ["Day and night start at sunrise and sunset (respectively)", "Day and night start at 6 am LMT and 6 pm LMT (respectively)"] },
      "There is a similar option for starting horas and weekdays.\nSunrise definition preference may also be of interest.\nPlease go through the calculation preferences menu to find them.",
    ],
  },
  {
    dialog: 2076, cmd: 33391, title: "Exaltation & Debilitation of Nodes", menu: "Nodal Exaltation & Debilitation Sign Options",
    port: "FUN_004e7f60 (dialog FUN_004d2ce0)", section: 'calc',
    items: [
      "What should be the exaltation & debilitation signs of nodes?\nSome versions of BPHS mention Ta and Sc, while others are quiet.\n Pt Sanjay Rath teaches Ge and Sg.",
      { id: 1003, kind: 'combo', key: 'NodalExaltationParasara', items: ["Rahu is exalted in Ge/Ta and Ketu in Sg/Le [phalita/ayur] (Pt Sanjay Rath)", "Rahu is exalted in Ta and Ketu in Sc (mentioned in some versions of BPHS)"] },
    ],
  },
  {
    dialog: 2045, cmd: 33162, title: "Chara Karaka Definition", menu: "Chara karaka scheme (7 or 8)",
    port: "FUN_004e7ed0 (dialog FUN_004d1170)", section: 'calc',
    items: [
      "In the \"eight chara karaka\" scheme, Rahu is included and\nPitri Karaka is included. Parasara and Jaimini taught this.\nSri Jagannath Centre recommends this.",
      "In the \"seven chara karaka\" scheme, Rahu is excluded and\nPitri Karaka is excluded. Sri K.N. Rao taught this.",
      { id: 1003, kind: 'combo', key: 'CharaKarakaDefinition', items: ["Eight chara karakas", "Seven chara karakas (No Pik) - Sri KNRao", "Seven chara karakas (PK merged with MK)", "Mixed 7/8 chara karakas of Parasara"] },
    ],
  },
  {
    dialog: 2027, cmd: 33074, title: "Sunrise definition selection", menu: "Sunrise, sunset & special lagna definitions",
    port: "FUN_004e7730 (dialog FUN_004d81f0, DDX FUN_004d1c50)", section: 'calc',
    items: [
      "Note that an appropriate sunset definition will be used along with the chosen sunrise definition.",
      "Sunrise definition impacts the calculation of the longitudes of special lagnas like hora lagna and ghati lagna and upagrahas like Kaala, Mrityu, Gulika and Mandi.",
      "What is the meaning of sunrise?",
      { id: 1003, kind: 'combo', key: 'SunriseDefinition', items: ["The center of Sun's disk is truly on the eastern horizon", "The tip of Sun's disk is truly on the eastern horizon", "The tip of Sun's disk appears to be on the eastern horizon", "The center of Sun's disk appears to be on the eastern horizon"] },
      "Traditional definition of hora lagna, ghati lagna & bhava lagna gives a discontunuity of about 1 degree at sunrise. Alternative definition is continuious.",
      { id: 1001, kind: 'check', key: 'ContinuousSpecialLagnas', label: "Use the alternative special lagna definition giving continuity" },
    ],
  },
  {
    dialog: 2030, cmd: 33078, title: "Hora, Kaala & Weekday Start Options", menu: "Hora, Kaala & Weekday Start Options",
    port: "FUN_004e77e0 (dialog FUN_004d87d0, DDX FUN_004d2bd0)", section: 'calc',
    items: [
      "Hora is a period of one hour. Horas are ruled by seven planets in the order of decreasing distance from earth. The 7 horas keep repeating and a day is formed by 24 horas.",
      "Lord of a weekday is the lord of day's 1st hora. This is how the weekday order is derived.",
      "There are differences of opinion on exactly when weekday changes. Select your preference.",
      { group: "Hora (Satya)" },
      "When does weekday change? (And, what exactly does hora stand for?)",
      { id: 1003, kind: 'combo', key: 'WeekdayDefinition', items: ["At sunrise (hora is 1/24th of sunrise-to-sunrise day)", "At 6 am LMT (hora is exactly 1 hour)"] },
      "Note: There is a similar option for the computation of Mandi, Gulika etc. Please go through the upagraha calculation preferences.",
      { group: "Mahaakaala Hora" },
      "The above is based on Satya (truth - Yama). In addition, there are horas based  on Maayaa (illusion - Mahaakaala). What definition should be used for Mahaakaala Hora?",
      { id: 1004, kind: 'combo', key: 'WeekdayDefinitionKaala', items: ["New mahakala hora and day start at 6 am LMT", "New mahakala hora and day start at 6 am LST"], read: (ini) => ini.WeekdayDefinitionKaala - 1, write: (v) => ({ WeekdayDefinitionKaala: Number(v) + 1 }) },
      "How should 16 kaalas be defined? This affects Raahu Kaalam.",
      { id: 1005, kind: 'combo', key: 'KaalaInDayNightSeparate', items: ["Divide day & night together into 16 equal parts", "Divide day into 8 equal parts & night into 8 equal parts"] },
    ],
  },
  {
    dialog: 2040, cmd: 33124, title: "Tajaka Calculation Options", menu: "Tajaka Calculation Options",
    port: "FUN_004e7b90 (dialog FUN_004d8230, DDX FUN_004d2bd0)", section: 'calc',
    items: [
      "Should Tajaka charts be computed based on\nexact solar motion or mean solar motion?",
      { id: 1003, kind: 'combo', key: 'TrueTajaka', items: ["Mean solar motion", "Exact solar motion"] },
      "Should Tajaka charts be computed based on\ntropical solar year or sidereal solar year?",
      { id: 1004, kind: 'combo', key: 'TropicalTajaka', items: ["Sidereal solar year (mean: 365.256364 days)", "Tropical solar year (mean: 365.24219 days)"] },
      "Some people find muntha of Tajaka annual and monthly charts by\nsimply progressing the rasi lagna and take the same sign in all divisions.",
      "Some people  consider muntha to be the dasa/antardasa sign of\nSudarsana  Chakra dasa. Again, one can start antardasas (munthas of\nmonthly charts) from the dasa sign or from the lord of the dasa sign.",
      "What is your preference for computing muntha?",
      { id: 1005, kind: 'combo', key: 'MunthaPreference', items: ["Muntha of rasi chart shown in all vargas", "Muntha from each varga chart, with antardasas starting from dasa sign", "Muntha from each varga chart, with antardasas starting from dasa lord"] },
    ],
  },
  {
    dialog: 2065, cmd: 33282, title: "Tithi Pravesha Calculation", menu: "Tithi Pravesha Calculation Options",
    port: "FUN_004e7c50 (dialog FUN_004d8490, then dialog 2080 FUN_004d2ba0)", section: 'calc',
    then: 2080,
    items: [
      "Tithi Pravesha is based on the soli-lunar day of birth returning in the soli-lunar month of birth every year. Some people use the solar month insyead.",
      { id: 1001, kind: 'check', key: 'SolarMonthUsedInTP', label: "Use solar (as opposed to soli-lunar) months in Tithi Pravesha" },
    ],
  },
  {
    dialog: 2080, cmd: 33421, title: "Lunar Calendar Options", menu: "Lunar calendar options",
    port: "FUN_004b9400 (dialog FUN_004d2ba0, DDX FUN_004d2bd0)", section: 'calc',
    items: [
      "Pick a lunar month definition:",
      { id: 1003, kind: 'combo', key: 'LunarYrDef', items: ["Suklanta  (month starts & ends at Full Moon)", "Amanta  (month starts & ends at New Moon)", "Solar  (month starts when Sun changes sign)"], read: (ini) => Math.trunc(ini.LunarYrDef / 2), write: (v, ini) => ({ LunarYrDef: Number(v) * 2 + lunarTropical(ini) }) },
      "Names of months are defined based on signs. Should we use star aligned sidereal signs (popular)\nor season aligned tropical signs (taught by Parasara to Maitreya in Vishnu Purana chapter 2.8)",
      { id: 1004, kind: 'combo', key: 'LunarYrDef', items: ["Sidereal signs  (most popular - star aligned)", "Tropical signs  (Vishnu Purana - season aligned)"], read: (ini) => lunarTropical(ini), write: (v, ini) => ({ LunarYrDef: Math.trunc(ini.LunarYrDef / 2) * 2 + Number(v) }) },
      "Pick the sign used for the beginning of lunar year",
      { id: 1005, kind: 'combo', key: 'LunarYrSign', items: ["Aries (Vaisakha)", "Taurus (Jyeshtha)", "Gemini (Ashadha)", "Cancer (Sravana)", "Leo (Bhadrapada)", "Virgo (Aswayuja)", "Libra (Kartika)", "Scorpio (Margasira)", "Sagittarius (Pushya)", "Capricorn (Magha)", "Aquarius (Phalguna)", "Pisces (Chaitra)"] },
    ],
  },
  {
    dialog: 2082, cmd: 33422, title: "Solar Calendar Options", menu: "Solar calendar options",
    port: "FUN_004b94d0 (dialog FUN_004d7a50, DDX FUN_004d7a80)", section: 'calc',
    items: [
      "Sun's entry into this sign starts a new solar year:",
      { id: 1003, kind: 'combo', key: 'SolarYrSign', items: ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"] },
      "Should we use star aligned sidereal signs (popular)\nor season aligned tropical signs (taught by Parasara to Maitreya in Vishnu Purana chapter 2.8)",
      { id: 1004, kind: 'combo', key: 'SolarYrTrop', items: ["Sidereal signs  (most popular - star aligned)", "Tropical signs  (Vishnu Purana - season aligned)"] },
    ],
  },
  {
    dialog: 2031, cmd: 33079, title: "Mrityu Bhaga Preferences", menu: "Mrityu Bhaga Options",
    port: "FUN_004e7950 (dialog FUN_004d2c20, DDX FUN_004d2480)", section: 'calc',
    items: [
      "There are two versions of mrityu bhaga degrees given\nfor Moon in classics. Which version do you prefer?",
      { id: 1003, kind: 'combo', key: 'MBTablePreference', items: ["Follow Saravali, Jataka Parijatam and Sarvartha Chintamani", "Follow Phala Deepika and Brihat Prajapatyam"] },
      "Jupiter's mrityu bhaga degree in Aries is given in classics as 19.\nWhat exactly is the corresponding death-inflicting region?",
      { id: 1004, kind: 'combo', key: 'MBLocationPreference', items: ["Starts there, i.e. 19 deg - 20 deg is the region", "Mid-point there, i.e. 18.5 deg - 19.5 deg is the region", "The 19th degree, i.e. 18 deg - 19 deg is the region"] },
    ],
  },
  {
    dialog: 2077, cmd: 33392, title: "Pushkara Bhaga Definition", menu: "Pushkara Bhaga Definition Options",
    port: "FUN_004e8000 (dialog FUN_004d7640)", section: 'calc',
    items: [
      "What definition of Pushkara bhagas do you prefer?",
      { id: 1003, kind: 'combo', key: 'PushkaraBhagaJP', items: ["Definition given by Sri CS Patel in his book \"Nadi & Navamsha Astrology\"", "Definition given in Jataka Parijatam"] },
    ],
  },
  {
    dialog: 2059, cmd: 33245, title: "Arudha Pada Calculation", menu: "Arudha Pada Calculation Options",
    port: "FUN_004e82a0 (dialog FUN_004cf330, DDX FUN_004cf370)", section: 'calc',
    items: [
      "Parasara gave some exceptions in the calculation of arudha padas. Some commentators of Jaimini also mention these exceptions. But some commentators of Jaimini do not accept these exceptions.",
      "Sri Jagannath Centre recommends using these exceptions,\nwhile Sri KN Rao does not recommend them.",
      { id: 1003, kind: 'combo', key: 'ExceptionsInBhavaArudhas', items: ["Do not use exceptions in bhava arudha padas", "Use exceptions in bhava arudha padas"] },
      { id: 1004, kind: 'combo', key: 'ExceptionsInGrahaArudhas', items: ["Do not use exceptions in graha arudha padas", "Use exceptions in graha arudha padas"] },
      "Do you want to use Rahu and Ketu as the lords of Aq and Sc when they are stronger than Saturn and Mars, when finding bhava arudha padas?",
      { id: 1001, kind: 'check', key: 'NodesInArudhas', label: "Use Rahu and Ketu when stronger" },
      { group: "Longitude Based Arudha Padas" },
      "In one version of Brihat Paaraasara Horaa Saastram, Parasara taught finding arudha padas based on the exact longitudes of houses (cusps) and planets.",
      { id: 1002, kind: 'check', key: 'LongitudeBasedBhavaArudhas', label: "Find arudha padas of houses using exact longitudes.\nUncheck it for sign based calculations." },
      "If using longitude based arudha padas, one can either calculate arudha padas in each divisional chart  based on divisional longitudes or based on longitudes in rasi chart.",
      { id: 1053, kind: 'check', key: 'DivLongsInBhavaArudhas', label: "Use divisional longitudes of planets when finding\nlongitude based arudha padas in  divisional charts" },
      "Choose the base for finding houses and their arudha padas. Lagna is the default that people use. If you experiment with other references, please make sure to change it back to lagna when you are done with the experiments.",
      { id: 1005, kind: 'combo', key: 'ArudhaBasePlanet', items: ["Lagna", "Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu", "Bhavalagna"], read: (ini) => (ini.ArudhaBasePlanet > 9 ? 10 : ini.ArudhaBasePlanet), write: (v) => ({ ArudhaBasePlanet: Number(v) >= 10 ? 13 : Number(v) }) },
    ],
  },
  {
    dialog: 2026, cmd: 33073, title: "Lifecycle length for casting a new chart", menu: "Life cycle length for casting a new chart (countries etc)",
    port: "FUN_004e7660 (dialog FUN_004d28e0, DDX FUN_004d2920, OnInitDialog FUN_004d29d0)", section: 'calc',
    items: [
      "The theory is that each chart becomes invalid after exactly 144 solar years and a new chart must be cast then. This is an important factor when analyzing the charts of countries like USA.",
      "If you want to experiment with different lifecycle lengths, change the values below.",
      ["Enter the lifecycle length in years here:", { id: 100, kind: 'number', key: 'LifeCycleYears', step: 0.01 }],
      ["What is the definition of a year?", { id: 1003, kind: 'combo', key: 'LifeCycleYearDefinition', items: ["Normal solar year (365.2425 days)", "Savana year (360 days)", "User defined year (n days - enter below)", "Solar longitude based year (360 deg year)", "Year with 360 tithis"] }],
      ["How many days per year?", { id: 101, kind: 'number', key: 'LifeCycleYearLength', step: 0.00001, enabledWhen: (v) => Number(v[1003]) === 2 }],
    ],
  },
  {
    dialog: 145, cmd: 32887, title: "Language & Chart Style", menu: "Chart Style and Language",
    port: "FUN_004048a0 (dialog FUN_004d2850, DDX FUN_004d2880)", section: 'display',
    items: [
      "Choose the language to be used\nwhen writing planet names in charts.",
      { id: 1003, kind: 'combo', key: 'ChartLanguage', items: ["Assamese", "Bengali", "English", "Gujarati", "Hindi", "Kannada", "Malayalam", "Oriya", "Punjabi", "Tamil", "Telugu"] },
      "Choose the chart style:",
      { id: 1004, kind: 'combo', key: 'ChartStyle', items: ["South Indian Regular", "South Indian Irregular", "North Indian (diamond chart)", "East Indian (Sun chart)", "East Indian with frame"] },
      "When mentioning planet names, do you want English names (Sun, Moon) etc or Sanskrit names (Surya, Chandra etc)?",
      { id: 1005, kind: 'combo', key: 'SanskritPlanetNames', items: ["English names", "Sanskrit names"] },
      "When mentioning sign names, do you want English names (Ar, Ta) etc or Sanskrit names (Mesh, Vrish etc)?",
      { id: 1006, kind: 'combo', key: 'SanskritRasiNames', items: ["English names", "Sanskrit names"] },
    ],
  },
  {
    dialog: 2036, cmd: 33114, title: "Multiple Chart Style Support", menu: "Use of 2 chart styles",
    port: "FUN_00404970 (dialog FUN_004d84f0, DDX FUN_004d8520)", section: 'display',
    items: [
      { id: 1001, kind: 'check', key: 'UseTwoChartStyles', label: "Use two chart styles" },
      "Choose the chart style of the first chart:",
      { id: 1003, kind: 'combo', key: 'ChartStyle', items: ["South Indian Regular", "South Indian Irregular", "North Indian (diamond chart)", "East Indian (Sun chart)", "East Indian with frame"] },
      "Choose the chart style of the second chart:",
      { id: 1004, kind: 'combo', key: 'ChartStyle2', items: ["South Indian Regular", "South Indian Irregular", "North Indian (diamond chart)", "East Indian (Sun chart)", "East Indian with frame"] },
    ],
  },
  {
    dialog: 2039, cmd: 33118, title: "Size of the fonts used", menu: "Adjust font size",
    port: "FUN_004e79f0 (dialog FUN_004d2450, DDX FUN_004d2480)", section: 'display',
    items: [
      "If you want the fonts to be smaller or bigger,\nchange the setting below.",
      { id: 1003, kind: 'combo', key: 'FontSizeSelection', items: ["Much smaller", "Even Smaller", "Smaller", "Standard", "Bigger", "Even bigger", "Much bigger", "Biggest"] },
      "Compared to the rest of the fonts, do you want the\nlanguage fonts in charts to be bigger or smaller?",
      { id: 1004, kind: 'combo', key: 'ChartFontSizeSelection', items: ["Make them very much smaller", "Make them much smaller", "Make them smaller", "Same level", "Make them bigger", "Make them much bigger", "Make them very much bigger"] },
    ],
  },
  {
    dialog: 157, cmd: 32994, title: "Printing Page Selection", menu: "Pages to include in printouts",
    port: "FUN_004e7230 (dialog FUN_004d7550, DDX FUN_004d7590)", section: 'display',
    items: [
      "Select the items to include when printing charts:",
      { id: 1001, kind: 'check', key: 'MaskedPrintPageMap', label: "Basics (birthdata, longitudes, rasi, navamsa, Vimsottari dasa)", read: (ini) => (ini.MaskedPrintPageMap >> 0) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 0, v) }) },
      { id: 1002, kind: 'check', key: 'MaskedPrintPageMap', label: "Strengths (ashtakavarga, sodhya pindas, shadbalas, bhava balas)", read: (ini) => (ini.MaskedPrintPageMap >> 1) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 1, v) }) },
      { id: 1003, kind: 'check', key: 'MaskedPrintPageMap', label: "Other key dasas (Moola dasa, Ashtottari dasa, Kalachakra dasa)", read: (ini) => (ini.MaskedPrintPageMap >> 2) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 2, v) }) },
      { id: 1004, kind: 'check', key: 'MaskedPrintPageMap', label: "Key rasi dasas (Narayana dasa, Sudasa)", read: (ini) => (ini.MaskedPrintPageMap >> 3) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 3, v) }) },
      { id: 1005, kind: 'check', key: 'MaskedPrintPageMap', label: "Other rasi dasas (Lagna kendradi rasi dasa, Drigdasa)", read: (ini) => (ini.MaskedPrintPageMap >> 4) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 4, v) }) },
      { id: 1006, kind: 'check', key: 'MaskedPrintPageMap', label: "Ayur dasas (Shoola dasa, Niryana shoola dasa)", read: (ini) => (ini.MaskedPrintPageMap >> 5) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 5, v) }) },
      { id: 1012, kind: 'check', key: 'MaskedPrintPageMap', label: "Tribhagi Vimsottari dasa", read: (ini) => (ini.MaskedPrintPageMap >> 6) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 6, v) }) },
      { id: 1007, kind: 'check', key: 'MaskedPrintPageMap', label: "Yogini dasa", read: (ini) => (ini.MaskedPrintPageMap >> 7) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 7, v) }) },
      { id: 1008, kind: 'check', key: 'MaskedPrintPageMap', label: "Charts of standing (D-10, D-2, D-4, D-16, D-5, D-40)", read: (ini) => (ini.MaskedPrintPageMap >> 8) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 8, v) }) },
      { id: 1009, kind: 'check', key: 'MaskedPrintPageMap', label: "Charts of family and background (D-12, D-3, D-7, D-20, D-24, D-27)", read: (ini) => (ini.MaskedPrintPageMap >> 9) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 9, v) }) },
      { id: 1010, kind: 'check', key: 'MaskedPrintPageMap', label: "Charts of misfortune and karma (D-6, D-8, D-11, D-30, D-45, D-60)", read: (ini) => (ini.MaskedPrintPageMap >> 10) & 1, write: (v, ini) => ({ MaskedPrintPageMap: bit(ini.MaskedPrintPageMap, 10, v) }) },
      { id: 1011, kind: 'check', key: 'BlackPrintingWanted', label: "I don't have a color printer. Print in black and white only." },
      "(Note: Trying to print color pages on a black and white",
      "printer may result in printouts that are not so dark.)",
    ],
  },
  {
    dialog: 2028, cmd: 33075, title: "Enter your name and address", menu: "Astrologer's name and address (for printouts)",
    port: "FUN_004e78a0 (dialog FUN_004cf490)", section: 'display',
    items: [
      "Please enter your name, address, phone number, email etc.\nThis will be printed in a box at the top of your chart print-outs.",
      { id: 100, kind: 'textarea', key: 'JyotishiAddress' },
    ],
  },
  {
    dialog: 2078, cmd: 33394, title: "Software Update Preferences", menu: "Updates",
    port: "FUN_004e5280 (dialog FUN_004d8640, DDX FUN_004d8670)", section: 'display',
    items: [
      { id: 1001, kind: 'check', key: 'AutoUpdateOn', label: "Enable automatic updates. Please note that no private data will be collected from your computer during an automatic update." },
      { id: 1003, kind: 'check', key: 'AutoUpdateOnTest', label: "Download test releases also (alpha & beta releases). Uncheck this if you want only stable and well-tested updates." },
    ],
  },
  // 165 and 2047: their keys are read by core/ashtakavarga.ts and core/otherStrengths.ts.
  {
    dialog: 165, cmd: 33157, title: "Ashtakavarga Calculation Preferences", menu: "Ashtakavarga Calculation Options",
    port: "FUN_004e7db0 (dialog FUN_004cf5f0, DDX FUN_004cf630)", section: 'calc',
    items: [
      // check 1010 shows AshtakaVargaDefinition == 0 (FUN_004e7db0 inverts it both ways)
      { id: 1010, kind: 'check', key: 'AshtakaVargaDefinition', label: "Reverse the ashtakavarga meaning, as far as references are concerned.", read: (ini) => (ini.AshtakaVargaDefinition === 0 ? 1 : 0), write: (v) => ({ AshtakaVargaDefinition: Number(v) ? 0 : 1 }) },
      "If this option is unchecked, count in a sign in the BAV of a planet shows the number of references from which the planet is benefic in that sign.",
      "If this option is checked, count in a sign in the BAV of a planet shows the number of planets that are benefic from the planet in that sign.",
      { id: 1012, kind: 'check', key: 'BhavaDrivenSarvaAshtakaVarga', label: "Consolidate houses from references when finding SAV (instead of signs)." },
      "If this option is unchecked, count in a sign in SAV is found by adding the counts in the BAVs of various planets in that sign.",
      "If this option is checked, count in a house in SAV is found by adding the counts in the BAVs of various planets in that house (from the position of the planet).",
      "For example, count in Sun's BAV in the 9th from Sun, count in the 9th from Moon in Moon's BAV etc are added to get the count in the 9th house in SAV.",
      { id: 1013, kind: 'check', key: 'EightAVInSAV', label: "Use eight ashtakavargas (instead of seven) in SAV, i.e. include lagna ashtakavarga too." },
      { group: "Parasara-Varahamihira Discrepancy" },
      "If you want to use Parasara's definitions, check all the options below.",
      "If you want to use Varahamihira's definitions, uncheck all the options below.",
      "You can try a mixture of the two definitions by checking some and unchecking some options below. But be careful when you do that.",
      ...([[1001, "Moon is benefic in the 9th from Moon"], [1002, "Moon is malefic in the 9th from Mars"], [1003, "Moon is benefic in the 2nd from Jupiter"],
        [1004, "Moon is malefic in the 12th from Jupiter"], [1008, "Venus is benefic in the 4th from Mars"], [1009, "Venus is malefic in the 5th from Mars"]] as const)
        .map(([id, label], i): OptionField => ({
          id, kind: 'check', key: 'AshtakaVargaCalculation', label,
          read: (ini) => Number(ini.AshtakaVargaCalculation[i] ?? 1),
          write: (v, ini) => ({ AshtakaVargaCalculation: slots(ini.AshtakaVargaCalculation, [i], Number(v) ? 1 : 0) }),
        })),
    ],
  },
  {
    dialog: 2047, cmd: 33166, title: "Vaiseshikamsa Calculation Preferences", menu: "Vaiseshikamsa Calculation Options",
    port: "FUN_004e80a0 (dialog FUN_004cf1e0, DDX FUN_004cf240)", section: 'calc',
    items: [
      "Parasara mentioned quadrants from \"swarudha\" as\ngood placements when evaluating vaiseshikamsas.",
      ["What does swarudha mean here?", { id: 1003, kind: 'combo', key: 'SwarudhaInAmsaBala', items: ["Ignore this special case", "Arudha lagna of rasi chart", "Arudha lagna of each divisional chart", "Graha arudha of rasi chart", "Graha arudha of each divisional chart", "AL lord of rasi chart (take kendra from him in vargas)", "AL of rasi, but take kendra lords (not planets in kendra)", "AL of varga, but take kendra lords (not planets in kendra)"] }],
      "Parasara defined some overriding conditions for the above. Under\nthese conditions, a good placement as found above becomes bad.",
      "Select the overriding conditions you want to use for annulling the above.",
      { id: 1001, kind: 'check', key: 'CombustionBadInAmsaBala', label: "If the planet is combust" },
      { id: 1002, kind: 'check', key: 'DispositorCombustionBadInAmsaBala', label: "If the dispositior is combust" },
      { id: 1018, kind: 'check', key: 'CombustionSpecialRuleVenusMercury', label: "Retrograde Mercury and direct Venus are not combust (Sanjay Rath)." },
      { id: 1004, kind: 'check', key: 'DefeatBadInAmsaBala', label: "If the planet is defeated in a planetary war" },
      { id: 1008, kind: 'check', key: 'DispositorDefeatBadInAmsaBala', label: "If the dispositor is defeated in a planetary war" },
      { id: 1009, kind: 'check', key: 'NeechaBadInAmsaBala', label: "If the planet is debilitated in division" },
      { id: 1010, kind: 'check', key: 'DispositorNeechaBadInAmsaBala', label: "If the dispositior is debilitated in division" },
      { id: 1011, kind: 'check', key: 'DispositorNeechaRasiBadInAmsaBala', label: "If the dispositior is debilitated in rasi" },
      // FUN_004a6af0 tests these two as "in an enemy's sign" (compound relationship of the varga)
      { id: 1014, kind: 'check', key: 'PoorVimsopakaBadInAmsaBala', label: "If the planet is in satru/adhisatru sthana" },
      { id: 1015, kind: 'check', key: 'DispositorPoorVimsopakaBadInAmsaBala', label: "If the dispositor is in satru/adhisatru sthana" },
      { id: 1016, kind: 'check', key: 'SayanadiBadInAmsaBala', label: "If the planet is in a bad sayanadi avastha" },
      { id: 1017, kind: 'check', key: 'DispositorSayanadiBadInAmsaBala', label: "If the dispositor is in a bad sayanadi avastha" },
      "Less than 50% vimsopaka bala in dasa varga makes a planet weak.",
    ],
  },
];

/** The dialog with a resource id. */
export const optionDialog = (dialog: number) => OPTION_DIALOGS.find((d) => d.dialog === dialog);

/** Every field of a dialog, in order. */
export function dialogFields(d: OptionDialogDef): OptionField[] {
  const out: OptionField[] = [];
  for (const it of d.items) {
    if (Array.isArray(it)) out.push(...it.filter((x): x is OptionField => typeof x === 'object'));
    else if (typeof it === 'object' && 'id' in it) out.push(it);
  }
  return out;
}

/** A field's control value for `ini` (the handler's copy-in). */
export function readField(f: OptionField, ini: JhoraIni): FieldValue {
  if (f.read) return f.read(ini);
  const v = ini[f.key];
  return typeof v === 'string' ? v : Number(v);
}

/** The ini patch of OK (the handler's copy-out), applying the fields in order. */
export function applyFields(d: OptionDialogDef, ini: JhoraIni, values: Record<number, FieldValue>): Partial<JhoraIni> {
  let cur: JhoraIni = { ...ini };
  const patch: Partial<JhoraIni> = {};
  for (const f of dialogFields(d)) {
    const v = values[f.id];
    if (v === undefined) continue;
    const p = f.write ? f.write(v, cur) : ({ [f.key]: typeof ini[f.key] === 'string' ? String(v) : Number(v) } as Partial<JhoraIni>);
    Object.assign(patch, p);
    cur = { ...cur, ...p };
  }
  return patch;
}
