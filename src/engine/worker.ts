// Calculation worker: owns one Swiss Ephemeris instance and answers JobRequests.
import { applyNodalExaltation } from '../core/signStrength';
import { loadEngine } from '../core/engine';
import type { Sweph } from '../sweph';
import { computeChart, type Chart } from '../core/chart';
import { stableStringify } from './hash';
import type { ChartSpec, FromWorker, JobRequest, Table, ToWorker } from './protocol';
import { ASYNC_TABLES, runTable, runText } from './jobs';

const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

// Plain fetch: the files are static, so the browser's HTTP cache keeps repeat
// loads local. (The Cache API was tried first and can stall in some profiles.)
async function fetchFile(name: string): Promise<Uint8Array | null> {
  const r = await fetch(`${import.meta.env.BASE_URL}ephe/${name}`);
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}

const engine: Promise<Sweph> = loadEngine(async (name) => {
  const t = performance.now();
  const data = await fetchFile(name);
  console.info(`[worker] ${name}: ${data ? data.length + ' bytes' : 'missing'} in ${(performance.now() - t).toFixed(0)} ms`);
  return data;
});
engine.then(
  (swe) => { console.info(`[worker] Swiss Ephemeris ${swe.version()} ready`); post({ ready: true, version: swe.version() }); },
  (e) => { console.error('[worker] engine failed', e); post({ id: -1, ok: false, error: String(e) }); },
);

// Charts are cached by spec; tables and texts by spec + request.
const MAX = 300;
const cache = new Map<string, Promise<unknown>>();
function memo<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const p = fn();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  if (cache.size > MAX) cache.delete(cache.keys().next().value!);
  return p;
}

export function chartFor(spec: ChartSpec): Promise<Chart> {
  return memo(`chart:${stableStringify(spec)}`, async () => computeChart(await engine, spec.birth, spec.ini));
}

const cancelled = new Set<number>();

async function run(req: JobRequest): Promise<unknown> {
  switch (req.kind) {
    case 'chart': {
      const c = await chartFor(req.chart);
      return { positions: c.positions, bodies: c.bodies, longitudes: c.longitudes, day: c.day, birth: c.birth, userPoints: c.userPoints };
    }
    case 'table':
      return memo<Table>(`table:${req.table}:${stableStringify(req.params ?? {})}:${stableStringify(req.chart)}`,
        async () => {
          const chart = await chartFor(req.chart);
          const asyncTable = ASYNC_TABLES[req.table];
          if (req.table in ASYNC_TABLES) applyNodalExaltation((chart.ini?.NodalExaltationParasara ?? 0) !== 0);   // shared tables (signStrength.ts)
          return asyncTable ? asyncTable(chart, req.params ?? {}, await engine) : runTable(chart, req.table, req.params ?? {}, await engine);
        });
    case 'text':
      return memo<string>(`text:${req.cmd}:${stableStringify(req.params ?? {})}:${stableStringify(req.chart)}`,
        async () => runText(await chartFor(req.chart), req.cmd, req.params ?? {}, await engine));
  }
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if ('cancel' in m) { cancelled.add(m.id); return; }
  try {
    const result = await run(m.req);
    if (!cancelled.delete(m.id)) post({ id: m.id, ok: true, result });
  } catch (err) {
    if (!cancelled.delete(m.id)) post({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
