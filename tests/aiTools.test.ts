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
import { PROG_DASAS, PROG_VARGA_LABELS } from '../src/core/derived/progression';
import { ASPECTS, ECLIPSE_TYPES as MUNDANE_ECLIPSES, MUNDANE_BODIES, TRANSIT_DIVISIONS } from '../src/core/derived/mundane';
import { PRASNA_LIMIT } from '../src/core/derived/prasna';
import { CHAKRAS as CHAKRA_IDS, CHAKRA_BODY_SETS as CHAKRA_SETS } from '../src/core/chakras/chakraJobs';
import { ARGALA_REFS as JAIMINI_REFS } from '../src/core/jaiminiJobs';
import { CHARA_SEEDS } from '../src/core/dasas/charaParasara';
import { KALACHAKRA_METHODS } from '../src/core/dasas/kalachakra';
import { BAR_GRAPH_SETS } from '../src/core/strengthGraphs';
import { RASI_VARGA_SLOTS } from '../src/ui/shell/DasaOptions';
import { RASI_SLOTS } from '../src/core/dasas/yearDefinition';
import {
  AI_TOOLS, AV_MODES, ECLIPSE_TYPES, MUNDANE_ASPECTS, MUNDANE_DIVISIONS, NAKSHATRA_DASA_SYSTEMS, PRASNA_LIMITS, PROGRESSION_DASAS, PROGRESSION_VARGAS,
  STATIONARY_PLANETS, ARGALA_REFS, CHAKRAS, CHARA_SEED_NAMES, KALACHAKRA_METHOD_NAMES, RASI_DASA_CHART_NAMES, STRENGTH_GRAPH_SETS, CHAKRA_BODY_SETS, OTHER_DASA_SYSTEMS, RASI_DASA_SYSTEMS, SAHAMA_NAMES, SIGN_NAMES, TRANSIT_MODES, VARGAS, YOGA_CATEGORIES,
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
    expect(PROGRESSION_VARGAS).toEqual(PROG_VARGA_LABELS);
    expect(PROGRESSION_DASAS).toEqual(PROG_DASAS.map((d) => d[0]));
    expect(MUNDANE_DIVISIONS).toEqual(TRANSIT_DIVISIONS);
    expect(MUNDANE_ASPECTS).toEqual(ASPECTS.map((a) => a[0]));
    expect(ECLIPSE_TYPES).toEqual(MUNDANE_ECLIPSES);
    expect(STATIONARY_PLANETS).toEqual(MUNDANE_BODIES.slice(3));
    expect(PRASNA_LIMITS).toEqual(PRASNA_LIMIT);
    expect(CHAKRAS).toEqual([...CHAKRA_IDS]);
    expect(CHAKRA_BODY_SETS).toEqual([...CHAKRA_SETS]);
    expect(ARGALA_REFS).toEqual(JAIMINI_REFS);
    expect(CHARA_SEED_NAMES).toEqual([...CHARA_SEEDS]);
    expect(KALACHAKRA_METHOD_NAMES).toEqual([...KALACHAKRA_METHODS]);
    expect(STRENGTH_GRAPH_SETS).toEqual([...BAR_GRAPH_SETS]);
    expect(RASI_DASA_CHART_NAMES).toContain('D-9');
    // the dasas the rasi_dasa_chart option names are the four that share DAT_008a4b94
    expect([...RASI_VARGA_SLOTS].map((slot) => RASI_SLOTS[slot - 25]).sort()).toEqual(['Chara (Parasara)', 'Drigdasa', 'Trikona', 'Yogardha']);
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
    // the derived charts: JHora 8.0's own results for this chart (golden/jhora-misc)
    ['get_progressed_chart', { method: 'nakshatra_dasa', date: { year: 2010, month: 6, day: 15 } }, /^Prog \(NaksDasa\)[\s\S]*LONGITUDES\n[^\n]*\nLagna \| 26 Cp 09' 43.07"[\s\S]*Avayoga Sphuta \| 27 Ar 03' 35.91"/],
    ['get_progressed_chart', { method: 'solar', date: { year: 2010, month: 6, day: 15 }, varga: 'D-10' }, /Progressed \(3 deg\)[\s\S]*Date: +April 3, 1864\s+Time: +9:27:44/],
    ['get_prasna_chart', { system: '249', number: 100, replace_lagna: true }, /^Prasna-249 \(100\)[\s\S]*\nLagna \| 24 Le 00' 00.00"[\s\S]*Avayoga Sphuta \| 26 Pi 53' 54.35"/],
    ['get_prasna_chart', { system: '108', number: 37 }, /\nPrasna Lagna \| 1 Le 40' 00.00" \| Magh \| 1 \| Le \| Ar$/],
    ['get_mundane_chart', { event: 'aspect', body: 'Jupiter', body2: 'Saturn', direction: 'before' }, /^Ju-Sa Conj[\s\S]*Date: +October 21, 1861\s+Time: +18:10:59/],
    ['get_mundane_chart', { event: 'eclipse', eclipse_type: 'Lunar' }, /^Tot Lun Ecli[\s\S]*Date: +June 2, 1863\s+Time: +2:43:37/],
    ['get_mundane_chart', { event: 'solar_new_year', date: { year: 2026, month: 1, day: 1 } }, /Date: +April 1\d, 2026/],
    ['get_angular_return', { body: 'Sun', body2: 'Moon', date: { year: 2001, month: 3, day: 15 } }, /^Ang Ret Su-Mo[\s\S]*Date: +March 16, 2001\s+Time: +1:16:36/],
    ['get_marriage_match', { other_nakshatra: 'Rohini', other_pada: 2 }, /Gunanka score[^\n]*= \d+ \(out of 36\)/],
    // Jaimini relationships, chakras, period charts, month tables (positions as verified elsewhere)
    ['get_argala_and_rasi_drishti', { kind: 'argala' }, /^Argala on the houses from Lagna \(Sg\)[\s\S]*\n1st \| Sg \| Su \| Cp 2nd: Me Ve \| vs Sc 12th: Ra \|/],
    ['get_argala_and_rasi_drishti', { kind: 'argala', ref: 'AL' }, /from AL \(/],
    ['get_argala_and_rasi_drishti', { kind: 'rasi_drishti' }, /\nAr \| Ma \| Le Sc Aq \| Ra\n/],
    ['get_chakra', { chakra: 'kota' }, /from Hast[\s\S]*\n1 \| Hast \| Bahya \/ Exterior \| Mo Sa\n[\s\S]*Kota Swami/],
    ['get_chakra', { chakra: 'sarvatobhadra', date: { year: 1890, month: 6, day: 1 } }, /transit bodies[\s\S]*Janma: Hast/],
    ['get_chakra', { chakra: 'sudarsana' }, /\n1 \| Sg: As Su \| Vi: Mo Sa \| Sg: As Su\n/],
    ['get_chakra', { chakra: 'surya_kalanala', bodies: 'upagrahas' }, /Surya Kalanala chakra/],
    ['get_chakra', { chakra: 'tripataki' }, /\n1 \| Sg \| As Su\n/],
    ['get_dasa_period_chart', { system: 'Vimsottari', path: [2, 1] }, /^Period Entry: Rah\/Jup\nPeriod \| Start \| End\nRah\/Jup \| 1877-02-19 \(5:46:14\)[\s\S]*Date: +February 19, 1877\s+Time: +5:46:14[\s\S]*LONGITUDES/],
    ['get_dasa_transits', { system: 'Narayana', path: [2] }, /\n1st \| Ar \| Saturn \| 1881-01-11 \| 1882-06-30\n/],
    ['get_dasa_transits', { system: 'Narayana', path: [2] }, /\n\d+(st|nd|rd|th) \| \w\w \| Rahu \| None \|/],
    ['get_transit_correlation', { date: { year: 1890, month: 6, day: 1 } }, /\nJupiter \| 19 Cp 51' 25.71"[^\n]*Lagna in D-9/],
    ['get_month_ephemeris', { year: 1890, month: 6 }, /\nEntry of planets into signs \| Sun \| enters \| Gemini \| 13 \| 16:17:50\n/],
    ['get_month_ephemeris', { year: 1890, month: 6, kind: 'panchanga' }, /Monthly Panchanga: 1890-6/],
    // dasa options (session settings of JHora's Options dialogs) and the remaining pane commands
    ['get_dasa', { system: 'Chara (Parasara)' }, /^Chara dasa of D-1 \(a popular phalita rasi dasa\)\nMaha Dasas \| Start \| End\nSg /],
    ['get_dasa', { system: 'Chara (Parasara)', options: { chara_seed: 'Moon' } }, /^Chara dasa of D-1 [^\n]*\nMaha Dasas \| Start \| End\nVi /],
    ['get_dasa', { system: 'Trikona', options: { rasi_dasa_chart: 'D-9' } }, /^Trikona Dasa of D-9[\s\S]*\d{4}-\d\d-\d\d/],
    ['get_dasa', { system: 'Kalachakra', options: { kalachakra_method: KALACHAKRA_METHODS[1] } }, /\d{4}-\d\d-\d\d/],
    ['get_running_dasa', { system: 'Chara (Parasara)', options: { chara_seed: 'Sun' }, date: { year: 1890, month: 6, day: 1 }, levels: 2 }, /level 2:/],
    ['get_progressed_chart', { method: 'nakshatra_dasa', dasa: 'Kalachakra', kalachakra_method: KALACHAKRA_METHODS[0], date: { year: 2010, month: 6, day: 15 } }, /^Prog \(NaksDasa\)/],
    ['get_dasa_details', { system: 'Narayana', kind: 'about' }, /^Quick Info on Narayana Dasa\nNarayana dasa is a general purpose rasi dasa/],
    ['get_dasa_details', { system: 'Vimsottari', kind: 'sum_of_longitudes', path: [2, 1] }, /^Sum of Longitudes\nSum of longitudes of planets upto selected level is /],
    ['get_supported_yogas', { category: 'Pancha maha purusha yogas' }, /Ruchaka/],
    ['get_strength_graphs', { set: 'Shadbala' }, /\|/],
    ['get_nisheka_chart', {}, /LONGITUDES[\s\S]*COMPRESSED VIMSOTTARI/],
    ['get_prasna_chart', { system: '108', number: 37, dasa_years: 1 }, /COMPRESSED VIMSOTTARI[\s\S]*compressed into 365\.\d\d days/],
    ['get_mundane_chart', { event: 'solar_new_year', date: { year: 2026, month: 1, day: 1 } }, /COMPRESSED VIMSOTTARI/],
    ['get_calculations_report', {}, /Vimsottari/],
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
    expect((await runTool(ctx, 'get_prasna_chart', { system: '108', number: 200 })).text).toMatch(/1-108/);
    expect((await runTool(ctx, 'get_mundane_chart', { event: 'aspect', body: 'Sun' })).text).toMatch(/needs `body` and `body2`/);
    expect((await runTool(ctx, 'get_angular_return', { body: 'Sun', body2: 'Sun' })).text).toMatch(/must differ/);
    expect((await runTool(ctx, 'get_dasa', { system: 'Vimsottari', options: { chara_seed: 'Moon' } })).text).toMatch(/Chara \(Parasara\) only/);
    expect((await runTool(ctx, 'get_dasa', { system: 'Narayana', options: { rasi_dasa_chart: 'D-9' } })).text).toMatch(/Drigdasa, Trikona/);
    expect((await runTool(ctx, 'get_progressed_chart', { method: 'solar', kalachakra_method: KALACHAKRA_METHODS[0] })).text).toMatch(/dasa Kalachakra only/);
    expect((await runTool(ctx, 'get_dasa_details', { system: 'Vimsottari', kind: 'sum_of_longitudes' })).text).toMatch(/at least one/);
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
