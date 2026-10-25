// Miscellany > Laghu Parasari (CLaghuParasariView, RTTI 0x57cd08, vtable 0x54c938,
// context menu 159, message map 0x54c4e0). "By adding the longitudes of various bodies
// and lagnas, years of some important events can be obtained" (0x57cde4).
//
// Fill routines by mode DAT_0088470c (menu ids):
//   0 FUN_00459e60  33215 "Consider 1 planet (including upagrahas)"  (default)
//   1 FUN_0045a240  33230 2 planets, no upagrahas
//   2 FUN_0045a660  33216 2 planets including upagrahas
//   3 FUN_0045aa80  33231 3 planets      4 FUN_0045af00 33232 4 planets
//   5 FUN_0045b3f0  33233 5 planets (no upagrahas)
// Bodies DAT_0057cd34: JHora body indices 1..9 (Sun..Ketu) and, "including upagrahas",
// 22..32 (Dhooma, Vyatipata, Parivesha, Indra Chapa, Upaketu, Kaala, Mrityu, Artha
// Prahara, Yama Ghantaka, Maandi, Gulika); combinations i < j < ... in that order.
// Lagna added (DAT_0057cd20, default 1) = DAT_00884710 (default 0 normal lagna;
// 33219..33224/33226: hora 14, ghati 15, bhava 13, sree 18, indu 19, pranapada 17,
// vighati 16); 33217 "None" clears DAT_0057cd20.
// FUN_00459af0(body, varga): with "Count signs in divisions" (DAT_0057cd30, default 1)
// and a varga other than D-1: value = (L mod 30) * n / 30, cycle n; otherwise
// value = degrees of L inside its 30/n division scaled to 30, cycle 30
// (n = DAT_00591ed4[varga]: 1,9,2,3,4,5,6,7,8,10,11,12,16,20,24,27,30,40,45,60,81,108,144).
// The values of the combination (plus the lagna) are summed, reduced mod the cycle,
// and the columns "Date k (age)" show age = v + (k-1)*cycle for k = 1..round(120/cycle);
// each cell "%s  (%.2f)": FUN_00459bc0 = date ("%4d-%02d-%02d") of the true sidereal
// solar return after `age` years (FUN_0049dae0 mode 3), then the age.
// Row labels "%s-%s..." with the short body names at 0x8a4350 ('Asc', 'Sun', 'Merc', 'Glk'...).
// Compressed charts (DAT_008a4b68, set by the Tajaka, Tithi Pravesha, mundane, prasna and
// angular-return charts, cleared by natal and progressed ones): FUN_00459bc0 turns the age
// into period x age / (120 x 365.24219) years (2.2815911089935512e-05), with "Use only one
// cycle" (33234, DAT_00884718) into period x age / (cycle x 365.24219) and a single column;
// period = DAT_005922b0, the chart's period of effect in days. Dates count from the shown
// chart's moment, the ages printed stay unscaled.
import type { Sweph } from '../../sweph';
import type { Chart } from '../chart';
import type { Table } from '../../engine/protocol';
import { GRAHAS } from '../positions';
import { solarYearsToJd } from '../tajaka/annual';

