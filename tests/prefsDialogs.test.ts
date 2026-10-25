// Edit / View / Preferences ports: the option-dialog registry (src/ui/dialogs/optionRegistry.ts),
// "Restore default" / "recommended by author" (src/core/presetOptions.ts), the user bodies
// (src/core/userPoints.ts), the display time zone (src/core/displayTz.ts), navigation history
// and notes (src/ui/state/store.ts), colours (src/ui/appearance.ts) and the am/pm clock.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULTS, INI_SPEC, type JhoraIni } from '../src/settings/generated';
import { applyFields, dialogFields, OPTION_DIALOGS, optionDialog, readField } from '../src/ui/dialogs/optionRegistry';
import { COLOR_FRAMES, COLOR_ITEMS } from '../src/ui/dialogs/colorItems';
import { RECOMMENDED_OPTIONS, RESTORED_DEFAULT_OPTIONS } from '../src/core/presetOptions';
import { risingOffset, specialLagnaName, specialPointLongitude, SPECIAL_POINT_BODIES, SPECIAL_POINT_SAHAMAS } from '../src/core/userPoints';
import { birthInZone, displayBirth, zoneFields, zoneFromFields } from '../src/core/displayTz';
import { appearanceCss, colorrefToHex, hexToColorref } from '../src/ui/appearance';
import { formatHms, formatHmsAmPm } from '../src/core/keyInfo';
import { chartSigns } from '../src/core/chartBodies';
import { JHORA_BODIES } from '../src/core/chakras/common';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { nodeSweph } from './helpers';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OptionDialog } from '../src/ui/dialogs/OptionDialog';
import { MenuBar } from '../src/ui/MenuBar';
import { ColorsDialog } from '../src/ui/dialogs/ColorsDialog';
import { SpecialLagnaDialog, SpecialPointDialog } from '../src/ui/dialogs/EditDialogs';

const KEYS = new Set(INI_SPEC.map((s) => s.key));
const menus = readFileSync('tools/harness/res/menus.txt', 'utf8');

describe('option dialog registry', () => {
  it('binds every control to a real ini key and a JHora menu command', () => {
    for (const d of OPTION_DIALOGS) {
      expect(menus, `menu command ${d.cmd}`).toMatch(new RegExp(`^\\s+${d.cmd}\\t`, 'm'));
      for (const f of dialogFields(d)) {
        expect(KEYS.has(f.key), `${d.dialog}/${f.id} ${f.key}`).toBe(true);
        if (f.kind === 'combo') expect(f.items?.length, `${d.dialog}/${f.id}`).toBeGreaterThan(1);
      }
    }
  });

  it('shows JHora defaults on a combo item and OK without changes keeps them', () => {
    for (const d of OPTION_DIALOGS) {
      const values = Object.fromEntries(dialogFields(d).map((f) => [f.id, readField(f, DEFAULTS)]));
      for (const f of dialogFields(d)) {
        if (f.kind !== 'combo') continue;
        const v = Number(values[f.id]);
        expect(v >= 0 && v < f.items!.length, `${d.dialog}/${f.id} default ${v}`).toBe(true);
      }
      const patch = applyFields(d, DEFAULTS, values);
      for (const [k, v] of Object.entries(patch)) expect(v, `${d.dialog} ${k}`).toEqual(DEFAULTS[k as keyof JhoraIni]);
    }
  });

  it('ports the handlers that transform values', () => {
    const with_ = (dialog: number, ini: JhoraIni, set: Record<number, number>) => {
      const d = optionDialog(dialog)!;
      const values = { ...Object.fromEntries(dialogFields(d).map((f) => [f.id, readField(f, ini)])), ...set };
      return applyFields(d, ini, values);
    };
    // 2080: LunarYrDef = 2 * month definition + tropical (FUN_004b9400); default 2 = amanta, sidereal
    expect(readField(dialogFields(optionDialog(2080)!)[0], DEFAULTS)).toBe(1);
    expect(with_(2080, DEFAULTS, { 1004: 1 }).LunarYrDef).toBe(3);
    expect(with_(2080, DEFAULTS, { 1003: 0 }).LunarYrDef).toBe(0);
    // 2030: combo 1004 = WeekdayDefinitionKaala - 1
    expect(with_(2030, DEFAULTS, { 1004: 1 }).WeekdayDefinitionKaala).toBe(2);
    // 2059: the 11th base item (Bhavalagna) stores 13
    expect(with_(2059, DEFAULTS, { 1005: 10 }).ArudhaBasePlanet).toBe(13);
    expect(readField(dialogFields(optionDialog(2059)!).find((f) => f.id === 1005)!, { ...DEFAULTS, ArudhaBasePlanet: 13 })).toBe(10);
    // 157: check 1012 is bit 6 of MaskedPrintPageMap
    expect(with_(157, DEFAULTS, { 1012: 0 }).MaskedPrintPageMap).toBe(2047 & ~(1 << 6));
    // 170: Gulika is slot 5, Mandi slot 4, Kaala etc. slots 0..3
    expect(with_(170, DEFAULTS, { 1010: 2, 1011: 0, 1012: 2 }).UpagrahaRiseMethod).toEqual([2, 2, 2, 2, 0, 2]);
  });

  it('Siddhanta SSS selects the SSS ayanamsa and opens the ayanamsa dialog (FUN_004e56f0)', () => {
    const d = optionDialog(2072)!;
    expect(d.afterOk!({ ...DEFAULTS, Siddhanta: 1 })).toMatchObject({ patch: { UserSelectedAyanamsa: 18, DeltaFromUserSelectedAyanamsa: 0 }, open: 'ayanamsa' });
    expect(d.afterOk!({ ...DEFAULTS, HouseTypeWanted: 11 })?.patch).toEqual({ HouseTypeWanted: 3 });
    expect(optionDialog(2065)!.then).toBe(2080);
  });
});

