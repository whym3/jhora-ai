// AI astrologer: a chat drawer whose model (Claude or OpenAI) reads the open chart through
// the retrieval tools in src/ai/tools.ts. API keys and settings stay in this browser.
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ChartSpec } from '../engine/protocol';
import { stableStringify } from '../engine/hash';
import { useEngine } from './EngineProvider';
import {
  CLAUDE_MODELS, DEFAULT_SETTINGS, OPENAI_REASONING, errorText, isOpenAIChatModel, listModels, startConversation,
  type AgentEvent, type AiSettings, type Conversation, type Effort, type ModelEntry,
} from '../ai/agent';
import { chartContext } from '../ai/systemPrompt';

const STORE_KEY = 'jhora-web.ai';
function loadSettings(): AiSettings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') }; } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: AiSettings) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* storage unavailable: settings last this session */ }
}

type Part =
  | { kind: 'text'; text: string }
  | { kind: 'thinking'; text: string }
  | { kind: 'tool'; id: string; name: string; input: unknown; result?: { ok: boolean; text: string } };
interface Turn { role: 'user' | 'assistant'; parts: Part[]; error?: string }

const STARTERS = [
  'Give me a complete, layered reading of this chart (Parashari, KP and Bhrigu Nandi Nadi), with the main life themes and karmic indications.',
  'Analyse my career: promise, strengths, and the best periods for change or growth in the next 5 years.',
  'Analyse marriage and relationships: promise, nature of the spouse, and timing.',
  'What do the next 12 months hold? Month-by-month, with the dasas and transits behind each prediction.',
];

/** Small markdown subset: headings, bold/italics, bullet and numbered lists, tables, paragraphs. */
export function Markdown({ text }: { text: string }) {
  const inline = (s: string, key: number): ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return <Fragment key={key}>{parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p.startsWith('`') && p.endsWith('`') && p.length > 2 ? <code key={i}>{p.slice(1, -1)}</code>
        : p.startsWith('*') && p.endsWith('*') && p.length > 2 ? <em key={i}>{p.slice(1, -1)}</em> : p))}</Fragment>;
  };
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { const H = `h${Math.min(6, h[1].length + 2)}` as 'h3'; out.push(<H key={i}>{inline(h[2], 0)}</H>); i++; continue; }
    // a row needs no closing pipe: models sometimes omit it, and a streamed row lacks it until it is complete
    if (/^\s*\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        if (!/^\s*\|[\s:|-]*$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim()));
        i++;
      }
      out.push(<table key={i} className="ai-table"><tbody>{rows.map((r, k) => <tr key={k}>{r.map((c, j) => (k === 0 ? <th key={j}>{inline(c, j)}</th> : <td key={j}>{inline(c, j)}</td>))}</tr>)}</tbody></table>);
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''));
      const L = ordered ? 'ol' : 'ul';
      out.push(<L key={i}>{items.map((it, k) => <li key={k}>{inline(it, k)}</li>)}</L>);
      continue;
    }
    if (l.trim() === '') { i++; continue; }
    // the first line is always taken, so every pass of the outer loop advances
    const para: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,4}\s|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={i}>{para.map((p, k) => <Fragment key={k}>{k > 0 && <br />}{inline(p, k)}</Fragment>)}</p>);
  }
  return <div className="ai-md">{out}</div>;
}

/** "Load models": every model the key can use (GET /v1/models), newest first. */
function useModelList(s: AiSettings) {
  const [models, setModels] = useState<Record<string, ModelEntry[]>>({});
  const [status, setStatus] = useState('');
  const key = s.provider === 'openai' ? s.openaiKey : s.anthropicKey;
  const load = async () => {
    setStatus('Loading models…');
    try {
      const list = await listModels(s.provider, key);
      setModels((m) => ({ ...m, [s.provider]: list }));
      setStatus(`${list.length} models`);
    } catch (e) {
      setStatus(errorText(e));
    }
  };
  return { list: models[s.provider] ?? null, status, load, canLoad: !!key };
}

const day = (t: number) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : '');

