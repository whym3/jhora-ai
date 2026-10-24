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
  // last sunrise at or before the moment: search from 1.2 days back and step forward
  let sunrise = nextEvent(swe, jdUt - 1.2, rise, flags, geo);
  for (let i = 0; i < 3; i++) {
    const n = nextEvent(swe, sunrise + 0.01, rise, flags, geo);
    // a moment at sunrise still belongs to the night: JHora treats its sunrise charts (Tajaka/TP
    // "sunrise chart", cast at the computed sunrise) as night births. The rise search only
    // reproduces to a few ms from another starting point, so allow 0.1 s.
    if (n > jdUt - 0.1 / 86400) break;
    sunrise = n;
  }
  const sunset = nextEvent(swe, sunrise + 0.01, set, flags, geo);
  const nextSunrise = nextEvent(swe, sunset + 0.01, rise, flags, geo);
  const prevSunset = nextEvent(swe, sunrise - 1.2, set, flags, geo);
  return {
    sunrise, sunset, nextSunrise, prevSunset,
    isDay: jdUt < sunset,
    ghatis: (jdUt - sunrise) * 60,
  };
}
