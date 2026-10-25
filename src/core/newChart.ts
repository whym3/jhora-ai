// File > New (command 57600), "Set Current Location as Default" (32934) and the
// LMT option of the birth data dialog (2005), after jhora.exe:
//
// * FUN_00402bc0 (the document's OnNewDocument): the chart gets the default
//   location (DefaultLongitude/Latitude/Altitude, the standard and summer zones,
//   DefaultLocationCountryCode and the city/country names) and the date and time
//   from FUN_00407150: gmtime(time()) moved into DefaultTimeZone, or into
//   DefaultSummerTimeZone when the place's DST rule (FUN_004aaa10) is in effect.
// * FUN_004df6c0: the open chart's longitude, latitude, both zones, country code,
//   names and altitude become the defaults, confirmed by a message box.
// * FUN_00403d80 (after dialog 2005 returns): "Use LMT instead" sets the zone to
//   the longitude's degrees and minutes / 15; the arcseconds are ignored.
//
// JHora's ini stores longitudes and zones west-positive (South Grafton, MA is
// DefaultLongitude=71.686111, DefaultTimeZone=5); BirthData is east-positive.
import { ATLAS_COUNTRIES, dstInEffect, type Place } from './atlas';
import type { BirthData } from './jhd';
import type { JhoraIni } from '../settings/generated';

const DEFAULT_PRESSURE = 1013.25;
const DEFAULT_TEMPERATURE = 20;

const iniName = (s: string) => s.replace(/\^/g, ' ');
const toIniName = (s: string) => (s || 'Unknown').replace(/ /g, '^');

/** The default place as an atlas entry (zones east-positive). */
function defaultPlace(ini: JhoraIni): Place {
  return {
    country: ini.DefaultLocationCountryCode,
    name: iniName(ini.DefaultLocationCityName),
    lat: ini.DefaultLatitude,
    lon: -ini.DefaultLongitude,
    tz: -ini.DefaultTimeZone,
    tzDst: -ini.DefaultSummerTimeZone,
    altitude: ini.DefaultAltitude,
  };
}

/** Birth data of a new chart: now, at the default location. */
export function newChartBirth(ini: JhoraIni, now: Date = new Date()): BirthData {
  const place = defaultPlace(ini);
  // whole seconds of UTC, as gmtime gives them
  const utSec = Math.floor(now.getTime() / 1000);
  const at = (tz: number) => {
    const d = new Date((utSec + Math.round(tz * 3600)) * 1000);
    return {
      year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
      hour: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600,
    };
  };
  const std = at(place.tz);
  const known = place.country >= 0 && place.country < ATLAS_COUNTRIES.length;
  const dst = known && dstInEffect(place, std.year, std.month, std.day, std.hour);
  const tz = dst ? place.tzDst : place.tz;
  return {
    ...at(tz),
    tzHours: tz,
    lon: place.lon,
    lat: place.lat,
    altitudeM: place.altitude,
    altitudeGiven: true,
    pressureMbar: DEFAULT_PRESSURE,
    temperatureC: DEFAULT_TEMPERATURE,
    city: place.name,
    country: iniName(ini.DefaultLocationCountryName),
    placeCode: ini.DefaultLocationCountryCode,
    standardTz: place.tz,
    summerTz: place.tzDst,
    dst,
    field15: 1,
    field18: 0,
    legacy: null,
  };
}

/** The ini keys "Set Current Location as Default" writes from a chart. */
export function defaultLocationFromChart(b: BirthData): Partial<JhoraIni> {
  return {
    DefaultLongitude: -b.lon,
    DefaultLatitude: b.lat,
    DefaultAltitude: b.altitudeM,
    DefaultTimeZone: -(b.standardTz ?? b.tzHours),
    DefaultSummerTimeZone: -(b.summerTz ?? b.standardTz ?? b.tzHours),
    DefaultLocationCountryCode: b.placeCode ?? 0,
    DefaultLocationCityName: toIniName(b.city),
    DefaultLocationCountryName: toIniName(b.country),
  };
}

const dms = (v: number) => {
  const t = Math.round(Math.abs(v) * 3600);
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60];
};

/** FUN_004df6c0's confirmation text. */
export function defaultLocationMessage(ini: Partial<JhoraIni>): string {
  const lon = ini.DefaultLongitude ?? 0, lat = ini.DefaultLatitude ?? 0;
  const [lod, lom, los] = dms(lon), [lad, lam, las] = dms(lat);
  const zone = (z: number) => {
    const [h, m] = dms(z);
    return `${h}:${String(m).padStart(2, '0')} (${z >= 0 ? 'West' : 'East'} of GMT)`;
  };
  return [
    'Current chart location was set as the default location.',
    'It will be used when new charts are cast.',
    '',
    `${iniName(ini.DefaultLocationCityName ?? '')}, ${iniName(ini.DefaultLocationCountryName ?? '')}`,
    '',
    `Longitude: ${lod} ${lon >= 0 ? 'W' : 'E'} ${lom}' ${los}"`,
    `Latitude: ${lad} ${lat >= 0 ? 'N' : 'S'} ${lam}' ${las}"`,
    `Altitude: ${Math.trunc(ini.DefaultAltitude ?? 0)} meters above sea level`,
    `Standard Timezone: ${zone(ini.DefaultTimeZone ?? 0)}`,
    `Summer Timezone: ${zone(ini.DefaultSummerTimeZone ?? 0)}`,
  ].join('\n');
}

/** Dialog 2005's "Use LMT instead": hours east of UTC from the longitude's whole degrees and minutes. */
export function lmtZone(lon: number): number {
  const [deg, min] = dms(lon);
  return (lon < 0 ? -1 : 1) * (deg + min * 0.016666666666666666) * 0.06666666666666667;
}
