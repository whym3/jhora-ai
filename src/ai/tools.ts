// Retrieval tools for the AI astrologer: each one runs the app's own calculation jobs
// (the same worker jobs the views use, verified against Jagannatha Hora) on the chart
// that is open, and returns the result as compact text. Provider-neutral: the Claude
// and OpenAI adapters (agent.ts) wrap the same JSON-schema definitions, made strict
// by anthropicStrictSchema() / openaiStrictSchema().
import type { ChartSpec, JobRequest, Table } from '../engine/protocol';
import { DEFAULTS } from '../settings/generated';
import { ayanamsaLabel, calcSettingsFromIni, type AyanamsaId } from '../core/settings';
import { HOUSE_SYSTEMS } from '../core/kpHouses';
import { YEAR_DEFINITIONS } from '../core/dasas/time';
import { NAKSHATRA_NAMES as ZODIAC_NAKSHATRA_NAMES, SIGN_NAMES as ZODIAC_SIGN_NAMES } from '../core/zodiac';
import { SAHAMAS } from '../core/sahamas';
import { NATAL_REFS as TRANSIT_REFS, VARGA_ORDER, transitBirth, type TransitDate } from '../core/transits/common';
import { NATAL_SEARCH_BODIES as SEARCH_BODIES, type SpecialSearch } from '../core/transits/search';
import { CALENDAR_ITEMS as TRANSIT_CALENDAR_ITEMS } from '../core/transits/calendar';

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
  /** JSON Schema of the input (every object: additionalProperties false and a required list) */
  parameters: Json;
  /** sample inputs shown to Claude (input_examples); each must validate against `parameters` */
  examples?: Json[];
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
  'PAV of Saturn', 'PAV of Lagna', 'Sodhya pindas', 'Nakshatras & rasis'];
export const YOGA_CATEGORIES = ['All yogas', 'Pancha maha purusha yogas', 'Solar yogas', 'Lunar yogas', 'Naabhasa yogas', 'Raja yogas',
  'Raja sambandha yogas', 'Dhana yogas', 'Daridra yogas', 'Parivraja yogas', 'Other popular yogas'];
export const TRANSIT_MODES = ['Standard (tara, murthi, vedha)', 'Houses from lagna & Moon', 'Ashtakavarga related', 'Transits in special nakshatras',
  'Aspects on special nakshatras', 'Latta (planetary kick)', 'Transits in special nakshatras (lagna)', 'Aspects on special nakshatras (lagna)',
  'Anga graha transits'];
export const BODIES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
export const SIGN_NAMES: string[] = [...ZODIAC_SIGN_NAMES];
export const SAHAMA_NAMES = SAHAMAS.map((s) => s.name);
export const NATAL_SEARCH_BODIES: string[] = [...SEARCH_BODIES];
export const NATAL_REFS: string[] = [...TRANSIT_REFS];
export const CALENDAR_ITEMS: string[] = [...TRANSIT_CALENDAR_ITEMS];
export const NAKSHATRA_NAMES: string[] = [...ZODIAC_NAKSHATRA_NAMES];
/** Progressions tab: combo 1007 (vargas; JHora's last entry "D-108" divides by 81) and combo 1014 (nakshatra dasas). */
export const PROGRESSION_VARGAS = ['Rasi', 'Navamsa', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-10', 'D-11', 'D-12', 'D-16', 'D-20',
  'D-24', 'D-27', 'D-30', 'D-40', 'D-45', 'D-60', 'D-108'];
export const PROGRESSION_DASAS = ['Vimsottari', 'Ashtottari', 'Kalachakra', 'Yogini', 'Dwisaptati sama', 'Shattrimsa sama', 'Dwadasottati',
  'Chaturaseeti sama', 'Satabdika', 'Shodasottari', 'Panchottari', 'Shashtisama'];
const PROGRESSION_METHODS: Record<string, string> = { solar: 'solar', bhrigu: 'bhrigu', sudarsana_chakra: 'scd', nakshatra_dasa: 'nakshatra' };
/** Mundane tab: transit divisions (combo 1004), aspects (combo 1036), eclipse types (combo 1032). */
export const MUNDANE_DIVISIONS = ['Rasi', 'Nakshatra', 'Navamsa', 'D-2', 'D-3', 'D-4', 'D-5', 'D-6', 'D-7', 'D-8', 'D-10', 'D-11', 'D-12', 'D-16',
  'D-20', 'D-24', 'D-27', 'D-30', 'D-40', 'D-45', 'D-60', 'D-108', 'D-144'];
export const MUNDANE_ASPECTS = ['Conjunction (yuti)', 'Opposition (samasaptaka)', 'Trine (5th)', 'Trine (9th)', 'Quadrant (4th)', 'Quadrant (10th)',
  '2nd', '3rd', '6th', '8th', '11th', '12th'];
export const ECLIPSE_TYPES = ['Lunar', 'Global Solar', 'Local Solar'];
export const STATIONARY_PLANETS = ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
/** Mundane events -> the mundane.find mode (the calendar events take only { next }). */
const MUNDANE_EVENTS: Record<string, string> = {
  sign_or_division_change: 'transit', aspect: 'conjunction', station: 'stationary', eclipse: 'eclipse',
  solar_new_year: 'solarYear', solar_new_month: 'solarMonth', lunar_new_year: 'lunarYear', lunar_new_month: 'lunarMonth',
  new_lunar_day: 'lunarDay', fortnight: 'fortnight', ardra_pravesha: 'ardra',
};
export const PRASNA_LIMITS: Record<string, number> = { '108': 108, '249': 249, nadi: 1800 };
/** Chakras tab (src/core/chakras/chakraJobs.ts) and the bodies a chakra can place. */
export const CHAKRAS = ['sarvatobhadra', 'kota', 'sudarsana', 'surya_kalanala', 'chandra_kalanala', 'shoola', 'tripataki'];
export const CHAKRA_BODY_SETS = ['planets', 'trisphuta', 'upagrahas', 'specialLagnas', 'sahamas'];
export const ARGALA_REFS = ['Lagna', 'AL', 'UL', 'Moon', 'Sun', 'AK'];
/** Longitude Correlation modes (radio 201..204). */
const CORRELATION_METHODS: Record<string, number> = { aspect_strength: 0, named_aspects: 1, conjunction_and_quadrants: 2, conjunction_trines_and_7th: 3 };
/** Panchanga menu copies by tool name -> job. */
const MONTH_TABLES: Record<string, string> = { planetary_movements: 'panchanga.movements', daily_ephemeris: 'panchanga.ephemeris', panchanga: 'panchanga.monthly' };

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

/** A derived chart found by a `*.find` job (text[0] = JSON { birth, label }): the search result, Key Info and longitudes. */
async function derivedChartText(ctx: ToolContext, found: Table): Promise<string> {
  const { birth, label } = JSON.parse(found.text![0]) as { birth: ChartSpec['birth']; label: string };
  const spec = { birth, ini: ctx.spec.ini };
  const [info, lons] = await Promise.all([keyInfo(ctx, spec), table(ctx, 'basics.longitudes', {}, spec)]);
  // the Key Info copy is titled "Natal Chart" (the chart record's name): name the derived chart instead
  const named = info.replace(/^(\s*)Natal Chart(\r?\n)/, `$1${label}$2`);
  return [...(found.caption ? [] : [label]), tableText({ ...found, text: undefined }), '', named, '', 'LONGITUDES', tableText(lons)].join('\n');
}

