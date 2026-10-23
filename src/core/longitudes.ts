// The complete body list of JHora's "Longitudes & Basic Info" table, in its order.
import type { Sweph } from '../sweph';
import { dayFrame, type Geo } from './day';
import { computePositions, norm360, GRAHAS, type Positions } from './positions';
import type { Settings } from './settings';
import type { JhoraIni } from '../settings/generated';
import {
  bhriguBindu, induLagna, lagnaAt, planetPortions, pranapadaLagna, specialLagnas, sphutas, sreeLagna,
  sunUpagrahas, upagrahaMoments, varnada, weekdayOf,
} from './bodies';
import { yogiPoints } from './basics';

export interface NamedBody { name: string; lon: number }

export function allBodies(swe: Sweph, p: Positions, geo: Geo, tzHours: number, settings: Settings, ini: JhoraIni): NamedBody[] {
  const frame = dayFrame(swe, p.jdUt, geo, settings, ini.SunriseDefinition);
  const sunAtRise = computePositions(swe, frame.sunrise, geo, settings).grahas.Sun.lon;
  const sl = specialLagnas(sunAtRise, frame.ghatis);
  const weekday = weekdayOf(frame.sunrise, tzHours);
  const portions = planetPortions(frame, weekday);
  // JHora's defaults (UpagrahaRiseMethod = 1 1 1 1 1 0): Kaala, Mrityu, Artha Prahara,
  // Yama Ghantaka and Mandi rise at the middle of their portion, Gulika at its start.
  // The combo-box meaning of other values is pinned once the dialogs are dumped.
  const m = ini.UpagrahaRiseMethod;
  const mid = (v: number, dflt: number) => (v === dflt ? 0.5 : v === 2 ? 1 : 0);
  const times = upagrahaMoments(portions, {
    kaala: mid(m[0], 1), mrityu: mid(m[1], 1), artha: mid(m[2], 1), yama: mid(m[3], 1),
    gulika: m[4] === 1 ? 0 : m[4] === 2 ? 1 : 0.5,
    mandi: mid(m[5], 0),
  });
  const at = (jd: number) => lagnaAt(swe, jd, geo, settings);
  const gulika = at(times.gulika), mandi = at(times.mandi);
  const su = sunUpagrahas(p.grahas.Sun.lon);
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
