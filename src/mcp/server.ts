// MCP server: the AI astrologer's tools (src/ai/tools.ts) for any MCP client (Claude
// Desktop, Claude Code, Cursor, Gemini ...). Calculations run in-process with the same jobs
// as the app's worker. A session is a consultation: choose or enter the chart, give past
// events to test it against, then ask questions (CONSULTATION_FLOW).
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Sweph } from '../sweph';
import { loadEngine } from '../core/engine';
import { computeChart, type Chart } from '../core/chart';
import { parseJhd, writeJhd, type BirthData } from '../core/jhd';
import { HOUSE_SYSTEMS } from '../core/kpHouses';
import { ASYNC_TABLES, runTable, runText } from '../engine/jobs';
import { stableStringify } from '../engine/hash';
import type { ChartSpec, JobRequest } from '../engine/protocol';
import { AI_TOOLS, localDateString, runTool, validateInput, type ToolContext } from '../ai/tools';
import { SYSTEM_PROMPT } from '../ai/systemPrompt';

export interface ServerOptions {
  /** directory holding the Swiss Ephemeris files (.se1) */
  epheDir: string;
  /** the user's saved charts (.jhd); open_chart's save_as writes here */
  chartsDir: string;
  /** sample charts (.jhd) of well-known people */
  samplesDir: string;
}

type Json = Record<string, unknown>;

/** Runs worker jobs in-process (the dispatch of src/engine/worker.ts), caching charts and results. */
export function createEngine(epheDir: string) {
  let engine: Promise<Sweph> | null = null;
  const sweph = () => (engine ??= loadEngine(async (name) => {
    try { return new Uint8Array(await readFile(join(epheDir, name))); } catch { return null; }
  }));
  const MAX = 300;
  const cache = new Map<string, Promise<unknown>>();
  const memo = <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const hit = cache.get(key);
    if (hit) return hit as Promise<T>;
    const p = fn();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
    if (cache.size > MAX) cache.delete(cache.keys().next().value!);
    return p;
  };
  const chartFor = (spec: ChartSpec) => memo<Chart>(`chart:${stableStringify(spec)}`, async () => computeChart(await sweph(), spec.birth, spec.ini));
  return async (req: JobRequest): Promise<unknown> => {
    const key = `${stableStringify(req)}`;
    switch (req.kind) {
      case 'chart': return chartFor(req.chart);
      case 'table': return memo(key, async () => {
        const chart = await chartFor(req.chart);
        const asyncTable = ASYNC_TABLES[req.table];
        return asyncTable ? asyncTable(chart, req.params ?? {}, await sweph()) : runTable(chart, req.table, req.params ?? {}, await sweph());
      });
      case 'text': return memo(key, async () => runText(await chartFor(req.chart), req.cmd, req.params ?? {}, await sweph()));
    }
  };
}

/** How every MCP conversation runs; the reading itself follows SYSTEM_PROMPT. */
export const CONSULTATION_FLOW = `# Consultation flow
Run every new conversation as a consultation. Call start_consultation before your first reply, then go through these steps in order, one at a time: ask, wait for the answer, then move on. If the user has already given something, don't ask for it again; if they want to skip a step, go along but say what is lost.

1. The chart. Ask whose chart this is and offer the user's saved charts by name (start_consultation and list_saved_charts list them). If they pick one, open it with open_chart. Otherwise ask for the birth details: date, time as exact as known (and how reliable it is) and place of birth. Work out the place's latitude and longitude and the clock's offset from UT on that date, including daylight saving; state them so the user can confirm, then open the chart and offer to save it under the person's name (open_chart save_as) so it is there next time. Ask the native's gender (Bhrigu Nandi Nadi needs it) if it is not known. Confirm the chart by quoting its lagna, Moon sign and nakshatra.
2. Past events. Before any reading, ask for 3 to 6 significant past events with dates as exact as the user remembers: education milestones, jobs and career changes, marriage or relationships, children, moves or travel abroad, illnesses or accidents, losses in the family, financial highs and lows. Record them with record_life_events and use the periods running at each event to test the chart. If they do not fit and the birth time is uncertain, check get_sign_change_sensitivity and tell the user.
3. The question. Ask what they want to know (offer: a complete reading, career, money, marriage and relationships, children, health, education, property, spirituality, the next 12 months). Then analyse it with the method below, relating the reading to their past events where that helps. After answering, offer to go deeper or take the next question.`;

const HOUSE_NAMES = HOUSE_SYSTEMS.map((h) => h[0]);

