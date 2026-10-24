// Shadbala, bhava bala, ishta/kashta and rashmis exactly as jhora.exe computes
// them (strength object built by FUN_004bbd50 and its helpers; offsets quoted
// in comments are into that object). Numbers are virupas unless noted.
import type { Chart } from './chart';
import type { Graha } from './positions';
import { norm360 } from './positions';
import { SIGN_LORD } from './lords';
import { ALL_VARGAS, vargaLongitude } from './vargas';
import { SEVEN, naturalRelation, temporaryRelation } from './relations';

export type Seven = (typeof SEVEN)[number];

/** |a - b| folded into 0..180 */
const fold = (x: number) => { const d = norm360(x); return d > 180 ? 360 - d : d; };
/** C-style truncation toward zero */
const trunc = (x: number) => (x < 0 ? Math.ceil(x) : Math.floor(x));
/** C-style remainder (sign of the dividend) */
const crem = (a: number, b: number) => a - b * trunc(a / b);

/** Sphuta (graded) drishti of planet q on a point `diff` degrees ahead of it, in percent (FUN_004b2b00). */
export function sphutaDrishti(diff: number, q: Seven, graded = false): number {
  const d = norm360(diff);
  let v = 0;
  if (d >= 300 || d < 30) v = 0;
  else if (d >= 180) v = (300 - d) / 2;
  else if (d >= 150) v = (d - 150) * 2;
  else if (d >= 120) v = 150 - d;
  else if (d >= 90) v = (120 - d) / 2 + 30;
  else if (d >= 60) v = d - 60 + 15;
  else v = (d - 30) / 2;
  if (!graded) {
    const special: Partial<Record<Seven, [number, number, number]>> = { Mars: [90, 210, 15], Jupiter: [120, 240, 30], Saturn: [60, 270, 45] };
    const s = special[q];
    if (s && ((d >= s[0] && d < s[0] + 30) || (d >= s[1] && d < s[1] + 30))) v += s[2];
  } else if (q === 'Jupiter') {
    if (d >= 90 && d < 120) v = (d - 90) / 2 + 45;
    else if (d >= 120 && d < 150) v = 60 - (d - 120) * 2;
    else if (d >= 210 && d < 240) v = (d - 210) / 2 + 45;
    else if (d >= 240 && d < 270) v = 60 - (d - 240) * 1.5;
  } else if (q === 'Mars') {
    if (d >= 60 && d < 90) v = (d - 60) * 1.5 + 15;
    else if (d >= 90 && d < 120) v = 60 - (d - 90);
    else if (d >= 180 && d < 210) return 100;
    else if (d >= 210 && d < 240) v = 60 - (d - 210);
  } else if (q === 'Saturn') {
    if (d >= 30 && d < 60) v = (d - 30) * 2;
    else if (d >= 60 && d < 90) v = 60 - (d - 60) / 2;
    else if (d >= 240 && d < 270) v = d - 240 + 30;
    else if (d >= 270 && d < 300) v = (300 - d) * 2;
  }
  if (v > 60) v = 60;
  return v * (5 / 3);
}

export interface PlanetBala {
  uchcha: number; saptavargaja: number; ojayugma: number; kendra: number; drekkana: number; sthana: number;
  dig: number;
  natonnata: number; paksha: number; tribhaga: number; abda: number; maasa: number; vaara: number; hora: number; ayana: number; yuddha: number; kaala: number;
  cheshta: number; naisargika: number; drig: number;
  total: number; rupas: number; percent: number;
  ishta: number; kashta: number; uchchaRashmi: number; cheshtaRashmi: number; subhaRashmi: number; asubhaRashmi: number; ishtaParasara: number; kashtaParasara: number;
}
export interface BhavaBala { lord: number; dig: number; drig: number; total: number; rupas: number }
export interface Shadbala { planets: Record<Seven, PlanetBala>; bhavas: BhavaBala[]; benefic: Record<Seven, 1 | -1> }

