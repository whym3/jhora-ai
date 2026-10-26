// The complete body list of JHora's "Longitudes & Basic Info" table, in its order.
//
// Calculation options read here (jhora.exe):
// * ContinuousSpecialLagnas (0x8a4c45, dialog 2027 "Use the alternative special lagna
//   definition giving continuity"; FUN_004a2420): bhava, hora, ghati and vighati lagnas
//   start from the Sun's longitude at the moment instead of at sunrise.
// * MandiInSaturnPortion / GulikaInSaturnPortion (0x585ee4 / 0x585ee5, FUN_004a27e0):
//   0 puts Mandi / Gulika in the 8th, lordless portion instead of Saturn's.
// * UpagrahaDayDefinition (0x897068, FUN_004a27e0): 1 divides the 6:00 - 18:00 local
//   mean time day and night (FUN_004a1350's second frame, chart+0xdba0) instead of
//   sunrise - sunset; the weekday stays the sunrise one.
// * VyatipataMethod (0x897020, FUN_004a2670): the Dhuma family, see sunUpagrahas.
import type { Sweph } from '../sweph';
import { dayFrame, type DayFrame, type Geo } from './day';
import { computePositions, norm360, GRAHAS, type Positions } from './positions';
import type { Settings } from './settings';
import type { JhoraIni } from '../settings/generated';
import {
  bhriguBindu, induLagna, lagnaAt, planetPortions, pranapadaLagna, specialLagnas, sphutas, sreeLagna,
  sunUpagrahas, upagrahaMoments, varnada, weekdayOf,
} from './bodies';
import { yogiPoints } from './basics';

export interface NamedBody { name: string; lon: number }

