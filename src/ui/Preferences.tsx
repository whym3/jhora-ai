// Preferences: every jhora.ini option (JHora's Preferences dialogs edit the same
// keys), grouped by ini section, with JHora's defaults, search, reset and
// jhora.ini import/export. Values are JHora's raw ini values (combo indices etc.).
import { useMemo, useState } from 'react';
import { DEFAULTS, INI_SPEC, type IniKeySpec, type JhoraIni } from '../settings/generated';
import { parseIni, writeIni } from '../io/ini';
import { setIni, useStore } from './state/store';

const SECTIONS = ['CalculationPreferences', 'DisplayPreferences', 'BodiesToShow', 'CurrentState', 'Colors'] as const;
type Value = string | number | string[] | number[];

const show = (v: Value) => (Array.isArray(v) ? v.join(', ') : String(v));
function parseValue(spec: IniKeySpec, text: string): Value | null {
  if (spec.kind === 'str') return text;
  if (spec.kind === 'str[]') return text.split(',').map((x) => x.trim());
  const nums = text.split(',').map((x) => Number(x.trim()));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const fix = spec.kind.startsWith('int') ? nums.map((n) => Math.round(n)) : nums;
  return spec.kind.endsWith('[]') ? fix : fix[0];
}

function Row({ spec, value }: { spec: IniKeySpec; value: Value }) {
  const key = spec.key as keyof JhoraIni;
  const def = DEFAULTS[key];
  const changed = JSON.stringify(value) !== JSON.stringify(def);
  const [text, setText] = useState(show(value));
  const [bad, setBad] = useState(false);
  const commit = () => {
    const v = parseValue(spec, text);
    setBad(v === null);
    if (v !== null) setIni({ [key]: v } as Partial<JhoraIni>);
  };
  return (
    <tr className={changed ? 'pref-changed' : undefined}>
      <td className="mono">{spec.key}</td>
      <td>
        <input aria-label={spec.key} value={text} className={bad ? 'bad' : undefined}
          onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      </td>
      <td className="muted">{show(def)}</td>
      <td>{changed && <button onClick={() => { setText(show(def)); setIni({ [key]: def } as Partial<JhoraIni>); }}>Reset</button>}</td>
    </tr>
  );
}

export function Preferences({ onClose }: { onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const [section, setSection] = useState<string>(SECTIONS[0]);
  const [query, setQuery] = useState('');
  const rows = useMemo(() => INI_SPEC.filter((s) => (query ? s.key.toLowerCase().includes(query.toLowerCase()) : s.section === section)), [section, query]);
  const changedCount = INI_SPEC.filter((s) => JSON.stringify(ini[s.key as keyof JhoraIni]) !== JSON.stringify(DEFAULTS[s.key as keyof JhoraIni])).length;

  const importIni = async (f: File) => {
    const { ini: parsed } = parseIni(await f.text());
    setIni(parsed);
  };
  const exportIni = () => {
    const url = URL.createObjectURL(new Blob([writeIni(ini)], { type: 'text/plain' }));
    Object.assign(document.createElement('a'), { href: url, download: 'jhora.ini' }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal prefs" role="dialog" aria-label="Preferences" onClick={(e) => e.stopPropagation()}>
        <div className="note-bar">
          <strong>Preferences (jhora.ini) · {changedCount} changed</strong>
          <span className="toolbar">
            <label className="file">Import jhora.ini<input type="file" accept=".ini" onChange={(e) => e.target.files?.[0] && importIni(e.target.files[0])} /></label>
            <button onClick={exportIni}>Export jhora.ini</button>
            <button onClick={() => setIni(structuredClone(DEFAULTS))} disabled={!changedCount}>Reset all</button>
            <button onClick={onClose}>Close</button>
          </span>
        </div>
        <div className="subview-bar">
          <span className="tabbar tabbar-sub">
            {SECTIONS.map((s) => <button key={s} className={`tab${s === section && !query ? ' active' : ''}`} onClick={() => { setSection(s); setQuery(''); }}>{s}</button>)}
          </span>
          <input aria-label="Search options" placeholder="Search all options" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <table className="prefs-table">
          <thead><tr><th>Option</th><th>Value</th><th>JHora default</th><th /></tr></thead>
          <tbody>{rows.map((s) => <Row key={s.key} spec={s} value={ini[s.key as keyof JhoraIni]} />)}</tbody>
        </table>
      </div>
    </div>
  );
}