// ---------------------------------------------------------------------------
// Schemas

/** An object schema: closed (additionalProperties false) with an explicit required list, as strict mode needs. */
const obj = (properties: Record<string, Json>, required: string[] = [], description?: string): Json =>
  ({ type: 'object', additionalProperties: false, required, properties, ...(description ? { description } : {}) });

interface DateInput { year: number; month: number; day: number; hour?: number }
const dateSchema = (what: string) => obj({
  year: { type: 'integer' },
  month: { type: 'integer', minimum: 1, maximum: 12, description: '1-12' },
  day: { type: 'integer', minimum: 1, maximum: 31, description: '1-31' },
  hour: { type: 'number', minimum: 0, maximum: 24, description: 'decimal hours 0-24, default 12' },
}, ['year', 'month', 'day'], `${what} (local clock time in the chart's time zone)`);
const vargaSchema = (what = 'divisional chart') => ({ type: 'string', enum: VARGAS, description: `${what}, default D1` });
const pathSchema = (what: string) => ({ type: 'array', items: { type: 'integer', minimum: 0 }, maxItems: 5, description: what });
const bodiesSchema = {
  type: 'array', items: { type: 'string' },
  description: 'only these bodies, by the names in the Body column (e.g. "Moon", "Hora Lagna", "Gulika"); default all',
};

const p2 = (x: number) => String(x).padStart(2, '0');
const dateText = (d: DateInput) => `${d.year}-${p2(d.month)}-${p2(d.day)}`;
/** Today in the browser's local calendar (noon), the date the user means by "today". */
export const localDate = (now = new Date()): DateInput => ({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(), hour: 12 });
export const localDateString = (now = new Date()) => dateText(localDate(now));
const transitDate = (d: DateInput | undefined): TransitDate => { const x = d ?? localDate(); return { year: x.year, month: x.month, day: x.day, hour: x.hour ?? 12 }; };
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
/** JHora's varga index (the transit jobs' combos) of a varga name. */
const vargaIndex = (v: unknown) => Math.max(0, VARGA_ORDER.indexOf(String(v ?? 'D1') as (typeof VARGA_ORDER)[number]));

// ---------------------------------------------------------------------------
// Output helpers

/** Body name of a table row: "Saturn (R) - AmK" -> "saturn". */
const bodyKey = (s: string) => s.replace(/ - \w+$/, '').replace(' (R)', '').trim().toLowerCase();

/** Keep only the rows of the named bodies; unknown names are listed, never silently ignored. */
function filterBodies(t: Table, bodies: string[] | undefined): Table {
  if (!bodies?.length) return t;
  const want = new Map(bodies.map((b) => [bodyKey(b), b]));
  const rows = t.rows.filter((r) => want.has(bodyKey(r[0])));
  const found = new Set(rows.map((r) => bodyKey(r[0])));
  const missing = [...want].filter(([k]) => !found.has(k)).map(([, b]) => b);
  if (!rows.length) throw new Error(`no row matches ${bodies.join(', ')}; the bodies are: ${t.rows.map((r) => r[0].replace(/ - \w+$/, '').replace(' (R)', '')).join(', ')}`);
  return { ...t, rows, notes: [...(t.notes ?? []), ...(missing.length ? [`Not found: ${missing.join(', ')}`] : [])] };
}

const AYANAMSA_NAME: Partial<Record<AyanamsaId, string>> = {
  'true-chitrapaksha': 'True Chitrapaksha (Lahiri; Spica at 180 deg of date)', lahiri: 'Lahiri (Swiss Ephemeris SE_SIDM_LAHIRI)', tropical: 'Tropical (no ayanamsa)',
};

/** The settings that change positions, houses and dasa dates of the open chart. */
export function settingsText(ini: ChartSpec['ini']): string {
  const s = calcSettingsFromIni(ini), all = { ...DEFAULTS, ...ini };
  const house = HOUSE_SYSTEMS.find((h) => h[2] === all.HouseTypeWanted)?.[0] ?? `house type ${all.HouseTypeWanted}`;
  const ayanamsa = s.sssAyanamsa ? 'Surya Siddhanta' : AYANAMSA_NAME[s.ayanamsa] ?? ayanamsaLabel(s.ayanamsa);
  const year = YEAR_DEFINITIONS[all.YearDefinition?.[0] ?? 3] ?? 'true-sidereal';
  return [
    'CALCULATION SETTINGS',
    `Ayanamsa: ${ayanamsa} (JHora index ${all.UserSelectedAyanamsa})${s.ayanamsaDelta ? `, adjusted by ${s.ayanamsaDelta} deg` : ''}`,
    `Planets: ${s.sss ? 'Surya Siddhanta model' : 'Swiss Ephemeris'}, ${s.topocentric ? 'topocentric' : 'geocentric'}, ${s.truePositions ? 'true (geometric)' : 'apparent'} positions; ${s.trueNodes ? 'true' : 'mean'} nodes`,
    `Houses: ${house}, ${all.HouseCuspsInMiddle ? 'cusp in the middle of the house' : 'cusp at the start of the house'}`,
    `KP: cusps and their lords follow the house system above${all.HouseTypeWanted === 4 ? ' (Placidus, as KP prescribes)' : '; KP proper uses Placidus, so cusp sub lords here are not standard KP'}`,
    `Dasa year: ${year.replace('-', ' ')}`,
  ].join('\n');
}

const RELATION: Record<string, string> = { own: 'own', rel1: 'Adhimitra', rel2: 'Mitra', rel3: 'Sama', rel4: 'Satru', rel5: 'Adhisatru' };

/** The compound relationships aspects.table carries only as cell colours, as text. */
function relationshipText(t: Table): string[] {
  if (!t.cellClasses) return [];
  const out = ['RELATIONSHIPS (compound, of the aspecting planet towards the lord of its own sign, each planet, and the lord of each house)'];
  t.rows.forEach((r, i) => {
    const c = t.cellClasses![i] ?? [];
    const named = (k: number) => (c[k] ? `${t.headers[k].trim()} ${RELATION[c[k]!] ?? c[k]}` : null);
    const cols = t.headers.map((_, k) => k).slice(1);
    const planets = cols.filter((k) => !/^\d/.test(t.headers[k])).map(named).filter(Boolean);
    const houses = cols.filter((k) => /^\d/.test(t.headers[k])).map(named).filter(Boolean);
    out.push(`${r[0].split(' ')[0]}: sign lord ${RELATION[c[0] ?? ''] ?? '-'}; planets: ${planets.join(', ')}; house lords: ${houses.join(', ')}`);
  });
  return out;
}

