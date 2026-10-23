// Special lagnas, upagrahas and sphutas: the extra bodies of JHora's
// "Longitudes & Basic Info" table that derive from the planets, the lagna and
// the day frame (sunrise/sunset).
import type { Sweph } from '../sweph';
import type { DayFrame, Geo } from './day';
import { ALL_VARGAS, vargaLongitude } from './vargas';
import { norm360, type Graha, type Positions } from './positions';
import { signLord } from './lords';
import { nakshatraOf, signOf } from './zodiac';
import type { Settings } from './settings';
import { computePositions } from './positions';

const NAK_SPAN = 360 / 27;

// ---- Special lagnas --------------------------------------------------------
/**
 * Bhava, Hora and Ghati lagnas start at the Sun's longitude at sunrise and move
 * one sign per 5, 2.5 and 1 ghati respectively; the vighati lagna one sign per vighati.
 */
export function specialLagnas(sunAtSunrise: number, ghatis: number) {
  return {
    bhavaLagna: norm360(sunAtSunrise + ghatis * 6),
    horaLagna: norm360(sunAtSunrise + ghatis * 12),
    ghatiLagna: norm360(sunAtSunrise + ghatis * 30),
    vighatiLagna: norm360(sunAtSunrise + ghatis * 120),   // JHora: 4 signs per ghati
  };
}

/** Varnada of a longitude (Jaimini): counted from Aries or Pisces by the parity of the sign. */
export function varnada(lagna: number, horaLagna: number): number {
  const l = signOf(lagna), h = signOf(horaLagna);
  const lOdd = l % 2 === 0, hOdd = h % 2 === 0;
  // count from Aries forward for odd signs, from Pisces backward for even signs
  const lc = lOdd ? l + 1 : 12 - l;
  const hc = hOdd ? h + 1 : 12 - h;
  const n = lOdd === hOdd ? ((lc + hc - 1) % 12) + 1 : ((Math.abs(lc - hc) + 11) % 12) + 1;
  const sign = lOdd ? n - 1 : (12 - n) % 12;
  return sign * 30 + (lagna % 30);
}

/** Sree lagna: Moon's nakshatra fraction, applied to the lagna, times 360. */
export function sreeLagna(lagna: number, moon: number): number {
  const frac = (moon % NAK_SPAN) / NAK_SPAN;
  return norm360(lagna + frac * 360);
}

/**
 * Pranapada lagna (BPHS): the time since sunrise at one sign per 15 vighatis
 * (120 degrees per ghati), added to the Sun for movable signs, to the 9th from
 * the Sun for fixed signs and to the 5th for dual signs.
 */
export function pranapadaLagna(sunAtBirth: number, ghatisSinceSunrise: number): number {
  const base = norm360(ghatisSinceSunrise * 120);
  const s = signOf(sunAtBirth);
  const offset = s % 3 === 0 ? 0 : s % 3 === 1 ? 240 : 120; // movable: from Sun; fixed: 9th; dual: 5th
  return norm360(sunAtBirth + offset + base);
}

/** Indu lagna: from the 9th-lord kalas of lagna and Moon. */
const KALAS: Record<Graha, number> = { Sun: 30, Moon: 16, Mars: 6, Mercury: 8, Jupiter: 10, Venus: 12, Saturn: 1, Rahu: 0, Ketu: 0 };
export function induLagna(lagna: number, moon: number): number {
  const l9 = signLord((signOf(lagna) + 8) % 12);
  const m9 = signLord((signOf(moon) + 8) % 12);
  const sum = (KALAS[l9] + KALAS[m9]) % 12;
  const count = sum === 0 ? 12 : sum;
  return norm360(signOf(moon) * 30 + (count - 1) * 30 + (moon % 30));
}

/** Bhrigu bindu: midpoint of Moon and Rahu (the one closer to Rahu's forward arc is JHora's convention; matched by tests). */
export function bhriguBindu(moon: number, rahu: number): number {
  const d = norm360(moon - rahu);
  return norm360(rahu + d / 2);
}

// ---- Upagrahas -------------------------------------------------------------
/** Sun-based upagrahas (JHora's Dhuma family, VyatipataMethod=0). */
export function sunUpagrahas(sun: number) {
  const dhuma = norm360(sun + 133 + 20 / 60);
  const vyatipata = norm360(360 - dhuma);
  const parivesha = norm360(vyatipata + 180);
  const indraChapa = norm360(360 - parivesha);
  const upaketu = norm360(indraChapa + 16 + 40 / 60);
  return { dhuma, vyatipata, parivesha, indraChapa, upaketu };
}