describe('presets (32938 / 33328)', () => {
  it('only uses ini keys', () => {
    for (const k of [...Object.keys(RECOMMENDED_OPTIONS), ...Object.keys(RESTORED_DEFAULT_OPTIONS)]) expect(KEYS.has(k), k).toBe(true);
  });
  it('sets what FUN_004e5fa0 stores', () => {
    const r = RECOMMENDED_OPTIONS;
    expect(r.UserSelectedAyanamsa).toBe(21);
    expect(r.CustomStarCode).toBe(',deCnc');
    expect(r.CustomStarLongitude).toBe(106);
    expect(r.YearDefinition).toEqual(Array(75).fill(7));
    expect(r.YearLength).toEqual(Array(75).fill(365.24219));
    expect(r.UseDasaSeedFromNatalInTajaka).toEqual(Array(75).fill(0));
    expect([r.D3Preference, r.D10Preference, r.D60Preference, r.D7Preference, r.D16Preference, r.HoraPreference]).toEqual([4, 4, 2, 1, 1, 6]);
    expect([r.LunarYrDef, r.LunarYrSign, r.SolarYrSign, r.SolarYrTrop, r.CharaKarakaDefinition]).toEqual([3, 3, 3, 1, 3]);
    expect([r.TrueNodes, r.TropicalTajaka, r.ContinuousSpecialLagnas, r.NodalExaltationParasara, r.LifeCycleYearDefinition]).toEqual([1, 1, 1, 1, 7]);
    expect(r.NakshatraDasaStartPoint![12]).toBe(4);
    expect(r.ShowOuterPlanetsInCharts).toBe(0);
  });
  it('restores what FUN_004e5870 stores', () => {
    const d = RESTORED_DEFAULT_OPTIONS;
    expect(d.UserSelectedAyanamsa).toBe(17);
    expect(d.CustomStarCode).toBe(',alVir');
    expect(d.KalachakraDasaCalculation).toBe(4);
    expect(d.DisplayVarga).toEqual([0, 1, 9, 13, 7, 19, 2, 11, 16, 3, 12, 14, 0, 0, 0]);
    expect(d.YearDefinition).toEqual(Array(75).fill(3));
  });
});