const DEBILITATION_POINT = [190, 213, 118, 345, 275, 177, 20];
const MOOLATRIKONA: [number, number][] = [[120, 140], [34, 50], [0, 12], [166, 170], [240, 250], [180, 195], [300, 320]];
const OJA_PARITY = [0, 1, 0, 0, 0, 1, 0];           // sign index parity wanted (0 = odd sign)
const DREKKANA_OFFSET = [0, 8, 0, 4, 0, 8, 4];
const DIG_WEAK = [90, 270, 90, 180, 180, 270, 0];
const NAISARGIKA = [60, 51.43, 17.14, 25.70, 34.28, 42.85, 8.57];
const REQUIRED_RUPAS = [5, 6, 5, 7, 6.5, 5.5, 5];
const KENDRA_BALA = [60, 30, 15];
const RELATION_SCORE: Record<number, number> = { 3: 30, 2: 22.5, 1: 15, 0: 7.5, '-1': 3.75, '-2': 1.875 };
const SAPTA_VARGAS = ['D1', 'D2', 'D3', 'D7', 'D9', 'D12', 'D30'] as const;
/** reverse Chaldean order used for horas, and each planet's position in it */
const HORA_SEQ: Seven[] = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'];
const AYANA_SIGN = [1, -1, 1, 1, 1, 1, -1];
const KRANTI_STEP = [362, 341, 299, 236, 150, 52];
const KRANTI_SUM = [0, 362, 703, 1002, 1238, 1388];
/** Mean-motion elements (sidereal, epoch 1900): [c0, c1 per day, c2, c3 per year]; first quad = seeghrochcha side, second = madhya side, as JHora orders them */
const MEAN_SUN = [257.4568, 0.98560265, 0, 0];
const MEAN: Record<'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn', [number[], number[]]> = {
  Mars: [MEAN_SUN, [270.22, 0.524019, 0, 0]],
  Mercury: [[164.0, 4.092318, 6.67, -0.00133], MEAN_SUN],
  Jupiter: [MEAN_SUN, [220.04, 0.083096, -3.33, -0.0067]],
  Venus: [[328.51, 1.602146, -5.0, -0.001], MEAN_SUN],
  Saturn: [MEAN_SUN, [236.74, 0.033439, 5.0, 0.001]],
};

