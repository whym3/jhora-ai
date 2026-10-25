// The MCP server (src/mcp/server.ts), driven by the MCP SDK's own client over an in-memory
// transport: the consultation flow (start, saved charts, life events), opening charts
// (saved, sample, .jhd file, birth details), tools on the open chart, errors returned as
// tool errors, and the reading prompt.
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createJhoraServer, mcpInputSchema } from '../src/mcp/server';
import { AI_TOOLS } from '../src/ai/tools';
import { SYSTEM_PROMPT } from '../src/ai/systemPrompt';

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));

describe('MCP server', () => {
  const chartsDir = mkdtempSync(join(tmpdir(), 'jhora-charts-'));
  // a "saved chart" for the tests: Mahatma Gandhi's sample under another name
  writeFileSync(join(chartsDir, 'My chart.jhd'), readFileSync(dir('../public/samples/Mahatma Gandhi.jhd')));
  const client = new Client({ name: 'test', version: '0' });
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args });
    return { text: (r.content as { text: string }[])[0].text, isError: r.isError === true };
  };

  beforeAll(async () => {
    const server = createJhoraServer({ epheDir: dir('../public/ephe'), chartsDir, samplesDir: dir('../public/samples') });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
  });

  it('lists the consultation tools and every AI tool', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(['start_consultation', 'list_saved_charts', 'open_chart', 'record_life_events', ...AI_TOOLS.map((t) => t.name)]);
  });

  it('publishes schemas in the subset Gemini\'s function-calling API accepts', async () => {
    const keys = new Set<string>();
    let emptyObjects = 0;
    const walk = (s: Record<string, unknown>) => {
      if (s.type === 'object' && (!s.properties || !Object.keys(s.properties as object).length)) emptyObjects++;
      for (const [k, v] of Object.entries(s)) {
        if (k === 'properties') Object.values(v as Record<string, Record<string, unknown>>).forEach(walk);
        else if (k === 'items') walk(v as Record<string, unknown>);
        else keys.add(k);
      }
    };
    for (const t of (await client.listTools()).tools) {
      walk(t.inputSchema as Record<string, unknown>);
      if (Object.keys(t.inputSchema.properties ?? {}).length) expect(t.inputSchema.properties, t.name).toBeDefined();
    }
    expect(keys.has('additionalProperties')).toBe(false);
    expect([...keys].sort()).toEqual(['description', 'enum', 'maxItems', 'maximum', 'minimum', 'required', 'type']);
    // no-input tools publish {type:'object'} with no empty properties list; nested date objects keep theirs
    expect((await client.listTools()).tools.find((t) => t.name === 'start_consultation')!.inputSchema).toEqual({ type: 'object' });
    expect(emptyObjects).toBe((await client.listTools()).tools.filter((t) => !t.inputSchema.properties).length);
    // the transform keeps everything else, including nested properties, and leaves its input alone
    const src = { type: 'object', additionalProperties: false, required: [], properties: { d: { type: 'object', additionalProperties: false, required: ['y'], properties: { y: { type: 'integer', minimum: 1 } } }, s: { type: 'array', maxItems: 2, items: { type: 'object', additionalProperties: false, required: [], properties: {} } } } };
    const before = JSON.stringify(src);
    expect(mcpInputSchema(src)).toEqual({ type: 'object', properties: { d: { type: 'object', required: ['y'], properties: { y: { type: 'integer', minimum: 1 } } }, s: { type: 'array', maxItems: 2, items: { type: 'object' } } } });
    expect(JSON.stringify(src)).toBe(before);
    // the original schema is still enforced on calls
    expect((await call('start_consultation', { extra: 1 })).text).toMatch(/not allowed/);
  });

  it('carries the flow and the full system prompt in its instructions', () => {
    const instructions = client.getInstructions()!;
    expect(instructions).toMatch(/start_consultation[\s\S]*Past events[\s\S]*The question/);
    expect(instructions).toContain(SYSTEM_PROMPT);
  });

  it('starts a consultation with the saved charts and no chart open', async () => {
    const start = await call('start_consultation');
    expect(start.text).toMatch(/# Consultation flow[\s\S]*No chart is open yet[\s\S]*Saved charts: My chart\nSample charts of well-known people: [^\n]*Swami Vivekananda/);
    expect(start.text).not.toMatch(/well-known people: [^\n]*My chart/);
    expect(await call('get_longitudes')).toEqual({ text: expect.stringMatching(/open_chart first/), isError: true });
    expect((await call('record_life_events', { events: [{ year: 2020, event: 'x' }] })).isError).toBe(true);
  });

  it('opens a saved chart and tests it against life events', async () => {
    const opened = await call('open_chart', { chart: 'My chart', gender: 'male' });
    expect(opened.isError).toBe(false);
    expect(opened.text).toMatch(/Opened "My chart"\.\nGender: male\.[\s\S]*Lagna \|[\s\S]*October 2, 1869[\s\S]*CALCULATION SETTINGS/);
    const first = await call('record_life_events', { events: [{ year: 1888, month: 9, event: 'sailed to London to study law' }, { year: 1893, month: 5, day: 24, event: 'arrived in South Africa' }] });
    expect(first.text).toMatch(/1888-09 \| sailed to London to study law \| \w+ \/ \w+ \/ \w+ \(month only[^\n]*\n1893-05-24 \| arrived in South Africa \| \w+ \/ \w+ \/ \w+\n/);
    const second = await call('record_life_events', { events: [{ year: 1883, event: 'married' }] });
    expect(second.text).toMatch(/\n1883 \| married[^\n]*year only[^\n]*\n1888-09 \| sailed to London[\s\S]*\n1893-05-24 \| arrived/);
    expect((await call('record_life_events', { events: [{ year: 2016, day: 3, event: 'x' }] })).text).toMatch(/needs a month/);
    expect((await call('start_consultation')).text).toMatch(/Open chart: "My chart" \(male\); 3 life events recorded: continue with step 3/);
  }, 120000);

  it('opens a sample and runs tools on it, clearing the events', async () => {
    const opened = await call('open_chart', { chart: 'Swami Vivekananda' });
    expect(opened.text).toMatch(/Opened "Swami Vivekananda"[\s\S]*January 12, 1863/);
    expect((await call('start_consultation')).text).toMatch(/no life events recorded yet/);
    expect((await call('get_running_dasa', { system: 'Vimsottari', date: { year: 1890, month: 6, day: 1 } })).text).toMatch(/level 3:/);
  }, 120000);

  it('opens birth details, saves them, and applies KP house settings', async () => {
    expect((await call('open_chart', { jhd_path: dir('../golden/charts/Mahatma Gandhi.jhd') })).text).toMatch(/Opened "Mahatma Gandhi"/);
    const birth = { year: 1990, month: 6, day: 15, hour: 14.5, tz_hours: 5.5, latitude: 28.6139, longitude: 77.209 };
    const house_system = 'Placidus houses (KP/Krishnamoorthy)';
    const firstHouse = async () => (await call('get_houses_and_kp')).text.split('\n').find((l) => l.startsWith('1st |'))!.split(' | ');
    await call('open_chart', { birth, house_system, cusps_in_middle: true });
    const [, , middleCusp] = await firstHouse();
    const opened = await call('open_chart', { birth, name: 'Delhi 1990', save_as: 'Delhi 1990', house_system });
    expect(opened.text).toMatch(/Saved as "Delhi 1990"[\s\S]*June 15, 1990[\s\S]*Placidus houses \(KP\/Krishnamoorthy\), cusp at the start/);
    expect(existsSync(join(chartsDir, 'Delhi 1990.jhd'))).toBe(true);
    expect((await call('list_saved_charts')).text).toMatch(/^Saved charts: Delhi 1990, My chart\n/);
    // the saved chart reopens as the same moment
    expect((await call('open_chart', { chart: 'Delhi 1990' })).text).toMatch(/June 15, 1990[\s\S]*14:30:00/);
    // KP default: the 1st house begins at the Placidus cusp (the ascendant)
    await call('open_chart', { birth, house_system });
    const [, start] = await firstHouse();
    expect(start).toBe(middleCusp);
  }, 120000);

  it('reports bad input as tool errors', async () => {
    expect((await call('open_chart', {})).text).toMatch(/exactly one of/);
    expect((await call('open_chart', { chart: 'Nobody' })).text).toMatch(/no chart "Nobody"[\s\S]*Saved charts:/);
    expect((await call('open_chart', { birth: { year: 1990 } })).isError).toBe(true);
    expect((await call('open_chart', { chart: 'My chart', gender: 'other' })).isError).toBe(true);
    expect((await call('get_dasa', { system: 'Nope' })).isError).toBe(true);
  });

  it('serves the consultation prompt', async () => {
    expect((await client.listPrompts()).prompts.map((p) => p.name)).toEqual(['jyotish_reading']);
    const p = await client.getPrompt({ name: 'jyotish_reading', arguments: { question: 'career' } });
    const text = (p.messages[0].content as { text: string }).text;
    expect(text).toMatch(/^You are a Grandmaster Jyotishi[\s\S]*# Consultation flow[\s\S]*Today's date: \d{4}-\d\d-\d\d[\s\S]*question[^\n]*: career$/);
  });
});