describe('user bodies (FUN_004a70d0)', () => {
  const lon = (i: number) => [100, 350, 10][i] ?? 0;
  const ini = (p: Partial<JhoraIni>) => ({ ...DEFAULTS, SpecialPointUsePlanet: 0, ...p });
  it('special point', () => {
    expect(specialPointLongitude(ini({ SpecialPointUsePlanet: 1, SpecialPointPlanetIndex: 0, SpecialPointDeg: 10, SpecialPointMin: 30 }), lon, () => 0)).toBeCloseTo(110.5, 12);
    expect(specialPointLongitude(ini({ SpecialPointUsePlanet: 1, SpecialPointPlanetIndex: 2, SpecialPointBehindAfter: 0, SpecialPointDeg: 20 }), lon, () => 0)).toBeCloseTo(350, 12);
    expect(specialPointLongitude(ini({ SpecialPointUseSaham: 1, SpecialPointSahamIndex: 3, SpecialPointSec: 36 }), lon, (i) => i * 10)).toBeCloseTo(30.01, 12);
    expect(specialPointLongitude(ini({ SpecialPointUseRasi: 1, SpecialPointSignIndex: 11, SpecialPointDeg: 45 }), lon, () => 0)).toBeCloseTo(15, 12);
    // mid-point from 350 to 10 is 0 (not 180)
    expect(specialPointLongitude(ini({ SpecialPointUseMidPoint: 1, SpecialPointPlanetIndex1: 1, SpecialPointPlanetIndex2: 2 }), lon, () => 0)).toBeCloseTo(0, 12);
    // no source selected: off + off (sic)
    expect(specialPointLongitude(ini({ SpecialPointDeg: 7 }), lon, () => 0)).toBeCloseTo(14, 12);
  });
  it('dialog lists and names', () => {
    expect(SPECIAL_POINT_BODIES).toHaveLength(47);
    SPECIAL_POINT_BODIES.forEach((b, i) => expect(JHORA_BODIES[i][0]).toBe(b));
    expect(SPECIAL_POINT_SAHAMAS).toHaveLength(36);
    expect(specialLagnaName(5, 9)).toBe('Ju9');
    expect(specialLagnaName(1, 5, true)).toBe('Sy5');
    expect(risingOffset(1, 0, 1)).toBe(0);
    expect(risingOffset(1, 1, 1)).toBeCloseTo(-0.26638, 4);           // the Sun's semi-diameter at 1 AU
    expect(risingOffset(1, 2, 1)).toBeCloseTo(-0.26638 - 0.56667, 4);
    expect(risingOffset(8, 2, 0.0026)).toBeCloseTo(-0.56667, 4);       // no radius for the nodes
  });
  it('computes both for a chart and draws them in every varga', async () => {
    const swe = await nodeSweph();
    const birth = parseJhd(readFileSync('golden/charts/Mahatma Gandhi.jhd', 'latin1'));
    const chart = await computeChart(swe, birth, {
      SpecialPointOn: 1, SpecialPointUsePlanet: 1, SpecialPointPlanetIndex: 2, SpecialPointDeg: 1,
      SpecialLagnaOn: 1, SpecialLagnaPlanet: 1, SpecialLagnaSpeedFactor: 5, SpecialLagnaName: 'Su5',
    });
    const [sp, sl] = chart.userPoints!;
    expect(sp).toMatchObject({ index: 103, name: 'Special Point', symbol: 'SP' });
    expect(sp.lon).toBeCloseTo((chart.positions.grahas.Moon.lon + 1) % 360, 9);
    // Su5 starts from the Sun rising like the ghati lagna and moves 5 x 360 deg a day
    const gl = chart.longitudes.find((b) => b.name === 'Ghati Lagna')!.lon;
    expect(sl).toMatchObject({ index: 104, name: 'Su5', symbol: 'Su5' });
    expect(Math.abs(((sl.lon - gl + 540) % 360) - 180)).toBeLessThan(0.1);
    const signs = chartSigns(chart, 'D1');
    expect(signs[Math.floor(sp.lon / 30)].some((b) => b.label === 'SP' && b.kind === 'user')).toBe(true);
    const off = await computeChart(swe, birth);
    expect(off.userPoints).toEqual([]);
  });
});

describe('display time zone (33200)', () => {
  const b = parseJhd(readFileSync('golden/charts/Mahatma Gandhi.jhd', 'latin1'));
  it('keeps the moment and moves the clock', () => {
    const z = birthInZone(b, -5);
    const ut = (x: typeof b) => Date.UTC(x.year, x.month - 1, x.day) / 864e5 + (x.hour - x.tzHours) / 24;
    expect(ut(z)).toBeCloseTo(ut(b), 9);
    expect(z.tzHours).toBe(-5);
    expect(displayBirth(b, null)).toBe(b);
  });
  it('rolls dates in the Julian calendar too', () => {
    const j = { ...b, year: 1500, month: 3, day: 1, hour: 1, tzHours: 5 };
    expect(birthInZone(j, -2)).toMatchObject({ year: 1500, month: 2, day: 29, hour: 18 });
    const g = { ...b, year: 1582, month: 10, day: 15, hour: 1, tzHours: 2 };
    expect(birthInZone(g, 0)).toMatchObject({ month: 10, day: 4, hour: 23 });
  });
  it('dialog fields', () => {
    expect(zoneFromFields(5, 30, false)).toBeCloseTo(5.5, 12);
    expect(zoneFromFields(4, 0, true)).toBe(-4);
    expect(zoneFields(-3.75)).toEqual({ hours: 3, minutes: 45, west: true });
  });
});

