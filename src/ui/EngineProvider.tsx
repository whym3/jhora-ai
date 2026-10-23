import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { EngineClient } from '../engine/client';
import { stableStringify } from '../engine/hash';
import type { JobRequest, JobResult } from '../engine/protocol';

interface EngineState { client: EngineClient; ready: boolean; error: string | null }
const Ctx = createContext<EngineState | null>(null);

export function EngineProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => new EngineClient(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { client.ready.then(() => setReady(true), (e) => setError(String(e))); }, [client]);
  return <Ctx.Provider value={{ client, ready, error }}>{children}</Ctx.Provider>;
}

export function useEngine(): EngineState {
  const v = useContext(Ctx);
  if (!v) throw new Error('EngineProvider missing');
  return v;
}

export type JobState<T> = { status: 'idle' | 'loading' | 'done' | 'error'; data: T | null; error: string | null };

/** Run a job in the worker; re-runs when the request changes and cancels the superseded one. */
export function useJob<R extends JobRequest>(req: R | null): JobState<JobResult<R>> {
  const { client, ready } = useEngine();
  const key = req ? stableStringify(req) : '';
  const [st, setSt] = useState<JobState<JobResult<R>>>({ status: 'idle', data: null, error: null });
  useEffect(() => {
    if (!req || !ready) return;
    let live = true;
    setSt((s) => ({ ...s, status: 'loading', error: null }));
    const job = client.request(req);
    job.result.then(
      (data) => live && setSt({ status: 'done', data, error: null }),
      (e: Error) => live && setSt({ status: 'error', data: null, error: e.message }),
    );
    return () => { live = false; job.cancel(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, client]);
  return st;
}
