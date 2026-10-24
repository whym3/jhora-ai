// Sunrise, sunset and the day/night frame of a chart, as jhora.exe computes them
// (FUN_004a1350): swe_rise_trans with the chart's own calculation flags (so
// TruePositions affects rise times) and the SunriseDefinition option.
import { SE, type Sweph } from '../sweph';
import type { Settings } from './settings';
import { calcFlags } from './positions';

export type SunriseDefinition = 0 | 1 | 2 | 3;

/** Bits JHora adds to the rise/set request for each SunriseDefinition value. */
export function sunriseBits(def: number): number {
  switch (def) {
    case 0: return SE.BIT_DISC_CENTER | SE.BIT_NO_REFRACTION; // centre of disc, no refraction (default)
    case 1: return SE.BIT_NO_REFRACTION;                     // upper limb, no refraction
    case 3: return SE.BIT_DISC_CENTER;                       // centre of disc with refraction
    default: return 0;                                       // upper limb with refraction
  }
}

export interface DayFrame {
  /** sunrise before the birth moment (JD UT) */
  sunrise: number;
  /** sunset after that sunrise */
  sunset: number;
  /** sunrise following that sunset */
  nextSunrise: number;
  /** sunset before `sunrise` (for the night preceding the day) */
  prevSunset: number;
  /** birth is between sunrise and sunset */
  isDay: boolean;
  /** ghatis elapsed since `sunrise` (1 day = 60 ghatis) */
  ghatis: number;
}

export interface Geo { lon: number; lat: number; alt: number }

function nextEvent(swe: Sweph, from: number, rsmi: number, flags: number, geo: Geo): number {
  const t = swe.riseTrans(from, SE.SUN, rsmi, flags, geo, 0, 0);
  if (t === null) throw new Error('sun does not rise/set at this latitude');
  return t;
}

/** The day frame around a UT Julian day. */
export function dayFrame(swe: Sweph, jdUt: number, geo: Geo, settings: Settings, sunriseDef = 0): DayFrame {
  const flags = calcFlags(settings);
  const bits = sunriseBits(sunriseDef);
  const rise = SE.CALC_RISE | bits;
  const set = SE.CALC_SET | bits;
  // FUN_004a1350's order: the sunrise after the moment, the sunrise found from 1.5 days
  // before that, then sunset from that sunrise. The rise search lands on one of two
  // results ~14 ms apart depending on where it starts, so the start points matter.
  const nextSunrise = nextEvent(swe, jdUt, rise, flags, geo);
  const sunrise = nextEvent(swe, nextSunrise - 1.5, rise, flags, geo);
  const sunset = nextEvent(swe, sunrise, set, flags, geo);
  const prevSunset = nextEvent(swe, sunrise - 1.2, set, flags, geo);
  return {
    sunrise, sunset, nextSunrise, prevSunset,
    isDay: jdUt < sunset,
    ghatis: (jdUt - sunrise) * 60,
  };
}