/** Short names of JHora's body indices (0x8a4350). */
const BODY_SHORT: Record<number, string> = {
  0: 'Asc', 1: 'Sun', 2: 'Moon', 3: 'Mars', 4: 'Merc', 5: 'Jup', 6: 'Ven', 7: 'Sat', 8: 'Rah', 9: 'Ket',
  13: 'BL', 14: 'HL', 15: 'GL', 16: 'VGL', 17: 'PPL', 18: 'SL', 19: 'IL',
  22: 'Dhu', 23: 'Vya', 24: 'PaV', 25: 'ICh', 26: 'UpK', 27: 'Kal', 28: 'Mri', 29: 'APr', 30: 'YGh', 31: 'Mnd', 32: 'Glk',
};
/** Body index -> name in Chart.longitudes. */
const BODY_NAME: Record<number, string> = {
  13: 'Bhava Lagna', 14: 'Hora Lagna', 15: 'Ghati Lagna', 16: 'Vighati Lagna', 17: 'Pranapada Lagna', 18: 'Sree Lagna', 19: 'Indu Lagna',
  22: 'Dhooma', 23: 'Vyatipata', 24: 'Parivesha', 25: 'Indra Chapa', 26: 'Upaketu', 27: 'Kaala', 28: 'Mrityu', 29: 'Artha Prahara',
  30: 'Yama Ghantaka', 31: 'Maandi', 32: 'Gulika',
};
const BODIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
/** Varga choices of the "Varga to be used" dialog: label (0x8a2874 + name 0x8a4110) and divisor. */
export const LAGHU_VARGAS: [string, string, number][] = [
  ['D-1', 'Rasi', 1], ['D-9', 'Navamsa', 9], ['D-2', 'Hora', 2], ['D-3', 'Drekkana', 3], ['D-4', 'Chaturthamsa', 4],
  ['D-5', 'Panchamsa', 5], ['D-6', 'Shashthamsa', 6], ['D-7', 'Saptamsa', 7], ['D-8', 'Ashtamsa', 8], ['D-10', 'Dasamsa', 10],
  ['D-11', 'Rudramsa', 11], ['D-12', 'Dwadasamsa', 12], ['D-16', 'Shodasamsa', 16], ['D-20', 'Vimsamsa', 20],
  ['D-24', 'Siddhamsa', 24], ['D-27', 'Nakshatramsa', 27], ['D-30', 'Trimsamsa', 30], ['D-40', 'Khavedamsa', 40],
  ['D-45', 'Akshavedamsa', 45], ['D-60', 'Shashtyamsa', 60], ['D-81', 'Navanavamsa', 81], ['D-108', 'Ashtottaramsa', 108],
  ['D-144', 'Dwadasa-Dwadasamsa', 144],
];
/** "Add this lagna to planet(s)" submenu: label, body index (null = None, 33217). */
export const LAGHU_LAGNAS: [string, number | null][] = [
  ['None', null], ['Normal lagna', 0], ['Hora lagna', 14], ['Ghati lagna', 15], ['Bhava lagna', 13], ['Sree lagna', 18],
  ['Indu lagna', 19], ['Pranapada lagna', 17], ['Vighati lagna', 16],
];
export const LAGHU_MODES = [
  'Consider 1 planet (including upagrahas)', 'Consider 2 planets (no upagrahas)', 'Consider 2 planets (including upagrahas)',
  'Consider 3 planets (no upagrahas)', 'Consider 4 planets (no upagrahas)', 'Consider 5 planets (no upagrahas)',
];
export const LAGHU_EXPLANATION = 'By adding the longitudes of various bodies and lagnas, years of some important events can be obtained.\nCounting of various amsas is also possible. These methods are basically like simple progression techniques.\nThese calculations are given to facilitate research.';

export interface LaghuOptions {
  /** 0..5 as LAGHU_MODES (DAT_0088470c, default 0) */
  mode: number;
  /** body index of the added lagna or null for none (default 0 = normal lagna) */
  lagna: number | null;
  /** index into LAGHU_VARGAS (DAT_00884714, default 0 = D-1) */
  varga: number;
  /** 'count': count signs in divisions (default); 'longitude': find longitudes in divisions */
  method: 'count' | 'longitude';
  /** period of effect (days) when the shown chart is a compressed one (DAT_008a4b68 / DAT_005922b0) */
  periodDays?: number | null;
  /** "Use only one cycle" (33234, DAT_00884718): only with a compressed chart */
  oneCycle?: boolean;
}
export const LAGHU_DEFAULTS: LaghuOptions = { mode: 0, lagna: 0, varga: 0, method: 'count' };

function bodyLon(chart: Chart, idx: number): number {
  if (idx === 0) return chart.positions.ascendant;
  if (idx >= 1 && idx <= 9) return chart.positions.grahas[GRAHAS[idx - 1]].lon;
  const b = chart.longitudes.find((x) => x.name === BODY_NAME[idx]);
  if (!b) throw new Error(`Laghu Parasari: body ${idx} not available`);
  return b.lon;
}

