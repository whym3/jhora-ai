// Dialog 2068 "Choose the Reference for Bhava/Chalit Chakra" (chart menu 103 command 33353,
// CMainFrame 0x4e9330, dialog class 0x4cfa40): the reference body (combo 1003, BhavaChartRef),
// lagna in the middle of the first house (1001, HouseCuspsInMiddle), bhavas from the nodes
// reckoned anti-zodiacally (1002, HousesFromNodesReversed) and the base varga (combo 1004,
// BhavaChartVarga). OK stores the four global settings (every chart is then recomputed);
// Cancel leaves them. See core/bhavaChart.ts.
import { useState } from 'react';
import { BHAVA_DIALOG, bhavaSettings } from '../../core/bhavaChart';
import { setIni, useStore } from '../state/store';

export function BhavaChartDialog({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const [v, setV] = useState(() => bhavaSettings(ini));
  const ok = () => {
    setIni({ BhavaChartRef: v.ref, HouseCuspsInMiddle: v.middle ? 1 : 0, HousesFromNodesReversed: v.nodesReversed ? 1 : 0, BhavaChartVarga: v.varga });
    onClose();
  };
  const D = BHAVA_DIALOG;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={D.title} onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>{D.title}</strong></div>
        <p>
          <select aria-label="Reference" value={v.ref} onChange={(e) => setV({ ...v, ref: Number(e.target.value) })}>
            {D.ref.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
          </select>
        </p>
        <p style={{ whiteSpace: 'pre-line' }}><label><input type="checkbox" checked={v.middle} onChange={(e) => setV({ ...v, middle: e.target.checked })} /> {D.middle.label}</label></p>
        <p><label><input type="checkbox" checked={v.nodesReversed} onChange={(e) => setV({ ...v, nodesReversed: e.target.checked })} /> {D.nodes.label}</label></p>
        <p>
          <select aria-label="Divisional chart" value={v.varga} onChange={(e) => setV({ ...v, varga: Number(e.target.value) })}>
            {D.varga.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
          </select>
        </p>
        <div className="note-bar">
          <span />
          <span><button onClick={ok}>OK</button> <button onClick={onClose}>Cancel</button></span>
        </div>
      </div>
    </div>
  );
}
