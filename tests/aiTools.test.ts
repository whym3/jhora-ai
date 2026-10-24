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
import {
  AI_TOOLS, AV_MODES, NAKSHATRA_DASA_SYSTEMS, OTHER_DASA_SYSTEMS, RASI_DASA_SYSTEMS, TRANSIT_MODES, VARGAS, YOGA_CATEGORIES,
  runTool, validateInput, type ToolContext,
} from '../src/ai/tools';
import { SYSTEM_PROMPT } from '../src/ai/systemPrompt';

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
  });

  it('every tool name appears in the system prompt or is self-describing', () => {
    expect(SYSTEM_PROMPT).toContain('get_chart_overview');
    for (const t of AI_TOOLS) expect(t.name).toMatch(/^get_[a-z_]+$/);
  });

  const cases: [string, Record<string, unknown>, RegExp][] = [
    ['get_chart_overview', {}, /Nakshatra:/],
    ['get_longitudes', {}, /Moon/],
    ['get_divisional_charts', {}, /\|/],
    ['get_divisional_longitudes', {}, /\|/],
    ['get_houses_and_kp', {}, /KP LORDS/],
    ['get_dasa', { system: 'Vimsottari' }, /\d{4}-\d\d-\d\d/],
    ['get_dasa', { system: 'Narayana', path: [0] }, /\d{4}-\d\d-\d\d/],
    ['get_running_dasa', { system: 'Vimsottari', date: { year: 1890, month: 6, day: 1 }, levels: 3 }, /level 3:/],
    ['get_strengths', { kind: 'shadbala' }, /Sun/],
    ['get_ashtakavarga', { mode: 'BAVs and SAV', varga: 'D1' }, /SAV/],
    ['get_yogas', { category: 'All yogas' }, /\w/],
    ['get_aspects', { kind: 'evaluation' }, /%/],
    ['get_special_points', { kind: 'chara_karakas' }, /\w/],
    ['get_sign_change_sensitivity', { body: 'Lagna' }, /earlier/],
    ['get_transits', { date: { year: 1890, month: 6, day: 1 } }, /Transit: /],
    ['get_annual_chart', { year: 1890 }, /MUDDA DASA/],
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
  });
});

describe('OpenAI model filter', async () => {
  const { isOpenAIChatModel } = await import('../src/ai/agent');
  it('keeps chat models and drops the others', () => {
    for (const id of ['gpt-5', 'gpt-4o', 'gpt-4.1-mini', 'o3', 'o4-mini', 'chatgpt-4o-latest']) expect(isOpenAIChatModel(id), id).toBe(true);
    for (const id of ['text-embedding-3-large', 'tts-1', 'whisper-1', 'dall-e-3', 'gpt-image-1', 'omni-moderation-latest', 'gpt-4o-realtime-preview', 'gpt-4o-mini-transcribe', 'davinci-002'])
      expect(isOpenAIChatModel(id), id).toBe(false);
  });
});
