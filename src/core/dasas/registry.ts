// Rasi and other (graha) dasas in the order of JHora's dasa menus (resource
// 108, popups 1 and 2). Each builder takes the chart and the number of levels,
// and optionally what a derived chart changes (DasaOptions):
//  - compressed (DAT_008a4b68): Karana Chaturaseeti lists 8 maha dasas (the
//    other count changes are applied by yearDefinition.ts COMPRESSED_COUNT);
//  - tajaka (doc+0x76d04 = 1): with UseDasaSeedFromNatalInTajaka[slot] and
//    ProgressDasaSeedInTajaka[slot] the flagged rasi dasas start from the Muntha
//    (rasiCommon DasaSeed); Rasi-Bhukta Vimsottari (flags of slot 0), Tithi
//    Ashtottari (69), Yoga Vimsottari (70), Tithi Yogini (72) and Karana
//    Chaturaseeti (flags of slot 7) take their seed from the natal chart and
//    advance it by the completed years n.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import type { VargaCtx } from '../signStrength';
import type { VargaName } from '../vargas';
import { DEFAULTS } from '../../settings/generated';
import { rasiCtx, withDasaSeed } from './rasiCommon';
import { nakshatraSeedLon } from './nakshatra';
import { narayanaDasa } from './narayana';
import { SUDASA_TITLE, sudasa } from './sudasa';
import { LAGNAMSAKA_TITLE, lagnamsakaDasa } from './lagnamsaka';
import { PADANATHAMSA_TITLE, padanathamsaDasa } from './padanathamsa';
import { DRIGDASA_TITLE, drigDasa } from './drigdasa';
import { LAGNA_KENDRADI_TITLE, lagnaKendradiDasa } from './lagnaKendradi';
import { AK_KENDRADI_TITLE, akKendradiDasa } from './akKendradi';
import { TRIKONA_TITLE, trikonaDasa } from './trikona';
import { CHARA_PARASARA_TITLE, charaParasaraDasa } from './charaParasara';
import { CHARA_KN_RAO_TITLE, charaKNRaoDasa } from './charaKNRao';
import { CHARA_IRANGANTI_TITLE, charaIrangantiDasa } from './charaIranganti';
import { YOGARDHA_TITLE, yogardhaDasa } from './yogardha';
import { paryaayaDasa } from './paryaaya';
import { SHOOLA_TITLE, shoolaDasa } from './shoola';
import { NIRYAANA_SHOOLA_TITLE, niryaanaShoolaDasa } from './niryaanaShoola';
import { BRAHMA_TITLE, brahmaDasa } from './brahma';
import { STHIRA_TITLE, sthiraDasa } from './sthira';
import { MANDOOKA_D11_TITLE, mandookaD11Dasa } from './mandookaD11';
import { MANDOOKA_KN_RAO_TITLE, mandookaKNRaoDasa } from './mandookaKNRao';
import { NAVAMSA_TITLE, navamsaDasa } from './navamsa';
import { VARNADA_TITLE, varnadaDasa } from './varnada';
import { MOOLA_TITLE, moolaDasa } from './moola';
import { NAISARGIKA_TITLE, naisargikaDasa } from './naisargika';
import { TARA_TITLE, taraDasa } from './tara';
import { KAALA_TITLE, kaalaDasa } from './kaala';
import { CHAKRA_TITLE, chakraDasa } from './chakra';
import { AK_KENDRADI_GRAHA_TITLE, akKendradiGrahaDasa } from './akKendradiGraha';
import { PATYAYINI_TITLE, patyayiniDasa } from './patyayini';
import { SUDARSANA_CHAKRA_TITLE, sudarsanaChakraDasa } from './sudarsanaChakra';
import { BUDDHI_GATI_TITLE, buddhiGatiDasa } from './buddhiGati';
import { RASI_BHUKTA_MUDDA_TITLE, RASI_BHUKTA_VIMSOTTARI_TITLE, rasiBhuktaVimsottariDasa } from './rasiBhuktaVimsottari';
import { KARAKA_TITLE, karakaDasa } from './karaka';
import { TITHI_ASHTOTTARI_TITLE, tithiAshtottariDasa } from './tithiAshtottari';
import { YOGA_VIMSOTTARI_TITLE, yogaVimsottariDasa } from './yogaVimsottari';
import { KARANA_CHATURASEETI_TITLE, karanaChaturaseetiDasa } from './karanaChaturaseeti';
import { TITHI_YOGINI_TITLE, tithiYoginiDasa } from './tithiYogini';

export interface BuiltDasa { title: string; periods: Period[] }

