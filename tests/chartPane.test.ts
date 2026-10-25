// Chart pane, chart right-click menu 103 and the mixed-chart buttons (src/ui/shell/ChartPane.tsx,
// ChartMenu.tsx, MixedChartDialog.tsx, src/core/chartJobs.ts).
// The golden part reads the captures of tools/harness/views-chartpane.json and skips while
// golden/jhora-chartpane* are absent:
//   python tools/harness/capture.py --jhora ~/.local/share/jhweb/jhora-harness --views tools/harness/views-chartpane.json --out golden/jhora-chartpane golden/charts/*.jhd
//   ... --ini UseTwoChartStyles=1 --ini ChartStyle2=2 --out golden/jhora-chartpane-twostyles ...
//   ... --ini MoreChartsOnBigDisplay=0 --out golden/jhora-chartpane-unpacked ...
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd, type BirthData } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { movedLagnaBirth, vargaDivisions } from '../src/core/chartJobs';
import { formatSpan, signChange } from '../src/core/signChange';
import { vargaLongitude } from '../src/core/vargas';
import { vargasOf } from '../src/core/vargaOptions';
import { mixedVargas } from '../src/core/chakras/mixedVargas';
import { displayIndexOf, paneLayout, slotChart, slotPlaces, slotVargaOf } from '../src/ui/shell/ChartPane';
import { bhavaSigns } from '../src/core/bhavaChart';

const CHARTS = ['Mahatma Gandhi', 'Swami Vivekananda', 'India'];
const load = (name: string) => parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1'));

describe('chart pane layout (FUN_004318f0, draw loop 0x43226d)', () => {
  it('6 charts in 2 x 3 (packed), 2 charts stacked', () => {
    const six = paneLayout(6), two = paneLayout(2);
    expect([six.cols, six.rows, six.width, six.height]).toEqual([2, 3, 750, 1120]);
    expect([six.at(1), six.at(4)]).toEqual([[380, 10], [10, 750]]);
    expect([two.cols, two.rows, two.width, two.height]).toEqual([1, 2, 380, 750]);
    expect(two.at(1)).toEqual([10, 380]);
  });
  it('DisplayVarga slots, varga 28 = Bhava/Chalit', () => {
    const p = slotPlaces({}, 6, 'south');
    expect(p.map((x) => x.varga)).toEqual(['D1', 'D9', 'D30', 'D3', 'D10', 'D60']);
    expect(p.every((x) => x.style === 'south')).toBe(true);
    expect(slotVargaOf(28)).toBe('Bhava');
    expect(displayIndexOf('Bhava')).toBe(28);
    expect(displayIndexOf('D30')).toBe(16);
  });
  it('UseTwoChartStyles: each pair shows DisplayVarga[2k] in ChartStyle and ChartStyle2', () => {
    const p = slotPlaces({ UseTwoChartStyles: 1, ChartStyle2: 2 }, 6, 'south');
    expect(p.map((x) => x.varga)).toEqual(['D1', 'D1', 'D30', 'D30', 'D10', 'D10']);
    expect(p.map((x) => x.style)).toEqual(['south', 'north', 'south', 'north', 'south', 'north']);
    expect(p.map((x) => x.at)).toEqual([0, 0, 2, 2, 4, 4]);
  });
});

describe('Change birthtime to move lagna to the previous / next sign (33187 / 33186)', async () => {
  const swe = await nodeSweph();
  const lagnaIn = (c: Awaited<ReturnType<typeof computeChart>>, v: 'D1' | 'D9') =>
    Math.floor(vargaLongitude(c.positions.ascendant, vargasOf(c.ini)[v]) / 30) % 12;
  for (const name of CHARTS) {
    for (const v of ['D1', 'D9'] as const) {
      it(`${name} ${v}`, async () => {
        const birth = load(name);
        const chart = await computeChart(swe, birth);
        const next = await computeChart(swe, movedLagnaBirth(swe, chart, birth, v, 'next').birth);
        const prev = await computeChart(swe, movedLagnaBirth(swe, chart, birth, v, 'prev').birth);
        expect(lagnaIn(next, v)).toBe((lagnaIn(chart, v) + 1) % 12);
        expect(lagnaIn(prev, v)).toBe((lagnaIn(chart, v) + 11) % 12);
        // the moved moment sits 5e-6 day past the boundary
        expect(Math.abs(next.positions.jdUt - chart.positions.jdUt - signChange(swe, chart, 'Lagna', vargaDivisions(v)).laterDays)).toBeLessThan(1e-4);
      });
    }
  }
});

