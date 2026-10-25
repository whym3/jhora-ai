import type { Table } from '../../engine/protocol';
import type { JobState } from '../EngineProvider';
import { listCopyText } from '../../core/format/listCopy';

interface Props { job: JobState<Table>; title?: string; onCopy?: () => void; onRowClick?: (index: number) => void }

const CRLF = String.fromCharCode(13, 10);

/**
 * List-view twin of JHora's tables: same headers; "Copy to clipboard" writes JHora's list copy
 * (FUN_004b9d30, src/core/format/listCopy.ts) or the job's own text when it provides one.
 */
export function TableView({ job, title, onCopy, onRowClick }: Props) {
  const copy = () => {
    if (!job.data) return;
    const text = job.data.text ? job.data.text.join(CRLF) : listCopyText(job.data);
    navigator.clipboard?.writeText(text);
    onCopy?.();
  };
  return (
    <div className="tableview">
      {(title || job.data) && (
        <div className="tableview-bar">
          <span>{title ?? job.data?.caption}</span>
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
              <tr key={i} className={onRowClick ? 'clickable' : undefined} onClick={onRowClick ? () => onRowClick(i) : undefined}>{r.map((c, j) => <td key={j} className={job.data!.cellClasses?.[i]?.[j] ?? (/\d+ \w\w \d+'/.test(c) ? 'mono' : undefined)}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )}
      {job.data?.notes?.map((n, i) => <p key={i} className="table-note">{n}</p>)}
    </div>
  );
}
