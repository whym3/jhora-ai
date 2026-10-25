// Varga options: JHora's chart right-click "Choose hora / drekkana / ..." submenus
// (menu 103), dialog 152 "Divisional Chart Calculation Options" and the research
// charts' dialogs 2073 (custom D-n) and 2071 (D-m x n), as one compact dialog that
// writes the same jhora.ini keys (src/core/vargaOptions.ts).
import { DEFAULTS, type JhoraIni } from '../settings/generated';
import {
  CUSTOM_BASES, CUSTOM_STARTS, DM_COUNT, DMDN_NAMES, DN_COUNT, VARGA_CHOICES, VARGA_INI_KEYS, vargaColumnLabel,
  vargaOptionsFromIni, type VargaIni,
} from '../core/vargaOptions';
import { setIni, useStore } from './state/store';

const set = (patch: Record<string, number>) => setIni(patch as Partial<JhoraIni>);

export function VargaOptions({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini) as VargaIni;
  const o = vargaOptionsFromIni(ini);
  const c = o.custom;
  const reset = () => set({ ...Object.fromEntries(VARGA_INI_KEYS.map((k) => [k, DEFAULTS[k]])), D81Preference: 0 });
  return (
    <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="modal prefs" role="dialog" aria-label="Varga options" onClick={(e) => e.stopPropagation()}>
        <div className="note-bar">
          <strong>Divisional chart options</strong>
          <span className="toolbar">
            <button onClick={reset}>JHora defaults</button>
            <button onClick={onClose}>Close</button>
          </span>
        </div>
        <table className="prefs-table">
          <thead><tr><th>Varga</th><th>Definition</th><th>Column</th></tr></thead>
          <tbody>
            {VARGA_CHOICES.map((ch) => (
              <tr key={ch.key}>
                <td>{ch.title}</td>
                <td>
                  <select aria-label={ch.title} value={o.prefs[ch.key]} onChange={(e) => set({ [ch.key]: Number(e.target.value) })}>
                    {ch.options.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                  </select>
                </td>
                <td className="mono">{vargaColumnLabel(ch.varga, ini)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>
                <label><input type="checkbox" checked={o.use1DegInD30} onChange={(e) => set({ Use1DegInD30ForDivLong: e.target.checked ? 1 : 0 })} />{' '}
                  Map each 1 degree in rasi to 30 deg in D-30 (when finding divisional longitudes)</label>
              </td>
            </tr>
            <tr>
              <td colSpan={3}>
                <label><input type="checkbox" checked={o.fromEnd} onChange={(e) => set({ DivLongFromEndToo: e.target.checked ? 1 : 0 })} />{' '}
                  Reckon divisional longitudes from the end of sign when using reverse reckoning of signs</label>
              </td>
            </tr>
            <tr>
              <td>Custom divisional chart ({vargaColumnLabel('D0', ini)})</td>
              <td colSpan={2}>
                <label>Parts per sign <input aria-label="Custom divisions" type="number" min={0} max={300} value={c.n} style={{ width: '5em', minWidth: 0 }}
                  onChange={(e) => set({ 'CustDivSettings.nCustDivN': Math.max(0, Math.trunc(Number(e.target.value) || 0)) })} /></label>{' '}
                <label><input type="checkbox" checked={c.cyclic} onChange={(e) => set({ 'CustDivSettings.bCyclical': e.target.checked ? 1 : 0 })} /> cyclical (parivritti)</label>
                <div>
                  <select aria-label="Custom base" value={c.houseSeed ? 1 : 0} disabled={c.cyclic} onChange={(e) => set({ 'CustDivSettings.bHouseAsSeed': Number(e.target.value) })}>
                    {CUSTOM_BASES.map((b, i) => <option key={b} value={i}>Base: {b}</option>)}
                  </select>{' '}
                  <select aria-label="Custom start" value={c.start} disabled={c.cyclic} onChange={(e) => set({ 'sCustDivSettings.tStart': Number(e.target.value) })}>
                    {CUSTOM_STARTS.map((s, i) => <option key={s} value={i}>Start: {s}</option>)}
                  </select>{' '}
                  <label><input type="checkbox" checked={c.reverseEven} disabled={c.cyclic} onChange={(e) => set({ 'sCustDivSettings.bReverseDivsInEvenSigns': e.target.checked ? 1 : 0 })} />{' '}
                    count from the end of even signs</label>
                </div>
              </td>
            </tr>
            <tr>
              <td>Sub-divisional chart ({vargaColumnLabel('D10xD9', ini)})</td>
              <td colSpan={2}>
                D-n of D-m: base{' '}
                <select aria-label="Base chart D-m" value={o.dm} onChange={(e) => set({ DmDnChartDm: Number(e.target.value) })}>
                  {DMDN_NAMES.slice(0, DM_COUNT).map((n, i) => <option key={n} value={i}>{n}</option>)}
                </select>{' '}
                then{' '}
                <select aria-label="Chart D-n" value={o.dn} onChange={(e) => set({ DmDnChartDn: Number(e.target.value) })}>
                  {DMDN_NAMES.slice(0, DN_COUNT).map((n, i) => <option key={n} value={i}>{n}</option>)}
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="muted">The D-81 choice is not saved in jhora.ini by JHora; here it lasts with the other preferences.</p>
      </div>
    </div>
  );
}
