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
import { vimsottari } from '../src/core/dasas/vimsottari';
import { NAKSHATRA_DASAS, nakshatraDasa } from '../src/core/dasas/nakshatra';
// import { kalachakraDasa } from '../src/core/dasas/kalachakra';
import { narayanaDasa } from '../src/core/dasas/narayana';

/** Block after `title`: per dasa, its label and [label, date] antardasas (labels may be "Sc (Magh1)"). */
function parseBlock(lines: string[], title: string): { label: string; antars: [string, string][] }[] | null {
  const i = lines.findIndex((l) => l.startsWith(title));
  if (i < 0) return null;
  const out: { label: string; antars: [string, string][] }[] = [];
  for (let k = i + 2; k < lines.length && lines[k].trim(); k++) {
    const l = lines[k];
    let rest = l;
    if (l[0] !== ' ') {
      const m = l.match(/^(\S+(?: \(\w+\))?)\s+/)!;
      out.push({ label: m[1], antars: [] });
      rest = l.slice(m[0].length);
    }
    for (const m of rest.matchAll(/(\S+(?: \(\w+\))?) (\d{4}-\d\d-\d\d)/g)) out[out.length - 1].antars.push([m[1], m[2]]);
  }
  return out;
}

/** JHora abbreviates planets (Sat, Merc, Ket) and keeps sign codes; ours are full names / the same codes. */
const sameLabel = (ours: string, theirs: string) => ours === theirs || ours.toLowerCase().startsWith(theirs.toLowerCase());

const SYSTEMS: [string, (c: Awaited<ReturnType<typeof computeChart>>, ctx: SudasaCtx) => Period[]][] = [
  ['Vimsottari Dasa', (c) => vimsottari(c.positions.grahas.Moon.lon, 2)],
  [NAKSHATRA_DASAS.Ashtottari.title, (c) => nakshatraDasa(NAKSHATRA_DASAS.Ashtottari, c.positions.grahas.Moon.lon, 2)],
  // Kalachakra: antardasas still to port
  // ['Kalachakra Dasa', (c) => kalachakraDasa(c.positions.grahas.Moon.lon).periods],
  ['Narayana Dasa of D-1', (c, ctx) => narayanaDasa(ctx.lagnaSign, ctx).periods],
  [SUDASA_TITLE, (c, ctx) => sudasa(c.longitudes.find((b) => b.name === 'Sree Lagna')!.lon, ctx)],
];

describe('Dasas of the complete calculations text match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const g of goldenCalcs()) {
    for (const [title, make] of SYSTEMS) {
      const want = parseBlock(g.lines, title);
      if (!want) continue;
      it(`${g.name}: ${title.split(' (')[0].split(' of ')[0]}`, async () => {
        const c = await computeChart(swe, g.birth);
        const p = c.positions;
        const ctx: SudasaCtx = { sign: (x) => Math.floor(p.grahas[x].lon / 30), degree: (x) => p.grahas[x].lon % 30, lagnaSign: Math.floor(p.ascendant / 30), lagnaDegree: p.ascendant % 30 };
        const clock = dasaClock(swe, c);
        const day = (y: number) => formatDasaTime(clock.toJd(y), g.birth.tzHours, (jd) => swe.revjul(jd)).slice(0, 10);
        const ms = Date.parse;
        const bad: string[] = [];
        make(c, ctx).slice(0, want.length).forEach((md, i) => {
          const w = want[i];
          if (!sameLabel(periodLabel(md), w.label)) bad.push(`dasa ${i}: ${periodLabel(md)} vs ${w.label}`);
          if (w.antars.length && !md.children?.length) bad.push(`${w.label}: no antardasas`);
          (md.children ?? []).forEach((ad, j) => {
            const [wl, wd] = w.antars[j] ?? ['', ''];
            const hd = day(ad.start);
            if (!sameLabel(periodLabel(ad), wl) || Math.abs(ms(hd) - ms(wd)) > 86400000) bad.push(`${w.label}/${wl}: ${periodLabel(ad)} ${hd} vs ${wd}`);
          });
        });
        expect(bad.slice(0, 6), bad.slice(0, 6).join(' | ')).toEqual([]);
      });
    }
  }
});
