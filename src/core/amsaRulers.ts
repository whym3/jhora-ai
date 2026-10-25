// Nadiamsa (D-150) rulers, as JHora's "Amsa rulers" view shows them.
// Ported from jhora.exe: FUN_004a9ae0 fills the nadiamsa number of every body
// using unequal nadiamsas (150 boundaries per sign in 1/504 degree units; the
// equal 12' scheme is the alternative branch), FUN_00495cc0 derives the index
// in the name list (movable signs direct, fixed signs reversed, dual signs
// from the 76th) and FUN_00493230 holds the 150 names in index order.
//
// The other vargas of the Amsa rulers view (menu 141, 32915-32929 set AmsaRulerVarga =
// DAT_0057f828 to a JHora varga index, 33064 back to 25 = D-150): FUN_00495cc0 with the
// name tables FUN_00495390 points 0x8967a4[varga] at (D150NamePreference picks the D-150
// list: 1 = 0x896b2c, otherwise 0x896d84).
import NADIAMSA_BOUNDS from './data/nadiamsa-bounds.json';
import NADIAMSA_NAMES from './data/nadiamsa.json';

export { NADIAMSA_NAMES };

/** 0-based nadiamsa number (0..149) of a degree inside its sign. */
export function nadiamsaDivision(degInSign: number, unequal = true): number {
  if (!unequal) return Math.min(149, Math.floor(degInSign * 5));
  let k = 0;
  for (let i = 1; i < NADIAMSA_BOUNDS.length; i++) {
    if (NADIAMSA_BOUNDS[i] / 504 <= degInSign) k++;
    else break;
  }
  return k;
}

/** 0-based index into NADIAMSA_NAMES for a sign and 0-based division. */
export function nadiamsaIndex(sign: number, division: number): number {
  const m = sign % 3;
  if (m === 0) return division;
  if (m === 1) return 149 - division;
  return (division + 75) % 150;
}

export interface AmsaRuler { division: number; index: number; name: string }

export function amsaRuler(lon: number, unequal = true): AmsaRuler {
  const sign = Math.floor(lon / 30) % 12;
  const division = nadiamsaDivision(lon - sign * 30, unequal);
  const index = nadiamsaIndex(sign, division);
  return { division, index, name: NADIAMSA_NAMES[index] };
}

