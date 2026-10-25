// Preferences > Related to Display > "Colors to be used" (33049, dialog 2023, handler
// FUN_004e72f0): frame combo 1003, item combo 1004, R/G/B edits 100..102 and the buttons
// 3 "Revert to saved colors in this frame", 4 "... for this item", 5 "... in all frames",
// 6 / 9 / 8 "Restore default colors in this frame" / "... for this item" / "Restore all
// the factory default colors", 7 "Apply this color to item", 1 "Save colors", 2 Cancel.
// "Saved" colours are the ones in jhora.ini when the dialog opened, "default" JHora's.
// The app previews the colours while the dialog is open (src/ui/appearance.ts).
import { useEffect, useState } from 'react';
import { DEFAULTS, type JhoraIni } from '../../settings/generated';
import { getState, setIni, useStore } from '../state/store';
import { applyAppearance, colorref, colorrefToHex, COLOR_TARGETS, hexToColorref, rgbOf } from '../appearance';
import { COLOR_FRAMES, COLOR_ITEMS } from './colorItems';

type Colors = Record<string, number>;
const pick = (src: Partial<JhoraIni>): Colors => Object.fromEntries(COLOR_ITEMS.map((c) => [c.key, Number(src[c.key as keyof JhoraIni])]));

export function ColorsDialog({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const [saved] = useState(() => pick(ini));
  const [work, setWork] = useState<Colors>(saved);
  const [frame, setFrame] = useState(0);
  const items = COLOR_ITEMS.filter((c) => c.frame === frame);
  const [itemKey, setItemKey] = useState(items[0].key);
  const [rgb, setRgb] = useState(() => rgbOf(work[itemKey]));
  const factory = pick(DEFAULTS);

  useEffect(() => { applyAppearance({ ...ini, ...work }); }, [work, ini]);
  useEffect(() => () => applyAppearance(getState().ini), []);   // back to the saved colours on close

  const select = (key: string, w: Colors = work) => { setItemKey(key); setRgb(rgbOf(w[key])); };
  const chooseFrame = (f: number) => { setFrame(f); select(COLOR_ITEMS.find((c) => c.frame === f)!.key); };
  const update = (keys: string[], from: Colors) => {
    const w = { ...work };
    for (const k of keys) w[k] = from[k];
    setWork(w);
    setRgb(rgbOf(w[itemKey]));
  };
  const frameKeys = items.map((c) => c.key);
  const allKeys = COLOR_ITEMS.map((c) => c.key);
  const current = colorref(rgb.r, rgb.g, rgb.b);
  const channel = (c: 'r' | 'g' | 'b', label: string) => (
    <label className="opt-row">{label}:<input type="number" min={0} max={255} aria-label={label} value={rgb[c]} style={{ width: '5em' }}
      onChange={(e) => setRgb({ ...rgb, [c]: Math.max(0, Math.min(255, Number(e.target.value))) })} /></label>
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal opt-dialog colors-dialog" role="dialog" aria-label="Choose colors" onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>Choose colors</strong></div>
        <div className="opt-body">
          <div className="opt-row"><span className="opt-text">Frame:</span>
            <select aria-label="Frame (1003)" value={frame} onChange={(e) => chooseFrame(Number(e.target.value))}>
              {COLOR_FRAMES.map((f, i) => <option key={f} value={i}>{f}</option>)}
            </select></div>
          <div className="opt-row"><span className="opt-text">Item in frame</span>
            <select aria-label="Item in frame (1004)" value={itemKey} onChange={(e) => select(e.target.value)}>
              {items.map((c) => <option key={c.key} value={c.key}>{c.label}{COLOR_TARGETS[c.key] ? '' : ' (not used by the web app)'}</option>)}
            </select></div>
          <div className="opt-row">
            <input type="color" aria-label="Color" value={colorrefToHex(current)} onChange={(e) => setRgb(rgbOf(hexToColorref(e.target.value)))} />
            {channel('r', 'R')}{channel('g', 'G')}{channel('b', 'B')}
            <button onClick={() => setWork({ ...work, [itemKey]: current })}>Apply this color to item</button>
          </div>
          <span className="opt-text muted">You can enter R, G and B values here or select the color and brightness on the left. ({itemKey})</span>
          <div className="opt-row">
            <button onClick={() => update(frameKeys, saved)}>Revert to saved colors in this frame</button>
            <button onClick={() => update([itemKey], saved)}>Revert to saved color for this item</button>
            <button onClick={() => update(allKeys, saved)}>Revert to saved colors in all frames</button>
          </div>
          <div className="opt-row">
            <button onClick={() => update(frameKeys, factory)}>Restore default colors in this frame</button>
            <button onClick={() => update([itemKey], factory)}>Restore default color for this item</button>
            <button onClick={() => update(allKeys, factory)}>Restore all the factory default colors</button>
          </div>
        </div>
        <div className="opt-buttons">
          <button onClick={() => { setIni(work as Partial<JhoraIni>); onClose(); }}>Save colors</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
