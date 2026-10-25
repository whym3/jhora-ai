// "Copy chart as text" (commands 32985 current style / 32992 south-north-east) against JHora 8.0's
// clipboard texts (golden/jhora-v3/<chart>.json texts "chart_text" / "chart_text_sne": the
// Rasi chart of the chart pane, default ChartStyle 0) - byte for byte, for every chart - and the
// body sets of the chart views (menu 103) from jhora.exe.
// Other styles and the body views: tests/chartViewsGolden.test.ts.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { chartText, chartTextSne } from '../src/core/chartText';
import { chartSigns, viewBodies, CHART_LABELS } from '../src/core/chartBodies';
import { DEFAULTS } from '../src/settings/generated';

interface Text { name?: string; lines?: string[]; top: string; sub: string | null }
interface Golden { texts: Text[]; ini_overrides?: Record<string, string> }

const DIR = 'golden/jhora-v3';
const charts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
const lines = (s: string) => s.replace(/\r\n/g, '\n').split('\n');

describe.skipIf(!charts.length)('chart as text matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const name of charts) {
    const g: Golden = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'));
    const text = (n: string) => g.texts.find((t) => t.name === n && t.top === 'Chakras')?.lines;
    if (!text('chart_text')) continue;
    describe(name, async () => {
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      it('32985 current style (South Indian)', () => {
        expect(lines(chartText(chart, 'D1', DEFAULTS.ChartStyle))).toEqual(text('chart_text'));
      });
      it('32992 south-north-east', () => {
        expect(lines(chartTextSne(chart, 'D1'))).toEqual(text('chart_text_sne'));
      });
    });
  }
});

describe('chart views (menu 103)', () => {
  it('standard view: the Show*InCharts bodies, Maandi/Gulika under the shifted keys', () => {
    expect(viewBodies('standard').map((i) => CHART_LABELS[i].trim())).toEqual(
      ['As', 'Su', 'Mo', 'Ma', 'Me', 'Ju', 'Ve', 'Sa', 'Ra', 'Ke', 'HL', 'GL', 'PP', 'SL', 'BB', 'Md', 'Gk', 'AL', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'UL']);
    expect(viewBodies('standard', { ShowUserPointsInCharts: 0 })).not.toContain(31);
    expect(viewBodies('standard', { ShowMandiInCharts: 0 })).not.toContain(32);
    expect(viewBodies('standard', { ShowOuterPlanetsInCharts: 1 })).toEqual(expect.arrayContaining([10, 11, 12]));
  });
  it('other views', () => {
    const labels = (v: Parameters<typeof viewBodies>[0]) => viewBodies(v).map((i) => CHART_LABELS[i].trim()).join(' ');
    expect(labels('upagraha')).toBe('As HL GL Dh Vy PV IC UK Kl Mri AP YG Md Gk AL');
    expect(labels('grahaArudha')).toBe('As HL GL Su Mo Ma Me Ju Ve Sa Ra Ke');
    expect(labels('dualGrahaArudha')).toBe('As HL GL Su Mo Ra Ke Ma1 Me3 Ju9 Ve2 Sa10 Ma8 Me6 Ju12 Ve7 Sa11');
    expect(labels('specialLagna')).toBe('As HL GL VG PP SL IL BB VL AL');
    expect(labels('varnada')).toBe('As Su Mo Ma Me Ju Ve Sa Ra Ke HL GL VL V2 V3 V4 V5 V6 V7 V8 V9 V10 V11 V12 AL');
    expect(labels('standardGrahaArudhas')).toContain('L1 L2');
  });
  it('Chandra arudha view relabels the arudhas counted from the Moon', async () => {
    const swe = await nodeSweph();
    if (!existsSync('golden/charts/Swami Vivekananda.jhd')) return;
    const chart = await computeChart(swe, parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1')));
    const std = chartSigns(chart, 'D1');
    const moon = chartSigns(chart, 'D1', { view: 'chandraArudha' });
    const signOf = (l: ReturnType<typeof chartSigns>, label: string) => l.findIndex((x) => x.some((b) => b.label.trim() === label));
    const moonHouse = (signOf(std, 'Mo') - signOf(std, 'As') + 12) % 12;
    // M1 is the arudha of the Moon's house: the standard view's A<moonHouse + 1>
    expect(signOf(moon, 'M1')).toBe(signOf(std, moonHouse === 0 ? 'AL' : moonHouse === 11 ? 'UL' : `A${moonHouse + 1}`));
  });
});
