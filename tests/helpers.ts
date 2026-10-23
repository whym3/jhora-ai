import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Sweph } from '../src/sweph';
import { loadEngine } from '../src/core/engine';

const EPHE = fileURLToPath(new URL('../public/ephe/', import.meta.url));
let cached: Promise<Sweph> | null = null;

/** Swiss Ephemeris instance reading .se1 files from public/ephe. */
export function nodeSweph(): Promise<Sweph> {
  cached ??= loadEngine(async (name) => {
    try { return new Uint8Array(await readFile(EPHE + name)); } catch { return null; }
  });
  return cached;
}