/** The Tajaka chart behind a kind-1 derived chart. */
export interface TajakaDasaSeed {
  natal: Chart;
  /** completed years n (doc+0x76d10) */
  years: number;
  /** Muntha sign of a varga (doc+0x39e80) */
  munthaIn: (varga: VargaName) => number;
}
export interface DasaOptions {
  /** DAT_008a4b68: the chart's dasas are compressed into its period */
  compressed?: boolean;
  tajaka?: TajakaDasaSeed;
}
export type DasaBuilder = (chart: Chart, levels: number, opts?: DasaOptions) => BuiltDasa;

const signOf = (lon: number) => Math.floor(lon / 30) % 12;
const d1 = (chart: Chart): VargaCtx => ({ sign: (g: Graha) => signOf(chart.positions.grahas[g].lon), degree: (g: Graha) => chart.positions.grahas[g].lon % 30 });
const plain = (title: string, f: (c: Chart, levels: number) => Period[]): DasaBuilder => (c, levels) => ({ title, periods: f(c, levels) });

/** UseDasaSeedFromNatalInTajaka / ProgressDasaSeedInTajaka of a slot (bytes 0x8a184c / 0x8a1800). */
export function tajakaSeedFlags(chart: Chart, slot: number): { natal: boolean; progress: boolean } {
  const natal = (chart.ini.UseDasaSeedFromNatalInTajaka?.[slot] ?? DEFAULTS.UseDasaSeedFromNatalInTajaka[slot] ?? 1) !== 0;
  const progress = (chart.ini.ProgressDasaSeedInTajaka?.[slot] ?? DEFAULTS.ProgressDasaSeedInTajaka[slot] ?? 1) !== 0;
  return { natal, progress };
}

/** A rasi dasa whose Tajaka seed is the Muntha when both flags of `slot` are set. */
const munthaSeeded = (slot: number, f: DasaBuilder): DasaBuilder => (c, levels, opts) => {
  const t = opts?.tajaka;
  if (!t) return f(c, levels, opts);
  const flags = tajakaSeedFlags(c, slot);
  return f(flags.natal && flags.progress ? withDasaSeed(c, { lagnaIn: t.munthaIn, natal: t.natal }) : c, levels, opts);
};
const seededPlain = (slot: number, title: string, f: (c: Chart, levels: number) => Period[]) => munthaSeeded(slot, plain(title, f));

/** Rasi dasas, labelled like JHora's menu items (slots 25.., yearDefinition.ts RASI_SLOTS). */
export const RASI_DASAS: Record<string, DasaBuilder> = {
  Narayana: munthaSeeded(25, (c, levels) => narayanaDasa(rasiCtx(c, 0).lagna, d1(c), 'D-1', levels)),
  Lagnamsaka: seededPlain(26, LAGNAMSAKA_TITLE, (c, l) => lagnamsakaDasa(c, l)),
  Padanaathaamsa: plain(PADANATHAMSA_TITLE, (c, l) => padanathamsaDasa(c, l)),
  Sudasa: (c, levels) => {
    const ctx = { ...d1(c), lagnaSign: signOf(c.positions.ascendant), lagnaDegree: c.positions.ascendant % 30 };
    return { title: SUDASA_TITLE, periods: sudasa(c.longitudes.find((x) => x.name === 'Sree Lagna')!.lon, ctx, levels) };
  },
  Drigdasa: seededPlain(29, DRIGDASA_TITLE, (c, l) => drigDasa(c, l)),
  'Lagna Kendradi': seededPlain(30, LAGNA_KENDRADI_TITLE, (c, l) => lagnaKendradiDasa(c, l)),
  'AK Kendradi Rasi': seededPlain(31, AK_KENDRADI_TITLE, (c, l) => akKendradiDasa(c, l)),
  Trikona: seededPlain(32, TRIKONA_TITLE, (c, l) => trikonaDasa(c, l)),
  'Chara (Parasara)': plain(CHARA_PARASARA_TITLE, (c, l) => charaParasaraDasa(c, l)),
  'Chara (K.N. Rao)': seededPlain(34, CHARA_KN_RAO_TITLE, charaKNRaoDasa),
  'Chara (Rangacharya)': seededPlain(35, CHARA_IRANGANTI_TITLE, (c, l) => charaIrangantiDasa(c, l)),
  Yogardha: seededPlain(36, YOGARDHA_TITLE, (c, l) => yogardhaDasa(c, l)),
  Paryaaya: munthaSeeded(37, (c, levels) => { const p = paryaayaDasa(c, levels); return { title: p.title, periods: p.periods }; }),
  Shoola: seededPlain(38, SHOOLA_TITLE, (c, l) => shoolaDasa(c, l)),
  'Niryaana Shoola': seededPlain(39, NIRYAANA_SHOOLA_TITLE, niryaanaShoolaDasa),
  Brahma: seededPlain(40, BRAHMA_TITLE, brahmaDasa),
  Sthira: seededPlain(41, STHIRA_TITLE, sthiraDasa),
  'Mandooka (D-11)': seededPlain(42, MANDOOKA_D11_TITLE, mandookaD11Dasa),
  'Mandooka (K.N. Rao)': seededPlain(43, MANDOOKA_KN_RAO_TITLE, mandookaKNRaoDasa),
  Navamsa: seededPlain(44, NAVAMSA_TITLE, navamsaDasa),
  Varnada: plain(VARNADA_TITLE, varnadaDasa),
};

