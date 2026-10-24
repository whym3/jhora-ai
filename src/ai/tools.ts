// Retrieval tools for the AI astrologer: each one runs the app's own calculation jobs
// (the same worker jobs the views use, verified against Jagannatha Hora) on the chart
// that is open, and returns the result as compact text. Provider-neutral: the Claude
// and OpenAI adapters (agent.ts) wrap the same JSON-schema definitions.
import type { ChartSpec, JobRequest, Table } from '../engine/protocol';

export interface ToolContext {
  /** runs a job in the calculation worker */
  request: (req: JobRequest) => Promise<unknown>;
  /** the open chart (natal, or the derived chart shown in place of it) */
  spec: ChartSpec;
  title: string;
}

type Json = Record<string, unknown>;
export interface AiTool {
  name: string;
  description: string;
  /** JSON Schema of the input (type object, additionalProperties false) */
  parameters: Json;
  run: (ctx: ToolContext, input: Json) => Promise<string>;
}

// Option lists of the engine jobs (kept in sync with the registries by tests/aiTools.test.ts).
export const NAKSHATRA_DASA_SYSTEMS = ['Vimsottari', 'Ashtottari', 'Yogini', 'Kalachakra', 'Dwisaptati sama', 'Shattrimsa sama', 'Dwadasottari',
  'Chaturaseeti sama', 'Sataabdika', 'Shodasottari', 'Shashtihayani', 'Panchottari', 'Saptarshi nakshatra'];
export const RASI_DASA_SYSTEMS = ['Narayana', 'Lagnamsaka', 'Padanaathaamsa', 'Sudasa', 'Drigdasa', 'Lagna Kendradi', 'AK Kendradi Rasi', 'Trikona',
  'Chara (Parasara)', 'Chara (K.N. Rao)', 'Chara (Rangacharya)', 'Yogardha', 'Paryaaya', 'Shoola', 'Niryaana Shoola', 'Brahma', 'Sthira',
  'Mandooka (D-11)', 'Mandooka (K.N. Rao)', 'Navamsa', 'Varnada'];
export const OTHER_DASA_SYSTEMS = ['Moola', 'Naisargika', 'Tara', 'Kaala', 'Chakra', 'AK Kendradi Graha', 'Patyayini', 'Sudarsana Chakra', 'Buddhi Gati',
  'Rasi-Bhukta Vimsottari', 'Karaka', 'Tithi Ashtottari', 'Yoga Vimsottari', 'Karana Chaturaseeti', 'Tithi Yogini'];
export const VARGAS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60',
  'D81', 'D108', 'D144'];
export const AV_MODES = ['BAVs and SAV', 'SoAV', 'PAV of Sun', 'PAV of Moon', 'PAV of Mars', 'PAV of Mercury', 'PAV of Jupiter', 'PAV of Venus',
  'PAV of Saturn', 'PAV of Lagna', 'Sodhya pindas'];
export const YOGA_CATEGORIES = ['All yogas', 'Pancha maha purusha yogas', 'Solar yogas', 'Lunar yogas', 'Naabhasa yogas', 'Raja yogas',
  'Raja sambandha yogas', 'Dhana yogas', 'Daridra yogas', 'Parivraja yogas', 'Other popular yogas'];
export const TRANSIT_MODES = ['Standard (tara, murthi, vedha)', 'Houses from lagna & Moon', 'Ashtakavarga related', 'Transits in special nakshatras',
  'Aspects on special nakshatras', 'Latta (planetary kick)', 'Transits in special nakshatras (lagna)', 'Aspects on special nakshatras (lagna)',
  'Anga graha transits'];
const BODIES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

