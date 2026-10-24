// The AI astrologer's retrieval tools (src/ai/tools.ts): option lists match the engine's
// registries, every tool runs on a real chart through the same jobs the views use, and
// inputs are validated before running.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { ASYNC_TABLES, TABLES, TEXTS } from '../src/engine/jobs';
import type { JobRequest } from '../src/engine/protocol';
import { NAKSHATRA_DASAS } from '../src/core/dasas/nakshatra';
import { OTHER_DASAS, RASI_DASAS } from '../src/core/dasas/registry';
import { ALL_VARGAS } from '../src/core/vargas';
import { YOGA_MODES } from '../src/core/yogas';
import { BASIC_MODES } from '../src/core/transits/basic';
import { AV_MODES as UI_AV_MODES } from '../src/ui/shell/tabs';
import { SAHAMAS } from '../src/core/sahamas';
import { SIGNS } from '../src/core/zodiac';
import { VARGA_ORDER } from '../src/core/transits/common';
import {
  AI_TOOLS, AV_MODES, NAKSHATRA_DASA_SYSTEMS, OTHER_DASA_SYSTEMS, RASI_DASA_SYSTEMS, SAHAMA_NAMES, SIGN_NAMES, TRANSIT_MODES, VARGAS, YOGA_CATEGORIES,
  anthropicStrictSchema, localDateString, openaiStrictSchema, runTool, stripNulls, validateInput, type ToolContext,
} from '../src/ai/tools';
import { SYSTEM_PROMPT, chartContext } from '../src/ai/systemPrompt';

type Json = Record<string, unknown>;
/** Every object schema inside `s` (s itself included). */
function objects(s: Json): Json[] {
  const out: Json[] = [];
  const walk = (x: Json) => {
    if (x.type === 'object' || (Array.isArray(x.type) && x.type.includes('object'))) out.push(x);
    for (const p of Object.values((x.properties ?? {}) as Record<string, Json>)) walk(p);
    if (x.items) walk(x.items as Json);
    for (const a of (x.anyOf ?? []) as Json[]) walk(a);
  };
  walk(s);
  return out;
}

