// JHora's "Copy to clipboard" of its list panes (FUN_004b9d30, src/core/format/listCopy.ts)
// byte for byte against the copies captured from JHora 8.0: Key Info 32975 (and the yoga
// pane's 32975), Amsa rulers 32976, Strengths 32977 / 32978, Houses 33010, KP 33013
// (golden/jhora-v3), Planetary Aspect Evaluation (golden/jhora-dasas) and Basic Transit
// Results 32979 (golden/jhora-derived, transit form at 2024-03-15 12:00).
//
// Known deviations, compared after normalising only the affected text:
// * Coordinates, Rahu row: JHora's Swiss Ephemeris returns tiny non-zero mean-node latitude
//   and distance speeds ("-0.000", "-0.000000"); ours returns exact zeros.
// * Amsa rulers (D-150), Varnada Lagna and V2..V12: JHora reads their nadiamsa from the
//   per-varga sign bytes it keeps for every body (doc + 0x17f0 + 29 * body), which for the
//   varnadas hold a sign recomputed in that varga, not a nadiamsa; we show the nadiamsa of
//   the displayed longitude (as tests/basics.test.ts already notes).
// * Planetary Aspect Evaluation: a few "Nth from" points exactly on a curve boundary print
//   " 0.00%" in JHora where we compute exactly 0 ("-"), or the other way round.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts, type GoldenText } from './golden';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { ASYNC_TABLES, runTable } from '../src/engine/jobs';
import { listCopyLines } from '../src/core/format/listCopy';
import { VIMSOPAKA_PANE_MODES } from '../src/ui/shell/tabs';

const KEY_INFO: Record<string, string> = {
  'Longitudes & Basic Info': 'basics.longitudes', Coordinates: 'basics.coordinates', 'All Divisional Longitudes': 'basics.allDivisionalLongitudes',
  'Rasis occupied in all vargas': 'basics.rasisInVargas', 'Nava Taras (from Moon)': 'basics.navaTarasMoon', 'Nava Taras (from lagna)': 'basics.navaTarasLagna',
  'Special Taras (from Moon)': 'basics.specialTarasMoon', 'Special Taras (from lagna)': 'basics.specialTarasLagna',
  'Nakshatra Aspects & Latta': 'basics.nakshatraAspects', 'Yogi, Sahayogi, Avayogi': 'basics.yogi', Pushkaramsas: 'basics.pushkara',
  'Special Tithis': 'basics.specialTithis', 'Chara Karakas': 'basics.charaKarakas', Combustion: 'basics.combustion', 'Graha Yuddha': 'basics.grahaYuddha',
  'Brahma Rudra Maheswara': 'basics.deities', 'Mrityu Bhaga': 'basics.mrityuBhaga', 'Planetary drekkanas': 'basics.drekkanas',
  '64th navamsa and 22nd drekkana': 'basics.malicious', Sahamas: 'basics.sahamas',
  'Natal Longitudes': 'basics.natalLongitudes', 'Natal Sahamas': 'basics.natalSahamas',
};
const SHADBALA: Record<string, string> = {
  'Shadbala Summary': 'strengths.shadbalaSummary', 'Shadbala Break-up': 'strengths.shadbalaBreakup', 'Sthana Bala': 'strengths.sthana',
  'Kaala Bala': 'strengths.kaala', DigBala: 'strengths.dig', 'Cheshta Bala': 'strengths.cheshta', DrigBala: 'strengths.drig',
  'Naisargika Bala': 'strengths.naisargika', 'Bhava balas': 'strengths.bhava', 'Ishta-Kashta Phala': 'strengths.ishtaKashta', Rashmis: 'strengths.rashmis',
};
const KP: Record<string, [string, Record<string, unknown>]> = {
  'Sub lords': ['basics.kp', {}], 'Planets in nakshatra': ['basics.kpOccupants', { level: 0 }], 'Planets in sub': ['basics.kpOccupants', { level: 1 }],
  'Planets in prati-sub': ['basics.kpOccupants', { level: 2 }], 'Planets in sookshma-sub': ['basics.kpOccupants', { level: 3 }],
  'Planets in praana-sub': ['basics.kpOccupants', { level: 4 }], 'Planets in deha-sub': ['basics.kpOccupants', { level: 5 }],
};

/** The job behind a captured copy (null: not a list copy of the natal chart). */
function jobOf(t: GoldenText): [string, Record<string, unknown>] | null {
  if (t.cmd === 32975 && t.name === 'yogas') return ['strengths.yogas', { mode: t.mode }];
  if (t.cmd === 32975) return KEY_INFO[t.mode!] ? [KEY_INFO[t.mode!], {}] : null;
  if (t.cmd === 32976) return ['basics.amsaRulers', {}];
  if (t.cmd === 32977) return SHADBALA[t.mode!] ? [SHADBALA[t.mode!], {}] : null;
  if (t.cmd === 32978) { const m = VIMSOPAKA_PANE_MODES.find((x) => x[0] === t.mode); return m ? [m[1], {}] : null; }
  if (t.cmd === 33010) return ['basics.houses', {}];
  if (t.cmd === 33013) return KP[t.mode!] ?? null;
  return null;
}