/** Strength and special-point tables by name -> engine job. */
const STRENGTHS: Record<string, string> = {
  shadbala: 'strengths.shadbalaSummary', shadbala_breakup: 'strengths.shadbalaBreakup', sthana_bala: 'strengths.sthana',
  kaala_bala: 'strengths.kaala', dig_bala: 'strengths.dig', cheshta_bala: 'strengths.cheshta', drig_bala: 'strengths.drig',
  naisargika_bala: 'strengths.naisargika', bhava_bala: 'strengths.bhava', ishta_kashta: 'strengths.ishtaKashta', rashmis: 'strengths.rashmis',
  vimsopaka: 'strengths.vimsopaka', amsa_balas: 'strengths.amsaBalas', avasthas: 'strengths.basicAvasthas', sayanadi_avasthas: 'strengths.sayanadi',
  pancha_vargeeya_bala: 'strengths.panchaVargeeya', dwadasa_vargeeya_bala: 'strengths.dwadasaVargeeya', harsha_bala: 'strengths.harsha',
};
const SPECIAL: Record<string, string> = {
  chara_karakas: 'basics.charaKarakas', nava_taras_from_moon: 'basics.navaTarasMoon', nava_taras_from_lagna: 'basics.navaTarasLagna',
  special_taras_from_moon: 'basics.specialTarasMoon', special_taras_from_lagna: 'basics.specialTarasLagna', yogi_avayogi: 'basics.yogi',
  combustion: 'basics.combustion', graha_yuddha: 'basics.grahaYuddha', malicious_points: 'basics.malicious', sahamas: 'basics.sahamas',
  drekkanas: 'basics.drekkanas', nakshatra_aspects_latta: 'basics.nakshatraAspects', special_tithis: 'basics.specialTithis',
  pushkara: 'basics.pushkara', mrityu_bhaga: 'basics.mrityuBhaga', deities: 'basics.deities', amsa_rulers: 'basics.amsaRulers',
  declinations_coordinates: 'basics.coordinates', laghu_parasari_functional_nature: 'laghuParasari.table',
};

/** A job's table as plain text: caption, header row and rows joined with " | ", notes. */
export function tableText(t: Table): string {
  const out: string[] = [];
  if (t.caption) out.push(t.caption);
  if (t.rows.length) {
    if (t.headers.length) out.push(t.headers.map((h) => h.trim()).join(' | '));
    for (const r of t.rows) out.push(r.map((c) => c.trim()).join(' | '));
  } else if (t.text) out.push(...t.text);
  if (t.notes?.length) out.push(...t.notes);
  return out.join('\n');
}

const table = async (ctx: ToolContext, name: string, params: Json = {}, spec = ctx.spec) =>
  (await ctx.request({ kind: 'table', chart: spec, table: name, params })) as Table;
const keyInfo = async (ctx: ToolContext, spec = ctx.spec) => (await ctx.request({ kind: 'text', chart: spec, cmd: 32974 })) as string;

interface DateInput { year: number; month: number; day: number; hour?: number }
const dateSchema = (what: string) => ({
  type: 'object', additionalProperties: false, required: ['year', 'month', 'day'],
  description: `${what} (local clock time in the chart's time zone)`,
  properties: {
    year: { type: 'integer' }, month: { type: 'integer', minimum: 1, maximum: 12 }, day: { type: 'integer', minimum: 1, maximum: 31 },
    hour: { type: 'number', minimum: 0, maximum: 24, description: 'decimal hours, default 12' },
  },
});
const today = (): DateInput => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: 12 }; };
const dayNumber = (d: DateInput) => Date.UTC(d.year, d.month - 1, d.day) / 86400000 + (d.hour ?? 12) / 24;
/** "2004-07-11 (11:09:43)" -> day number comparable with dayNumber(). */
function periodDay(s: string): number | null {
  const m = /(-?\d+)-(\d\d)-(\d\d)(?: \((\d+):(\d\d):(\d\d)\))?/.exec(s);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + ((+(m[4] ?? 0)) + (+(m[5] ?? 0)) / 60 + (+(m[6] ?? 0)) / 3600) / 24;
}
function dasaJob(system: string): string {
  if (NAKSHATRA_DASA_SYSTEMS.includes(system)) return 'dasas.nakshatra';
  if (RASI_DASA_SYSTEMS.includes(system)) return 'dasas.rasi';
  if (OTHER_DASA_SYSTEMS.includes(system)) return 'dasas.other';
  throw new Error(`unknown dasa system "${system}"`);
}
const ALL_DASAS = [...NAKSHATRA_DASA_SYSTEMS, ...RASI_DASA_SYSTEMS, ...OTHER_DASA_SYSTEMS];