/** Birth data typed in by the user, with the defaults parseJhd() gives a .jhd file. */
function birthFrom(b: Json): BirthData {
  return {
    year: Number(b.year), month: Number(b.month), day: Number(b.day), hour: Number(b.hour),
    tzHours: Number(b.tz_hours), lon: Number(b.longitude), lat: Number(b.latitude),
    altitudeM: Number(b.altitude_m ?? 0), altitudeGiven: b.altitude_m !== undefined,
    pressureMbar: 1013.25, temperatureC: 20,
    city: String(b.city ?? ''), country: String(b.country ?? ''),
    placeCode: null, standardTz: null, summerTz: null, dst: false, field15: null, field18: null, legacy: null,
  };
}

const NO_INPUT = { type: 'object', additionalProperties: false, required: [], properties: {} };

const START = {
  name: 'start_consultation',
  description: 'Call this first, before your first reply in every new conversation: it returns the consultation steps to follow (chart, past events, question), the user\'s saved charts and what has been done so far in this session.',
  inputSchema: NO_INPUT,
};

const LIST_CHARTS = {
  name: 'list_saved_charts',
  description: 'The user\'s saved charts, then the sample charts of well-known people; open_chart opens either by name.',
  inputSchema: NO_INPUT,
};

const OPEN_CHART = {
  name: 'open_chart',
  description: 'Open the chart every other tool works on: a saved or sample chart by name, a Jagannatha Hora .jhd file, or birth details (optionally saved for next time with save_as). Also records the native\'s gender for Bhrigu Nandi Nadi, and can choose the house system (KP needs Placidus) and true instead of mean nodes. Opening a chart replaces the previous one and clears the recorded life events.',
  inputSchema: {
    type: 'object', additionalProperties: false, required: [],
    properties: {
      chart: { type: 'string', description: 'name of a saved or sample chart (see list_saved_charts)' },
      jhd_path: { type: 'string', description: 'absolute path of a .jhd file' },
      birth: {
        type: 'object', additionalProperties: false, description: 'birth details',
        required: ['year', 'month', 'day', 'hour', 'tz_hours', 'latitude', 'longitude'],
        properties: {
          year: { type: 'integer' }, month: { type: 'integer', minimum: 1, maximum: 12 }, day: { type: 'integer', minimum: 1, maximum: 31 },
          hour: { type: 'number', minimum: 0, maximum: 24, description: 'local clock time in decimal hours (14:30 = 14.5)' },
          tz_hours: { type: 'number', description: 'offset of the local clock from UT in hours, east positive (IST = 5.5, New York in winter = -5), including daylight saving if it was in force' },
          latitude: { type: 'number', minimum: -90, maximum: 90, description: 'degrees, north positive' },
          longitude: { type: 'number', minimum: -180, maximum: 180, description: 'degrees, east positive' },
          altitude_m: { type: 'number' }, city: { type: 'string' }, country: { type: 'string' },
        },
      },
      name: { type: 'string', description: 'title for the chart (the person\'s name)' },
      save_as: { type: 'string', description: 'save the chart under this name among the saved charts (overwrites a saved chart of that name)' },
      gender: { type: 'string', enum: ['male', 'female'], description: 'the native\'s gender (BNN: Jupiter for a man, Venus for a woman)' },
      house_system: { type: 'string', enum: HOUSE_NAMES, description: 'default Equal houses' },
      cusps_in_middle: { type: 'boolean', description: 'cusp in the middle of each house (default) or at its start (default for Placidus, as KP counts houses from the cusp)' },
      true_nodes: { type: 'boolean', description: 'true (osculating) Rahu/Ketu instead of mean, default false' },
    },
  },
};

const RECORD_EVENTS = {
  name: 'record_life_events',
  description: 'Record past events of the native\'s life (added to those already recorded for this chart) and get the Vimsottari maha, antar and pratyantar dasa running at each, to test the chart and birth time against real life. A date can be a year, a month or a day; vaguer dates give less precise periods. Returns every event recorded so far, in date order.',
  inputSchema: {
    type: 'object', additionalProperties: false, required: ['events'],
    properties: {
      events: {
        type: 'array', description: 'the events',
        items: {
          type: 'object', additionalProperties: false, required: ['year', 'event'],
          properties: {
            year: { type: 'integer' },
            month: { type: 'integer', minimum: 1, maximum: 12, description: 'if known' },
            day: { type: 'integer', minimum: 1, maximum: 31, description: 'if known (needs month)' },
            event: { type: 'string', description: 'what happened, e.g. "married", "started first job", "father died"' },
          },
        },
      },
    },
  },
};

