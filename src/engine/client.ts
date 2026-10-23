// UI-side handle on the calculation worker: promise per request, cancellation.
import type { FromWorker, JobRequest, JobResult, ToWorker } from './protocol';

interface Pending { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (p: number) => void }

export class EngineClient {
  private worker: Worker;
  private next = 1;
  private pending = new Map<number, Pending>();
  readonly ready: Promise<string>;

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let resolveReady!: (v: string) => void;
    let rejectReady!: (e: Error) => void;
    this.ready = new Promise<string>((res, rej) => { resolveReady = res; rejectReady = rej; });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const m = e.data;
      if ('ready' in m) { resolveReady(m.version); return; }
      if (m.id === -1 && 'ok' in m && !m.ok) { rejectReady(new Error(m.error)); return; }
      const p = this.pending.get(m.id);
      if (!p) return;
      if ('progress' in m) { p.onProgress?.(m.progress); return; }
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.result); else p.reject(new Error(m.error));
    };
    this.worker.onerror = (e) => rejectReady(new Error(e.message));
  }

  request<R extends JobRequest>(req: R, onProgress?: (p: number) => void): { result: Promise<JobResult<R>>; cancel: () => void } {
    const id = this.next++;
    const result = new Promise<JobResult<R>>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
      this.post({ id, req });
    });
    return { result, cancel: () => { if (this.pending.delete(id)) this.post({ id, cancel: true }); } };
  }

  private post(m: ToWorker) { this.worker.postMessage(m); }
}
