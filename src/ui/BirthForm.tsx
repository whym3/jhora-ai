// Birth data form: JHora's dialog 2005 "Enter Birthdata" (atlas search, date,
// time, zone, place, altitude and "Use LMT instead and ignore the above").
import { useState } from 'react';
import type { BirthData } from '../core/jhd';
import { ATLAS_COUNTRIES, dstInEffect, summerZone, type Place } from '../core/atlas';
import { lmtZone } from '../core/newChart';
import { PlaceSearch } from './PlaceSearch';
import { BIRTH_AMPM_OPTIONS, birthHourFromFields, birthTimeFields, type BirthAmPm } from '../core/format/clock';
import { setIni, useStore } from './state/store';

interface Props { initial: BirthData; onSubmit: (b: BirthData) => void }

const pad = (n: number) => String(n).padStart(2, '0');

function hoursToHms(h: number) {
  const total = Math.round(Math.abs(h) * 3600);
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function parseHms(s: string): number {
  const [h = '0', m = '0', sec = '0'] = s.split(':');
  return Number(h) + Number(m) / 60 + Number(sec) / 3600;
}

/** Degrees as "88 30 00" with an E/W or N/S suffix. */
function toDms(v: number) {
  const t = Math.round(Math.abs(v) * 3600);
  return `${Math.floor(t / 3600)} ${pad(Math.floor((t % 3600) / 60))} ${pad(t % 60)}`;
}

function fromDms(s: string, negative: boolean): number {
  const [d = '0', m = '0', sec = '0'] = s.trim().split(/[\s:°'"]+/);
  const v = Number(d) + Number(m) / 60 + Number(sec) / 3600;
  return negative ? -v : v;
}

export function BirthForm({ initial, onSubmit }: Props) {
  const [date, setDate] = useState(`${String(initial.year).padStart(4, '0')}-${pad(initial.month)}-${pad(initial.day)}`);
  // combo 1080 (am / pm / 0-24 hrs) and the hours shown, from TimeDisplayWithAmPm (FUN_00403d80)
  const ampmPref = useStore((s) => !!s.ini.TimeDisplayWithAmPm);
  const [shown] = useState(() => birthTimeFields(initial.hour, ampmPref));
  const [time, setTime] = useState(hoursToHms(shown.hour));
  const [ampm, setAmPm] = useState<BirthAmPm>(shown.mode);
  const [tz, setTz] = useState(String(initial.tzHours));
  const [lon, setLon] = useState(toDms(initial.lon));
  const [lonDir, setLonDir] = useState(initial.lon < 0 ? 'W' : 'E');
  const [lat, setLat] = useState(toDms(initial.lat));
  const [latDir, setLatDir] = useState(initial.lat < 0 ? 'S' : 'N');
  const [city, setCity] = useState(initial.city);
  const [alt, setAlt] = useState(String(initial.altitudeM));
  const [lmt, setLmt] = useState(false);
  // atlas data of a picked place (zones, region code), written to the .jhd like JHora does
  const [place, setPlace] = useState<Pick<BirthData, 'country' | 'placeCode' | 'standardTz' | 'summerTz' | 'dst'> | null>(null);

  const longitude = () => fromDms(lon, lonDir === 'W');

  /** Fill the place fields from the atlas; the zone follows JHora's DST rules for the entered date and time. */
  const pick = (p: Place) => {
    const [y, m, d] = date.split('-').map(Number);
    const dst = dstInEffect(p, y, m, d, birthHourFromFields(parseHms(time), ampm).hour);
    setCity(p.name);
    setLon(toDms(p.lon)); setLonDir(p.lon < 0 ? 'W' : 'E');
    setLat(toDms(p.lat)); setLatDir(p.lat < 0 ? 'S' : 'N');
    setTz(String(dst ? summerZone(p) : p.tz));
    setAlt(String(p.altitude));
    setPlace({ country: ATLAS_COUNTRIES[p.country]?.[1] ?? '', placeCode: p.country, standardTz: p.tz, summerTz: summerZone(p), dst });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [y, m, d] = date.split('-').map(Number);
    const altitudeM = Number(alt);
    // on OK "0-24 hrs" clears TimeDisplayWithAmPm, am / pm set it (FUN_00403d80)
    const t = birthHourFromFields(parseHms(time), ampm);
    if (t.ampm !== ampmPref) setIni({ TimeDisplayWithAmPm: t.ampm ? 1 : 0 });
    onSubmit({
      ...initial,
      ...(place ?? {}),
      year: y, month: m, day: d,
      hour: t.hour,
      // FUN_00403d80: with "Use LMT" the zone is the longitude's degrees and minutes / 15
      tzHours: lmt ? lmtZone(longitude()) : Number(tz),
      lon: longitude(),
      lat: fromDms(lat, latDir === 'S'),
      city,
      ...(altitudeM !== initial.altitudeM || initial.altitudeGiven !== false ? { altitudeM, altitudeGiven: true } : {}),
    });
  };

  return (
    <form className="birth-form" onSubmit={submit}>
      <PlaceSearch onPick={pick} />
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Time<input value={time} onChange={(e) => setTime(e.target.value)} placeholder="hh:mm:ss" pattern="\d{1,2}:\d{2}(:\d{2})?" required />
        <select aria-label="am / pm" value={ampm} onChange={(e) => setAmPm(Number(e.target.value) as BirthAmPm)}>
          {BIRTH_AMPM_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
        </select></label>
      <label>Time zone (h, east +)
        <input type="number" step="0.0001" value={lmt ? String(+lmtZone(longitude()).toFixed(6)) : tz} disabled={lmt} onChange={(e) => setTz(e.target.value)} required />
      </label>
      <label style={{ flexDirection: 'row', alignItems: 'center' }}>
        <input type="checkbox" checked={lmt} onChange={(e) => setLmt(e.target.checked)} />
        Use LMT instead and ignore the above (useful for old dates)
      </label>
      <label>Place<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" /></label>
      <label>Longitude
        <span className="coord"><input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="deg min sec" required />
          <select value={lonDir} onChange={(e) => setLonDir(e.target.value)}><option>E</option><option>W</option></select></span>
      </label>
      <label>Latitude
        <span className="coord"><input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="deg min sec" required />
          <select value={latDir} onChange={(e) => setLatDir(e.target.value)}><option>N</option><option>S</option></select></span>
      </label>
      <label>Altitude (meters above sea-level)<input type="number" step="any" value={alt} onChange={(e) => setAlt(e.target.value)} required /></label>
      <button type="submit">Cast chart</button>
    </form>
  );
}