export const AI_TOOLS: AiTool[] = [
  {
    name: 'get_chart_overview',
    description: 'Birth data and the Key Info of the open chart: date, time, time zone, place, lunar year/month, tithi, weekday, nakshatra, yoga, karana (with % left), hora and kaala lords, sunrise/sunset, janma ghatis, ayanamsa, sidereal time. Call this first.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    run: async (ctx) => `Chart: ${ctx.title}\n${await keyInfo(ctx)}`,
  },
  {
    name: 'get_longitudes',
    description: 'Sidereal longitudes of all 56 bodies of the rasi chart (lagna, Sun..Ketu with chara karaka and retrograde marks, Maandi/Gulika, special lagnas, upagrahas, arudha padas, sphutas) with nakshatra, pada, rasi and navamsa.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    run: async (ctx) => tableText(await table(ctx, 'basics.longitudes')),
  },
  {
    name: 'get_divisional_charts',
    description: 'Sign occupied by each body (planets, lagna, special lagnas, arudhas) in every divisional chart (D-1 ... D-60, D-81, D-108, D-144) at once. Use get_divisional_longitudes for exact degrees in each varga.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    run: async (ctx) => tableText(await table(ctx, 'basics.rasisInVargas')),
  },
  {
    name: 'get_divisional_longitudes',
    description: 'Longitude of every body in every divisional chart (degrees within the varga sign).',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
    run: async (ctx) => tableText(await table(ctx, 'basics.allDivisionalLongitudes')),
  },
  {
    name: 'get_houses_and_kp',
    description: 'Bhava (house) cusps with the planets in each house, the KP (Krishnamurti Paddhati) lords of every cusp and planet (nakshatra lord, sub lord, prati-sub ... deha-sub), and which planets occupy the nakshatra of each planet (or its sub, ... at `occupant_level`).',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { occupant_level: { type: 'integer', minimum: 0, maximum: 5, description: '0 = nakshatra (default), 1 = sub, 2 = prati-sub, 3 = sookshma, 4 = praana, 5 = deha' } },
    },
    run: async (ctx, i) => {
      const level = Number(i.occupant_level ?? 0);
      const [houses, kp, occ] = await Promise.all([table(ctx, 'basics.houses'), table(ctx, 'basics.kp'), table(ctx, 'basics.kpOccupants', { level })]);
      return ['HOUSES', tableText(houses), '', 'KP LORDS OF CUSPS AND PLANETS', tableText(kp), '', 'KP OCCUPANTS', tableText(occ)].join('\n');
    },
  },
  {
    name: 'get_dasa',
    description: 'Periods of a dasa system. Without `path` the maha dasas; `path` drills down by row index (e.g. [2] = antardasas of the 3rd maha dasa, [2,0] = pratyantardasas of its first antardasa). Dates are local time.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['system'],
      properties: {
        system: { type: 'string', enum: ALL_DASAS },
        path: { type: 'array', items: { type: 'integer', minimum: 0 }, maxItems: 5 },
      },
    },
    run: async (ctx, i) => {
      const system = String(i.system);
      return tableText(await table(ctx, dasaJob(system), { system, path: (i.path as number[] | undefined) ?? [] }));
    },
  },
  {
    name: 'get_running_dasa',
    description: 'The periods running on a date in a dasa system, from maha dasa down to `levels` levels (maha, antar, pratyantar, sookshma, prana), each with its start and end. Default date: today.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['system'],
      properties: {
        system: { type: 'string', enum: ALL_DASAS },
        date: dateSchema('the date to look up'),
        levels: { type: 'integer', minimum: 1, maximum: 5, description: 'default 3' },
      },
    },
    run: async (ctx, i) => {
      const system = String(i.system), job = dasaJob(system);
      const date = (i.date as DateInput | undefined) ?? today();
      const at = dayNumber(date);
      const levels = Number(i.levels ?? 3);
      const path: number[] = [];
      const out = [`${system} running on ${date.year}-${date.month}-${date.day}:`];
      for (let level = 0; level < levels; level++) {
        const t = await table(ctx, job, { system, path });
        const k = t.rows.findIndex((r) => {
          const s = periodDay(r[1] ?? ''), e = periodDay(r[2] ?? '');
          return s !== null && e !== null && s <= at && at < e;
        });
        if (k < 0) { out.push(level === 0 ? 'the date is outside the listed periods' : '(no deeper level)'); break; }
        out.push(`${'  '.repeat(level)}level ${level + 1}: ${t.rows[k].map((c) => c.trim()).join(' | ')}`);
        if (t.drill === false) break;
        path.push(k);
      }
      return out.join('\n');
    },
  },
  {
    name: 'get_strengths',
    description: 'Strength tables: shadbala (summary or breakup and its components), bhava_bala, ishta_kashta phala, rashmis, vimsopaka bala, amsa balas (vaiseshikamsa), avasthas, Tajaka balas (pancha/dwadasa vargeeya, harsha).',
    parameters: {
      type: 'object', additionalProperties: false, required: ['kind'],
      properties: { kind: { type: 'string', enum: Object.keys(STRENGTHS) } },
    },
    run: async (ctx, i) => tableText(await table(ctx, STRENGTHS[String(i.kind)])),
  },
  {
    name: 'get_ashtakavarga',
    description: 'Ashtakavarga of a varga: BAVs and SAV, sodhita (reduced) AV, prastara AV of one planet, or sodhya pindas. A * marks the sign the planet occupies.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { mode: { type: 'string', enum: AV_MODES }, varga: { type: 'string', enum: VARGAS } },
    },
    run: async (ctx, i) => tableText(await table(ctx, 'strengths.ashtakavarga', { mode: i.mode ?? AV_MODES[0], varga: i.varga ?? 'D1' })),
  },
  {
    name: 'get_yogas',
    description: 'Yogas present in a varga (JHora\'s yoga set), with yoga givers, results and definitions.',
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { category: { type: 'string', enum: YOGA_CATEGORIES }, varga: { type: 'string', enum: VARGAS } },
    },
    run: async (ctx, i) => {
      const t = await table(ctx, 'strengths.yogas', { mode: i.category ?? YOGA_CATEGORIES[0], varga: i.varga ?? 'D1' });
      return t.rows.length ? tableText(t) : 'No yogas of this category in this varga.';
    },
  },
  {
    name: 'get_aspects',
    description: 'Parasara aspects. kind "evaluation": aspect strength (%) of each planet on every body and on every house cusp from each body; kind "table": aspect values between planets with their compound relationships.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['kind'],
      properties: { kind: { type: 'string', enum: ['evaluation', 'table'] }, varga: { type: 'string', enum: VARGAS } },
    },
    run: async (ctx, i) => {
      const varga = String(i.varga ?? 'D1');
      return i.kind === 'table'
        ? tableText(await table(ctx, 'aspects.table', { varga }))
        : tableText(await table(ctx, 'aspects.evaluation', { aspectedVarga: varga, aspectingVarga: varga }));
    },
  },
  {
    name: 'get_special_points',
    description: 'Other basic tables: chara karakas, nava taras and special taras (from Moon or lagna), yogi/avayogi, combustion, graha yuddha, malicious points, 36 sahamas, drekkanas, nakshatra aspects and latta, special tithis, pushkara amsa/bhaga, mrityu bhaga, deities, amsa rulers (D-60/D-150 names), declinations, Laghu Parasari functional benefics/malefics.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['kind'],
      properties: { kind: { type: 'string', enum: Object.keys(SPECIAL) } },
    },
    run: async (ctx, i) => tableText(await table(ctx, SPECIAL[String(i.kind)])),
  },
  {
    name: 'get_sign_change_sensitivity',
    description: 'How much earlier or later the birth time would have to be for a body to change sign in a varga (birth-time sensitivity, for rectification).',
    parameters: {
      type: 'object', additionalProperties: false, required: ['body'],
      properties: { body: { type: 'string', enum: BODIES }, varga: { type: 'string', enum: VARGAS } },
    },
    run: async (ctx, i) => tableText(await table(ctx, 'chart.signChange', { body: i.body, varga: i.varga ?? 'D1' })),
  },
  {
    name: 'get_transits',
    description: 'Transit positions on a date against the natal chart, in one of JHora\'s transit modes: standard (tara, murthi, vedha), houses from lagna and Moon, ashtakavarga bindus, special nakshatras, aspects, latta, anga graha.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['date'],
      properties: { date: dateSchema('transit date'), mode: { type: 'string', enum: TRANSIT_MODES } },
    },
    run: async (ctx, i) => {
      const d = i.date as DateInput;
      const mode = Math.max(0, TRANSIT_MODES.indexOf(String(i.mode ?? TRANSIT_MODES[0])));
      return tableText(await table(ctx, 'transits.basic', { date: { ...d, hour: d.hour ?? 12 }, mode }));
    },
  },
  {
    name: 'get_annual_chart',
    description: 'Tajaka (varshaphala) chart of a year of life, i.e. the solar return in the given calendar year: its Key Info, longitudes and Mudda dasa.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['year'],
      properties: { year: { type: 'integer' }, month: { type: 'integer', minimum: 1, maximum: 12, description: 'for a monthly (masa) chart instead' } },
    },
    run: async (ctx, i) => {
      const selection: Json = { year: Number(i.year) };
      if (i.month) selection.month = Number(i.month);
      const found = await table(ctx, 'tajaka.find', { selection, variant: 'exact' });
      const { birth, label } = JSON.parse(found.text![0]) as { birth: ChartSpec['birth']; label: string };
      const spec = { birth, ini: ctx.spec.ini };
      const [info, lons, mudda] = await Promise.all([keyInfo(ctx, spec), table(ctx, 'basics.longitudes', {}, spec), table(ctx, 'tajaka.mudda', { selection, variant: 'exact', path: [] })]);
      return [label, info, '', 'LONGITUDES', tableText(lons), '', 'MUDDA DASA', tableText(mudda)].join('\n');
    },
  },
  {
    name: 'get_panchanga',
    description: 'Panchanga of a day at the chart\'s place: tithi, nakshatra, yoga, karana with end times, sunrise/sunset, moonrise/moonset, rahu kaala, varjya, durmuhurta, horas and choghadiyas. Default: the chart\'s own day.',
    parameters: { type: 'object', additionalProperties: false, properties: { date: dateSchema('the day') } },
    run: async (ctx, i) => {
      const d = i.date as DateInput | undefined;
      const spec = d ? { ...ctx.spec, birth: { ...ctx.spec.birth, year: d.year, month: d.month, day: d.day, hour: d.hour ?? 12, override: undefined } } : ctx.spec;
      return tableText(await table(ctx, 'panchanga.daily', {}, spec));
    },
  },
];