describe('navigation history and notes (store)', () => {
  it('goes back and forward through visited views (FUN_004eb890 / FUN_004e74c0 / FUN_004e7500)', async () => {
    const s = await import('../src/ui/state/store');
    s.setState({ nav: { stack: [], pos: -1 }, view: { ...s.getState().view, topTab: 'Basics', subTab: {} } });
    s.setTopTab('Dasas');
    s.setSubTab('Dasas', 'Rasi dasas');
    s.setTopTab('Strengths');
    expect(s.getState().nav.stack.map((e) => e.topTab)).toEqual(['Basics', 'Dasas', 'Dasas', 'Strengths']);
    expect(s.getState().nav.stack[2].sub).toBe('Rasi dasas');
    s.navigateBack();
    expect(s.getState().view.topTab).toBe('Dasas');
    expect(s.currentSubTab(s.getState().view, 'Dasas')).toBe('Rasi dasas');
    s.navigateBack(); s.navigateBack();
    expect(s.getState().view.topTab).toBe('Basics');
    expect(s.canNavigateBack(s.getState())).toBe(false);
    s.navigateForward();
    expect(s.getState().view.topTab).toBe('Dasas');
    // a new view drops the forward entries
    s.setTopTab('Chakras');
    expect(s.canNavigateForward(s.getState())).toBe(false);
    expect(s.getState().nav.stack.at(-1)!.topTab).toBe('Chakras');
  });
  it('names the notes file like JHora', async () => {
    const s = await import('../src/ui/state/store');
    expect(s.notesFileName('Mahatma Gandhi')).toBe('Mahatma Gandhi.txt');
    expect(s.notesFileName('x.jhd')).toBe('x.txt');
  });
});

describe('colours, fonts and the am/pm clock', () => {
  it('maps COLORREFs', () => {
    expect(colorrefToHex(255)).toBe('#ff0000');
    expect(hexToColorref('#0000ff')).toBe(0xff0000);
    expect(COLOR_ITEMS).toHaveLength(125);
    expect(COLOR_FRAMES).toHaveLength(13);
    for (const c of COLOR_ITEMS) expect(KEYS.has(c.key), c.key).toBe(true);
  });
  it('styles only what differs from JHora', () => {
    expect(appearanceCss(DEFAULTS)).toBe('');
    const css = appearanceCss({ ...DEFAULTS, ColorChartViewPlanet: 0x0000ff, ColorFornViewBackground: 0x00ff00, FontSizeSelection: 7 });
    expect(css).toContain(':root .cb { fill: #ff0000; }');
    expect(css).toContain('--bg: #00ff00;');
    expect(css).toContain('font-size: 150%;');
  });
  it('formats times like FUN_004c1e20', () => {
    expect(formatHmsAmPm(13.5)).toBe('1:30:00 pm');
    expect(formatHmsAmPm(0.25)).toBe('12:15:00 am');
    expect(formatHmsAmPm(12)).toBe('12:00:00 pm');
    expect(formatHms(13.5)).toBe('13:30:00');
  });
});

describe('dialogs render', () => {
  it('every option dialog, the Edit dialogs, Colors and the menu bar', () => {
    for (const d of OPTION_DIALOGS) {
      const html = renderToStaticMarkup(createElement(OptionDialog, { def: d, onDone: () => {} }));
      expect(html, `${d.dialog}`).toContain(d.title.replace(/&/g, '&amp;'));
      for (const f of dialogFields(d)) if (f.kind === 'combo') expect(html).toContain(`(${f.id})`);
    }
    expect(renderToStaticMarkup(createElement(SpecialPointDialog, { onClose: () => {} }))).toContain('Mid-point of');
    expect(renderToStaticMarkup(createElement(SpecialLagnaDialog, { onClose: () => {} }))).toContain('Shown as Su5');
    expect(renderToStaticMarkup(createElement(ColorsDialog, { onClose: () => {} }))).toContain('Chart frames');
    expect(renderToStaticMarkup(createElement(MenuBar))).toContain('Preferences');
  });
});