const VARNADA_ROW = /^(Varnada Lagna|V\d+) /;
/** The known deviations (header comment), applied to both sides. */
function normalise(table: string, lines: string[]): string[] {
  if (table === 'basics.coordinates') return lines.map((l) => (l.startsWith('Rahu ') ? l.replace(/-(0\.0+ )/g, '$1').replace(/\s+/g, ' ') : l));
  if (table === 'basics.amsaRulers') return lines.map((l) => (VARNADA_ROW.test(l) ? l.slice(0, 23) : l));
  if (table === 'aspects.evaluation') return lines.map((l) => l.replace(/ ?0\.00%|-/g, ' -').replace(/\s+/g, ' '));
  return lines;
}

describe('list copies match JHora 8.0 byte for byte', async () => {
  const swe = await nodeSweph();
  for (const c of goldenV3Charts()) {
    const texts = c.texts.filter((t) => t.lines?.length && jobOf(t));
    if (!texts.length) continue;
    describe(c.name, async () => {
      const chart = await computeChart(swe, c.birth);
      for (const t of texts) {
        const [table, params] = jobOf(t)!;
        it(`${t.cmd} ${t.mode ?? t.sub}`, () => {
          const lines = listCopyLines(runTable(chart, table, params, swe));
          expect(normalise(table, lines)).toEqual(normalise(table, t.lines));
        });
      }
    });
  }
});

interface Golden { texts: GoldenText[] }
const load = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({
  name: f.slice(0, -5), g: JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as Golden,
})) : []);

describe('Planetary Aspect Evaluation copy (32975) matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const { name, g } of load('golden/jhora-dasas')) {
    const t = g.texts.find((x) => x.cmd === 32975 && x.mode === 'Planetary Aspect Evaluation');
    if (!t?.lines?.length) continue;
    it(name, async () => {
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      const lines = listCopyLines(runTable(chart, 'aspects.evaluation', {}, swe));
      expect(lines[0]).toBe(t.lines[0]);   // header and column widths exactly
      expect(normalise('aspects.evaluation', lines)).toEqual(normalise('aspects.evaluation', t.lines));
    });
  }
});

const TRANSIT_MODES = ['Standard', 'Houses', 'AV', 'SpecialNak', 'SpecialNakAspects', 'Latta', 'SpecialNakLagna', 'SpecialNakAspectsLagna', 'AngaGraha'];
describe('Basic Transit Results copy (32979) matches JHora 8.0 byte for byte', async () => {
  const swe = await nodeSweph();
  for (const { name, g } of load('golden/jhora-derived')) {
    const texts = g.texts.filter((x) => x.cmd === 32979 && x.lines?.length);
    if (!texts.length) continue;
    describe(name, async () => {
      const natal = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      for (const t of texts) {
        it(t.mode!, async () => {
          const tab = await ASYNC_TABLES['transits.basic'](natal, { date: { year: 2024, month: 3, day: 15, hour: 12 }, mode: TRANSIT_MODES.indexOf(t.mode!) }, swe);
          expect(listCopyLines(tab)).toEqual(t.lines);
        });
      }
    });
  }
});

describe('list copy layout (FUN_004b9d30)', () => {
  it('pads all but the last column to width + 1, then a blank line and a trailing one', () => {
    expect(listCopyLines({ headers: ['A', 'Bee'], rows: [['xx', 'y'], ['z', '']] })).toEqual(['A  Bee', '', 'xx y', 'z  ', '', '']);
  });
  it('repeats the last header for declared columns that do not exist, and truncates headers to 29 characters', () => {
    expect(listCopyLines({ headers: ['Body', 'H'], rows: [['a', 'b']], copyColumns: 3 })[0]).toBe('Body H H');
    expect(listCopyLines({ headers: ['x'.repeat(40)], rows: [] })[0]).toBe('x'.repeat(29));
  });
  it('wraps a line once the widths pass 384 characters', () => {
    const w = 'w'.repeat(200);
    const lines = listCopyLines({ headers: ['a', 'b', 'c'], rows: [[w, w, 'x']] });
    // header: the sum restarts at 0 after the break; rows: at the column's width
    expect(lines).toEqual([`a${' '.repeat(200)}`, `    b${' '.repeat(200)}c`, '', `${w} `, `    ${w} x`, '', '']);
  });
});
