// The Edit menu's dialogs: "Change timezone" (33200, dialog 2052), "User defined special
// point" (33199, dialog 2051), "Planetary Special Lagnas (research)" (33252, dialog 2062)
// and "Chart notes (in notepad)" (32988). Calculations: src/core/displayTz.ts and
// src/core/userPoints.ts; texts and control order from the dialog templates.
import { useState, type ReactNode } from 'react';
import type { JhoraIni } from '../../settings/generated';
import { zoneFields, zoneFromFields } from '../../core/displayTz';
import { SPECIAL_POINT_BODIES, SPECIAL_POINT_BODIES_SANSKRIT, SPECIAL_POINT_SAHAMAS, specialLagnaName } from '../../core/userPoints';
import { getChartNotes, notesFileName, setChartNotes, setIni, updateChart, useStore, type ChartDoc } from '../state/store';

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

function Modal({ title, children, onClose, buttons }: { title: string; children: ReactNode; onClose: () => void; buttons: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal opt-dialog" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>{title}</strong></div>
        <div className="opt-body">{children}</div>
        <div className="opt-buttons">{buttons}</div>
      </div>
    </div>
  );
}

const Select = ({ label, value, items, onChange, disabled }: { label: string; value: number; items: readonly string[]; onChange: (v: number) => void; disabled?: boolean }) => (
  <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
    {items.map((t, i) => <option key={i} value={i}>{t}</option>)}
  </select>
);

/**
 * Edit > Change timezone (FUN_00406d80): combo 1003 "Use the timezone of birth" / "Use the
 * timezone entered below" (shown on the second, as JHora presets it), hours 100, minutes
 * 101, combo 1004 East/West of GMT, prefilled with the zone in use.
 */
export function TimezoneDialog({ doc, onClose }: { doc: ChartDoc; onClose: () => void }) {
  const z = zoneFields(doc.displayTz ?? doc.birth.tzHours);
  const [mode, setMode] = useState(1);
  const [hours, setHours] = useState(z.hours);
  const [minutes, setMinutes] = useState(z.minutes);
  const [west, setWest] = useState(z.west ? 1 : 0);
  const ok = () => {
    updateChart(doc.id, { displayTz: mode === 0 ? null : zoneFromFields(hours, minutes, west === 1) });
    onClose();
  };
  return (
    <Modal title="Enter the time zone to be used" onClose={onClose} buttons={<><button onClick={ok}>OK</button><button onClick={onClose}>Cancel</button></>}>
      <span className="opt-text">{'If the native lives away from birthplace,\nyou may want to use the timezone of\nthe place of residence when displaying\ndates and times in dasas, TP charts etc.'}</span>
      <span className="opt-text">{'Please note that the birthdata is NOT\nchanged. The birthtime is simply converted\nto a different timezone and all calculations\nare converted to the timezone.'}</span>
      <span className="opt-text">This is just for convenience.</span>
      <div className="opt-group">Calculation Display Timezone</div>
      <span className="opt-text">What is the timezone you want to use?</span>
      <Select label="Timezone choice (1003)" value={mode} items={['Use the timezone of birth', 'Use the timezone entered below']} onChange={setMode} />
      <div className="opt-row">
        <span className="opt-text">Time Zone:</span>
        <input type="number" aria-label="Hours (100)" min={0} max={14} value={hours} disabled={mode === 0} onChange={(e) => setHours(Number(e.target.value))} style={{ width: '4em' }} />
        <span>:</span>
        <input type="number" aria-label="Minutes (101)" min={0} max={59} value={minutes} disabled={mode === 0} onChange={(e) => setMinutes(Number(e.target.value))} style={{ width: '4em' }} />
        <Select label="East or West (1004)" value={west} items={['East of GMT', 'West of GMT']} onChange={setWest} disabled={mode === 0} />
      </div>
    </Modal>
  );
}