/** JHora's "hh.mmss" number for a decimal quantity (hours or degrees). */
function hhmm(x: number): number {
  const sgn = x < 0 ? -1 : 1; x = Math.abs(x);
  const d = Math.floor(x + 1e-9); let m = Math.floor((x - d) * 60 + 1e-6); let s = ((x - d) * 60 - m) * 60;
  if (s < 0) s = 0;
  return sgn * ((s / 60 + m) * 0.01 + d);
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

export interface ShadbalaOptions { gradedAspects?: boolean }
/** JHora's default: graded special aspects (DAT_005923c9 set). */
export function computeShadbala(chart: Chart, opts: ShadbalaOptions = { gradedAspects: true }): Shadbala {
  const p = chart.positions;
  const lon = (g: Graha) => p.grahas[g].lon;
  const lagna = p.ascendant;
  const lagnaSign = Math.floor(lagna / 30) % 12;
  const signIn = (g: Seven, v: (typeof SAPTA_VARGAS)[number]) => Math.floor(vargaLongitude(lon(g), ALL_VARGAS[v]) / 30) % 12;
  const sign1 = (g: Seven) => Math.floor(lon(g) / 30) % 12;

  // ---- benefic / malefic flags (FUN_004bdb90)
  const flag: Record<string, number> = { Sun: -1, Moon: fold(lon('Moon') - lon('Sun')) >= 90 ? 1 : -1, Mars: -1, Mercury: 0, Jupiter: 1, Venus: 1, Saturn: -1, Rahu: -1 };
  {
    let sum = 0, assoc = false;
    const special: Record<string, [number, number]> = { Mars: [90, 210], Jupiter: [120, 240], Saturn: [60, 270] };
    for (const q of ['Sun', 'Moon', 'Mars', 'Jupiter', 'Venus', 'Saturn', 'Rahu'] as const) {
      const d = norm360(lon('Mercury') - lon(q));
      if (d <= 15 || d >= 345) { assoc = true; sum += flag[q]; }
      if (d >= 165 && d <= 195) { assoc = true; sum += flag[q]; }
      const s = special[q];
      if (s) for (const a of s) if (d >= a - 15 && d <= a + 15) { assoc = true; sum += 0.75 * flag[q]; }
    }
    flag.Mercury = sum >= 0 && (sum !== 0 || !assoc) ? 1 : -1;
  }

  // ---- compound relationships (FUN_004bd130): natural +/-1/0, temporary +/-1 by folded sign distance 1..3
  const rel = (a: Seven, b: Seven) => {
    if (a === b) return 3;
    let d = (((sign1(a) - sign1(b)) % 12) + 12) % 12; if (12 - d < d) d = 12 - d;
    return naturalRelation(a, b) + (d >= 1 && d <= 3 ? 1 : -1);
  };

  // ---- day frame
  const day = chart.day;
  const ghatis = day.ghatis;
  const dayLen = (day.sunset - day.sunrise) * 60, nightLen = (day.nextSunrise - day.sunset) * 60;
  const hours = ghatis * 0.4;
  const birth = chart.birth;
  // JHora's day count: local civil date number minus 2037, one less for a night birth before noon
  const D = Math.floor(p.jdUt + birth.tzHours / 24 - 0.5) - 2037 - (!day.isDay && birth.hour < 12 ? 1 : 0);
  const w7 = (x: number) => { const r = ((x % 7) + 7) % 7; return r === 0 ? 7 : r; };
  const lordOf = (w: number) => SEVEN[(w + 2) % 7];
  const vaaraLord = lordOf(w7(D));
  const abdaLord = lordOf(w7(3 * Math.floor(D / 360) + 1));
  const maasaLord = lordOf(w7(2 * Math.floor(D / 30) + 1));
  const h = trunc(-hours);
  const r = crem(HORA_SEQ.indexOf(vaaraLord) - h, 7);
  const horaLord = r >= 0 ? HORA_SEQ[r] : (['Mercury', 'Saturn', 'Mars', 'Venus', 'Moon', 'Jupiter', 'Sun'] as Seven[])[7 + r];
  const part = day.isDay ? crem(trunc(ghatis / (dayLen / 3)), 3) : crem(trunc((ghatis - dayLen) / (nightLen / 3)), 3) + 3;
  const tribhagaLord = (['Mercury', 'Sun', 'Saturn', 'Moon', 'Venus', 'Mars'] as Seven[])[part];

  // ---- mean longitudes for cheshta (FUN_004bdd90 / FUN_004bc4f0)
  const Y = trunc(birth.year - 1900);
  let days = 0;
  for (let y = 1900; y < birth.year; y++) days += isLeap(y) ? 366 : 365;
  // JHora tests the leap year on its loop counter, which never goes below 1900
  const ml = [31, isLeap(Math.max(birth.year, 1900)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let m = 0; m < birth.month - 1; m++) days += ml[m];
  // longitude west-positive in JHora's dd.mm form, (76 - lon)/15 brings local time to Ujjain; time in hh.mm form
  const lonVal = -hhmm(birth.lon);
  const T = (birth.day - 1) + days + ((lonVal + 76) / 15 + hhmm(birth.hour)) / 24;
  const meanLon = (c: number[]) => norm360(c[0] + c[1] * T + c[2] + c[3] * Y);

  const planets = {} as Record<Seven, PlanetBala>;
  SEVEN.forEach((g, i) => {
    const L = lon(g);
    const uchcha = fold(L - DEBILITATION_POINT[i]) / 3;
    let sapta = 0;
    for (const v of SAPTA_VARGAS) {
      const s = signIn(g, v);
      const lordV = SIGN_LORD[s] as Seven;
      const inMT = v === 'D1' && L >= MOOLATRIKONA[i][0] && L <= MOOLATRIKONA[i][1];
      sapta += inMT ? 45 : RELATION_SCORE[rel(g, lordV)];
    }
    const oja = (sign1(g) % 2 === OJA_PARITY[i] ? 15 : 0) + (signIn(g, 'D9') % 2 === OJA_PARITY[i] ? 15 : 0);
    const kendra = KENDRA_BALA[(((sign1(g) - lagnaSign) % 12) + 12) % 3];
    const drekkana = signIn(g, 'D3') === (sign1(g) + DREKKANA_OFFSET[i]) % 12 ? 15 : 0;
    const sthana = uchcha + sapta + oja + kendra + drekkana;
    const dig = fold(L - (lagna + DIG_WEAK[i])) / 3;

    const nat = fold(lagna - lon('Sun') + 90) / 3;
    const natonnata = i === 3 ? 60 : [0, 4, 5].includes(i) ? nat : 60 - nat;
    const pk = fold(lon('Moon') - lon('Sun')) / 3;
    const paksha = (flag[g] > 0 ? pk : 60 - pk) * (g === 'Moon' ? 2 : 1);
    const tribhaga = g === 'Jupiter' || g === tribhagaLord ? 60 : 0;
    const abda = g === abdaLord ? 15 : 0, maasa = g === maasaLord ? 30 : 0, vaara = g === vaaraLord ? 45 : 0, hora = g === horaLord ? 60 : 0;
    // ayana: kranti from a fixed-ayanamsa tropical longitude, BPHS table in minutes
    const x = norm360(L + 23);
    const q = x < 90 ? x : x < 180 ? 180 - x : x < 270 ? x - 180 : 360 - x;
    const k = Math.min(5, trunc(q / 15));
    let kranti = ((q - k * 15) * KRANTI_STEP[k] / 15 + KRANTI_SUM[k]) / 60;
    if (x >= 180) kranti = -kranti;
    kranti *= AYANA_SIGN[i];
    if (g === 'Mercury' && kranti < 0) kranti = -kranti;
    const ayana = (kranti + 24) * 1.25 * (g === 'Sun' ? 2 : 1);
    const yuddha = 0;
    const kaala = natonnata + paksha + tribhaga + abda + maasa + vaara + hora + ayana + yuddha;

    let cheshta: number;
    if (g === 'Sun') cheshta = fold(L + 113) / 3;
    else if (g === 'Moon') cheshta = fold(L - lon('Sun')) / 3;
    else {
      const [a, b] = MEAN[g as keyof typeof MEAN];
      cheshta = fold(meanLon(a) - (meanLon(b) + L) / 2) / 3;
    }
    const naisargika = NAISARGIKA[i];
    let drig = 0;
    for (const q2 of SEVEN) drig += flag[q2] * sphutaDrishti(L - lon(q2), q2, opts.gradedAspects) * 0.6;
    drig *= 0.25;
    const total = sthana + dig + kaala + (i >= 2 ? cheshta : 0) + naisargika + drig;
    const rupas = total / 60;
    const percent = (rupas * 100) / REQUIRED_RUPAS[i];
    const ur = 2 * (1 + uchcha / 10), cr = 2 * (1 + cheshta / 10);
    const subha = (ur / 2 + cr / 2) / 2;
    const ishtaP = ((ur / 2 - 1) + (cr / 2 - 1)) * 5;
    planets[g] = {
      uchcha, saptavargaja: sapta, ojayugma: oja, kendra, drekkana, sthana, dig,
      natonnata, paksha, tribhaga, abda, maasa, vaara, hora, ayana, yuddha, kaala,
      cheshta, naisargika, drig, total, rupas, percent,
      ishta: Math.sqrt(uchcha * cheshta), kashta: Math.sqrt((60 - uchcha) * (60 - cheshta)),
      uchchaRashmi: ur, cheshtaRashmi: cr, subhaRashmi: subha, asubhaRashmi: 8 - subha, ishtaParasara: ishtaP, kashtaParasara: 60 - ishtaP,
    };
  });

  // ---- bhava balas (FUN_004bbd50 tail, FUN_004bccc0, FUN_004bcec0)
  const lagnaDeg = lagna - lagnaSign * 30;
  // sign types: 0 human (strong in 1st), 1 watery (4th), 2 quadruped (10th), 3 insect (7th)
  const type = [2, 2, 0, 1, 2, 0, 0, 3, lagnaDeg >= 15 ? 2 : 0, lagnaDeg >= 15 ? 1 : 2, 0, 1];
  const peakOffset = [6, 9, 3, 0];
  const digTable = [0, 10, 20, 30, 40, 50, 60, 50, 40, 30, 20, 10];
  const bhavas: BhavaBala[] = [];
  for (let hIdx = 0; hIdx < 12; hIdx++) {
    const s = (lagnaSign + hIdx) % 12;
    const lordBala = planets[SIGN_LORD[s] as Seven].total;
    const idx = (((hIdx - peakOffset[type[s]]) % 12) + 12) % 12;
    const dig = digTable[idx];
    let drig = 0;
    for (const q2 of SEVEN) {
      let v = sphutaDrishti(lagna + 30 * hIdx - lon(q2), q2, opts.gradedAspects) * 0.6;
      if (flag[q2] < 1) {
        if (q2 === 'Mercury') drig += v; else drig -= v * 0.25;
      } else {
        if (q2 !== 'Mercury' && q2 !== 'Jupiter') v *= 0.25;
        drig += v;
      }
    }
    const total = lordBala + dig + drig;
    bhavas.push({ lord: lordBala, dig, drig, total, rupas: total / 60 });
  }
  const benefic = Object.fromEntries(SEVEN.map((g) => [g, flag[g] > 0 ? 1 : -1])) as Record<Seven, 1 | -1>;
  return { planets, bhavas, benefic };
}