/** Names per JHora varga index (table 0x8967a4, set up by FUN_00495390). */
const AMSA_NAMES: Record<number, string[]> = {
  1: [
    'Deva', 'Manushya', 'Raakshasa',
  ],
  2: [
    'Devas  -  Sun', 'Pitris  -  Moon',
  ],
  3: [
    'Naarada', 'Agastya', 'Durvaasa',
  ],
  4: [
    'Sanaka', 'Sananda', 'Kumaara', 'Sanaatana',
  ],
  7: [
    'Kshaara', 'Ksheera', 'Dadhi', 'Ghrita', 'Ikshu Rasa', 'Madya', 'Suddha Jala',
  ],
  9: [
    'Indra', 'Agni', 'Yama', 'Nirriti', 'Varuna', 'Vaayu', 'Kubera', 'Isaana', 'Brahma', 'Ananta',
  ],
  11: [
    'Ganesa', 'Aswini Kumaras', 'Yama', 'Ahi (Sarpa)',
  ],
  12: [
    'Brahma', 'Vishnu', 'Shiva', 'Surya',
  ],
  14: [
    'Skanda', 'Parasu Raama', 'Anala', 'Viswa-karmaa', 'Bhaga', 'Mitra', 'Maya', 'Antaka', 'Vrisha-dhwaja', 'Govinda',
    'Madana', 'Bheema',
  ],
  15: [
    'Aswini Kumaara', 'Yama', 'Agni', 'Brahma', 'Chandra', 'Shiva', 'Aditi', 'Guru', 'Ahi (Sarpa - Rahu)', 'Pitris',
    'Bhaga', 'Aryamaan', 'Surya', 'Tvashta', 'Vaayu', 'Shakragni', 'Mitra', 'Indra', 'Nirriti', 'Varuna', 'Viswadeva',
    'Govinda', 'Vasu', 'Varuna', 'Ajapada', 'Ahirbudhanya', 'Pooshan',
  ],
  16: [
    'Agni', 'Vaayu', 'Indra', 'Kubera', 'Varuna',
  ],
  17: [
    'Vishnu', 'Chandra', 'Marichi', 'Tvashtaa', 'Brahma', 'Shiva', 'Surya', 'Yama', 'Yaksha', 'Gandharva', 'Kaala',
    'Varuna',
  ],
  18: [
    'Brahma', 'Shiva', 'Vishnu',
  ],
  19: [
    'Ghora', 'Raakshasa', 'Deva', 'Kubera', 'Yaksha', 'Kinnara', 'Bhrashta', 'Kulaghna', 'Garala', 'Vahni', 'Maayaa',
    'Pureeshaka', 'Apaampati', 'Marutvaan', 'Kaala', 'Sarpa', 'Amrita', 'Indu', 'Mridu', 'Komala', 'Heramba', 'Brahma',
    'Vishnu', 'Maheswara', 'Deva', 'Aardra', 'Kali-naasa', 'Kshiteesa', 'Kamalaakara', 'Gulika', 'Mrityu', 'Kaala',
    'Daavaagni', 'Ghora', 'Yama', 'Kantaka', 'Sudhaa', 'Amrita', 'Poorna Chandra', 'Visha-dagdha', 'Kula-naasa',
    'Vamsa-kshaya', 'Utpaata', 'Kaala', 'Saumya', 'Komala', 'Seetala', 'Karala-danshtra', 'Chandra-mukhi', 'Praveena',
    'Kaala Paavaka', 'Dandaayudha', 'Nirmala', 'Saumya', 'Kroora', 'Ati-seetaka', 'Amrita', 'Payodhi', 'Bhramana',
    'Chandra-rekha',
  ],
};
/** D-20 names for odd signs (0x896a44) and even signs (0x8969f4). */
const D20_ODD = [
  'Kaali', 'Gouri', 'Jayaa', 'Lakshmi', 'Vijayaa', 'Vimalaa', 'Sati', 'Taaraa', 'Jwaalaa-mukhi', 'Swethaa', 'Lalitaa',
  'Bagala-mukhi', 'Pratyangiraa', 'Sachi', 'Roudri', 'Bhavaani', 'Varadaa', 'Jayaa', 'Tripuraa', 'Sumukhi',
];
const D20_EVEN = [
  'Dayaa', 'Medhaa', 'Chinna-seershaa', 'Pisaachini', 'Dhoomavati', 'Maatangi', 'Baalaa', 'Bhadraa', 'Arunaa',
  'Analaa', 'Pingalaa', 'Chuchchukaa', 'Ghoraa', 'Vaaraahi', 'Vaishnavi', 'Sitaa', 'Bhuvaneswari', 'Bhairavi',
  'Mangalaa', 'Aparaajitaa',
];
/** The other D-150 name list (0x896b2c, D150NamePreference = 1). */
const NADIAMSA_NAMES_ALT = [
  'Vasudha', 'Vaishnavi', 'Braahmi', 'Kaalakoota', 'Sankari', 'Sadaakari', 'Samaa', 'Saumya', 'Suraa', 'Maayaa',
  'Manohara', 'Maadhavi', 'Manjuswana', 'Ghora', 'Kumbhini', 'Kutila', 'Prabhaa', 'Paraa', 'Payaswini', 'Maalaa',
  'Jagati', 'Jarjhari', 'Dhruva', 'Musala', 'Mudgara', 'Paasaa', 'Chambaka', 'Daamini', 'Mahi', 'Kalusha', 'Kamala',
  'Kaantaa', 'Kaalaa', 'Karikara', 'Kshamaa', 'Durdharaa', 'Durbhagaa', 'Viswa', 'Visirna', 'Vikata Viswala',
  'Aavilaa', 'Vidruma', 'Sukhada', 'Snigdha', 'Sodara', 'Surasundari', 'Amritapraasini', 'Karaalaa', 'Kaamadrik',
  'Kara Veerani', 'Gahwaraa', 'Kundini', 'Kundini', 'Roudra/Kaanthaa', 'Vishaa', 'Vishanaasini', 'Nirmada', 'Seetala',
  'Nimnaa', 'Preeta', 'Priyavaasini', 'Maanaghna', 'Durbhaga', 'Chitra', 'Chitrini', 'Chiranjeevani', 'Viroopa/Bhoopa',
  'Gadaaharaa', 'Naalaa', 'Nalini', 'Nirmalaa', 'Nadee', 'Sadamritamsukala', 'Chapalaa', 'Saankuraa',
  'Trailokya Mohanakari', 'Mahaamaayaa', 'Suseetalaa', 'Sumataa/Subhagaa', 'Suprabhaa', 'Sobhaa', 'Sobhana', 'Sivadaa',
  'Sivaa', 'Balaa', 'Jwaalaa', 'Gadaa', 'Gaadaa', 'Nootana', 'Sumanoharaa', 'Somavalli', 'Somalataa', 'Mangala',
  'Mudrikaa', 'Sootaa', 'Mokshapavarga', 'Valaya', 'Navaneetaa', 'Nisaakari', 'Nivriti', 'Nigadaa', 'Saaraa/Saura',
  'Sangeeta', 'Sumathaa', 'Viswambharaa', 'Kumaari', 'Kokilaa', 'Kunjarakriti', 'Aindiraa', 'Swaahaa', 'Swaraa',
  'Vahni', 'Peethi', 'Rakshajala', 'Plava', 'Madiraa', 'Maitri', 'Haarini', 'Harini', 'Marut', 'Dhananjaya',
  'Dhanakari', 'Dhanadaa', 'Mrichchaya', 'Ambujaa', 'Isaani', 'Thoolini', 'Roudri', 'Sivaa', 'Sivakari', 'Kalaa',
  'Kunda', 'Mukunda', 'Bharata', 'Pasitha', 'Kandini', 'Smaraa', 'Kunthala', 'Kokila', 'Paapa', 'Kaamini',
  'Kalasodbhava', 'Viraprasoo', 'Sankara', 'Satayajnaa', 'Sadaavari', 'Brahvi/Virahapa', 'Paatalini', 'Pankajaa',
  'Parameswari',
];

