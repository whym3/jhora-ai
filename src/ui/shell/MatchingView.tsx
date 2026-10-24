// Horoscope matching for marriage (JHora command 33320, dialog 2067; see src/core/matching.ts).
// JHora asks for the other person's nakshatra and pada; here they can also be taken from
// the Moon of another open chart.
import { useMemo, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { defaultOtherIsGroom, MATCH_NAKSHATRA_NAMES, nakshatraPada } from '../../core/matching';
import { useJob } from '../EngineProvider';
import { useStore } from '../state/store';

const MANUAL = '';

export function MatchingView({ spec }: { spec: ChartSpec }) {
  const docs = useStore((s) => s.docs);
  const [otherDoc, setOtherDoc] = useState<string>(MANUAL);
  const [nak, setNak] = useState(0);
  const [pada, setPada] = useState(0);
  const [otherIsGroom, setOtherIsGroom] = useState(() => defaultOtherIsGroom(spec.birth.field18));

  // the other person's Moon, when taken from an open chart (computed with the same settings)
  const other = docs.find((d) => d.id === otherDoc) ?? null;
  const otherChart = useJob(other ? { kind: 'chart' as const, chart: { birth: other.birth, ini: { ...spec.ini, ...other.ini } } } : null);
  const fromChart = useMemo(() => (other && otherChart.data ? nakshatraPada(otherChart.data.positions.grahas.Moon.lon) : null), [other, otherChart.data]);
  const sel = fromChart ?? { nak, pada };

  const job = useJob(other && !fromChart ? null : {
    kind: 'table' as const, chart: spec, table: 'matching.result',
    params: { otherNak: sel.nak, otherPada: sel.pada, otherIsGroom },
  });

  return (
    <div className="subview matching">
      <div className="subview-bar">
        <span>Consider a</span>
        <select aria-label="Other person is" value={otherIsGroom ? 1 : 0} onChange={(e) => setOtherIsGroom(e.target.value === '1')}>
          <option value={0}>Bride</option>
          <option value={1}>Bridegroom</option>
        </select>
        <select aria-label="Second chart" value={otherDoc} onChange={(e) => setOtherDoc(e.target.value)}>
          <option value={MANUAL}>with the nakshatra and pada below</option>
          {docs.map((d) => <option key={d.id} value={d.id}>with the Moon of {d.title}</option>)}
        </select>
      </div>
      <div className="subview-bar">
        <span>with the following nakshatra</span>
        <select aria-label="Nakshatra" value={sel.nak} disabled={!!other} onChange={(e) => setNak(Number(e.target.value))}>
          {MATCH_NAKSHATRA_NAMES.map((n, i) => <option key={n} value={i}>{n}</option>)}
        </select>
        <span>and the following pada (quarter)</span>
        <select aria-label="Pada" value={sel.pada} disabled={!!other} onChange={(e) => setPada(Number(e.target.value))}>
          {[0, 1, 2, 3].map((p) => <option key={p} value={p}>{p + 1}</option>)}
        </select>
      </div>
      {otherChart.status === 'error' && <p className="error">{otherChart.error}</p>}
      {job.data?.text && <pre className="key-info">{job.data.text.join('\n')}</pre>}
      {job.status === 'error' && <p className="error">{job.error}</p>}
    </div>
  );
}