interface LifeEvent { year: number; month?: number; day?: number; event: string }
const eventDate = (e: LifeEvent) => `${e.year}${e.month ? `-${String(e.month).padStart(2, '0')}` : ''}${e.month && e.day ? `-${String(e.day).padStart(2, '0')}` : ''}`;
/** The date a vague event is looked up on: the middle of its year or month. */
const eventLookup = (e: LifeEvent) => ({ year: e.year, month: e.month ?? 7, day: e.month ? (e.day ?? 15) : 1 });

const text = (t: string, isError = false) => ({ content: [{ type: 'text' as const, text: t }], ...(isError ? { isError: true } : {}) });

/**
 * The input schema as published to clients. Gemini forwards tool schemas to Google's
 * function-calling API, which accepts an OpenAPI subset: it rejects a schema that has
 * `additionalProperties` ("Cannot find field") or an object with an empty `properties`,
 * and then the client behaves as if the server had no tools. The original schema stays
 * the contract: runTool()/validateInput() still enforce it on every call.
 */
export function mcpInputSchema(schema: Json): Json {
  const walk = (s: Json): Json => {
    const out: Json = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === 'additionalProperties') continue;
      if (k === 'properties') {
        const props = v as Record<string, Json>;
        if (!Object.keys(props).length) continue;
        out[k] = Object.fromEntries(Object.entries(props).map(([p, x]) => [p, walk(x)]));
      } else if (k === 'items') out[k] = walk(v as Json);
      else if (k === 'required') { if ((v as string[]).length) out[k] = [...(v as string[])]; }
      else out[k] = Array.isArray(v) ? [...v] : v;
    }
    return out;
  };
  return walk(schema);
}

