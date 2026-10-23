import type { Table } from '../../engine/protocol';
import type { JobState } from '../EngineProvider';

interface Props { job: JobState<Table>; title?: string; onCopy?: () => void }

/** List-view twin of JHora's tables: same headers, tab-separated copy. */
export function TableView({ job, title, onCopy }: Props) {
  const copy = () => {
    if (!job.data) return;
    const text = [job.data.headers.join('\t'), ...job.data.rows.map((r) => r.join('\t'))].join('\r\n');
    navigator.clipboard?.writeText(text);
    onCopy?.();
  };
  return (
    <div className="tableview">
      {(title || job.data) && (
        <div className="tableview-bar">
          <span>{title}</span>
          <button onClick={copy} disabled={!job.data}>Copy to clipboard</button>
        </div>
      )}
      {job.status === 'error' && <p className="error">{job.error}</p>}
      {job.status === 'loading' && !job.data && <p className="status">Calculating…</p>}
      {job.data && (
        <table>
          <thead><tr>{job.data.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {job.data.rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className={/\d+ \w\w \d+'/.test(c) ? 'mono' : undefined}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