const NAK = 360 / 27;
/** A Tajaka seed: the natal chart with UseDasaSeedFromNatalInTajaka[slot], n to add with ProgressDasaSeedInTajaka[slot] too. */
function tajakaSeed(c: Chart, slot: number, opts?: DasaOptions): { chart: Chart; n?: number } {
  const t = opts?.tajaka;
  if (!t) return { chart: c };
  const f = tajakaSeedFlags(c, slot);
  return f.natal ? { chart: t.natal, n: f.progress ? t.years : undefined } : { chart: c };
}

/** Other (mostly graha) dasas. */
export const OTHER_DASAS: Record<string, DasaBuilder> = {
  Moola: plain(MOOLA_TITLE, (c, l) => moolaDasa(signOf(c.positions.ascendant), d1(c), l)),
  Naisargika: plain(NAISARGIKA_TITLE, naisargikaDasa),
  Tara: plain(TARA_TITLE, taraDasa),
  Kaala: plain(KAALA_TITLE, kaalaDasa),
  Chakra: plain(CHAKRA_TITLE, chakraDasa),
  'AK Kendradi Graha': plain(AK_KENDRADI_GRAHA_TITLE, (c, l) => akKendradiGrahaDasa(c, l)),
  Patyayini: plain(PATYAYINI_TITLE, patyayiniDasa),
  'Sudarsana Chakra': plain(SUDARSANA_CHAKRA_TITLE, (c, l) => sudarsanaChakraDasa(c, l).periods),
  'Buddhi Gati': plain(BUDDHI_GATI_TITLE, (c, l) => buddhiGatiDasa(c, l)),
  'Rasi-Bhukta Vimsottari': (c, l, opts) => {
    // seed NakshatraDasaStartPoint[0] (DAT_008a1670), like Vimsottari
    const point = c.ini.NakshatraDasaStartPoint?.[0] ?? DEFAULTS.NakshatraDasaStartPoint[0] ?? 0;
    const s = tajakaSeed(c, 0, opts);
    if (s.chart === c) return { title: RASI_BHUKTA_VIMSOTTARI_TITLE, periods: rasiBhuktaVimsottariDasa(c, l, 0, nakshatraSeedLon(c, point)) };
    const seed = nakshatraSeedLon(s.chart, point) + (s.n ?? 0) * NAK;
    return { title: RASI_BHUKTA_MUDDA_TITLE, periods: rasiBhuktaVimsottariDasa(s.chart, l, 0, ((seed % 360) + 360) % 360) };
  },
  Karaka: plain(KARAKA_TITLE, karakaDasa),
  'Tithi Ashtottari': (c, l, opts) => { const s = tajakaSeed(c, 69, opts); return { title: TITHI_ASHTOTTARI_TITLE, periods: tithiAshtottariDasa(s.chart, l, 0, s.n) }; },
  'Yoga Vimsottari': (c, l, opts) => { const s = tajakaSeed(c, 70, opts); return { title: YOGA_VIMSOTTARI_TITLE, periods: yogaVimsottariDasa(s.chart, l, s.n) }; },
  'Karana Chaturaseeti': (c, l, opts) => {
    const s = tajakaSeed(c, 7, opts);
    return { title: KARANA_CHATURASEETI_TITLE, periods: karanaChaturaseetiDasa(s.chart, l, opts?.compressed ? 8 : 7, s.n ?? 0) };
  },
  'Tithi Yogini': (c, l, opts) => { const s = tajakaSeed(c, 72, opts); return { title: TITHI_YOGINI_TITLE, periods: tithiYoginiDasa(s.chart, l, 0, s.n) }; },
};
