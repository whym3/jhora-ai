// The Chakras tab as tables, for the AI tools: what each chakra places where, from the
// builders the views draw (sarvatobhadra.ts, kota.ts, sudarsana.ts, kalanala.ts, shoola.ts,
// tripataki.ts). Registered in src/engine/jobs.ts.
//
// 'chakras.table' (natal spec) params {
//    chakra: 'sarvatobhadra' | 'kota' | 'sudarsana' | 'surya_kalanala' | 'chandra_kalanala' | 'shoola' | 'tripataki',
//    date?: TransitDate (natal-zone clock time) - place the transit bodies of that moment, as JHora does
//           after "View transits on this date" (the chakra's base stays natal),
//    bodies?: 'planets' | 'trisphuta' | 'upagrahas' | 'specialLagnas' | 'sahamas' (default planets),
//    varga?: VargaName (default D1) }
import type { Sweph } from '../../sweph';
import type { Table } from '../../engine/protocol';
import { computeChart, type Chart } from '../chart';
import { transitBirth, type TransitDate } from '../transits/common';
import { NAK28, SIGNS } from '../zodiac';
import { VARGA_INDEX } from '../vargaOptions';
import type { VargaName } from '../vargas';
import { planetBodies, vargaChart, type ChakraBody } from './common';
import { grahaDrishtiOn, lattasOn, sarvatobhadra, sarvatobhadraVedhasFrom, sarvatobhadraVedhasOn, SBC_STAR_CELLS, SBC_WEEKDAYS } from './sarvatobhadra';
import { KOTA_ZONE_LABELS, kotaChakra } from './kota';
import { sudarsanaChakra, type SudarsanaMode } from './sudarsana';
import { chandraKalanala, suryaKalanala } from './kalanala';
import { bodyText, shoolaChakra, type StarChakraMode } from './shoola';
import { tripatakiChakra, type TripatakiMode } from './tripataki';

export const CHAKRAS = ['sarvatobhadra', 'kota', 'sudarsana', 'surya_kalanala', 'chandra_kalanala', 'shoola', 'tripataki'] as const;
export const CHAKRA_BODY_SETS = ['planets', 'trisphuta', 'upagrahas', 'specialLagnas', 'sahamas'] as const;
type BodySet = (typeof CHAKRA_BODY_SETS)[number];
const SUDARSANA_MODE: Record<BodySet, SudarsanaMode> = { planets: 0, trisphuta: 1, upagrahas: 2, specialLagnas: 3, sahamas: 4 };
const KALANALA_MODE: Record<BodySet, number> = { planets: 0, trisphuta: 2, upagrahas: 3, specialLagnas: 4, sahamas: 5 };

const names = (bs: ChakraBody[]) => (bs.length ? bs.map(bodyText).join(' ') : '-');

/** Sarvatobhadra: each body's vedhas, then the natal special nakshatras with what hits them. */
function sbcTable(natal: Chart, transit: Chart | null, vargaIndex: number): Table {
  const s = sarvatobhadra(natal, transit, vargaIndex);
  const cellOf = (r: number, c: number) => s.cells[r * 9 + c];
  const special = new Map<string, string[]>();
  for (const row of s.special) {
    special.set(row.fromMoon, [...(special.get(row.fromMoon) ?? []), `${row.name} from Moon`]);
    special.set(row.fromLagna, [...(special.get(row.fromLagna) ?? []), `${row.name} from lagna`]);
  }
  const starText = (label: string) => (special.has(label) ? `${label} (${special.get(label)!.join(', ')})` : label);
  const rows: string[][] = [];
  for (const cell of s.cells) {
    for (const b of cell.bodies) {
      const hit = sarvatobhadraVedhasFrom(cell.row, cell.col).filter((m) => m.state === 2).map((m) => cellOf(m.row, m.col));
      const of = (kind: string) => hit.filter((h) => h.kind === kind);
      rows.push([
        bodyText(b), cell.label,
        of('nakshatra').map((h) => starText(h.label)).join(', ') || '-',
        of('rasi').map((h) => h.label).join(' ') || '-',
        of('tithi').map((h) => `${h.label}${h.weekdays?.length ? ` (${h.weekdays.map((w) => SBC_WEEKDAYS[w]).join('/')})` : ''}`).join(', ') || '-',
        [...of('vowel'), ...of('consonant')].map((h) => h.label).join(' ') || '-',
      ]);
    }
  }
  // what falls on each natal special nakshatra (from the Moon): vedhas, graha drishti, lattas
  const cur = vargaChart(transit ?? natal, vargaIndex);
  const label = (i: number) => planetBodies(cur)[i].label;
  const notes = ['Special nakshatras of the natal chart (from Moon / from lagna) and what falls on the one from the Moon:'];
  for (const row of s.special) {
    const star = NAK28.indexOf(row.fromMoon);
    const [r, c] = SBC_STAR_CELLS[star];
    const vedha = sarvatobhadraVedhasOn(r, c).filter((m) => m.state === 1).flatMap((m) => cellOf(m.row, m.col).bodies);
    notes.push(`  ${row.name}: ${row.fromMoon} / ${row.fromLagna}; vedha from ${names(vedha)}; graha drishti from ${grahaDrishtiOn(cur, r, c).map(label).join(' ') || '-'}; latta from ${lattasOn(cur, r, c).map(label).join(' ') || '-'}`);
  }
  return {
    caption: `Sarvatobhadra chakra: ${transit ? 'transit' : 'natal'} bodies in ${VARGA_INDEX[vargaIndex]}`,
    headers: ['Body', 'In', 'Vedha on nakshatras', 'Vedha on signs', 'Vedha on tithis (weekdays)', 'Vedha on letters'],
    rows, notes,
  };
}