describe('slot charts: Bhava/Chalit chakra (varga 28) and "houses from this planet" (33294)', async () => {
  const swe = await nodeSweph();
  it('captions, signs and the "Bhava from %s" line', async () => {
    const chart = await computeChart(swe, load('Mahatma Gandhi'));
    const slot = slotChart(chart, {}, 'Bhava', 'standard', 'Natal Chart', { housesFrom: 1 })!;
    expect(slot.caption).toEqual({ name: 'Natal Chart', varga: 'Bhava/Chalit', short: 'D-1 (Moon)' });
    expect(slot.short).toBe('D-1 (B)');
    expect(slot.extraCaption).toBe('Bhava from Sun');
    const signs = bhavaSigns(chart, chart.ini);
    expect(slot.grahaSign('Sun')).toBe(signs[1]);
    expect(slot.lagna).toBe(signs[0]);
    const d9 = slotChart(chart, {}, 'D9', 'standard', 'Natal Chart')!;
    expect([d9.bhava, d9.short, d9.extraCaption]).toEqual([false, 'D-9', undefined]);
  });
});

describe('mixed charts (handler 0x4853e0)', async () => {
  const swe = await nodeSweph();
  it('natal D-1 inside, the derived chart D-1 outside, "Outer: <chart name>"', async () => {
    const natal = await computeChart(swe, load('Mahatma Gandhi'));
    const outer = await computeChart(swe, { ...natal.birth, year: natal.birth.year + 30 });
    const m = mixedVargas(natal, { inner: 0, outer: 0, outerChart: outer, outerName: 'Tajaka annual' });
    expect(m.innerCaption).toEqual(['Inner: Natal Chart', 'Rasi']);
    expect(m.outerCaption).toEqual(['Outer: Tajaka annual', 'Rasi']);
    expect(m.signs.flatMap((s) => s.outer).every((b) => b.transit)).toBe(true);
    // without a derived chart: natal D-1 inside, natal D-9 outside
    const plain = mixedVargas(natal, { inner: 0 });
    expect(plain.outerCaption).toEqual(['Outer: Natal Chart', 'Navamsa']);
  });
});

// ---- JHora captures -----------------------------------------------------------------------------

interface GdiEvent { hwnd: number; cls?: string; fn: string; text?: string; rect?: [number, number, number, number]; fmt?: number }
interface Captured {
  texts: { sub?: string; mode?: string | null; name?: string; lines?: string[]; dialogs?: string[] }[];
  draws?: { top?: string; sub: string | null; mode?: string | null; events: GdiEvent[] }[];
}
const DIRS = existsSync('golden') ? readdirSync('golden').filter((d) => /^jhora-chartpane(-twostyles|-unpacked)?$/.test(d)) : [];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Date and time lines of a Key Info copy. */
function keyInfoMoment(lines: string[]) {
  const date = /Date:\s+(\w+) (\d+), (-?\d+)/.exec(lines.find((l) => l.startsWith('Date:')) ?? '');
  const time = /Time:\s+(\d+):(\d+):(\d+)/.exec(lines.find((l) => l.startsWith('Time:')) ?? '');
  if (!date || !time) return null;
  return { year: Number(date[3]), month: MONTHS.indexOf(date[1]) + 1, day: Number(date[2]), hour: Number(time[1]) + Number(time[2]) / 60 + Number(time[3]) / 3600 };
}

