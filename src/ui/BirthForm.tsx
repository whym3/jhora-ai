import { useState } from 'react';
import type { BirthData } from '../core/jhd';

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
  const [time, setTime] = useState(hoursToHms(initial.hour));
  const [tz, setTz] = useState(String(initial.tzHours));
  const [lon, setLon] = useState(toDms(initial.lon));
  const [lonDir, setLonDir] = useState(initial.lon < 0 ? 'W' : 'E');
  const [lat, setLat] = useState(toDms(initial.lat));
  const [latDir, setLatDir] = useState(initial.lat < 0 ? 'S' : 'N');
  const [city, setCity] = useState(initial.city);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [y, m, d] = date.split('-').map(Number);
    onSubmit({
      ...initial,
      year: y, month: m, day: d,
      hour: parseHms(time),
      tzHours: Number(tz),
      lon: fromDms(lon, lonDir === 'W'),
      lat: fromDms(lat, latDir === 'S'),
      city,
    });
  };

  return (
    <form className="birth-form" onSubmit={submit}>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label>Time<input value={time} onChange={(e) => setTime(e.target.value)} placeholder="hh:mm:ss" pattern="\d{1,2}:\d{2}(:\d{2})?" required /></label>
      <label>Time zone (h, east +)<input type="number" step="0.0001" value={tz} onChange={(e) => setTz(e.target.value)} required /></label>
      <label>Place<input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" /></label>
      <label>Longitude
        <span className="coord"><input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="deg min sec" required />
          <select value={lonDir} onChange={(e) => setLonDir(e.target.value)}><option>E</option><option>W</option></select></span>
      </label>
      <label>Latitude
        <span className="coord"><input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="deg min sec" required />
          <select value={latDir} onChange={(e) => setLatDir(e.target.value)}><option>N</option><option>S</option></select></span>
      </label>
      <button type="submit">Cast chart</button>
    </form>
  );
}