/** Builds the table of one chakra. */
export function chakraTable(natal: Chart, transit: Chart | null, chakra: string, bodies: BodySet, varga: VargaName): Table {
  const vargaIndex = Math.max(0, VARGA_INDEX.indexOf(varga));
  const by = <T extends { pos: number }>(items: T[], n: number) => Array.from({ length: n }, (_, p) => items.filter((x) => x.pos === p));
  switch (chakra) {
    case 'sarvatobhadra': return sbcTable(natal, transit, vargaIndex);
    case 'kota': {
      const k = kotaChakra(natal, transit);
      return {
        caption: `Kota chakra from ${NAK28[k.baseStar]} (natal Moon's star); ${transit ? 'transit' : 'natal'} planets`,
        headers: ['From base', 'Nakshatra', 'Zone', 'Bodies'],
        rows: k.stars.map((s) => [String(s.k + 1), s.label, KOTA_ZONE_LABELS[s.zone].join(' / '), names(s.bodies)]),
        notes: [k.swamiText, k.palaText],
      };
    }
    case 'sudarsana': {
      const d = sudarsanaChakra(natal, { mode: SUDARSANA_MODE[bodies], vargaIndex, transit });
      return {
        caption: `Sudarsana chakra: ${d.title}`,
        headers: ['House', ...d.rings.map((r) => `From ${r.ref} (${SIGNS[r.startSign]})`)],
        rows: Array.from({ length: 12 }, (_, h) => [String(h + 1), ...d.rings.map((r) => `${SIGNS[r.houses[h].sign]}: ${names(r.houses[h].bodies)}`)]),
        notes: ['Inner ring: houses from the lagna; middle: from the Moon; outer: from the Sun. The n-th year of life is read from the n-th house of all three (mod 12).'],
      };
    }
    case 'surya_kalanala': case 'chandra_kalanala': {
      const k = (chakra === 'surya_kalanala' ? suryaKalanala : chandraKalanala)(natal, { mode: KALANALA_MODE[bodies], vargaIndex, transit });
      return {
        caption: `${chakra === 'surya_kalanala' ? 'Surya' : 'Chandra'} Kalanala chakra: ${k.title} (base ${NAK28[k.baseStar]})`,
        headers: ['From base', 'Nakshatra', 'Bodies'],
        rows: k.slots.map((s) => [String(s.pos + 1), NAK28[s.star], s.labels.map((l) => l.text).join(' ') || '-']),
      };
    }
    case 'shoola': {
      const sh = shoolaChakra(natal, { mode: bodies as StarChakraMode, vargaIndex, current: transit });
      const placed = by(sh.bodies, sh.slots.length);
      return {
        caption: `Shoola chakra: ${sh.title} (base ${NAK28[sh.baseStar]})`,
        headers: ['From base', 'Nakshatra', 'Bodies'],
        rows: sh.slots.map((s) => [String(s.pos + 1), s.label, placed[s.pos].map((p) => p.text).join(' ') || '-']),
      };
    }
    case 'tripataki': {
      const t = tripatakiChakra(natal, { mode: bodies as TripatakiMode, vargaIndex, current: transit });
      const placed = by(t.bodies, 12);
      return {
        caption: `Tripataki chakra: ${t.title}`,
        headers: ['From base', 'Sign', 'Bodies'],
        rows: t.slots.map((s) => [String(s.pos + 1), s.label, placed[s.pos].map((p) => p.text).join(' ') || '-']),
      };
    }
    default: throw new Error(`unknown chakra ${chakra}`);
  }
}

export const CHAKRA_JOBS: Record<string, (chart: Chart, params: Record<string, unknown>, swe: Sweph) => Promise<Table>> = {
  'chakras.table': async (natal, params, swe) => {
    const d = params.date as TransitDate | undefined;
    const transit = d ? await computeChart(swe, transitBirth(natal.birth, d), natal.ini) : null;
    return chakraTable(natal, transit, String(params.chakra), (params.bodies ?? 'planets') as BodySet, (params.varga ?? 'D1') as VargaName);
  },
};
