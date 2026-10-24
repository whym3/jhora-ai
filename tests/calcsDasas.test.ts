// Rasi/graha dasas listed in JHora's "complete calculations" text (dasa and
// antardasa signs with start dates), compared with ours to within a day.
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenCalcs } from './golden';
import { computeChart } from '../src/core/chart';
import { dasaClock } from '../src/core/dasas/time';
import { formatDasaTime, periodLabel } from '../src/core/dasas/format';
import type { Period } from '../src/core/dasas/vimsottari';
import { SUDASA_TITLE, sudasa } from '../src/core/dasas/sudasa';
import type { SudasaCtx } from '../src/core/dasas/sudasa';

/** Block after `title`: per dasa, its label and 12 [label, date] antardasas. */
function parseBlock(lines: string[], title: string): { label: string; antars: [string, string][] }[] | null {
  const i = lines.findIndex((l) => l.startsWith(title));
  if (i < 0) return null;
  const out: { label: string; antars: [string, string][] }[] = [];
  for (let k = i + 2; k < lines.length && lines[k].trim(); k++) {
    const l = lines[k];
    if (l[0] !== ' ') out.push({ label: l.slice(0, 2), antars: [] });
    for (const m of l.slice(4).matchAll(/(\S\S) (\d{4}-\d\d-\d\d)/g)) out[out.length - 1].antars.push([m[1], m[2]]);
  }
  return out;
}

const SYSTEMS: [string, (c: Awaited<ReturnType<typeof computeChart>>, ctx: SudasaCtx) => Period[]][] = [
  [SUDASA_TITLE, (c, ctx) => sudasa(c.longitudes.find((b) => b.name === 'Sree Lagna')!.lon, ctx)],
];

describe('Dasas of the complete calculations text match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const g of goldenCalcs()) {
    for (const [title, make] of SYSTEMS) {
      const want = parseBlock(g.lines, title);
      if (!want) continue;
      it(`${g.name}: ${title.split(' (')[0]}`, async () => {
        const c = await computeChart(swe, g.birth);
        const p = c.positions;
        const ctx: SudasaCtx = { sign: (x) => Math.floor(p.grahas[x].lon / 30), degree: (x) => p.grahas[x].lon % 30, lagnaSign: Math.floor(p.ascendant / 30), lagnaDegree: p.ascendant % 30 };
        const clock = dasaClock(swe, c);
        const day = (y: number) => formatDasaTime(clock.toJd(y), g.birth.tzHours, (jd) => swe.revjul(jd)).slice(0, 10);
        const ms = Date.parse;
        const bad: string[] = [];
        make(c, ctx).slice(0, want.length).forEach((md, i) => {
          const w = want[i];
          if (periodLabel(md).slice(0, 2) !== w.label) bad.push(`dasa ${i}: ${periodLabel(md)} vs ${w.label}`);
          (md.children ?? []).forEach((ad, j) => {
            const [wl, wd] = w.antars[j] ?? ['', ''];
            const hd = day(ad.start);
            if (periodLabel(ad).slice(0, 2) !== wl || Math.abs(ms(hd) - ms(wd)) > 86400000) bad.push(`${w.label}/${wl}: ${periodLabel(ad)} ${hd} vs ${wd}`);
          });
        });
        expect(bad.slice(0, 6), bad.slice(0, 6).join(' | ')).toEqual([]);
      });
    }
  }
});