/** Weekday (0 = Sunday) of the day that starts at `sunrise`, per JHora's WeekdayDefinition=0 (sunrise to sunrise). */
export function weekdayOf(sunriseJdUt: number, tzHours: number): number {
  // JD 0 = Monday noon; a civil day index from local noon-based JD
  const local = sunriseJdUt + tzHours / 24;
  return (Math.floor(local + 1.5) % 7 + 7) % 7; // 0 Sunday
}

/**
 * Portions of the day/night ruled by the planets, for Kaala (Sun), Mrityu (Mars),
 * Artha Prahara (Mercury), Yama Ghantaka (Jupiter), Gulika/Mandi (Saturn).
 * The day (sunrise to sunset) or night is divided into 8 equal parts. JHora
 * assigns them from the 8-cycle Su Mo Ma Me Ju Ve Sa (lordless), starting at the
 * weekday lord by day and at the 5th lord from it by night - so the lordless
 * part follows Saturn's rather than always coming last (verified on 18 charts).
 */
export const WEEKDAY_LORDS: Graha[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
const CYCLE8: (Graha | null)[] = [...WEEKDAY_LORDS, null];

export interface Portion { start: number; end: number; lord: Graha | null }

export function planetPortions(frame: DayFrame, weekday: number): Portion[] {
  const isDay = frame.isDay;
  const [start, end] = isDay ? [frame.sunrise, frame.sunset] : [frame.sunset, frame.nextSunrise];
  const first = isDay ? weekday : (weekday + 4) % 7;
  const len = (end - start) / 8;
  return Array.from({ length: 8 }, (_, i) => ({
    start: start + i * len,
    end: start + (i + 1) * len,
    lord: CYCLE8[(first + i) % 8],
  }));
}

/** Longitude rising at a moment: the tropical ascendant minus the chart's mean ayanamsa. */
export function lagnaAt(swe: Sweph, jdUt: number, geo: Geo, settings: Settings): number {
  return computePositions(swe, jdUt, geo, settings).ascendant;
}

export interface UpagrahaTimes { kaala: number; mrityu: number; arthaPrahara: number; yamaGhantaka: number; gulika: number; mandi: number }

/**
 * Rise moments (JD UT) of the planet-portion upagrahas. `riseAt` selects the
 * point of a portion (0 start, 0.5 middle, 1 end) per UpagrahaRiseMethod;
 * JHora's defaults: Kaala/Mrityu/Artha/Yama at the start, Gulika at the start,
 * Mandi at the middle of Saturn's portion.
 */
export function upagrahaMoments(portions: Portion[], riseAt: { kaala: number; mrityu: number; artha: number; yama: number; gulika: number; mandi: number }): UpagrahaTimes {
  const of = (lord: Graha, f: number) => {
    const p = portions.find((x) => x.lord === lord)!;
    return p.start + f * (p.end - p.start);
  };
  return {
    kaala: of('Sun', riseAt.kaala), mrityu: of('Mars', riseAt.mrityu), arthaPrahara: of('Mercury', riseAt.artha),
    yamaGhantaka: of('Jupiter', riseAt.yama), gulika: of('Saturn', riseAt.gulika), mandi: of('Saturn', riseAt.mandi),
  };
}

// ---- Sphutas --------------------------------------------------------------
export function sphutas(p: Positions, gulika: number, mandi: number) {
  const lagna = p.ascendant, moon = p.grahas.Moon.lon, sun = p.grahas.Sun.lon, rahu = p.grahas.Rahu.lon;
  const prana = norm360(lagna * 5 + gulika);
  const deha = norm360(moon * 8 + gulika);
  const mrityu = norm360(gulika * 7 + sun);
  const sookshmaTri = norm360(prana + deha + mrityu);
  const tri = norm360(lagna + moon + gulika);
  const chatus = norm360(tri + sun);
  const pancha = norm360(chatus + rahu);
  const tithi = norm360(moon - sun);
  const yoga = norm360(moon + sun);
  const rahuTithi = norm360(rahu - sun);
  const kshetra = norm360(moon + p.grahas.Mars.lon + p.grahas.Jupiter.lon);   // female fertility point
  const beeja = norm360(sun + p.grahas.Venus.lon + p.grahas.Jupiter.lon);      // male fertility point
  void mandi;
  return { prana, deha, mrityu, sookshmaTri, tri, chatus, pancha, tithi, yoga, rahuTithi, kshetra, beeja };
}

export { ALL_VARGAS, vargaLongitude, nakshatraOf };