/** Dasa periods of `system` overlapping [from, to) down to `level`, as an indented list. */
async function periodsInRange(ctx: ToolContext, system: string, level: number, from: number, to: number): Promise<string[]> {
  const job = dasaJob(system);
  const LIMIT = 300;
  let count = 0;
  const walk = async (path: number[], depth: number): Promise<string[]> => {
    const t = await table(ctx, job, { system, path });
    const kept = t.rows.map((r, k) => ({ r, k })).filter(({ r }) => {
      const s = periodDay(r[1] ?? ''), e = periodDay(r[2] ?? '');
      return s !== null && e !== null && s < to && e > from;
    });
    const deeper = depth < level && t.drill !== false;
    if (!deeper) {
      count += kept.length;
      if (count > LIMIT) throw new Error(`more than ${LIMIT} periods: narrow the date range or lower the level`);
    }
    const parts = await Promise.all(kept.map(async ({ r, k }) => {
      const line = `${'  '.repeat(depth - 1)}L${depth} ${r.map((c) => c.trim()).join(' | ')}`;
      return deeper ? [line, ...(await walk([...path, k], depth + 1))] : [line];
    }));
    return parts.flat();
  };
  return walk([], 1);
}

// ---------------------------------------------------------------------------
// Tools

export const AI_TOOLS: AiTool[] = [
  {
    name: 'get_chart_overview',
    description: 'Birth data, Key Info and calculation settings of the open chart: date, time, time zone, place, lunar year/month, tithi, weekday, nakshatra, yoga, karana (with % left), hora and kaala lords, sunrise/sunset, janma ghatis, ayanamsa, sidereal time; then the ayanamsa, node type, house system (which KP cusps follow) and dasa year length in use. Call this first.',
    parameters: obj({}),
    run: async (ctx) => `Chart: ${ctx.title}\n${await keyInfo(ctx)}\n\n${settingsText(ctx.spec.ini)}`,
  },
  {
    name: 'get_longitudes',
    description: 'Sidereal longitudes of the 56 bodies of the rasi chart (lagna; Sun..Ketu marked "(R)" when retrograde and " - AK/AmK/..." with their chara karaka; Maandi/Gulika, special lagnas, upagrahas, arudha padas, sphutas) with nakshatra, pada, rasi and navamsa. Longitude format: degrees, sign abbreviation, minutes and seconds within the sign.',
    parameters: obj({ bodies: bodiesSchema }),
    run: async (ctx, i) => tableText(filterBodies(await table(ctx, 'basics.longitudes'), i.bodies as string[] | undefined)),
  },
  {
    name: 'get_divisional_charts',
    description: 'Sign occupied by each body (planets, lagna, special lagnas, arudhas) in every divisional chart (D-1 ... D-60, D-81, D-108, D-144) at once. Use get_divisional_longitudes for exact degrees in each varga.',
    parameters: obj({ bodies: bodiesSchema }),
    run: async (ctx, i) => tableText(filterBodies(await table(ctx, 'basics.rasisInVargas'), i.bodies as string[] | undefined)),
  },
  {
    name: 'get_divisional_longitudes',
    description: 'Longitude of every body in every divisional chart (degrees, sign, minutes within the varga sign, e.g. 29Sg27).',
    parameters: obj({ bodies: bodiesSchema }),
    run: async (ctx, i) => tableText(filterBodies(await table(ctx, 'basics.allDivisionalLongitudes'), i.bodies as string[] | undefined)),
  },
  {
    name: 'get_houses_and_kp',
    description: 'Bhava (house) cusps with the planets in each house in the chart\'s house system, the KP (Krishnamurti Paddhati) lords of every cusp and planet (nakshatra lord, sub lord, prati-sub ... deha-sub), and which planets occupy the nakshatra of each planet (or its sub, ... at `occupant_level`).',
    parameters: obj({ occupant_level: { type: 'integer', minimum: 0, maximum: 5, description: '0 = nakshatra (default), 1 = sub, 2 = prati-sub, 3 = sookshma, 4 = praana, 5 = deha' } }),
    run: async (ctx, i) => {
      const level = Number(i.occupant_level ?? 0);
      const [houses, kp, occ] = await Promise.all([table(ctx, 'basics.houses'), table(ctx, 'basics.kp'), table(ctx, 'basics.kpOccupants', { level })]);
      const system = settingsText(ctx.spec.ini).split('\n').filter((l) => /^(Houses|KP):/.test(l));
      return [...system, '', 'HOUSES', tableText(houses), '', 'KP LORDS OF CUSPS AND PLANETS', tableText(kp), '', 'KP OCCUPANTS', tableText(occ)].join('\n');
    },
  },
  {
    name: 'get_dasa',
    description: 'Periods of a dasa system as rows "lord | start | end" (lords abbreviated: Sun Moon Mars Merc Jup Ven Sat Rah Ket, or signs for rasi dasas). Without `path` the maha dasas; `path` drills down by 0-based row index ([2] = antardasas of the 3rd maha dasa, [2,0] = pratyantardasas of its first antardasa). For "which periods fall between two dates" use get_dasa_periods_in_range instead.',
    parameters: obj({
      system: { type: 'string', enum: ALL_DASAS },
      path: pathSchema('0-based row indices to drill into, at most 5'),
    }, ['system']),
    examples: [{ system: 'Vimsottari' }, { system: 'Vimsottari', path: [2, 0] }, { system: 'Narayana', path: [0] }],
    run: async (ctx, i) => {
      const system = String(i.system);
      return tableText(await table(ctx, dasaJob(system), { system, path: (i.path as number[] | undefined) ?? [] }));
    },
  },
  {
    name: 'get_running_dasa',
    description: 'The periods running on one date in a dasa system, from maha dasa down to `levels` levels (maha, antar, pratyantar, sookshma, prana), each with its start and end. Default date: today.',
    parameters: obj({
      system: { type: 'string', enum: ALL_DASAS },
      date: dateSchema('the date to look up, default today'),
      levels: { type: 'integer', minimum: 1, maximum: 5, description: '1-5, default 3' },
    }, ['system']),
    examples: [{ system: 'Vimsottari' }, { system: 'Yogini', date: { year: 2027, month: 3, day: 15 }, levels: 2 }],
    run: async (ctx, i) => {
      const system = String(i.system), job = dasaJob(system);
      const date = (i.date as DateInput | undefined) ?? localDate();
      const at = dayNumber(date);
      const levels = Number(i.levels ?? 3);
      const path: number[] = [];
      const out = [`${system} running on ${dateText(date)}:`];
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
    name: 'get_dasa_periods_in_range',
    description: 'Every period of a dasa system that overlaps a date range, down to `level` (1 maha, 2 antar, 3 pratyantar), as an indented list "L<level> lord | start | end". Use it for timing windows ("which antardasas run 2026-2030") instead of drilling get_dasa repeatedly. Errors (rather than truncating) above 300 periods.',
    parameters: obj({
      system: { type: 'string', enum: ALL_DASAS },
      from: dateSchema('start of the range'),
      to: dateSchema('end of the range'),
      level: { type: 'integer', minimum: 1, maximum: 3, description: '1-3, default 2' },
    }, ['system', 'from', 'to']),
    examples: [{ system: 'Vimsottari', from: { year: 2026, month: 1, day: 1 }, to: { year: 2030, month: 12, day: 31 }, level: 3 }],
    run: async (ctx, i) => {
      const system = String(i.system), from = i.from as DateInput, to = i.to as DateInput;
      const level = Number(i.level ?? 2);
      if (dayNumber(to) <= dayNumber(from)) throw new Error('`to` must be after `from`');
      const lines = await periodsInRange(ctx, system, level, dayNumber(from), dayNumber(to));
      return [`${system} periods overlapping ${dateText(from)} - ${dateText(to)} (down to level ${level}):`, ...(lines.length ? lines : ['none: the range is outside the listed periods'])].join('\n');
    },
  },
  {
    name: 'get_strengths',
    description: 'Strength tables: shadbala (summary or breakup and its components), bhava_bala, ishta_kashta phala, rashmis, vimsopaka bala, amsa balas (vaiseshikamsa), avasthas, Tajaka balas (pancha/dwadasa vargeeya, harsha).',
    parameters: obj({ kind: { type: 'string', enum: Object.keys(STRENGTHS) } }, ['kind']),
    run: async (ctx, i) => tableText(await table(ctx, STRENGTHS[String(i.kind)])),
  },
  {
    name: 'get_ashtakavarga',
    description: 'Ashtakavarga of a varga: BAVs and SAV, sodhita (reduced) AV, prastara AV of one planet, or sodhya pindas. A * marks the sign the planet occupies.',
    parameters: obj({ mode: { type: 'string', enum: AV_MODES, description: 'default "BAVs and SAV"' }, varga: vargaSchema() }),
    run: async (ctx, i) => tableText(await table(ctx, 'strengths.ashtakavarga', { mode: i.mode ?? AV_MODES[0], varga: i.varga ?? 'D1' })),
  },
  {
    name: 'get_yogas',
    description: 'Yogas present in a varga (JHora\'s yoga set), with yoga givers, results and definitions.',
    parameters: obj({ category: { type: 'string', enum: YOGA_CATEGORIES, description: 'default "All yogas"' }, varga: vargaSchema() }),
    run: async (ctx, i) => {
      const t = await table(ctx, 'strengths.yogas', { mode: i.category ?? YOGA_CATEGORIES[0], varga: i.varga ?? 'D1' });
      return t.rows.length ? tableText(t) : 'No yogas of this category in this varga.';
    },
  },
  {
    name: 'get_aspects',
    description: 'Parasara aspects. kind "evaluation": aspect strength (%; "-" = none) of each planet on every body and house cusp; the aspecting and aspected planets can be taken from different vargas. kind "table": aspect values between planets and on houses (marks: ↑ exalted, ↓ debilitated, △ moolatrikona, ● combust), followed by the compound relationship (Adhimitra ... Adhisatru) of each planet towards the others and the house lords.',
    parameters: obj({
      kind: { type: 'string', enum: ['evaluation', 'table'] },
      varga: vargaSchema('divisional chart for kind "table" (and the default for both evaluation vargas)'),
      aspecting_varga: vargaSchema('evaluation: varga of the aspecting planets'),
      aspected_varga: vargaSchema('evaluation: varga of the aspected bodies'),
    }, ['kind']),
    run: async (ctx, i) => {
      const varga = String(i.varga ?? 'D1');
      if (i.kind === 'table') {
        const t = await table(ctx, 'aspects.table', { varga });
        return [tableText(t), '', ...relationshipText(t)].join('\n');
      }
      const aspectingVarga = String(i.aspecting_varga ?? varga), aspectedVarga = String(i.aspected_varga ?? varga);
      return `Aspecting planets from ${aspectingVarga}, aspected bodies in ${aspectedVarga}\n${tableText(await table(ctx, 'aspects.evaluation', { aspectedVarga, aspectingVarga }))}`;
    },
  },
  {
    name: 'get_special_points',
    description: 'Other basic tables: chara karakas, nava taras and special taras (from Moon or lagna), yogi/avayogi, combustion, graha yuddha, malicious points, 36 sahamas, drekkanas, nakshatra aspects and latta, special tithis, pushkara amsa/bhaga, mrityu bhaga, deities, amsa rulers (D-60/D-150 names), declinations, Laghu Parasari functional benefics/malefics.',
    parameters: obj({ kind: { type: 'string', enum: Object.keys(SPECIAL) } }, ['kind']),
    run: async (ctx, i) => tableText(await table(ctx, SPECIAL[String(i.kind)])),
  },
  {
    name: 'get_sign_change_sensitivity',
    description: 'How much earlier or later the birth time would have to be for a body to change sign in a varga (birth-time sensitivity, for rectification).',
    parameters: obj({ body: { type: 'string', enum: BODIES }, varga: vargaSchema() }, ['body']),
    run: async (ctx, i) => tableText(await table(ctx, 'chart.signChange', { body: i.body, varga: i.varga ?? 'D1' })),
  },
  {
    name: 'get_transits',
    description: 'Transit positions on one date against the natal chart, in one of JHora\'s transit modes: standard (tara, murthi, house, vedha), houses from lagna and Moon, ashtakavarga bindus, special nakshatras, aspects, latta, anga graha. In the standard mode houses are counted from `ref` in `ref_varga` (stated in the last "Reference:" row). Default date: today.',
    parameters: obj({
      date: dateSchema('transit date, default today'),
      mode: { type: 'string', enum: TRANSIT_MODES, description: 'default the standard mode' },
      ref: { type: 'string', enum: NATAL_REFS, description: 'standard mode: natal reference the houses are counted from, default Moon' },
      ref_varga: vargaSchema('varga of the natal reference'),
      av_natal_varga: vargaSchema('ashtakavarga mode: varga of the natal ashtakavarga'),
      av_transit_varga: vargaSchema('ashtakavarga mode: varga of the transit positions'),
    }),
    examples: [{ date: { year: 2027, month: 6, day: 1 } }, { date: { year: 2027, month: 6, day: 1 }, mode: 'Ashtakavarga related' }, { ref: 'Lagna', ref_varga: 'D9' }],
    run: async (ctx, i) => {
      const mode = Math.max(0, TRANSIT_MODES.indexOf(String(i.mode ?? TRANSIT_MODES[0])));
      return tableText(await table(ctx, 'transits.basic', {
        date: transitDate(i.date as DateInput | undefined), mode, ref: i.ref ?? 'Moon', refVarga: vargaIndex(i.ref_varga),
        avNatalVarga: vargaIndex(i.av_natal_varga), avTransitVarga: vargaIndex(i.av_transit_varga),
      }));
    },
  },
  {
    name: 'get_transit_search',
    description: 'Exact moment a transiting planet reaches a point: a natal body (optionally in a varga), a natal sahama, or the start of a sign (ingress), plus `offset_degrees` ahead (+) or behind (-) it, searching after or before a date (default: after today). Returns the date and time (chart-zone clock time) and the planet\'s longitude then. Finds the first crossing only: a retrograde planet may cross again, so search again from the found date for the next one. Never estimate ingress or conjunction dates yourself.',
    parameters: obj({
      planet: { type: 'string', enum: BODIES, description: 'the transiting body' },
      target_natal_body: { type: 'string', enum: NATAL_SEARCH_BODIES, description: 'natal body to reach (one target only)' },
      target_varga: vargaSchema('varga of target_natal_body'),
      target_saham: { type: 'string', enum: SAHAMA_NAMES, description: 'natal sahama to reach (one target only)' },
      target_sign: { type: 'string', enum: SIGN_NAMES, description: 'sign whose start (0 deg) to reach: the ingress (one target only)' },
      offset_degrees: { type: 'number', description: 'degrees ahead (+) or behind (-) the target, default 0' },
      direction: { type: 'string', enum: ['after', 'before'], description: 'search forward (default) or backward from `date`' },
      date: dateSchema('date to search from, default today'),
    }, ['planet']),
    examples: [
      { planet: 'Saturn', target_sign: 'Pisces' },
      { planet: 'Jupiter', target_natal_body: 'Moon', date: { year: 2026, month: 1, day: 1 } },
      { planet: 'Saturn', target_natal_body: 'Sun', offset_degrees: 180, direction: 'after' },
    ],
    run: async (ctx, i) => {
      const targets = [i.target_natal_body, i.target_saham, i.target_sign].filter((x) => x !== undefined);
      if (targets.length !== 1) throw new Error('give exactly one of target_natal_body, target_saham, target_sign');
      const planet = String(i.planet), off = Number(i.offset_degrees ?? 0), a = Math.abs(off);
      const deg = Math.floor(a), min = Math.floor((a - deg) * 60), sec = (a - deg - min / 60) * 3600;
      const ref: SpecialSearch['ref'] = i.target_natal_body !== undefined ? { kind: 'planet', body: String(i.target_natal_body), varga: vargaIndex(i.target_varga) }
        : i.target_saham !== undefined ? { kind: 'saham', index: SAHAMA_NAMES.indexOf(String(i.target_saham)) }
          : { kind: 'sign', sign: SIGN_NAMES.indexOf(String(i.target_sign)) };
      const after = (i.direction ?? 'after') === 'after';
      const from = transitDate(i.date as DateInput | undefined);
      const search: SpecialSearch = { planet: BODIES.indexOf(planet), deg, min, sec, ahead: off >= 0, ref, after, date: from };
      const t = await table(ctx, 'transits.search', search as unknown as Json);
      const { date } = JSON.parse(t.text![0]) as { date: TransitDate };
      const target = i.target_natal_body !== undefined ? `natal ${i.target_natal_body}${i.target_varga && i.target_varga !== 'D1' ? ` in ${i.target_varga}` : ''}`
        : i.target_saham !== undefined ? `natal ${i.target_saham} sahama` : `the start of ${i.target_sign}`;
      const lons = await table(ctx, 'basics.longitudes', {}, { birth: transitBirth(ctx.spec.birth, date), ini: ctx.spec.ini });
      const row = lons.rows.find((r) => bodyKey(r[0]) === planet.toLowerCase());
      return [
        `${planet} reaches ${target}${off ? ` ${off > 0 ? '+' : '-'}${a} deg` : ''}, first time ${after ? 'after' : 'before'} ${dateText(from)}:`,
        `Date and time: ${t.rows[0]?.[1] ?? '?'}`,
        ...(row ? [`${planet} then: ${row.map((c) => c.trim()).join(' | ')}`] : []),
      ].join('\n');
    },
  },
  {
    name: 'get_transit_calendar',
    description: 'Day-by-day (or every `step_days`) transit scores of the nine planets from a start date: houses from natal Moon and lagna with vedha, tara, murthi, ashtakavarga score and kakshya lord, coded as explained in the legend under the table. Use it to scan weeks or months for good and bad stretches.',
    parameters: obj({
      start: dateSchema('first row, default today'),
      step_days: { type: 'integer', minimum: 1, maximum: 366, description: 'days between rows, default 1' },
      rows: { type: 'integer', minimum: 1, maximum: 100, description: '1-100, default 15' },
      natal_varga: vargaSchema('varga of the natal chart'),
      transit_varga: vargaSchema('varga of the transit positions'),
      items: { type: 'array', items: { type: 'string', enum: CALENDAR_ITEMS }, description: 'which scores to show, default all' },
    }),
    examples: [{ start: { year: 2027, month: 1, day: 1 }, step_days: 7, rows: 26, items: ['Houses from natal Moon and vedhas', 'Ashtakavarga scores'] }],
    run: async (ctx, i) => {
      const items = i.items as string[] | undefined;
      const t = await table(ctx, 'transits.calendar', {
        start: transitDate(i.start as DateInput | undefined), stepDays: Number(i.step_days ?? 1), rows: Number(i.rows ?? 15),
        natalVarga: vargaIndex(i.natal_varga), transitVarga: vargaIndex(i.transit_varga),
        items: CALENDAR_ITEMS.map((x) => !items?.length || items.includes(x)),
      });
      return `Columns: Su Sun, Mo Moon, Ma Mars, Me Mercury, Ju Jupiter, Ve Venus, Sa Saturn, Ra Rahu, Ke Ketu\n${tableText(t)}`;
    },
  },
  {
    name: 'get_annual_chart',
    description: 'Tajaka (varshaphala) chart of a year of life, i.e. the solar return in the given calendar year (or a monthly chart): its Key Info, longitudes and Mudda dasa ("lord | start | end"; `dasa_path` drills into it like get_dasa). `variant` "sunrise" casts it for the sunrise of the day of the return (JHora\'s Tajaka sunrise chart).',
    parameters: obj({
      year: { type: 'integer' },
      month: { type: 'integer', minimum: 1, maximum: 12, description: '1-12, for a monthly (masa) chart instead' },
      variant: { type: 'string', enum: ['exact', 'sunrise'], description: 'default exact' },
      dasa_path: pathSchema('0-based row indices into the Mudda dasa'),
    }, ['year']),
    examples: [{ year: 2027 }, { year: 2027, dasa_path: [3] }],
    run: async (ctx, i) => {
      const selection: Json = { year: Number(i.year) };
      if (i.month) selection.month = Number(i.month);
      const variant = String(i.variant ?? 'exact');
      const path = (i.dasa_path as number[] | undefined) ?? [];
      const found = await table(ctx, 'tajaka.find', { selection, variant });
      const { birth, label } = JSON.parse(found.text![0]) as { birth: ChartSpec['birth']; label: string };
      const spec = { birth, ini: ctx.spec.ini };
      const [info, lons, mudda] = await Promise.all([keyInfo(ctx, spec), table(ctx, 'basics.longitudes', {}, spec), table(ctx, 'tajaka.mudda', { selection, variant, path })]);
      return [`${label} (${variant})`, tableText(found), '', info, '', 'LONGITUDES', tableText(lons), '', 'MUDDA DASA', tableText(mudda)].join('\n');
    },
  },
  {
    name: 'get_tithi_pravesha',
    description: 'Tithi Pravesha chart: the moment the Sun-Moon angle of birth returns in a year of life (or in a lunar month of it, or a day of that month), with its Key Info, longitudes and Vimsottari compressed into the chart\'s period (`dasa_path` drills into it like get_dasa). The compressed dasa is not yet verified against JHora: weigh it lightly.',
    parameters: obj({
      year: { type: 'integer' },
      month: { type: 'integer', minimum: 1, maximum: 14, description: '1-14: the n-th lunar month of that TP year, for a monthly chart' },
      day: { type: 'integer', minimum: 1, maximum: 30, description: '1-30: the n-th tithi of that month (needs month), for a daily chart' },
      dasa_path: pathSchema('0-based row indices into the compressed Vimsottari'),
    }, ['year']),
    examples: [{ year: 2027 }, { year: 2027, month: 4 }],
    run: async (ctx, i) => {
      const selection: Json = { year: Number(i.year) };
      if (i.month) selection.month = Number(i.month);
      if (i.day) { if (!i.month) throw new Error('`day` needs `month`'); selection.day = Number(i.day); }
      const found = await table(ctx, 'tithiPravesha.find', { mode: 'year', selection });
      const { birth, label, periodDays } = JSON.parse(found.text![0]) as { birth: ChartSpec['birth']; label: string; periodDays: number };
      const spec = { birth, ini: ctx.spec.ini };
      const path = (i.dasa_path as number[] | undefined) ?? [];
      const [info, lons, dasa] = await Promise.all([keyInfo(ctx, spec), table(ctx, 'basics.longitudes', {}, spec), table(ctx, 'tithiPravesha.dasa', { birth, label, periodDays, path })]);
      return [label, tableText(found), '', info, '', 'LONGITUDES', tableText(lons), '', 'COMPRESSED VIMSOTTARI (unverified against JHora)', tableText(dasa)].join('\n');
    },
  },
  {
    name: 'get_progressed_chart',
    description: 'Progressed chart on a date (default today), as JHora\'s Progressions tab casts it: "solar" (the natal chart moved forward one sign per year of life in the chosen varga, i.e. 30/n degrees of solar arc a year), "bhrigu" (the chart of the date with Sun..Saturn progressed at their Bhrigu rates: one revolution in 19, 45, 14, 46, 83, 27 and 30 years), "sudarsana_chakra" (every body moved one sign a year, a 12-year cycle) or "nakshatra_dasa" (every body moved by the arc the seed body\'s dasa progression has covered in the chosen varga). Returns its Key Info and the longitudes of all bodies. For "sudarsana_chakra" and "nakshatra_dasa" the shift is applied in the chosen varga, so the D-1 longitudes listed are exact only when varga is "Rasi".',
    parameters: obj({
      method: { type: 'string', enum: Object.keys(PROGRESSION_METHODS) },
      date: dateSchema('the progression date, default today'),
      varga: { type: 'string', enum: PROGRESSION_VARGAS, description: 'divisional chart the progression runs in, default Rasi' },
      seed_body: { type: 'string', enum: BODIES, description: 'nakshatra_dasa: seed body of the dasa, default Moon' },
      dasa: { type: 'string', enum: PROGRESSION_DASAS, description: 'nakshatra_dasa: the dasa followed, default Vimsottari' },
    }, ['method']),
    examples: [{ method: 'solar' }, { method: 'nakshatra_dasa', date: { year: 2027, month: 1, day: 1 }, seed_body: 'Moon', dasa: 'Vimsottari' }],
    run: async (ctx, i) => {
      const d = transitDate(i.date as DateInput | undefined);
      const found = await table(ctx, 'progression.find', {
        kind: PROGRESSION_METHODS[String(i.method)], varga: Math.max(0, PROGRESSION_VARGAS.indexOf(String(i.varga ?? 'Rasi'))),
        body: BODIES.indexOf(String(i.seed_body ?? 'Moon')), dasa: Math.max(0, PROGRESSION_DASAS.indexOf(String(i.dasa ?? 'Vimsottari'))), ...d,
      });
      return derivedChartText(ctx, found);
    },
  },
  {
    name: 'get_prasna_chart',
    description: 'Prasna (horary) chart from a number the querent gives: system "108" (1-108 fixes the rasi and navamsa of the Prasna Lagna), "249" (KP, 1-249 fixes its rasi, nakshatra and sub) or "nadi" (1-1800 fixes its rasi and nadiamsa). The chart is cast for the moment and place of the open chart, so open a chart of the question\'s moment first (open_chart with birth details) rather than the native\'s birth chart. With replace_lagna the Prasna Lagna becomes the lagna; otherwise it is listed as a separate body ("Prasna Lagna", last row).',
    parameters: obj({
      system: { type: 'string', enum: Object.keys(PRASNA_LIMITS) },
      number: { type: 'integer', minimum: 1, maximum: 1800, description: 'the number given by the querent, within the system\'s range' },
      replace_lagna: { type: 'boolean', description: 'replace the lagna with the Prasna Lagna, default per the chart settings (no)' },
    }, ['system', 'number']),
    examples: [{ system: '249', number: 100 }, { system: '108', number: 37, replace_lagna: true }],
    run: async (ctx, i) => {
      const system = String(i.system), n = Number(i.number);
      if (n > PRASNA_LIMITS[system]) throw new Error(`number must be 1-${PRASNA_LIMITS[system]} for system "${system}"`);
      const found = await table(ctx, 'prasna.find', { mode: system, n, ...(i.replace_lagna === undefined ? {} : { replace: Boolean(i.replace_lagna) }) });
      return derivedChartText(ctx, found);
    },
  },
  {
    name: 'get_mundane_chart',
    description: 'Mundane (event) chart, found by JHora\'s exact search from `date` (default the chart\'s own moment) at the chart\'s place: a body entering the next sign, nakshatra or varga division (sign_or_division_change), two bodies forming an aspect (aspect), a planet turning retrograde or direct (station), an eclipse, a solar or lunar new year or month, a new lunar day (tithi), a fortnight or Ardra Pravesha (Sun entering Ardra). Returns the moment found, the period the chart rules, its Key Info and longitudes. Use it for the exact moment of an event, then read the chart for the period it rules.',
    parameters: obj({
      event: { type: 'string', enum: Object.keys(MUNDANE_EVENTS) },
      date: dateSchema('search start, default the open chart\'s moment'),
      direction: { type: 'string', enum: ['after', 'before'], description: 'search forward (default) or backward' },
      body: { type: 'string', enum: BODIES, description: 'sign_or_division_change: the moving body, default Sun; aspect: the first body' },
      division: { type: 'string', enum: MUNDANE_DIVISIONS, description: 'sign_or_division_change: what it enters, default Rasi (a sign)' },
      body2: { type: 'string', enum: BODIES, description: 'aspect: the second body' },
      aspect: { type: 'string', enum: MUNDANE_ASPECTS, description: 'aspect: the angle of the second body from the first, default conjunction' },
      planet: { type: 'string', enum: STATIONARY_PLANETS, description: 'station: the planet (Rahu/Ketu need true nodes)' },
      eclipse_type: { type: 'string', enum: ECLIPSE_TYPES, description: 'eclipse: default Lunar; "Local Solar" is for the chart\'s place' },
      eclipse_maximum: { type: 'boolean', description: 'eclipse: cast the chart for the maximum instead of the start, default false' },
    }, ['event']),
    examples: [{ event: 'eclipse', eclipse_type: 'Lunar', date: { year: 2027, month: 1, day: 1 } }, { event: 'aspect', body: 'Jupiter', body2: 'Saturn', aspect: 'Conjunction (yuti)', direction: 'before' }],
    run: async (ctx, i) => {
      const event = String(i.event), mode = MUNDANE_EVENTS[event];
      const after = (i.direction ?? 'after') === 'after';
      const params: Json = { mode, after, next: after };
      // every search starts from the chart's moment: move the chart to `date` (place and zone kept)
      const spec = i.date ? { ...ctx.spec, birth: transitBirth(ctx.spec.birth, transitDate(i.date as DateInput)) } : ctx.spec;
      if (mode === 'transit') Object.assign(params, { body: BODIES.indexOf(String(i.body ?? 'Sun')), division: Math.max(0, MUNDANE_DIVISIONS.indexOf(String(i.division ?? 'Rasi'))) });
      if (mode === 'conjunction') {
        if (!i.body || !i.body2) throw new Error('`aspect` needs `body` and `body2`');
        if (i.body === i.body2) throw new Error('`body` and `body2` must differ');
        Object.assign(params, { body1: BODIES.indexOf(String(i.body)), body2: BODIES.indexOf(String(i.body2)), aspect: Math.max(0, MUNDANE_ASPECTS.indexOf(String(i.aspect ?? MUNDANE_ASPECTS[0]))) });
      }
      if (mode === 'stationary') {
        if (!i.planet) throw new Error('`station` needs `planet`');
        params.body = STATIONARY_PLANETS.indexOf(String(i.planet));
      }
      if (mode === 'eclipse') Object.assign(params, { type: Math.max(0, ECLIPSE_TYPES.indexOf(String(i.eclipse_type ?? 'Lunar'))), maximum: Boolean(i.eclipse_maximum) });
      return derivedChartText(ctx, await table(ctx, 'mundane.find', params, spec));
    },
  },
  {
    name: 'get_angular_return',
    description: 'Angular return: the next (or previous) moment after `date` (default today) when the angle from `body` to `body2` is again what it was at birth (e.g. Sun-Moon: a tithi return), with the period until the following return, the chart\'s Key Info and longitudes.',
    parameters: obj({
      body: { type: 'string', enum: BODIES },
      body2: { type: 'string', enum: BODIES },
      date: dateSchema('search start, default today'),
      direction: { type: 'string', enum: ['after', 'before'], description: 'default after' },
    }, ['body', 'body2']),
    examples: [{ body: 'Sun', body2: 'Moon' }],
    run: async (ctx, i) => {
      if (i.body === i.body2) throw new Error('`body` and `body2` must differ');
      const found = await table(ctx, 'angularReturn.find', {
        a: BODIES.indexOf(String(i.body)), b: BODIES.indexOf(String(i.body2)), before: i.direction === 'before',
        ...transitDate(i.date as DateInput | undefined), tzHours: ctx.spec.birth.tzHours,
      });
      return derivedChartText(ctx, found);
    },
  },
  {
    name: 'get_marriage_match',
    description: 'Ashta koota (Gunanka) marriage matching of the open chart\'s Moon nakshatra and pada with another person\'s, as JHora computes it: the score out of 36 and the level of match. A coarse indicator only; also compare the two charts themselves.',
    parameters: obj({
      other_nakshatra: { type: 'string', enum: NAKSHATRA_NAMES, description: 'the other person\'s Moon nakshatra' },
      other_pada: { type: 'integer', minimum: 1, maximum: 4, description: 'its pada (quarter), 1-4' },
      other_is: { type: 'string', enum: ['bride', 'groom'], description: 'the other person\'s role, default from the chart\'s gender (the opposite of the native)' },
    }, ['other_nakshatra', 'other_pada']),
    examples: [{ other_nakshatra: 'Rohini', other_pada: 2 }],
    run: async (ctx, i) => {
      const t = await table(ctx, 'matching.result', {
        otherNak: NAKSHATRA_NAMES.indexOf(String(i.other_nakshatra)), otherPada: Number(i.other_pada) - 1,
        ...(i.other_is === undefined ? {} : { otherIsGroom: i.other_is === 'groom' }),
      });
      return [t.caption ?? '', ...(t.text ?? [])].join('\n').trim();
    },
  },
  {
    name: 'get_argala_and_rasi_drishti',
    description: 'Jaimini sign relationships in a varga. kind "rasi_drishti": for each sign its occupants, the signs it aspects and the bodies aspecting it (planets aspect what their sign aspects). kind "argala": for each house from `ref` (Lagna, Arudha Lagna, Upapada, Moon, Sun, Atmakaraka or a sign), the planets giving argala (intervention) from the 2nd, 4th, 11th and secondarily 5th, set against those obstructing it from the 12th, 10th, 3rd and 9th; reversed when Ketu is in the house. Use with the Jaimini rasi dasas (Narayana, Chara ...): a period\'s sign and its argalas show what it brings.',
    parameters: obj({
      kind: { type: 'string', enum: ['rasi_drishti', 'argala'] },
      varga: vargaSchema(),
      ref: { type: 'string', enum: [...ARGALA_REFS, ...SIGN_NAMES], description: 'argala: the house 1 the houses count from, default Lagna' },
    }, ['kind']),
    examples: [{ kind: 'argala', ref: 'AL' }, { kind: 'rasi_drishti', varga: 'D9' }],
    run: async (ctx, i) => tableText(await table(ctx, i.kind === 'argala' ? 'jaimini.argala' : 'jaimini.rasiDrishti', { varga: i.varga ?? 'D1', ref: i.ref ?? 'Lagna' })),
  },
  {
    name: 'get_chakra',
    description: 'A chakra of JHora\'s Chakras tab, with the natal bodies or, given `date`, the transit bodies of that day placed in it. "sarvatobhadra": each body\'s vedhas (nakshatras, signs, tithis, weekdays, letters it strikes) and, for the natal special nakshatras (Janma, Karma, Naidhana ...), which bodies cast vedha, graha drishti or latta on them - the classic transit check. "kota": the fort chakra from the natal Moon\'s star (Stambha, Durgantara, Praakaara, Bahya zones) with Kota Swami and Kota Pala, for health and danger. "sudarsana": houses counted from lagna, Moon and Sun together (the year-by-year chakra). "surya_kalanala", "chandra_kalanala", "shoola" (trident from the Sun\'s star) and "tripataki" (from the lagna sign): positions counted from the base star or sign, for afflicted periods.',
    parameters: obj({
      chakra: { type: 'string', enum: CHAKRAS },
      date: dateSchema('place the transit bodies of this day instead of the natal ones'),
      bodies: { type: 'string', enum: CHAKRA_BODY_SETS, description: 'bodies placed (sudarsana, kalanala, shoola, tripataki), default planets' },
      varga: vargaSchema('divisional chart of the bodies'),
    }, ['chakra']),
    examples: [{ chakra: 'sarvatobhadra', date: { year: 2027, month: 1, day: 1 } }, { chakra: 'kota' }],
    run: async (ctx, i) => {
      const date = i.date ? transitDate(i.date as DateInput) : undefined;
      return tableText(await table(ctx, 'chakras.table', { chakra: i.chakra, bodies: i.bodies ?? 'planets', varga: i.varga ?? 'D1', ...(date ? { date } : {}) }));
    },
  },
  {
    name: 'get_dasa_period_chart',
    description: 'Entry chart of a dasa period: the chart cast for the moment the period begins, read like a natal chart for what the period brings. `path` picks the period as in get_dasa ([2] = the 3rd maha dasa, [2,0] = its first antardasa). Returns the period, its start and end, the Key Info and longitudes.',
    parameters: obj({
      system: { type: 'string', enum: ALL_DASAS },
      path: { type: 'array', items: { type: 'integer', minimum: 0 }, maxItems: 5, description: '0-based row indices down to the period (at least one)' },
    }, ['system', 'path']),
    examples: [{ system: 'Vimsottari', path: [5, 2] }],
    run: async (ctx, i) => {
      const system = String(i.system);
      if (!(i.path as number[]).length) throw new Error('`path` must pick a period: at least one index');
      return derivedChartText(ctx, await table(ctx, 'dasas.entry', { table: dasaJob(system), system, path: i.path }));
    },
  },
  {
    name: 'get_dasa_transits',
    description: 'Dasa-transit correlation (JHora\'s command 33269): over a dasa period picked by `path` (as in get_dasa), when Jupiter, Saturn, Rahu and Ketu transit each house counted from the period\'s sign (for rasi dasas the dasa sign, otherwise the lord\'s sign). Rows "house | sign | planet | from | to" (dates of entering and leaving the sign, cut to the period; "None |" when the planet is not there during the period), as JHora lists them per house. Use it to time events inside a period.',
    parameters: obj({
      system: { type: 'string', enum: ALL_DASAS },
      path: { type: 'array', items: { type: 'integer', minimum: 0 }, maxItems: 5, description: '0-based row indices down to the period (at least one)' },
    }, ['system', 'path']),
    examples: [{ system: 'Narayana', path: [3] }],
    run: async (ctx, i) => {
      const system = String(i.system);
      if (!(i.path as number[]).length) throw new Error('`path` must pick a period: at least one index');
      return tableText(await table(ctx, 'dasas.transit', { table: dasaJob(system), system, path: i.path }));
    },
  },
  {
    name: 'get_transit_correlation',
    description: 'Natal points aspected in transit on a date (JHora\'s Longitude Correlation): for each transiting planet (Jupiter, Saturn, Rahu, Ketu, Mars, Sun, Venus, Mercury, Moon), the natal points it strikes - lagna, planets, arudha padas, bhava/hora/ghati lagnas - in the natal D-1, D-9, D-7, D-10, D-11, D-12, D-16, D-20, D-24, D-30 and D-60. `method`: "aspect_strength" (Parasara aspect of 80% or more, default), "named_aspects", "conjunction_and_quadrants" or "conjunction_trines_and_7th" (within 4 degrees).',
    parameters: obj({
      date: dateSchema('transit date, default today'),
      method: { type: 'string', enum: Object.keys(CORRELATION_METHODS) },
    }),
    examples: [{ date: { year: 2027, month: 3, day: 1 }, method: 'conjunction_and_quadrants' }],
    run: async (ctx, i) => tableText(await table(ctx, 'transits.correlation', {
      date: transitDate(i.date as DateInput | undefined), tz: ctx.spec.birth.tzHours, mode: CORRELATION_METHODS[String(i.method ?? 'aspect_strength')],
    })),
  },
  {
    name: 'get_month_ephemeris',
    description: 'A calendar month at the chart\'s place: "planetary_movements" (every sign and nakshatra ingress of the planets, including re-entries while retrograde, and the month\'s conjunctions, oppositions and graha aspects between planets, with day and time), "daily_ephemeris" (sunrise, sunset and every planet\'s longitude at 5:30 am clock time each day; a station shows where a longitude turns back) or "panchanga" (tithi, nakshatra, yoga, karana and sunrise for every day). Use it to time things within a month.',
    parameters: obj({
      year: { type: 'integer' },
      month: { type: 'integer', minimum: 1, maximum: 12 },
      kind: { type: 'string', enum: Object.keys(MONTH_TABLES), description: 'default planetary_movements' },
    }, ['year', 'month']),
    examples: [{ year: 2027, month: 4 }, { year: 2027, month: 4, kind: 'panchanga' }],
    run: async (ctx, i) => tableText(await table(ctx, MONTH_TABLES[String(i.kind ?? 'planetary_movements')], { year: Number(i.year), month: Number(i.month) })),
  },
  {
    name: 'get_panchanga',
    description: 'Panchanga of a day at the chart\'s place: tithi, nakshatra, yoga, karana with end times, sunrise/sunset, moonrise/moonset, rahu kaala, varjya, durmuhurta, horas and choghadiyas. Default: the chart\'s own day.',
    parameters: obj({ date: dateSchema('the day') }),
    run: async (ctx, i) => {
      const d = i.date as DateInput | undefined;
      const spec = d ? { ...ctx.spec, birth: { ...ctx.spec.birth, year: d.year, month: d.month, day: d.day, hour: d.hour ?? 12, override: undefined } } : ctx.spec;
      return tableText(await table(ctx, 'panchanga.daily', {}, spec));
    },
  },
];

// ---------------------------------------------------------------------------
// Strict schemas for the providers (the original schemas stay the client-side contract)

/** Keywords dropped for strict mode; validateInput() still enforces them on the original schema. */
const UNSTRICT = new Set(['minimum', 'maximum', 'minItems', 'maxItems', 'default']);

/** Anthropic strict tool schema: constraint keywords dropped, every object closed with a required list. */
export function anthropicStrictSchema(schema: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(schema)) {
    if (UNSTRICT.has(k)) continue;
    if (k === 'properties') out[k] = Object.fromEntries(Object.entries(v as Record<string, Json>).map(([p, x]) => [p, anthropicStrictSchema(x)]));
    else if (k === 'items') out[k] = anthropicStrictSchema(v as Json);
    else out[k] = Array.isArray(v) ? [...v] : v;
  }
  if (out.type === 'object') {
    out.additionalProperties = false;
    out.properties ??= {};
    out.required = [...((out.required as string[] | undefined) ?? [])];
  }
  return out;
}

