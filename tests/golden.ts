import { readFileSync, readdirSync } from 'node:fs';
import { parseJhd, type BirthData } from '../src/core/jhd';

export interface GoldenView { tabs: string[]; control_id: number; mode: string | null; headers: string[]; rows: string[][] }
export interface GoldenChart { name: string; birth: BirthData; views: GoldenView[] }

/** All sample charts with the tables JHora 8.0 produced for them. */
export function goldenCharts(): GoldenChart[] {
  return readdirSync('golden/charts').filter((f) => f.endsWith('.jhd')).map((f) => {
    const name = f.replace(/\.jhd$/, '');
    const g = JSON.parse(readFileSync(`golden/jhora/${name}.json`, 'utf8'));
    return { name, birth: parseJhd(readFileSync(`golden/charts/${f}`, 'latin1')), views: g.views };
  });
}

export function view(c: GoldenChart, mode: string): GoldenView {
  const v = c.views.find((x) => x.mode === mode);
  if (!v) throw new Error(`${c.name}: no view ${mode}`);
  return v;
}

/** Parse JHora's "26 Sg 00' 01.51"" back to degrees. */
export function parseLongitude(s: string): number {
  const m = /(\d+) (\w\w) (\d+)' ([\d.]+)"/.exec(s);
  if (!m) throw new Error(`bad longitude ${s}`);
  const signs = 'Ar Ta Ge Cn Le Vi Li Sc Sg Cp Aq Pi'.split(' ');
  return signs.indexOf(m[2]) * 30 + +m[1] + +m[3] / 60 + +m[4] / 3600;
}
