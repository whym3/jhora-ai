// The mixed chart's own right-click menu 153 (CMixedChartView 0x45c8d0, commands of the base
// CChartView on slot 12 / 13; core/chakras/mixedVargas.ts, src/ui/chakras/MixedVargas.tsx,
// ChartMenu.tsx MENU_153): body views, the Bhava/Chalit chakra, captions, check marks and the
// menu items. JHora's mixed-chart commands cannot be driven by the capture harness (it posts
// WM_COMMAND without the right-click that selects the half: view+0x8ad0 stays 0, a Many Vargas
// slot), so there is no golden for them.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { chartSigns, viewBodies } from '../src/core/chartBodies';
import { bhavaSigns } from '../src/core/bhavaChart';
import { ARUDHAS_OF_PLANETS, MIXED_BHAVA_VARGA, MIXED_VIEW_CHECK, mixedSlots, mixedVargas } from '../src/core/chakras/mixedVargas';
import { ChartMenu, type MenuTarget } from '../src/ui/shell/ChartMenu';

const load = async (name: string) => computeChart(await nodeSweph(), parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

describe('mixed chart halves (FUN_0045d1e0)', async () => {
  const chart = await load('Mahatma Gandhi');

  it('the standard view draws the same bodies as before (default flags of FUN_0043f030)', () => {
    const plain = mixedVargas(chart);
    const viewed = mixedVargas(chart, { innerView: 'standard', outerView: 'standard', ini: chart.ini });
    const key = (d: typeof plain) => d.signs.map((s) => [s.inner.map((b) => `${b.index}${b.label}${b.retrograde}`), s.outer.map((b) => `${b.index}${b.label}${b.retrograde}`)]);
    expect(key(viewed)).toEqual(key(plain));
  });

  it('a body view changes the half: upagraha view outside', () => {
    const d = mixedVargas(chart, { outerView: 'upagraha', ini: chart.ini });
    const outer = d.signs.flatMap((s) => s.outer).map((b) => b.index).sort((a, b) => a - b);
    expect(outer).toEqual(viewBodies('upagraha', chart.ini).filter((i) => outer.includes(i)));
    expect(outer).toContain(22);
    expect(outer).not.toContain(1);
    // signs follow chartSigns of the half's varga (D-9 outside)
    const nav = chartSigns(chart, 'D9', { view: 'upagraha', ini: chart.ini });
    d.signs.forEach((s) => expect(s.outer.map((b) => b.index)).toEqual(nav[s.sign].map((b) => b.index)));
    expect([d.innerNote, d.outerNote]).toEqual(['', '']);
  });

  it('graha arudha views add "Arudhas of Planets"; corner bodies share one counter', () => {
    const d = mixedVargas(chart, { innerView: 'grahaArudha', outerView: 'varnada', ini: chart.ini });
    expect([d.innerNote, d.outerNote]).toEqual([ARUDHAS_OF_PLANETS, '']);
    // V2..V12 go to the corner slots of the outer half
    const bodies = [{ index: 1 }, { index: 48 }, { index: 2 }, { index: 49 }].map((b) => ({ ...b, label: '', lon: 0, retrograde: false }));
    expect(mixedSlots(bodies)).toEqual([[1 / 6, 5 / 54], [3 / 8, 5 / 18 + 1 / 9], [0, 0], [1 / 8, 5 / 18 + 1 / 9]]);
  });

  it('varga 28: the Bhava/Chalit chakra with its captions', () => {
    const signs = bhavaSigns(chart);
    const d = mixedVargas(chart, { inner: MIXED_BHAVA_VARGA, innerBhavaSigns: signs, outer: 3 });
    expect(d.innerCaption).toEqual(['Inner: Natal Chart', 'Bhava/Chalit']);
    expect(d.innerShort).toBe('D-1 (Moon)');
    expect([d.outerCaption[1], d.outerShort]).toEqual(['Drekkana', 'D-3 (Trd)']);
    for (const s of d.signs) for (const b of s.inner) if (b.index <= 9) expect(signs[b.index]).toBe(s.sign);
    expect(d.lagnaSign).toBe(signs[0]);
    expect(() => mixedVargas(chart, { inner: MIXED_BHAVA_VARGA })).toThrow();
  });

  it('display mode: the derived chart in the inner half is named and marked', async () => {
    const outer = await computeChart(await nodeSweph(), { ...chart.birth, year: chart.birth.year + 30 });
    const d = mixedVargas(chart, { innerChart: outer, innerName: 'Tajaka annual', inner: 0, outer: 0 });
    expect(d.innerCaption[0]).toBe('Inner: Tajaka annual');
    expect(d.signs.flatMap((s) => s.inner).every((b) => b.transit)).toBe(true);
    expect(d.outerCaption[0]).toBe('Outer: Natal Chart');
  });
});

describe('menu 153 (ChartMenu menu="mixed")', () => {
  const target = (t: Partial<MenuTarget> = {}): MenuTarget => ({ x: 0, y: 0, slot: 1, sign: 4, body: 'Sun', varga: 'D-9', ...t });
  // the menu places itself inside the window
  (globalThis as { window?: unknown }).window ??= { innerWidth: 1280, innerHeight: 1024 };
  const render = (t: MenuTarget) => decode(renderToStaticMarkup(createElement(ChartMenu, { target: t, onAction: () => {}, onClose: () => {}, menu: 'mixed' })));
  const items = (html: string) => [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);

  it('items in JHora order', () => {
    const it = items(render(target({ view: 'standard', natalOnly: false })));
    expect(it.slice(0, 5)).toEqual(['When will lagna change sign in D-9', 'Show ashtakavarga of this chart', 'Rasi chakra', 'Bhava chakra or Chalit chakra', 'Navamsa chakra']);
    expect(it).toContain('Dwadasamsa-Dwadasamsa (D-144)');
    expect(it).toContain('as text to clipboard (south-north-east styles)');
    expect(it).not.toContain('Standard view with graha arudhas');
    expect(it).not.toContain('Packed chart mode (more charts)');
    expect(it.slice(-2)).toEqual(['✓ Automatic (Natal, Tajaka etc)', 'Natal chart only']);
    expect(it).toContain('✓ Standard view');
    expect(it.filter((x) => x.startsWith('✓'))).toHaveLength(2);
  });

  it("the view check mark of 0x45c8d0 is one item off (kind 1 is not in menu 153)", () => {
    expect(MIXED_VIEW_CHECK.upagraha).toBe('grahaArudha');
    const it = items(render(target({ view: 'upagraha', natalOnly: true })));
    expect(it).toContain('✓ Graha arudha view');
    expect(it).toContain('Upagraha view');
    expect(it).toContain('✓ Natal chart only');
    expect(items(render(target({ view: 'specialLagna' }))).filter((x) => x.startsWith('✓') && x.includes('view'))).toEqual([]);
  });

  it('the rasi items need a sign box (the centre square is none)', () => {
    const html = render(target({ sign: -1 }));
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>having argala on this rasi<\/button>/);
    expect(html).toContain('No rasi');
    expect(render(target())).not.toMatch(/disabled=""[^>]*>having argala/);
  });
});
