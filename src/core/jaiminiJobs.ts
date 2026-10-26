// Jaimini relationships of signs as tables, for the AI tools: rasi drishti and argala /
// virodhargala in any varga. The rules are those of the chart menu's "Highlight rasi(s)"
// commands (chartMenu.ts highlightSigns, handlers 0x440690..0x440e80), which JHora draws
// but does not list. Registered in src/engine/jobs.ts.
//
//  'jaimini.rasiDrishti'  params { varga? }: for each sign, its occupants, the signs it aspects
//                         and the bodies aspecting it by rasi drishti
//  'jaimini.argala'       params { varga?, ref? ('Lagna' | 'AL' | 'UL' | 'Moon' | 'Sun' | 'AK' | a sign
//                         name) }: for each house from the reference, the planets in its argala
//                         houses (2nd, 4th, 11th; 5th secondary) against those in the obstructing
//                         ones (12th, 10th, 3rd; 9th), reversed when Ketu occupies the house
import type { Chart } from './chart';
import type { Table } from '../engine/protocol';
import { GRAHAS, type Graha } from './positions';
import { highlightSigns } from './chartMenu';
import { bhavaArudhaSigns } from './arudhaPadas';
import { charaKarakas } from './basics';
import { vargaLongitude, type VargaName } from './vargas';
import { vargaSpec } from './vargaOptions';
import { SIGN_NAMES, SIGNS } from './zodiac';

type TableFn = (chart: Chart, params: Record<string, unknown>) => Table;

const SHORT: Record<Graha | 'Lagna', string> = {
  Lagna: 'As', Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke',
};
const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
export const ARGALA_REFS = ['Lagna', 'AL', 'UL', 'Moon', 'Sun', 'AK'];

/** Signs of the lagna and Sun..Ketu in a varga. */
function vargaSigns(chart: Chart, varga: VargaName): { signOf: (g: Graha) => number; lagna: number } {
  const spec = vargaSpec(varga, chart.ini);
  const sign = (lon: number) => Math.floor(vargaLongitude(lon, spec) / 30) % 12;
  const signs = Object.fromEntries(GRAHAS.map((g) => [g, sign(chart.positions.grahas[g].lon)])) as Record<Graha, number>;
  return { signOf: (g) => signs[g], lagna: sign(chart.positions.ascendant) };
}

/** Occupants of every sign ("As" for the lagna, "(Sa)" never: rasi drishti ignores retrogression). */
function occupants(chart: Chart, varga: VargaName): string[][] {
  const { signOf, lagna } = vargaSigns(chart, varga);
  const out: string[][] = Array.from({ length: 12 }, () => []);
  out[lagna].push(SHORT.Lagna);
  for (const g of GRAHAS) out[signOf(g)].push(SHORT[g]);
  return out;
}
const list = (xs: string[]) => (xs.length ? xs.join(' ') : '-');

/** The sign a reference names, in the varga. */
function refSign(chart: Chart, varga: VargaName, ref: string): number {
  const { signOf, lagna } = vargaSigns(chart, varga);
  const named = SIGN_NAMES.indexOf(ref as (typeof SIGN_NAMES)[number]);
  if (named >= 0) return named;
  switch (ref) {
    case 'Lagna': return lagna;
    case 'AL': return bhavaArudhaSigns(chart, varga)[0];
    case 'UL': return bhavaArudhaSigns(chart, varga)[11];
    case 'Moon': case 'Sun': return signOf(ref);
    case 'AK': return signOf(charaKarakas(chart.positions)[0].planet as Graha);
    default: throw new Error(`unknown argala reference ${ref}`);
  }
}

export const JAIMINI_JOBS: Record<string, TableFn> = {
  'jaimini.rasiDrishti': (chart, params) => {
    const varga = String(params.varga ?? 'D1') as VargaName;
    const { signOf } = vargaSigns(chart, varga);
    const occ = occupants(chart, varga);
    const aspects = (s: number) => highlightSigns('rasiDrishtiRasi', signOf, null, s);
    return {
      caption: `Rasi drishti (Jaimini sign aspects) in ${varga}`,
      headers: ['Sign', 'Occupants', 'Aspects signs', 'Aspected by'],
      rows: SIGNS.map((name, s) => {
        const by = SIGNS.flatMap((_, t) => (t !== s && aspects(t).includes(s) ? occ[t] : []));
        return [name, list(occ[s]), aspects(s).map((t) => SIGNS[t]).join(' '), list(by)];
      }),
      notes: ['Movable signs aspect the fixed signs except the one next to them, fixed signs the movable ones except the one next to them, dual signs each other. A planet aspects what its sign aspects.'],
    };
  },
  'jaimini.argala': (chart, params) => {
    const varga = String(params.varga ?? 'D1') as VargaName;
    const ref = String(params.ref ?? 'Lagna');
    const base = refSign(chart, varga, ref);
    const { signOf } = vargaSigns(chart, varga);
    const occ = occupants(chart, varga).map((o) => o.filter((x) => x !== SHORT.Lagna));
    // pairs of [argala, virodhargala] houses: 2nd/12th, 4th/10th, 11th/3rd, 5th/9th
    const cell = (s: number, k: number) => `${SIGNS[s]} ${ORD[(s - k + 12) % 12]}: ${list(occ[s])}`;
    return {
      caption: `Argala on the houses from ${ref} (${SIGNS[base]}) in ${varga}`,
      headers: ['House', 'Sign', 'Occupants', '2nd vs 12th', '4th vs 10th', '11th vs 3rd', '5th vs 9th (secondary)'],
      rows: ORD.map((h, i) => {
        const s = (base + i) % 12;
        const arg = highlightSigns('argala', signOf, null, s), vir = highlightSigns('virodhargala', signOf, null, s);
        const reversed = signOf('Ketu') === s;
        return [h, SIGNS[s] + (reversed ? ' (Ketu: reversed)' : ''), list(occ[s]),
          ...arg.map((a, k) => `${cell(a, s)} | vs ${cell(vir[k], s)}`)];
      }),
      notes: [
        'Each cell: the argala house (sign, house from this one: planets) | vs the house obstructing it. Argala holds when the obstruction has fewer planets (or weaker ones).',
        'With Ketu in the house the counting is reversed (12th, 10th, 3rd and 9th give argala). Malefics in the 3rd also give argala (Jaimini).',
      ],
    };
  },
};