/** Edit > User defined special point (FUN_004067d0, dialog FUN_004d7ac0 / OnInitDialog FUN_004d7e00). */
export function SpecialPointDialog({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const bodies = ini.SanskritPlanetNames ? SPECIAL_POINT_BODIES_SANSKRIT : SPECIAL_POINT_BODIES;
  const [v, setV] = useState(() => ({
    remove: ini.SpecialPointOn ? 0 : 1, name: ini.SpecialPointName, symbol: ini.SpecialPointSymbol,
    deg: ini.SpecialPointDeg, min: ini.SpecialPointMin, sec: ini.SpecialPointSec, behind: ini.SpecialPointBehindAfter,
    use: ini.SpecialPointUsePlanet === 1 ? 0 : ini.SpecialPointUseSaham === 1 ? 1 : ini.SpecialPointUseRasi === 1 ? 2 : ini.SpecialPointUseMidPoint === 1 ? 3 : -1,
    planet: ini.SpecialPointPlanetIndex, saham: ini.SpecialPointSahamIndex, sign: ini.SpecialPointSignIndex,
    p1: ini.SpecialPointPlanetIndex1, p2: ini.SpecialPointPlanetIndex2,
  }));
  const set = (p: Partial<typeof v>) => setV((s) => ({ ...s, ...p }));
  const ok = () => {
    const patch: Partial<JhoraIni> = {
      SpecialPointOn: v.remove ? 0 : 1, SpecialPointBehindAfter: v.behind,
      SpecialPointUsePlanet: v.use === 0 ? 1 : 0, SpecialPointUseSaham: v.use === 1 ? 1 : 0,
      SpecialPointUseRasi: v.use === 2 ? 1 : 0, SpecialPointUseMidPoint: v.use === 3 ? 1 : 0,
      SpecialPointPlanetIndex: v.planet, SpecialPointSahamIndex: v.saham, SpecialPointSignIndex: v.sign,
      SpecialPointPlanetIndex1: v.p1, SpecialPointPlanetIndex2: v.p2,
      SpecialPointName: v.name.slice(0, 50), SpecialPointSymbol: v.symbol.slice(0, 4),
      SpecialPointDeg: v.deg, SpecialPointMin: v.min, SpecialPointSec: v.sec,
    };
    setIni(patch);
    onClose();
  };
  const radio = (i: number, label: string) => (
    <label className="opt-check"><input type="radio" name="sp-use" checked={v.use === i} onChange={() => set({ use: i })} /><span>{label}</span></label>
  );
  const num = (label: string, value: number, key: 'deg' | 'min' | 'sec') => (
    <input type="number" aria-label={label} value={value} step="any" style={{ width: '5em' }} onChange={(e) => set({ [key]: Number(e.target.value) })} />
  );
  return (
    <Modal title="User defined special point" onClose={onClose} buttons={<><button onClick={ok}>OK</button><button onClick={onClose}>Cancel</button></>}>
      <label className="opt-check"><input type="checkbox" checked={v.remove === 1} onChange={(e) => set({ remove: e.target.checked ? 1 : 0 })} /><span>Remove this special point</span></label>
      <div className="opt-row"><span className="opt-text">In charts, show a special pointed named</span>
        <input aria-label="Name (100)" maxLength={50} value={v.name} onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="opt-row"><span className="opt-text">and denoted by the symbol</span>
        <input aria-label="Symbol (101)" maxLength={4} value={v.symbol} style={{ width: '5em' }} onChange={(e) => set({ symbol: e.target.value })} />
        <span className="opt-text">as defined below:</span></div>
      <div className="opt-row">
        {num('Deg (102)', v.deg, 'deg')}<span>Deg</span>{num('Min (103)', v.min, 'min')}<span>Min</span>{num('Sec (1015)', v.sec, 'sec')}<span>Sec</span>
        <Select label="Behind or ahead (1003)" value={v.behind} items={['behind', 'ahead of']} onChange={(behind) => set({ behind })} />
      </div>
      <div className="opt-row">{radio(0, 'Planet')}<Select label="Body (1004)" value={v.planet} items={bodies} onChange={(planet) => set({ planet })} /></div>
      <div className="opt-row">{radio(1, 'Sahama')}<Select label="Sahama (1005)" value={v.saham} items={SPECIAL_POINT_SAHAMAS} onChange={(saham) => set({ saham })} /></div>
      <div className="opt-row">{radio(2, 'The beginning of')}<Select label="Sign (1006)" value={v.sign} items={SIGNS} onChange={(sign) => set({ sign })} /></div>
      <div className="opt-row">{radio(3, 'Mid-point of')}
        <Select label="First body (1007)" value={v.p1} items={bodies} onChange={(p1) => set({ p1 })} />
        <Select label="Second body (1009)" value={v.p2} items={bodies} onChange={(p2) => set({ p2 })} /></div>
    </Modal>
  );
}

/** Edit > Planetary Special Lagnas (research) (FUN_00406c00, dialog FUN_004d8160, DDX FUN_004d8190). */
export function SpecialLagnaDialog({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const [remove, setRemove] = useState(ini.SpecialLagnaOn ? 0 : 1);
  const [planet, setPlanet] = useState(Math.max(0, ini.SpecialLagnaPlanet - 1));
  const [speed, setSpeed] = useState(Math.max(0, ini.SpecialLagnaSpeedFactor - 1));
  const [reverse, setReverse] = useState(ini.SpecialLagnaNodesReverse ? 1 : 0);
  const ok = () => {
    setIni({
      SpecialLagnaOn: remove ? 0 : 1, SpecialLagnaNodesReverse: reverse, SpecialLagnaPlanet: planet + 1, SpecialLagnaSpeedFactor: speed + 1,
      SpecialLagnaName: specialLagnaName(planet + 1, speed + 1, ini.SanskritPlanetNames !== 0),
    });
    onClose();
  };
  return (
    <Modal title="Special Lagna Research" onClose={onClose} buttons={<><button onClick={ok}>OK</button><button onClick={onClose}>Cancel</button></>}>
      <label className="opt-check"><input type="checkbox" checked={remove === 1} onChange={(e) => setRemove(e.target.checked ? 1 : 0)} /><span>Remove this special lagna</span></label>
      <span className="opt-text">Define a special lagna akin to Hora Lagna and Ghati Lagna. It is at the longitude of the chosen planet when the planet rises in the east. Then it moves with a speed that is n times the average speed of lagna (i.e. 12 x n signs/24 hours).</span>
      <span className="opt-text">If you choose Jupiter and 9, it will be shown as Ju9 in charts. For nodes, it is possible to move lagna in reverse order.</span>
      <div className="opt-row"><span className="opt-text">Planet used</span><Select label="Planet (1003)" value={planet} items={PLANETS} onChange={setPlanet} /></div>
      <div className="opt-row"><span className="opt-text">Speed Fatcor</span><Select label="Speed factor (1004)" value={speed} items={Array.from({ length: 12 }, (_, i) => String(i + 1))} onChange={setSpeed} /></div>
      <label className="opt-check"><input type="checkbox" checked={reverse === 1} onChange={(e) => setReverse(e.target.checked ? 1 : 0)} /><span>Go in reverse for Rahu and Ketu!</span></label>
      <span className="muted">Shown as {specialLagnaName(planet + 1, speed + 1, ini.SanskritPlanetNames !== 0)}</span>
    </Modal>
  );
}

/** Edit > Chart notes (FUN_004e6a70): the chart's own notes file, "<chart>.txt". */
export function ChartNotesDialog({ doc, onClose }: { doc: ChartDoc; onClose: () => void }) {
  const [text, setText] = useState(() => getChartNotes(doc.title));
  const file = notesFileName(doc.title);
  const save = () => { setChartNotes(doc.title, text); onClose(); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text.replace(/\r?\n/g, '\r\n')], { type: 'text/plain' }));
    Object.assign(document.createElement('a'), { href: url, download: file }).click();
    URL.revokeObjectURL(url);
  };
  const load = async (f: File) => setText((await f.text()).replace(/\r\n/g, '\n'));
  return (
    <Modal title={`${file} - Chart notes`} onClose={onClose} buttons={<>
      <button onClick={save}>Save</button>
      <button onClick={download}>Save as {file}</button>
      <label className="file">Open .txt<input type="file" accept=".txt" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} /></label>
      <button onClick={onClose}>Cancel</button>
    </>}>
      <textarea aria-label="Chart notes" className="notes-text" rows={18} value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

/** JHora's message when a chart without a file asks for notes (0x591364 / 0x5913a4). */
export const NOTES_NEED_SAVE = 'You can enter notes only after saving the file. First save it.';