describe.skipIf(!DIRS.length)('chart pane and chart menu match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const dir of DIRS) {
    for (const file of readdirSync(`golden/${dir}`).filter((f) => f.endsWith('.json'))) {
      const name = file.slice(0, -5);
      const g: Captured = JSON.parse(readFileSync(`golden/${dir}/${file}`, 'utf8'));
      describe(`${dir} / ${name}`, async () => {
        const natalBirth = load(name);
        it('lagna moves and undo (Key Info birth time)', async () => {
          // JHora: next, next again, undo -> the first move, previous (from there), undo all -> natal
          const steps: [string, (b: BirthData) => Promise<BirthData>][] = [];
          const move = (dir2: 'prev' | 'next') => async (b: BirthData) => movedLagnaBirth(swe, await computeChart(swe, b), b, 'D1', dir2).birth;
          const b1 = await move('next')(natalBirth);
          const b2 = await move('next')(b1);
          const b3 = await move('prev')(b1);
          steps.push(['After: Lagna to next sign', async () => b1], ['After: Lagna to next sign again', async () => b2],
            ['After: Undo the latest change', async () => b1], ['After: Lagna to previous sign', async () => b3], ['After: Undo all changes', async () => natalBirth]);
          for (const [mode, ours] of steps) {
            const t = g.texts.find((x) => x.name === 'key_info' && x.mode === mode);
            if (!t?.lines) continue;
            const theirs = keyInfoMoment(t.lines)!;
            const b = await ours(natalBirth);
            expect([theirs.year, theirs.month, theirs.day], mode).toEqual([b.year, b.month, b.day]);
            expect(Math.abs(theirs.hour - b.hour) * 3600, mode).toBeLessThan(1.5);
          }
        });
        it('When will lagna change (33076) message', async () => {
          const t = g.texts.find((x) => x.mode === 'When will lagna change' && x.dialogs);
          if (!t) return;
          const r = signChange(swe, await computeChart(swe, natalBirth), 'Lagna', 1);
          const text = t.dialogs!.join(' ');
          expect(text).toContain(formatSpan(r.earlierDays));
          expect(text).toContain(formatSpan(r.laterDays));
        });
        it('left pane: 6 (packed) or 2 charts, 2 columns x 3 rows', () => {
          const d = g.draws?.find((x) => x.mode === 'Chart pane');
          if (!d) return;
          // chart boxes: square background fills (as in chartViewsGolden.test.ts)
          const boxes = d.events.filter((e) => e.fn === 'ExtTextOut' && !e.text && e.rect && e.rect[0] >= 0 && e.rect[2] - e.rect[0] > 100
            && e.rect[2] - e.rect[0] === e.rect[3] - e.rect[1]).map((e) => e.rect!);
          const seen = new Map(boxes.map((r) => [r.join(','), r]));
          const n = dir.endsWith('unpacked') ? 2 : 6;
          expect(seen.size).toBeGreaterThanOrEqual(n);
          const first = [...seen.values()].slice(0, n);
          expect(new Set(first.map((r) => r[0])).size).toBe(n === 6 ? 2 : 1);
          expect(new Set(first.map((r) => r[1])).size).toBe(n === 6 ? 3 : 2);
        });
        it('mixed Tajaka-natal window and Mixed 2-Vargas with the Tajaka chart', () => {
          for (const d of (g.draws ?? []).filter((x) => x.sub === 'Mixed 2-Vargas' || x.top === 'Tajaka' || x.sub === null)) {
            const texts = d.events.filter((e) => e.fn === 'DrawText' || e.fn === 'ExtTextOut').map((e) => e.text ?? '');
            if (!texts.some((x) => x.startsWith('Outer:'))) continue;
            expect(texts).toContain('Inner: Natal Chart');
            expect(texts.some((x) => /^Outer: Taj/.test(x))).toBe(true);
          }
        });
      });
    }
  }
});