/** OpenAI strict function schema: as above, plus every property required and the optional ones nullable. */
export function openaiStrictSchema(schema: Json): Json {
  const nullable = (p: Json): Json => {
    if (p.type === 'object') {
      const { description, ...rest } = p;
      return { ...(description ? { description } : {}), anyOf: [rest, { type: 'null' }] };
    }
    return { ...p, type: [p.type, 'null'], ...(p.enum ? { enum: [...(p.enum as unknown[]), null] } : {}) };
  };
  const walk = (s: Json): Json => {
    const out = { ...s };
    if (out.items) out.items = walk(out.items as Json);
    if (out.type === 'object') {
      const props = out.properties as Record<string, Json>;
      const required = new Set(out.required as string[]);
      out.properties = Object.fromEntries(Object.entries(props).map(([k, p]) => [k, required.has(k) ? walk(p) : nullable(walk(p))]));
      out.required = Object.keys(props);
    }
    return out;
  };
  return walk(anthropicStrictSchema(schema));
}

// ---------------------------------------------------------------------------
// Running

/** Drop null-valued keys at every depth: OpenAI strict mode sends null for an omitted optional. */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, x]) => x !== null).map(([k, x]) => [k, stripNulls(x)]));
  }
  return value;
}

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
  const args = stripNulls(input ?? {});
  const bad = validateInput(tool.parameters, args);
  if (bad) return { ok: false, text: `Invalid input: ${bad}` };
  try {
    return { ok: true, text: await tool.run(ctx, args as Json) };
  } catch (e) {
    return { ok: false, text: `Calculation failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
