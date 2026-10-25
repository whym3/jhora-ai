// One generic renderer for JHora's option dialogs (src/ui/dialogs/optionRegistry.ts):
// static texts, group captions and the controls in the template's order, OK / Cancel.
// OK applies the handler's copy-out to jhora.ini (setIni), then its follow-up
// (afterOk: messages, the Ayanamsa dialog) and a chained dialog (`then`).
import { useMemo, useState } from 'react';
import type { JhoraIni } from '../../settings/generated';
import { setIni, useStore } from '../state/store';
import { applyFields, dialogFields, optionDialog, readField, type DialogItem, type FieldValue, type OptionDialogDef, type OptionField } from './optionRegistry';

function Control({ f, value, values, onChange }: { f: OptionField; value: FieldValue; values: Record<number, FieldValue>; onChange: (v: FieldValue) => void }) {
  const disabled = f.enabledWhen ? !f.enabledWhen(values) : false;
  switch (f.kind) {
    case 'combo': {
      const items = f.items ?? [];
      const n = Number(value);
      return (
        <select aria-label={`${f.key} (${f.id})`} value={n} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))}>
          {items.map((t, i) => <option key={i} value={i}>{t}</option>)}
          {(n < 0 || n >= items.length) && <option value={n}>(value {n})</option>}
        </select>
      );
    }
    case 'check':
      return (
        <label className="opt-check">
          <input type="checkbox" checked={Number(value) !== 0} disabled={disabled} onChange={(e) => onChange(e.target.checked ? 1 : 0)} />
          <span>{f.label}</span>
        </label>
      );
    case 'number':
      return <input type="number" aria-label={`${f.key} (${f.id})`} value={String(value)} step={f.step ?? 'any'} disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />;
    case 'textarea':
      return <textarea aria-label={`${f.key} (${f.id})`} rows={6} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input aria-label={`${f.key} (${f.id})`} value={String(value)} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
  }
}

function Item({ it, values, set }: { it: DialogItem | string | OptionField; values: Record<number, FieldValue>; set: (id: number, v: FieldValue) => void }) {
  if (typeof it === 'string') return <span className="opt-text">{it}</span>;
  if (Array.isArray(it)) return <div className="opt-row">{it.map((x, i) => <Item key={i} it={x} values={values} set={set} />)}</div>;
  if ('group' in it) return <div className="opt-group">{it.group}</div>;
  return <Control f={it} value={values[it.id]} values={values} onChange={(v) => set(it.id, v)} />;
}

export interface FollowUp { open?: 'ayanamsa'; then?: number }

/** One option dialog; `onDone` gets what JHora opens next after OK (nothing on Cancel). */
export function OptionDialog({ def, onDone }: { def: OptionDialogDef; onDone: (next: FollowUp | null) => void }) {
  const ini = useStore((s) => s.ini);
  const fields = useMemo(() => dialogFields(def), [def]);
  const [values, setValues] = useState<Record<number, FieldValue>>(() => Object.fromEntries(fields.map((f) => [f.id, readField(f, ini)])));
  const set = (id: number, v: FieldValue) => setValues((s) => ({ ...s, [id]: v }));
  const ok = () => {
    const patch = applyFields(def, ini, values);
    const after = def.afterOk?.({ ...ini, ...patch } as JhoraIni) ?? null;
    setIni({ ...patch, ...(after?.patch ?? {}) });
    if (after?.message) window.alert(`${after.message.title}\n\n${after.message.text}`);
    onDone({ open: after?.open, then: def.then });
  };
  return (
    <div className="modal-backdrop" onClick={() => onDone(null)}>
      <div className="modal opt-dialog" role="dialog" aria-label={def.title} onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>{def.title}</strong></div>
        <div className="opt-body">
          {def.items.map((it, i) => <Item key={i} it={it} values={values} set={set} />)}
        </div>
        <div className="opt-buttons">
          <button onClick={ok}>OK</button>
          <button onClick={() => onDone(null)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** Opens dialog `dialog` and follows JHora's chain (2065 -> 2080, Siddhanta -> Ayanamsa). */
export function OptionDialogHost({ dialog, onClose, onOpenAyanamsa }: { dialog: number; onClose: () => void; onOpenAyanamsa: () => void }) {
  const [current, setCurrent] = useState(dialog);
  const def = optionDialog(current);
  if (!def) return null;
  return (
    <OptionDialog key={current} def={def} onDone={(next) => {
      if (next?.then) { setCurrent(next.then); return; }
      onClose();
      if (next?.open === 'ayanamsa') onOpenAyanamsa();
    }} />
  );
}
