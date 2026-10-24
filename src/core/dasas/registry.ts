// Rasi and other (graha) dasas in the order of JHora's dasa menus (resource
// 108, popups 1 and 2). Each builder takes the chart and the number of levels.
import type { Chart } from '../chart';
import type { Graha } from '../positions';
import type { Period } from './vimsottari';
import type { VargaCtx } from '../signStrength';
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
import { RASI_BHUKTA_VIMSOTTARI_TITLE, rasiBhuktaVimsottariDasa } from './rasiBhuktaVimsottari';
import { KARAKA_TITLE, karakaDasa } from './karaka';
import { TITHI_ASHTOTTARI_TITLE, tithiAshtottariDasa } from './tithiAshtottari';
import { YOGA_VIMSOTTARI_TITLE, yogaVimsottariDasa } from './yogaVimsottari';
import { KARANA_CHATURASEETI_TITLE, karanaChaturaseetiDasa } from './karanaChaturaseeti';
import { TITHI_YOGINI_TITLE, tithiYoginiDasa } from './tithiYogini';

export interface BuiltDasa { title: string; periods: Period[] }
export type DasaBuilder = (chart: Chart, levels: number) => BuiltDasa;

const signOf = (lon: number) => Math.floor(lon / 30) % 12;
const d1 = (chart: Chart): VargaCtx => ({ sign: (g: Graha) => signOf(chart.positions.grahas[g].lon), degree: (g: Graha) => chart.positions.grahas[g].lon % 30 });
const plain = (title: string, f: (c: Chart, levels: number) => Period[]): DasaBuilder => (c, levels) => ({ title, periods: f(c, levels) });

/** Rasi dasas, labelled like JHora's menu items. */
export const RASI_DASAS: Record<string, DasaBuilder> = {
  Narayana: (c, levels) => narayanaDasa(signOf(c.positions.ascendant), d1(c), 'D-1', levels),
  Lagnamsaka: plain(LAGNAMSAKA_TITLE, (c, l) => lagnamsakaDasa(c, l)),
  Padanaathaamsa: plain(PADANATHAMSA_TITLE, (c, l) => padanathamsaDasa(c, l)),
  Sudasa: (c, levels) => {
    const ctx = { ...d1(c), lagnaSign: signOf(c.positions.ascendant), lagnaDegree: c.positions.ascendant % 30 };
    return { title: SUDASA_TITLE, periods: sudasa(c.longitudes.find((x) => x.name === 'Sree Lagna')!.lon, ctx, levels) };
  },
  Drigdasa: plain(DRIGDASA_TITLE, (c, l) => drigDasa(c, l)),
  'Lagna Kendradi': plain(LAGNA_KENDRADI_TITLE, (c, l) => lagnaKendradiDasa(c, l)),
  'AK Kendradi Rasi': plain(AK_KENDRADI_TITLE, (c, l) => akKendradiDasa(c, l)),
  Trikona: plain(TRIKONA_TITLE, (c, l) => trikonaDasa(c, l)),
  'Chara (Parasara)': plain(CHARA_PARASARA_TITLE, (c, l) => charaParasaraDasa(c, l)),
  'Chara (K.N. Rao)': plain(CHARA_KN_RAO_TITLE, charaKNRaoDasa),
  'Chara (Rangacharya)': plain(CHARA_IRANGANTI_TITLE, (c, l) => charaIrangantiDasa(c, l)),
  Yogardha: plain(YOGARDHA_TITLE, (c, l) => yogardhaDasa(c, l)),
  Paryaaya: (c, levels) => { const p = paryaayaDasa(c, levels); return { title: p.title, periods: p.periods }; },
  Shoola: plain(SHOOLA_TITLE, (c, l) => shoolaDasa(c, l)),
  'Niryaana Shoola': plain(NIRYAANA_SHOOLA_TITLE, niryaanaShoolaDasa),
  Brahma: plain(BRAHMA_TITLE, brahmaDasa),
  Sthira: plain(STHIRA_TITLE, sthiraDasa),
  'Mandooka (D-11)': plain(MANDOOKA_D11_TITLE, mandookaD11Dasa),
  'Mandooka (K.N. Rao)': plain(MANDOOKA_KN_RAO_TITLE, mandookaKNRaoDasa),
  Navamsa: plain(NAVAMSA_TITLE, navamsaDasa),
  Varnada: plain(VARNADA_TITLE, varnadaDasa),
};

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
  'Rasi-Bhukta Vimsottari': plain(RASI_BHUKTA_VIMSOTTARI_TITLE, (c, l) => rasiBhuktaVimsottariDasa(c, l)),
  Karaka: plain(KARAKA_TITLE, karakaDasa),
  'Tithi Ashtottari': plain(TITHI_ASHTOTTARI_TITLE, (c, l) => tithiAshtottariDasa(c, l)),
  'Yoga Vimsottari': plain(YOGA_VIMSOTTARI_TITLE, yogaVimsottariDasa),
  'Karana Chaturaseeti': plain(KARANA_CHATURASEETI_TITLE, karanaChaturaseetiDasa),
  'Tithi Yogini': plain(TITHI_YOGINI_TITLE, (c, l) => tithiYoginiDasa(c, l)),
};