/** FUN_00459af0: a body's value in years and the cycle length. */
export function laghuValue(lon: number, varga: number, method: LaghuOptions['method']): { value: number; cycle: number } {
  const n = LAGHU_VARGAS[varga]?.[2] ?? 1;
  const d = 30 / n;
  if (method === 'count' && varga !== 0) {
    const sign = Math.trunc(lon * (1 / 30));
    return { value: (lon - sign * 30) / d, cycle: n };
  }
  const q = Math.trunc(lon / d);
  return { value: ((lon - q * d) * 30) / d, cycle: 30 };
}

function combos(list: number[], k: number): number[][] {
  if (k === 1) return list.map((x) => [x]);
  const out: number[][] = [];
  list.forEach((x, i) => { for (const rest of combos(list.slice(i + 1), k - 1)) out.push([x, ...rest]); });
  return out;
}

export interface LaghuRow { label: string; ages: number[]; dates: string[] }

/** The rows of the Laghu Parasari list (dates need `swe`; without it the date cells are empty). */
export function laghuRows(chart: Chart, opt: Partial<LaghuOptions> = {}, swe?: Sweph): { header: string; columns: number; rows: LaghuRow[] } {
  const o = { ...LAGHU_DEFAULTS, ...opt };
  const cycle = laghuValue(0, o.varga, o.method).cycle;
  const compressed = !!o.periodDays;
  const columns = compressed && o.oneCycle ? 1 : Math.trunc(120 / cycle + 0.5);
  // FUN_00459bc0: age -> years of the solar-return search
  const years = (age: number) => !compressed ? age
    : o.oneCycle ? (o.periodDays! * age) / (cycle * 365.24219) : o.periodDays! * age * 2.2815911089935512e-05;
  const sets = o.mode === 0 ? combos(BODIES, 1)
    : o.mode === 1 ? combos(BODIES.slice(0, 9), 2)
      : o.mode === 2 ? combos(BODIES, 2)
        : combos(BODIES.slice(0, 9), o.mode);
  const val = (idx: number) => laghuValue(bodyLon(chart, idx), o.varga, o.method).value;
  const rows = sets.map((set) => {
    let v = set.reduce((a, i) => a + val(i), 0);
    const names = set.map((i) => BODY_SHORT[i]);
    if (o.lagna !== null && o.lagna !== undefined) { v += val(o.lagna); names.unshift(BODY_SHORT[o.lagna]); }
    while (v >= cycle) v -= cycle;
    while (v < 0) v += cycle;
    const ages = Array.from({ length: columns }, (_, k) => v + k * cycle);
    const dates = ages.map((a) => {
      if (!swe) return '';
      const r = swe.revjul(solarYearsToJd(swe, chart, years(a), 3) + chart.birth.tzHours / 24);
      return `${String(r.year).padStart(4)}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}`;
    });
    return { label: names.join('-'), ages, dates };
  });
  const [short, name] = LAGHU_VARGAS[o.varga] ?? LAGHU_VARGAS[0];
  return { header: `${short} (${name})`, columns, rows };
}

/** The list view as a table: cells "date  (age)" like JHora's "%s  (%.2f)". */
export function laghuParasari(chart: Chart, opt: Partial<LaghuOptions> = {}, swe?: Sweph): Table {
  const r = laghuRows(chart, opt, swe);
  return {
    caption: LAGHU_MODES[{ ...LAGHU_DEFAULTS, ...opt }.mode] ?? LAGHU_MODES[0],
    headers: [r.header, ...Array.from({ length: r.columns }, (_, k) => `Date ${k + 1} (age)`)],
    rows: r.rows.map((x) => [x.label, ...x.ages.map((a, k) => `${x.dates[k]}  (${a.toFixed(2)})`)]),
    notes: [LAGHU_EXPLANATION],
  };
}
