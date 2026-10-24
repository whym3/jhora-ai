import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

export interface GoldenText { top: string; sub: string; mode: string | null; name: string; cmd: number; lines: string[] }
export interface GoldenChartV2 extends GoldenChart { texts: GoldenText[] }

/** Charts captured by harness v2 (golden/jhora-v2), with their copied texts. */
export function goldenV2Charts(): GoldenChartV2[] {
  if (!existsSync('golden/jhora-v2')) return [];
  return readdirSync('golden/jhora-v2').filter((f) => f.endsWith('.json')).map((f) => {
    const name = f.replace(/\.json$/, '');
    const g = JSON.parse(readFileSync(`golden/jhora-v2/${f}`, 'utf8'));
    return { name, birth: parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), views: g.views, texts: g.texts };
  });
}

/** Parse a copied JHora text table (header, blank line, rows) into cells split on 2+ spaces. */
export function textTable(t: GoldenText): { headers: string[]; rows: string[][] } {
  const split = (l: string) => l.trimEnd().split(/\s{2,}/);
  const [h, , ...rest] = t.lines;
  return { headers: split(h), rows: rest.filter((l) => l.trim()).map(split) };
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

/**
 * JHora's "complete calculations" dump (Edit menu, cmd 32983) per chart, from
 * the newest capture that has one: golden/jhora-v3, then golden/calcs.
 */
export function goldenCalcs(): { name: string; birth: BirthData; lines: string[] }[] {
  const out = new Map<string, { name: string; birth: BirthData; lines: string[] }>();
  for (const dir of ['golden/calcs', 'golden/jhora-v3']) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const name = f.replace(/\.json$/, '');
      const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
      const t = (g.texts ?? []).find((x: GoldenText) => x.name === 'complete_calcs' && x.lines?.length);
      if (t) out.set(name, { name, birth: parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), lines: t.lines });
    }
  }
  return [...out.values()];
}