export function allBodies(swe: Sweph, p: Positions, geo: Geo, tzHours: number, settings: Settings, ini: JhoraIni, frame?: DayFrame): NamedBody[] {
  frame ??= dayFrame(swe, p.jdUt, geo, settings, ini.SunriseDefinition);
  const sunAtRise = computePositions(swe, frame.sunrise, geo, settings).grahas.Sun.lon;
  const sl = specialLagnas(ini.ContinuousSpecialLagnas ? p.grahas.Sun.lon : sunAtRise, frame.ghatis);
  const weekday = weekdayOf(frame.sunrise, tzHours);
  const portions = planetPortions(ini.UpagrahaDayDefinition ? lmtDayFrame(swe, p.jdUt, tzHours, geo.lon) : frame, weekday);
  // UpagrahaRiseMethod (DAT_00585ecc, 6 slots) as dialog 170 edits it (FUN_00405e00,
  // DDX FUN_004d85b0): combo items 0 beginning, 1 middle, 2 end; slots 0..3 Kaala,
  // Mrityu, Artha Prahara, Yama Ghantaka (combo 1012 writes all four), slot 4 Mandi
  // (combo 1011), slot 5 Gulika (combo 1010). Defaults 1 1 1 1 1 0: Mandi in the middle
  // of its portion, Gulika at its start.
  const m = ini.UpagrahaRiseMethod;
  const point = (v: number) => (v === 2 ? 1 : v === 1 ? 0.5 : 0);
  const times = upagrahaMoments(portions, {
    kaala: point(m[0]), mrityu: point(m[1]), artha: point(m[2]), yama: point(m[3]),
    mandi: point(m[4]),
    gulika: point(m[5]),
  });
  // the 8th portion (no lord) when Mandi / Gulika are not in Saturn's
  const eighth = portions.find((x) => x.lord === null)!;
  if (ini.MandiInSaturnPortion === 0) times.mandi = eighth.start + point(m[4]) * (eighth.end - eighth.start);
  if (ini.GulikaInSaturnPortion === 0) times.gulika = eighth.start + point(m[5]) * (eighth.end - eighth.start);
  const at = (jd: number) => lagnaAt(swe, jd, geo, settings);
  const gulika = at(times.gulika), mandi = at(times.mandi);
  const su = sunUpagrahas(p.grahas.Sun.lon, ini.VyatipataMethod);
  const sp = sphutas(p, gulika, mandi);
  const yg = yogiPoints(p);
  const out: NamedBody[] = [
    { name: 'Lagna', lon: p.ascendant },
    ...GRAHAS.map((g) => ({ name: g, lon: p.grahas[g].lon })),
    { name: 'Maandi', lon: mandi },
    { name: 'Gulika', lon: gulika },
    { name: 'Bhava Lagna', lon: sl.bhavaLagna },
    { name: 'Hora Lagna', lon: sl.horaLagna },
    { name: 'Ghati Lagna', lon: sl.ghatiLagna },
    { name: 'Vighati Lagna', lon: sl.vighatiLagna },
    { name: 'Varnada Lagna', lon: varnada(p.ascendant, sl.horaLagna) },
    { name: 'Sree Lagna', lon: sreeLagna(p.ascendant, p.grahas.Moon.lon) },
    { name: 'Pranapada Lagna', lon: pranapadaLagna(p.grahas.Sun.lon, frame.ghatis) },
    { name: 'Indu Lagna', lon: induLagna(p.ascendant, p.grahas.Moon.lon) },
    { name: 'Bhrigu Bindu', lon: bhriguBindu(p.grahas.Moon.lon, p.grahas.Rahu.lon) },
    { name: 'Dhooma', lon: su.dhuma },
    { name: 'Vyatipata', lon: su.vyatipata },
    { name: 'Parivesha', lon: su.parivesha },
    { name: 'Indra Chapa', lon: su.indraChapa },
    { name: 'Upaketu', lon: su.upaketu },
    { name: 'Kaala', lon: at(times.kaala) },
    { name: 'Mrityu', lon: at(times.mrityu) },
    { name: 'Artha Prahara', lon: at(times.arthaPrahara) },
    { name: 'Yama Ghantaka', lon: at(times.yamaGhantaka) },
    { name: 'Prana Sphuta', lon: sp.prana },
    { name: 'Deha Sphuta', lon: sp.deha },
    { name: 'Mrityu Sphuta', lon: sp.mrityu },
    { name: 'Sookshma TriSphuta', lon: sp.sookshmaTri },
    { name: 'Tithi Sphuta', lon: sp.tithi },
    { name: 'Yoga Sphuta (Sun-Moon)', lon: sp.yoga },
    { name: 'Rahu Tithi Sphuta', lon: sp.rahuTithi },
    { name: 'Kshetra Sphuta', lon: sp.kshetra },
    { name: 'Beeja Sphuta', lon: sp.beeja },
    { name: 'TriSphuta', lon: sp.tri },
    { name: 'ChatusSphuta', lon: sp.chatus },
    { name: 'PanchaSphuta', lon: sp.pancha },
  ];
  // Varnada of the n-th house: both the lagna and the hora lagna are moved to the n-th house.
  for (let h = 2; h <= 12; h++) {
    out.push({ name: `V${h}`, lon: varnada(norm360(p.ascendant + 30 * (h - 1)), norm360(sl.horaLagna + 30 * (h - 1))) });
  }
  out.push({ name: 'Kunda', lon: norm360(p.ascendant * 81) });
  out.push({ name: 'Yoga Sphuta', lon: yg.yogaSphuta });
  out.push({ name: 'Avayoga Sphuta', lon: yg.avayogaSphuta });
  return out;
}

/**
 * FUN_004a1350's second day frame (chart+0xdba0..0xdbc8): "sunrise" at 6:00 local mean
 * time of the birth's (or, before that, the previous) civil day, sunset 12 hours later.
 */
export function lmtDayFrame(swe: Sweph, jdUt: number, tzHours: number, lonEast: number): DayFrame {
  const t = 6 + tzHours - lonEast / 15;
  const local = swe.revjul(jdUt + tzHours / 24);
  const day = local.hour < t ? swe.revjul(jdUt + tzHours / 24 - 1) : local;
  const start = swe.julday(day.year, day.month, day.day, t - tzHours);
  return { sunrise: start, sunset: start + 0.5, nextSunrise: start + 1, prevSunset: start - 0.5, isDay: jdUt < start + 0.5, ghatis: (jdUt - start) * 60 };
}