/** Parts per sign by JHora varga index (0x591ed4) and number of names (0x57f82c). */
const PARTS = [1, 9, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 16, 20, 24, 27, 30, 40, 45, 60, 81, 108, 144];
const COUNTS = [1, 3, 2, 3, 4, 1, 1, 7, 1, 10, 1, 4, 4, 20, 12, 27, 5, 12, 3, 60];

/** JHora varga indices the Amsa rulers menu offers (32915-32929, 33064), with their command ids. */
export const AMSA_RULER_VARGAS: [number, number, string][] = [
  [1, 32915, 'Navamsa'], [2, 32916, 'Hora (D-2)'], [3, 32917, 'Drekkana (D-3)'], [4, 32918, 'Chaturthamsa (D-4)'],
  [7, 32919, 'Saptamsa (D-7)'], [9, 32920, 'Dasamsa (D-10)'], [11, 32921, 'Dwadasamsa (D-12)'], [12, 32922, 'Shodasamsa (D-16)'],
  [13, 32923, 'Vimsamsa (D-20)'], [14, 32924, 'Siddhamsa (D-24)'], [15, 32925, 'Nakshatramsa (D-27)'], [16, 32926, 'Trimsamsa (D-30)'],
  [17, 32927, 'Khavedamsa (D-40)'], [18, 32928, 'Akshavedamsa (D-45)'], [19, 32929, 'Shashtyamsa (D-60)'], [25, 33064, 'Nadyamsa (D-150)'],
];
export const D150_INDEX = 25;

/**
 * FUN_00495cc0: the ruler of a longitude's amsa in a varga (JHora varga index). `division`
 * is 0-based (JHora prints division + 1), `index` the 0-based position in the name list.
 * D-150 goes through amsaRuler (the nadiamsa number JHora stores per body).
 */
export function vargaAmsaRuler(lon: number, varga: number, d150Pref = 0): AmsaRuler {
  const sign = Math.floor(lon / 30) % 12;
  const deg = lon - sign * 30;
  if (varga === D150_INDEX) {
    const r = amsaRuler(lon);
    return d150Pref === 1 ? { ...r, name: NADIAMSA_NAMES_ALT[r.index] } : r;
  }
  const parts = PARTS[varga];
  const division = Math.trunc(deg * parts * (1 / 30));
  let r = division;
  if (varga === 1 || varga === 3) r = division + (sign % 3);
  else {
    if (![4, 11, 13, 15, 17].includes(varga) && sign % 2 === 1) r = parts - division - 1;
    if (varga === 18) r += sign % 3;
  }
  if (varga === 16) {
    // trimsamsa lords by degree (odd signs Mars, Saturn, Jupiter, Mercury, Venus; even signs reversed)
    if (sign % 2 === 1) r = deg >= 25 ? 0 : deg >= 20 ? 1 : deg >= 12 ? 2 : deg >= 5 ? 3 : 4;
    else r = deg >= 25 ? 4 : deg >= 18 ? 3 : deg >= 10 ? 2 : deg >= 5 ? 1 : 0;
  }
  const index = r % COUNTS[varga];
  const list = varga === 13 ? (sign % 2 === 0 ? D20_ODD : D20_EVEN) : AMSA_NAMES[varga];
  return { division, index, name: list[index] };
}