/** Minimal check of a tool input against its schema (types, enums, required keys, no extras). */
export function validateInput(schema: Json, value: unknown, at = 'input'): string | null {
  const s = schema as { type?: string; enum?: unknown[]; properties?: Record<string, Json>; required?: string[]; items?: Json; additionalProperties?: boolean; minimum?: number; maximum?: number; maxItems?: number };
  if (s.enum && !s.enum.includes(value)) return `${at} must be one of ${s.enum.map((x) => JSON.stringify(x)).join(', ')}`;
  switch (s.type) {
    case 'object': {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${at} must be an object`;
      const v = value as Json;
      for (const k of s.required ?? []) if (!(k in v)) return `${at}.${k} is required`;
      for (const [k, x] of Object.entries(v)) {
        const p = s.properties?.[k];
        if (!p) { if (s.additionalProperties === false) return `${at}.${k} is not allowed`; continue; }
        const e = validateInput(p, x, `${at}.${k}`);
        if (e) return e;
      }
      return null;
    }
    case 'array': {
      if (!Array.isArray(value)) return `${at} must be an array`;
      if (s.maxItems !== undefined && value.length > s.maxItems) return `${at} has more than ${s.maxItems} items`;
      for (const [k, x] of value.entries()) { const e = s.items ? validateInput(s.items, x, `${at}[${k}]`) : null; if (e) return e; }
      return null;
    }
    case 'integer': case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value) || (s.type === 'integer' && !Number.isInteger(value))) return `${at} must be ${s.type === 'integer' ? 'an integer' : 'a number'}`;
      if (s.minimum !== undefined && value < s.minimum) return `${at} must be >= ${s.minimum}`;
      if (s.maximum !== undefined && value > s.maximum) return `${at} must be <= ${s.maximum}`;
      return null;
    }
    case 'string': return typeof value === 'string' ? null : `${at} must be a string`;
    default: return null;
  }
}

/** Validate and run a tool; errors come back as text for the model. */
export async function runTool(ctx: ToolContext, name: string, input: unknown): Promise<{ ok: boolean; text: string }> {
  const tool = AI_TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, text: `Unknown tool ${name}` };
  const bad = validateInput(tool.parameters, input ?? {});
  if (bad) return { ok: false, text: `Invalid input: ${bad}` };
  try {
    return { ok: true, text: await tool.run(ctx, (input ?? {}) as Json) };
  } catch (e) {
    return { ok: false, text: `Calculation failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
