// Preferences > Ayanamsa (command 32993): JHora's dialog 155 "Select Ayanamsa" and
// its "Customize further" dialog 2074 "Fixed Star Based Custom Ayanamsa", writing
// the same jhora.ini keys (UserSelectedAyanamsa, DeltaFromUserSelectedAyanamsa,
// SiderealNaksharasInTropical, CustomStarCode, CustomStarLongitude,
// FixedPlaneInCustomStarAyanamsa). The modes are computed in src/core/positions.ts.
import { useEffect, useState } from 'react';
import { AYANAMSA_CHOICES } from '../core/settings';
import { SIGN_NAMES } from '../core/zodiac';
import type { JhoraIni } from '../settings/generated';
import { setIni, useStore } from './state/store';

const CUSTOM = 19;

/** Stars of JHora's catalogue (our converted sefstars.txt) as CustomStarCode values. */
async function loadStars(): Promise<{ code: string; label: string }[]> {
  const text = (await import('../core/data/sefstars.txt?raw')).default as string;
  return text.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
    const [name, code] = l.split(',');
    const nomen = code.replace(/^JH/, '');
    return { code: `,${nomen}`, label: name ? `${name.replace(/^JHora/, '')} (${nomen})` : nomen };
  });
}

function splitDms(v: number) {
  const t = Math.round(Math.abs(v) * 3600);
  return { d: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

function Dms({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const { d, m, s } = splitDms(value);
  const set = (dd: number, mm: number, ss: number) => onChange(dd + mm / 60 + ss / 3600);
  const n = (x: string) => Math.max(0, Math.trunc(Number(x) || 0));
  return (
    <span className="dms">
      <input aria-label={`${label} degrees`} type="number" min={0} value={d} onChange={(e) => set(n(e.target.value), m, s)} style={{ width: '4.5em' }} /> Deg{' '}
      <input aria-label={`${label} minutes`} type="number" min={0} max={59} value={m} onChange={(e) => set(d, n(e.target.value), s)} style={{ width: '4em' }} /> Min{' '}
      <input aria-label={`${label} seconds`} type="number" min={0} max={59} value={s} onChange={(e) => set(d, m, n(e.target.value))} style={{ width: '4em' }} /> Sec
    </span>
  );
}

export function AyanamsaDialog({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const set = (patch: Partial<JhoraIni>) => setIni(patch);
  const index = ini.UserSelectedAyanamsa;
  const delta = ini.DeltaFromUserSelectedAyanamsa;
  const [custom, setCustom] = useState(false);
  const [stars, setStars] = useState<{ code: string; label: string }[]>([]);
  useEffect(() => { if (custom && !stars.length) loadStars().then(setStars); }, [custom, stars.length]);
  const starLon = ini.CustomStarLongitude;
  const sign = Math.floor((((starLon % 360) + 360) % 360) / 30);

  return (
    <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="modal prefs" role="dialog" aria-label="Select Ayanamsa" onClick={(e) => e.stopPropagation()}>
        <div className="note-bar">
          <strong>Select Ayanamsa</strong>
          <span className="toolbar"><button onClick={onClose}>Close</button></span>
        </div>
        <p>Select the ayanamsa you want to be used in calculations</p>
        <p>
          <select aria-label="Ayanamsa" value={index} onChange={(e) => set({ UserSelectedAyanamsa: Number(e.target.value) })}>
            {AYANAMSA_CHOICES.map((c) => <option key={c.index} value={c.index}>{c.label}</option>)}
          </select>{' '}
          <button onClick={() => setCustom(true)} disabled={index !== CUSTOM}>Customize further…</button>
        </p>
        <p>
          <label><input type="checkbox" checked={delta !== 0} onChange={(e) => set({ DeltaFromUserSelectedAyanamsa: e.target.checked ? 1 / 3600 : 0 })} />{' '}
            Apply the correction specified below to the ayanamsa selected above</label>
        </p>
        {delta !== 0 && (
          <p>
            <select aria-label="Add or subtract" value={delta < 0 ? 'sub' : 'add'}
              onChange={(e) => set({ DeltaFromUserSelectedAyanamsa: (e.target.value === 'sub' ? -1 : 1) * Math.abs(delta) })}>
              <option value="add">Add</option><option value="sub">Subtract</option>
            </select>{' '}
            the amount below to/from the ayanamsa chosen above:{' '}
            <Dms label="Correction" value={Math.abs(delta)} onChange={(v) => set({ DeltaFromUserSelectedAyanamsa: (delta < 0 ? -1 : 1) * v })} />
          </p>
        )}
        <p>
          <label><input type="checkbox" checked={ini.SiderealNaksharasInTropical !== 0}
            onChange={(e) => set({ SiderealNaksharasInTropical: e.target.checked ? 1 : 0 })} />{' '}
            Use sidereal zodiac for nakshatras and nakshatra dasas when using tropical zodiac. Fix Spica star in the middle of Chitra nakshatra.</label>
        </p>
        {custom && index === CUSTOM && (
          <fieldset>
            <legend>Fixed Star Based Custom Ayanamsa</legend>
            <p>Select the fixed star to be used:{' '}
              <select aria-label="Fixed star" value={ini.CustomStarCode} onChange={(e) => set({ CustomStarCode: e.target.value })}>
                {!stars.some((s) => s.code === ini.CustomStarCode) && <option value={ini.CustomStarCode}>{ini.CustomStarCode}</option>}
                {stars.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </p>
            <p>Fix this star at the following longitude always:{' '}
              <Dms label="Star longitude" value={starLon - sign * 30} onChange={(v) => set({ CustomStarLongitude: sign * 30 + Math.min(v, 30 - 1 / 3600) })} />{' '}
              from the beginning of the following sign:{' '}
              <select aria-label="Star sign" value={sign} onChange={(e) => set({ CustomStarLongitude: Number(e.target.value) * 30 + (starLon - sign * 30) })}>
                {SIGN_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
              </select>
            </p>
            <p>
              <label><input type="checkbox" checked={ini.FixedPlaneInCustomStarAyanamsa !== 0}
                onChange={(e) => set({ FixedPlaneInCustomStarAyanamsa: e.target.checked ? 1 : 0 })} />{' '}
                Use a FIXED mean solar rotation plane instead of the fluctuating ecliptic plane.</label>
            </p>
            <button onClick={() => setCustom(false)}>OK</button>
          </fieldset>
        )}
      </div>
    </div>
  );
}
