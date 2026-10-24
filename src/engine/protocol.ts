// Messages between the UI and the calculation worker.
import type { BirthData } from '../core/jhd';
import type { JhoraIni } from '../settings/generated';
import type { Positions } from '../core/positions';
import type { ChartBody } from '../core/chart';

/** Everything that identifies a chart: birth data plus the settings that affect it. */
export interface ChartSpec {
  birth: BirthData;
  /** JHora ini keys that differ from the defaults */
  ini: Partial<JhoraIni>;
}

export interface Table {
  headers: string[];
  rows: string[][];
  /** text placed on the clipboard instead of the tab-separated table (JHora's own copy format) */
  text?: string[];
  /** heading shown above the table */
  caption?: string;
  /** rows can be expanded (dasa periods); false when no deeper level exists */
  drill?: boolean;
}

export interface ChartResult { positions: Positions; bodies: ChartBody[] }

export type JobRequest =
  | { kind: 'chart'; chart: ChartSpec }
  | { kind: 'table'; chart: ChartSpec; table: string; params?: Record<string, unknown> }
  | { kind: 'text'; chart: ChartSpec; cmd: number; params?: Record<string, unknown> };

export type JobResult<R extends JobRequest> =
  R extends { kind: 'chart' } ? ChartResult :
  R extends { kind: 'table' } ? Table :
  string;

export type ToWorker = { id: number; req: JobRequest } | { id: number; cancel: true };
export type FromWorker =
  | { id: number; progress: number }
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
  | { ready: true; version: string };