export function createJhoraServer(opts: ServerOptions): Server {
  const request = createEngine(opts.epheDir);
  let open: { spec: ChartSpec; title: string; gender?: string } | null = null;
  let events: LifeEvent[] = [];

  const jhdNames = async (dir: string) => {
    try { return (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.jhd')).map((f) => f.slice(0, -4)).sort(); } catch { return []; }
  };
  const chartList = async () => {
    const [saved, samples] = await Promise.all([jhdNames(opts.chartsDir), jhdNames(opts.samplesDir)]);
    return { saved, samples: samples.filter((s) => !saved.includes(s)) };
  };
  const chartListText = async () => {
    const { saved, samples } = await chartList();
    return `Saved charts: ${saved.length ? saved.join(', ') : '(none yet)'}\nSample charts of well-known people: ${samples.join(', ')}`;
  };
  const ctx = (): ToolContext => ({ request, spec: open!.spec, title: open!.title });

  async function openChart(i: Json): Promise<string> {
    const sources = [i.chart, i.jhd_path, i.birth].filter((x) => x !== undefined);
    if (sources.length !== 1) throw new Error('give exactly one of chart, jhd_path, birth');
    let birth: BirthData, title: string;
    if (i.chart !== undefined) {
      const name = String(i.chart);
      const { saved, samples } = await chartList();
      const dir = saved.includes(name) ? opts.chartsDir : samples.includes(name) ? opts.samplesDir : null;
      if (!dir) throw new Error(`no chart "${name}".\n${await chartListText()}`);
      birth = parseJhd(await readFile(join(dir, `${name}.jhd`), 'latin1'));
      title = name;
    } else if (i.jhd_path !== undefined) {
      const path = String(i.jhd_path);
      birth = parseJhd(await readFile(path, 'latin1'));
      title = path.replace(/^.*[\\/]/, '').replace(/\.jhd$/i, '');
    } else {
      birth = birthFrom(i.birth as Json);
      title = 'Chart';
    }
    if (i.name) title = String(i.name);
    const ini: ChartSpec['ini'] = {};
    if (i.house_system !== undefined) ini.HouseTypeWanted = HOUSE_SYSTEMS[HOUSE_NAMES.indexOf(String(i.house_system))][2];
    const placidus = ini.HouseTypeWanted === 4;
    const middle = i.cusps_in_middle === undefined ? !placidus : Boolean(i.cusps_in_middle);
    if (!middle) ini.HouseCuspsInMiddle = 0;
    if (i.true_nodes) ini.TrueNodes = 1;
    const spec: ChartSpec = { birth, ini };
    await request({ kind: 'chart', chart: spec });   // fail here, not in the next tool, if the data is unusable
    open = { spec, title, gender: i.gender === undefined ? undefined : String(i.gender) };
    events = [];
    const notes: string[] = [];
    if (i.save_as !== undefined) {
      const name = String(i.save_as).replace(/[\\/:*?"<>|]/g, '').trim();
      try {
        await mkdir(opts.chartsDir, { recursive: true });
        await writeFile(join(opts.chartsDir, `${name}.jhd`), writeJhd(birth), 'latin1');
        notes.push(`Saved as "${name}".`);
      } catch (e) {
        notes.push(`Could not save the chart (${e instanceof Error ? e.message : e}); the server may only have read access to ${opts.chartsDir}.`);
      }
    }
    if (open.gender) notes.push(`Gender: ${open.gender}.`);
    const lagna = await runTool(ctx(), 'get_longitudes', { bodies: ['Lagna', 'Moon'] });
    return [`Opened "${title}".`, ...notes, '', lagna.text, '', (await runTool(ctx(), 'get_chart_overview', {})).text].join('\n');
  }

  async function recordEvents(list: LifeEvent[]): Promise<string> {
    for (const e of list) if (e.day && !e.month) throw new Error(`"${e.event}": a day needs a month`);
    events = [...events, ...list].sort((a, b) => eventDate(a).localeCompare(eventDate(b)));
    const rows = await Promise.all(events.map(async (e) => {
      const r = await runTool(ctx(), 'get_running_dasa', { system: 'Vimsottari', date: eventLookup(e), levels: 3 });
      const lords = [...r.text.matchAll(/level \d: ([^|]+?) \|/g)].map((m) => m[1].trim());
      const vague = !e.month ? ' (year only: periods at mid-year)' : !e.day ? ' (month only: periods at mid-month)' : '';
      return `${eventDate(e)} | ${e.event} | ${lords.length ? lords.join(' / ') : r.text}${vague}`;
    }));
    return [
      `Life events of "${open!.title}" with the Vimsottari periods running then (maha / antar / pratyantar):`,
      'Date | Event | Vimsottari', ...rows,
      '',
      'Test the chart against these: do the period lords own, occupy or aspect the houses of each event (and their karakas)? Exact dates support finer checks with get_running_dasa (more levels), get_transits and other dasas.',
    ].join('\n');
  }

  async function startText(): Promise<string> {
    const state = !open ? 'No chart is open yet: begin with step 1.'
      : `Open chart: "${open.title}"${open.gender ? ` (${open.gender})` : ''}; ${events.length ? `${events.length} life events recorded: continue with step 3.` : 'no life events recorded yet: continue with step 2.'}`;
    return [CONSULTATION_FLOW, '', 'SESSION', state, await chartListText(), `Today's date: ${localDateString()}.`].join('\n');
  }

  const server = new Server({ name: 'jhora', version: '1.0.0' }, {
    capabilities: { tools: {}, prompts: {} },
    instructions: `Vedic astrology calculations reproducing Jagannatha Hora 8.0.\n\n${CONSULTATION_FLOW}\n\n${SYSTEM_PROMPT}`,
  });

  const OWN_TOOLS = [START, LIST_CHARTS, OPEN_CHART, RECORD_EVENTS];
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ...OWN_TOOLS.map((t) => ({ ...t, inputSchema: mcpInputSchema(t.inputSchema) as { type: 'object' } })),
      ...AI_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: mcpInputSchema(t.parameters) as { type: 'object' } })),
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name } = req.params;
    const args = (req.params.arguments ?? {}) as Json;
    try {
      const own = OWN_TOOLS.find((t) => t.name === name);
      if (own) {
        const bad = validateInput(own.inputSchema, args);
        if (bad) return text(`Invalid input: ${bad}`, true);
      }
      if (name === START.name) return text(await startText());
      if (name === LIST_CHARTS.name) return text(await chartListText());
      if (name === OPEN_CHART.name) return text(await openChart(args));
      if (!open) return text('No chart is open: follow the consultation flow (start_consultation) and open a chart with open_chart first.', true);
      if (name === RECORD_EVENTS.name) return text(await recordEvents(args.events as LifeEvent[]));
      const r = await runTool(ctx(), name, args);
      return text(r.text, !r.ok);
    } catch (e) {
      return text(e instanceof Error ? e.message : String(e), true);
    }
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [{ name: 'jyotish_reading', description: 'Start a consultation: chart, past events, then the question, read with the three-layer method (Parashari, KP, Bhrigu Nandi Nadi)', arguments: [{ name: 'question', description: 'what to analyse, if already known', required: false }] }],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    if (req.params.name !== 'jyotish_reading') throw new Error(`unknown prompt ${req.params.name}`);
    const question = req.params.arguments?.question;
    return {
      description: 'Jyotish consultation',
      messages: [{ role: 'user', content: { type: 'text', text: `${SYSTEM_PROMPT}\n\n${CONSULTATION_FLOW}\n\nToday's date: ${localDateString()}.${question ? `\n\nMy question, once the chart and past events are settled: ${question}` : ''}` } }],
    };
  });

  return server;
}