function Settings({ s, set }: { s: AiSettings; set: (p: Partial<AiSettings>) => void }) {
  const models = useModelList(s);
  const [chatOnly, setChatOnly] = useState(true);
  const loader = (
    <span className="ai-models">
      <button type="button" onClick={() => void models.load()} disabled={!models.canLoad}>Load models</button>
      {models.status && <span className="note">{models.status}</span>}
    </span>
  );
  const claudeIds = models.list?.map((m) => m.id) ?? CLAUDE_MODELS;
  const openaiList = (models.list ?? []).filter((m) => !chatOnly || isOpenAIChatModel(m.id));
  return (
    <div className="ai-settings">
      <label>Provider
        <select value={s.provider} onChange={(e) => set({ provider: e.target.value as AiSettings['provider'] })}>
          <option value="claude">Claude (Anthropic)</option>
          <option value="openai">OpenAI</option>
        </select>
      </label>
      {s.provider === 'claude' ? (
        <>
          <label>Anthropic API key<input type="password" value={s.anthropicKey} placeholder="sk-ant-..." onChange={(e) => set({ anthropicKey: e.target.value.trim() })} /></label>
          <label>Model
            <select value={s.claudeModel} onChange={(e) => set({ claudeModel: e.target.value })}>
              {[...new Set([s.claudeModel, ...claudeIds])].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>Depth (effort)
            <select value={s.effort} onChange={(e) => set({ effort: e.target.value as Effort })}>
              {['low', 'medium', 'high', 'xhigh', 'max'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          {loader}
        </>
      ) : (
        <>
          <label>OpenAI API key<input type="password" value={s.openaiKey} placeholder="sk-..." onChange={(e) => set({ openaiKey: e.target.value.trim() })} /></label>
          <label>Model
            {models.list ? (
              <select value={s.openaiModel} onChange={(e) => set({ openaiModel: e.target.value })}>
                {!openaiList.some((m) => m.id === s.openaiModel) && <option value={s.openaiModel}>{s.openaiModel}</option>}
                {openaiList.map((m) => <option key={m.id} value={m.id}>{m.id}{m.created ? ` (${day(m.created)}, ${m.owner})` : ''}</option>)}
              </select>
            ) : <input value={s.openaiModel} onChange={(e) => set({ openaiModel: e.target.value.trim() })} />}
          </label>
          <label>Reasoning effort
            <select value={s.openaiReasoning} onChange={(e) => set({ openaiReasoning: e.target.value as AiSettings['openaiReasoning'] })}>
              <option value="">(model default)</option>
              {OPENAI_REASONING.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          {loader}
          {models.list && <label className="ai-check"><input type="checkbox" checked={chatOnly} onChange={(e) => setChatOnly(e.target.checked)} /> chat models only ({openaiList.length} of {models.list.length})</label>}
        </>
      )}
      <p className="note">Keys are kept only in this browser and sent only to the provider you choose. Each answer is billed to your API account.</p>
    </div>
  );
}

export function AiPanel({ open, onClose, spec, title }: { open: boolean; onClose: () => void; spec: ChartSpec | null; title: string }) {
  const { client, ready } = useEngine();
  const [settings, setSettings] = useState(loadSettings);
  const [showSettings, setShowSettings] = useState(() => !loadSettings().anthropicKey && !loadSettings().openaiKey);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const conv = useRef<Conversation | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement | null>(null);
  const chartKey = useMemo(() => (spec ? stableStringify(spec) : ''), [spec]);

  const set = (p: Partial<AiSettings>) => setSettings((s) => { const n = { ...s, ...p }; saveSettings(n); return n; });
  const reset = () => { abort.current?.abort(); conv.current = null; setTurns([]); setBusy(false); };
  // a new chart, provider or model starts a new conversation
  useEffect(reset, [chartKey, settings.provider, settings.claudeModel, settings.openaiModel]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [turns]);

  const send = async (text: string) => {
    if (!spec || !text.trim() || busy) return;
    let c = conv.current;
    let first = false;
    try {
      if (!c) {
        c = conv.current = startConversation(settings, {
          spec, title,
          request: (req) => client.request(req).result,
        });
        first = true;
      }
    } catch (e) {
      setShowSettings(true);
      setTurns((t) => [...t, { role: 'assistant', parts: [], error: errorText(e) }]);
      return;
    }
    setInput('');
    setBusy(true);
    setTurns((t) => [...t, { role: 'user', parts: [{ kind: 'text', text }] }, { role: 'assistant', parts: [] }]);
    const update = (f: (parts: Part[]) => Part[]) => setTurns((t) => {
      const last = t[t.length - 1];
      return [...t.slice(0, -1), { ...last, parts: f(last.parts) }];
    });
    const onEvent = (e: AgentEvent) => {
      if (e.type === 'text' || e.type === 'thinking') {
        const kind = e.type;
        update((p) => (p.length && p[p.length - 1].kind === kind
          ? [...p.slice(0, -1), { kind, text: (p[p.length - 1] as { text: string }).text + e.delta }]
          : [...p, { kind, text: e.delta }]));
      } else if (e.type === 'tool') {
        update((p) => [...p, { kind: 'tool', id: e.id, name: e.name, input: e.input }]);
      } else {
        update((p) => p.map((x) => (x.kind === 'tool' && x.id === e.id ? { ...x, result: { ok: e.ok, text: e.text } } : x)));
      }
    };
    abort.current = new AbortController();
    try {
      await c.send(first ? `${chartContext(title, new Date())}\n\n${text}` : text, onEvent, abort.current.signal);
    } catch (e) {
      setTurns((t) => [...t.slice(0, -1), { ...t[t.length - 1], error: errorText(e) }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={`ai-panel${open ? ' open' : ''}`} aria-label="AI astrologer" aria-hidden={!open}>
      <div className="ai-head">
        <strong>AI Astrologer</strong>
        <span className="note">{spec ? title : 'no chart open'} · {settings.provider === 'claude' ? settings.claudeModel : settings.openaiModel}</span>
        <span className="toolbar">
          <button onClick={() => setShowSettings((v) => !v)}>Settings</button>
          <button onClick={reset} disabled={!turns.length}>New conversation</button>
          <button onClick={onClose}>Close</button>
        </span>
      </div>
      {showSettings && <Settings s={settings} set={set} />}
      <div className="ai-log">
        {!turns.length && (
          <div className="ai-starters">
            <p className="note">Ask anything about the open chart. The AI reads it through this program's own calculations (positions, vargas, dasas, strengths, yogas, KP, transits, Tajaka).</p>
            {STARTERS.map((s) => <button key={s} disabled={!spec || !ready || busy} onClick={() => void send(s)}>{s}</button>)}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`ai-turn ${t.role}`}>
            {t.parts.map((p, k) => (p.kind === 'text' ? (t.role === 'user' ? <p key={k}>{p.text}</p> : <Markdown key={k} text={p.text} />)
              : p.kind === 'thinking' ? <details key={k} className="ai-thinking"><summary>Reasoning</summary><p>{p.text}</p></details>
                : (
                  <details key={k} className={`ai-tool${p.result && !p.result.ok ? ' failed' : ''}`}>
                    <summary>{p.result ? (p.result.ok ? '✓' : '✗') : '…'} {p.name} {p.input && Object.keys(p.input as object).length ? JSON.stringify(p.input) : ''}</summary>
                    {p.result && <pre>{p.result.text}</pre>}
                  </details>
                )))}
            {t.error && <p className="error">{t.error}</p>}
            {t.role === 'assistant' && busy && i === turns.length - 1 && !t.error && <p className="status">Working…</p>}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <textarea value={input} rows={3} placeholder={spec ? 'Ask about this chart (Ctrl+Enter to send)' : 'Open a chart first'}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(input); } }} />
        {busy ? <button type="button" onClick={() => abort.current?.abort()}>Stop</button>
          : <button type="submit" disabled={!spec || !ready || !input.trim()}>Send</button>}
      </form>
    </aside>
  );
}