describe('AI tools', async () => {
  const swe = await nodeSweph();
  const birth = parseJhd(readFileSync('golden/charts/Swami Vivekananda.jhd', 'latin1'));
  // the worker's dispatch, in-process
  const request = async (req: JobRequest): Promise<unknown> => {
    const chart = await computeChart(swe, req.chart.birth, req.chart.ini);
    if (req.kind === 'text') return TEXTS[req.cmd](chart, req.params ?? {}, swe);
    if (req.kind === 'chart') return chart;
    const sync = TABLES[req.table];
    return sync ? sync(chart, req.params ?? {}, swe) : ASYNC_TABLES[req.table](chart, req.params ?? {}, swe);
  };
  const ctx: ToolContext = { request, spec: { birth, ini: {} }, title: 'Swami Vivekananda' };

  it('option lists match the engine', () => {
    expect(new Set(NAKSHATRA_DASA_SYSTEMS)).toEqual(new Set(['Vimsottari', 'Kalachakra', 'Saptarshi nakshatra', ...Object.keys(NAKSHATRA_DASAS)]));
    expect(RASI_DASA_SYSTEMS).toEqual(Object.keys(RASI_DASAS));
    expect(OTHER_DASA_SYSTEMS).toEqual(Object.keys(OTHER_DASAS));
    expect(VARGAS.every((v) => v in ALL_VARGAS)).toBe(true);
    expect(YOGA_CATEGORIES).toEqual(YOGA_MODES.map((m) => m[0]));
    expect(TRANSIT_MODES).toEqual(BASIC_MODES.map((m) => m[0]));
    expect(AV_MODES).toEqual([...UI_AV_MODES]);
    expect(SAHAMA_NAMES).toEqual(SAHAMAS.map((s) => s.name));
    expect(SIGN_NAMES).toHaveLength(SIGNS.length);
    expect([...VARGAS].sort()).toEqual([...VARGA_ORDER].sort());
  });

  it('the system prompt names every tool', () => {
    for (const t of AI_TOOLS) {
      expect(t.name).toMatch(/^get_[a-z_]+$/);
      expect(SYSTEM_PROMPT, t.name).toContain(t.name);
    }
  });

  it('schemas are closed and strict-ready', () => {
    for (const t of AI_TOOLS) {
      for (const o of objects(t.parameters)) {
        expect(o.additionalProperties, t.name).toBe(false);
        expect(Array.isArray(o.required), t.name).toBe(true);
      }
      const before = JSON.stringify(t.parameters);
      const a = anthropicStrictSchema(t.parameters), o = openaiStrictSchema(t.parameters);
      expect(JSON.stringify(t.parameters), 'transforms must not mutate').toBe(before);
      expect(JSON.stringify(a)).not.toMatch(/"(minimum|maximum|minItems|maxItems|default)"/);
      for (const x of objects(o)) expect(x.required, t.name).toEqual(Object.keys(x.properties as Json));
    }
  });

  it('OpenAI strict schemas make optional properties nullable', () => {
    const s = openaiStrictSchema(AI_TOOLS.find((t) => t.name === 'get_running_dasa')!.parameters);
    const props = s.properties as Record<string, Json>;
    expect(props.system.type).toBe('string');                     // required: unchanged
    expect(props.levels.type).toEqual(['integer', 'null']);
    expect(props.date.anyOf).toEqual(expect.arrayContaining([{ type: 'null' }]));
    const t = openaiStrictSchema(AI_TOOLS.find((x) => x.name === 'get_transits')!.parameters);
    expect((t.properties as Record<string, Json>).mode.enum).toContain(null);
  });

  it('examples validate against their schemas', () => {
    for (const t of AI_TOOLS) for (const ex of t.examples ?? []) expect(validateInput(t.parameters, ex), `${t.name} ${JSON.stringify(ex)}`).toBeNull();
  });

  it('nulls are dropped before validation', () => {
    expect(stripNulls({ a: null, b: { c: null, d: 1 }, e: [{ f: null }] })).toEqual({ b: { d: 1 }, e: [{}] });
  });

  it('dates are local calendar dates', () => {
    const justAfterMidnight = new Date(2026, 0, 1, 0, 30);
    expect(localDateString(justAfterMidnight)).toBe('2026-01-01');
    expect(chartContext('X', justAfterMidnight)).toContain('2026-01-01');
  });

  const cases: [string, Record<string, unknown>, RegExp][] = [
    ['get_chart_overview', {}, /Nakshatra:/],
    ['get_chart_overview', {}, /CALCULATION SETTINGS[\s\S]*Houses: Equal houses/],
    ['get_longitudes', {}, /Moon/],
    ['get_longitudes', { bodies: ['moon', 'Saturn'] }, /^Body \| [^\n]*\nMoon[^\n]*\nSaturn[^\n]*$/],
    ['get_divisional_charts', { bodies: ['Lagna'] }, /Lagna/],
    ['get_houses_and_kp', {}, /^Houses: /],
    ['get_divisional_charts', {}, /\|/],
    ['get_divisional_longitudes', {}, /\|/],
    ['get_houses_and_kp', {}, /KP LORDS/],
    ['get_dasa', { system: 'Vimsottari' }, /\d{4}-\d\d-\d\d/],
    ['get_dasa', { system: 'Narayana', path: [0] }, /\d{4}-\d\d-\d\d/],
    ['get_running_dasa', { system: 'Vimsottari', date: { year: 1890, month: 6, day: 1 }, levels: 3 }, /level 3:/],
    ['get_running_dasa', { system: 'Vimsottari', date: { year: 1890, month: 6, day: 1, hour: null }, levels: null }, /level 3:/],
    ['get_dasa_periods_in_range', { system: 'Vimsottari', from: { year: 1890, month: 1, day: 1 }, to: { year: 1892, month: 1, day: 1 } }, /\nL1 [\s\S]*\n {2}L2 /],
    ['get_dasa_periods_in_range', { system: 'Narayana', from: { year: 1890, month: 1, day: 1 }, to: { year: 1891, month: 1, day: 1 }, level: 1 }, /L1 /],
    ['get_strengths', { kind: 'shadbala' }, /Sun/],
    ['get_ashtakavarga', { mode: 'BAVs and SAV', varga: 'D1' }, /SAV/],
    ['get_yogas', { category: 'All yogas' }, /\w/],
    ['get_aspects', { kind: 'evaluation' }, /%/],
    ['get_aspects', { kind: 'evaluation', aspecting_varga: 'D1', aspected_varga: 'D9' }, /in D9[\s\S]*D-9/],
    ['get_aspects', { kind: 'table' }, /RELATIONSHIPS[\s\S]*Sun: sign lord \w+; planets: Moon (Adhimitra|Mitra|Sama|Satru|Adhisatru)/],
    ['get_special_points', { kind: 'chara_karakas' }, /\w/],
    ['get_sign_change_sensitivity', { body: 'Lagna' }, /earlier/],
    ['get_transits', { date: { year: 1890, month: 6, day: 1 } }, /Transit: /],
    ['get_transits', { date: { year: 1890, month: 6, day: 1 }, ref: 'Lagna', ref_varga: 'D9' }, /Lagna of natal D-9/],
    ['get_transit_search', { planet: 'Jupiter', target_natal_body: 'Moon', date: { year: 1890, month: 1, day: 1 } }, /Date and time: 18\d\d-\d\d-\d\d[\s\S]*Jupiter then: /],
    ['get_transit_search', { planet: 'Saturn', target_sign: 'Aquarius', date: { year: 1890, month: 1, day: 1 } }, /Saturn then: Saturn[^|]*\| +0 Aq/],
    ['get_transit_calendar', { start: { year: 1890, month: 1, day: 1 }, rows: 3 }, /Columns: [\s\S]*1890-01-03/],
    ['get_annual_chart', { year: 1890 }, /MUDDA DASA/],
    ['get_annual_chart', { year: 1890, variant: 'sunrise', dasa_path: [0] }, /\(sunrise\)[\s\S]*MUDDA DASA\n\w+[^\n]*: /],
    ['get_tithi_pravesha', { year: 1890 }, /Annual TP[\s\S]*COMPRESSED VIMSOTTARI/],
    ['get_panchanga', { date: { year: 1890, month: 6, day: 1 } }, /\w/],
  ];
  for (const [name, input, want] of cases) {
    it(`${name} ${JSON.stringify(input)}`, async () => {
      const r = await runTool(ctx, name, input);
      expect(r.ok, r.text).toBe(true);
      expect(r.text).toMatch(want);
    }, 120000);
  }

  it('rejects invalid input', async () => {
    expect((await runTool(ctx, 'get_dasa', { system: 'Nope' })).ok).toBe(false);
    expect((await runTool(ctx, 'get_dasa', {})).text).toMatch(/system is required/);
    expect((await runTool(ctx, 'get_strengths', { kind: 'shadbala', extra: 1 })).text).toMatch(/not allowed/);
    expect((await runTool(ctx, 'nope', {})).ok).toBe(false);
    expect(validateInput({ type: 'integer', minimum: 0 }, -1)).toMatch(/>= 0/);
    expect((await runTool(ctx, 'get_transit_search', { planet: 'Saturn' })).text).toMatch(/exactly one/);
    expect((await runTool(ctx, 'get_longitudes', { bodies: ['Nobody'] })).text).toMatch(/no row matches/);
    expect((await runTool(ctx, 'get_tithi_pravesha', { year: 1890, day: 3 })).text).toMatch(/needs `month`/);
  });

  it('the range tool refuses rather than truncates', async () => {
    const r = await runTool(ctx, 'get_dasa_periods_in_range', { system: 'Vimsottari', from: { year: 1863, month: 1, day: 13 }, to: { year: 1983, month: 1, day: 1 }, level: 3 });
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/narrow/);
  }, 120000);
});

describe('OpenAI model filter', async () => {
  const { isOpenAIChatModel } = await import('../src/ai/agent');
  it('keeps chat models and drops the others', () => {
    for (const id of ['gpt-5', 'gpt-4o', 'gpt-4.1-mini', 'o3', 'o4-mini', 'chatgpt-4o-latest']) expect(isOpenAIChatModel(id), id).toBe(true);
    for (const id of ['text-embedding-3-large', 'tts-1', 'whisper-1', 'dall-e-3', 'gpt-image-1', 'omni-moderation-latest', 'gpt-4o-realtime-preview', 'gpt-4o-mini-transcribe', 'davinci-002'])
      expect(isOpenAIChatModel(id), id).toBe(false);
  });
});
