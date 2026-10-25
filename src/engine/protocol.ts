// Messages between the UI and the calculation worker.
import type { BirthData } from '../core/jhd';
import type { JhoraIni } from '../settings/generated';
import type { Positions } from '../core/positions';
import type { ChartBody } from '../core/chart';
import type { NamedBody } from '../core/longitudes';
import type { DayFrame } from '../core/day';
import type { UserPoint } from '../core/userPoints';

/** Everything that identifies a chart: birth data plus the settings that affect it. */
export interface ChartSpec {
  birth: BirthData;
  /** JHora ini keys that differ from the defaults */
  ini: Partial<JhoraIni>;
}

export interface Table {
  headers: string[];
  rows: string[][];
  /** text placed on the clipboard instead of JHora's list copy of the table (src/core/format/listCopy.ts) */
  text?: string[];
  /** JHora's column count for the list copy when larger than the headers (view+0x48) */
  copyColumns?: number;
  /** heading shown above the table */
  caption?: string;
  /** rows can be expanded (dasa periods); false when no deeper level exists */
  drill?: boolean;
  /** CSS class per cell (same shape as rows), e.g. relationship colours */
  cellClasses?: (string | undefined)[][];
  /** lines shown under the table (legends) */
  notes?: string[];
}

export interface ChartResult {
  positions: Positions;
  bodies: ChartBody[];
  /** JHora's 56 bodies (special lagnas, upagrahas, sphutas...) */
  longitudes: NamedBody[];
  day: DayFrame;
  birth: BirthData;
  /** the Edit menu's special point / planetary special lagna when on (core/userPoints.ts) */
  userPoints?: UserPoint[];
}

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
