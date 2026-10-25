// Modes > "Go to Nisheka/Aadhana Chakra" (33291): the conception chart replaces the natal
// chart in every view, its dasas compressed into the gestation period (job
// 'derived.nisheka', src/core/derived/nisheka.ts). Shown as a derived chart of kind
// 'mundane' (same compression; "Back to Natal Chart" in the Mundane tab or here).
import { useEffect, useRef, useState } from 'react';
import type { BirthData } from '../../core/jhd';
import type { ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { updateChart } from '../state/store';

export function NishekaButton({ docId, natalSpec, active }: { docId: string; natalSpec: ChartSpec; active: boolean }) {
  const [go, setGo] = useState(false);
  const job = useJob(go ? { kind: 'table' as const, chart: natalSpec, table: 'derived.nisheka' } : null);
  const stale = useRef<unknown>(null);
  useEffect(() => {
    if (!go || job.status !== 'done' || job.data === stale.current || !job.data?.text?.[0]) return;
    const { birth, label, periodDays } = JSON.parse(job.data.text[0]) as { birth: BirthData; label: string; periodDays: number };
    updateChart(docId, { derived: { kind: 'mundane', label, birth, params: { mode: 'nisheka', periodDays } } });
    stale.current = job.data;
    setGo(false);
  }, [go, job.status, job.data, docId]);
  if (active) return <button onClick={() => updateChart(docId, { derived: null })}>Back to Natal Chart</button>;
  return (
    <button onClick={() => { stale.current = job.data; setGo(true); }} title="Modes > Go to Nisheka/Aadhana Chakra (33291)">
      {go ? 'Nisheka…' : 'Nisheka/Aadhana chart'}
    </button>
  );
}
