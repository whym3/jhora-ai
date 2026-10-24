// Basic Transit Results: CTransitView (RTC 0x550328, vtbl 0x550528), the list
// view right of the transit form. Context menu 143 (0x490150) picks the mode
// stored at view+0x50; each mode refills the list (handlers 0x4902f0..0x4909a0):
//
//   0 Standard (tara, murthi, vedha)          32948  FUN_0048bbb0
//   1 Houses from lagna & Moon                32949  FUN_0048c0e0
//   2 Ashtakavarga related                    32950  FUN_0048c3a0
//   3 Transits in special nakshatras          32951  FUN_0048c8c0
//   4 Aspects on special nakshatras           32953  FUN_0048caa0
//   5 Latta (planetary kick)                  32952  FUN_0048d620
//   6 Transits in special nakshatras (lagna)  33212  FUN_0048cf70
//   7 Aspects on special nakshatras (lagna)   33213  FUN_0048d150
//   8 Anga graha transits                     33214  FUN_0048d970
//
// Other commands: 33111 natal reference (0x490390: a varga dialog -> DAT_008a4b84,
// then dialog 2035 Moon/Lagna/Arudha lagna -> DAT_005922d4 = 2/0/59), 32954 /
// 32955 natal / transit varga for the AV mode (view+0x54 / +0x58, default D-1),
// 32956 change the transit date (date dialog -> FUN_0041d660), 32979 copy
// (0x490df0: FUN_004ba0a0 text to the clipboard).
//
// "Transit" bodies are those of the current chart (doc+0x76d00): the transit
// chart once "Show Transit Calculations" (dialog 2013 button 1001, 0x48b660) ran,
// otherwise the natal chart itself. "Natal" is always doc+0x50.
import type { Chart } from '../chart';
import type { Table } from '../../engine/protocol';
import { ashtakavarga, prastara, type AvBody, AV_BODIES } from '../ashtakavarga';
import { SBC_GRAHA_DRISHTI } from '../chakras/sarvatobhadra';
import {
  BODY_ABBR, BODY_NAMES, bodyLon, bodySign, GOOD_HOUSE, KAKSHYA_LORD, kakshyaOf, MURTHI_NAMES, NAK28, nak27, nak28, ORDINALS,
  refSign, SPECIAL_NAKS, TARA_MEANINGS, TARA_NAMES, VARGA_LABEL, VEDHA_HOUSE, type NatalRef,
} from './common';

export const BASIC_MODES: [label: string, cmd: number][] = [
  ['Standard (tara, murthi, vedha)', 32948],
  ['Houses from lagna & Moon', 32949],
  ['Ashtakavarga related', 32950],
  ['Transits in special nakshatras', 32951],
  ['Aspects on special nakshatras', 32953],
  ['Latta (planetary kick)', 32952],
  ['Transits in special nakshatras (lagna)', 33212],
  ['Aspects on special nakshatras (lagna)', 33213],
  ['Anga graha transits', 33214],
];

export interface BasicOptions {
  /** natal reference body (DAT_005922d4, default Moon) and its varga index (DAT_008a4b84, default 0) */
  ref?: NatalRef;
  refVarga?: number;
  /** AV mode vargas (view+0x54 natal, view+0x58 transit; default 0 = D-1) */
  avNatalVarga?: number;
  avTransitVarga?: number;
  /** murthi index per body 1..9 of the transit chart (chart+0x21b8c), see murthi.ts */
  murthis?: number[];
  /** DAT_0059234b: 28-star scheme (default) or 27 */
  stars28?: boolean;
}

const NAMES = BODY_NAMES as readonly string[];

/**
 * FUN_0048baf0: vedha matrix of the transit Sun..Saturn. For planet i in house h
 * from the reference sign, every body j (Sun..Ketu) in house VEDHA_HOUSE[i][h]
 * obstructs it; Sun-Saturn and Moon-Mercury never obstruct each other.
 * out[i][j] (i, j = body index - 1).
 */
export function vedhaMatrix(transit: Chart, ref: number): boolean[][] {
  const p = transit.positions;
  const house = (b: number) => (bodySign(p, b, 0) - ref + 12) % 12;
  const out = Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));
  for (let i = 0; i < 7; i++) {
    const v = VEDHA_HOUSE[i + 1][house(i + 1)];
    for (let j = 0; j < 9; j++) if (house(j + 1) === v - 1) out[i][j] = true;
  }
  out[0][6] = out[6][0] = out[1][3] = out[3][1] = false;
  return out;
}

const list = (names: string[]) => (names.length ? names.join(', ') : '-');

function standard(natal: Chart, transit: Chart, o: Required<Omit<BasicOptions, 'murthis'>> & { murthis?: number[] }): Table {
  const p = transit.positions, np = natal.positions;
  const ref = refSign(natal, o.ref, o.refVarga);
  const vedha = vedhaMatrix(transit, ref);
  const moon27 = nak27(np, 2);
  const rows: string[][] = [];
  for (let i = 1; i <= 9; i++) {
    const t = (nak27(p, i) - moon27 + 27) % 9;
    const m = i === 2 ? '-' : o.murthis ? MURTHI_NAMES[o.murthis[i]] : '';
    const h = (bodySign(p, i, 0) - ref + 12) % 12;
    const under = i < 8 ? NAMES.slice(1).filter((_, j) => vedha[i - 1][j]) : [];
    const causing = NAMES.slice(1, 8).filter((_, j) => vedha[j][i - 1]);
    rows.push([NAMES[i], `${TARA_NAMES[t]} (${TARA_MEANINGS[t]})`, m, `${ORDINALS[h]}${GOOD_HOUSE[i][h] >= 1 ? ' (Good)' : ''}`, list(under), list(causing)]);
  }
  rows.push(['  ', '', '', '', '', '']);
  rows.push(['Reference:', `${o.ref} of natal ${VARGA_LABEL[o.refVarga]}`, '', '', '', '']);
  return { headers: ['Planet', 'Tara', 'Murthi', 'House', 'Under vedha from', 'Causing vedha to'], rows };
}

function houses(natal: Chart, transit: Chart): Table {
  const p = transit.positions, np = natal.positions;
  const refs = [bodySign(np, 2, 0), bodySign(np, 0, 0), bodySign(np, 2, 1), bodySign(np, 0, 1)];
  const rows: string[][] = [];
  for (let i = 1; i <= 9; i++) {
    const s = bodySign(p, i, 0);
    rows.push([NAMES[i], ...refs.map((r) => ORDINALS[(s - r + 12) % 12])]);
  }
  return { headers: ['Planet', 'From Moon', 'From Lagna', 'From Navamsa Moon', 'From Navamsa Lagna'], rows };
}

/** Natal BAV / SAV / prastara in varga index v (natal chart+0x1800c, +0x195cc, +0x19884). */
export function natalAv(natal: Chart, v: number) {
  const sign = (b: AvBody) => bodySign(natal.positions, AV_BODIES.indexOf(b), v);
  const av = ashtakavarga(sign);
  const pav = AV_BODIES.map((b) => prastara(b, sign));
  return {
    bav: (b: number, s: number) => av.bav[AV_BODIES[b]][s],
    sav: (s: number) => av.sav[s],
    /** does contributor c (0 Lagna .. 7 Saturn) give body b a bindu in sign s? */
    bindu: (b: number, s: number, c: number) => pav[b][AV_BODIES[c]][s] !== 0,
  };
}

function avMode(natal: Chart, transit: Chart, nv: number, tv: number): Table {
  const p = transit.positions;
  const av = natalAv(natal, nv);
  const rows: string[][] = [];
  for (let b = 0; b < 8; b++) {
    const s = bodySign(p, b, tv);
    const lord = KAKSHYA_LORD[kakshyaOf(bodyLon(p, b))];
    const refs = AV_BODIES.map((_, c) => c).filter((c) => av.bindu(b, s, c)).map((c) => BODY_ABBR[c]);
    rows.push([NAMES[b], String(av.bav(b, s)), String(av.sav(s)), NAMES[lord], av.bindu(b, s, lord) ? '1' : '0', refs.join(', ')]);
  }
  rows.push(['  ', '', '', '', '', '']);
  rows.push(['Natal varga:', VARGA_LABEL[nv], '', '', '', '']);
  rows.push(['Transit varga:', VARGA_LABEL[tv], '', '', '', '']);
  return { headers: ['Planet', 'AV Score', 'SAV Score', 'Kakshya', 'Good?', 'Good house from references'], rows };
}

/** Index (0..10) of the special nakshatra that star `n` is, counted from natal star `from`, or -1. */
function specialIndex(n: number, from: number, stars28: boolean): number {
  const m = stars28 ? 28 : 27;
  let hit = -1;
  SPECIAL_NAKS.forEach(([, , off], k) => { if (n === (off - 1 + from) % m) hit = k; });
  return hit;
}
const specialText = (k: number) => (k < 0 ? '-' : `${SPECIAL_NAKS[k][0]} (${SPECIAL_NAKS[k][1]})`);

function specialOccupied(natal: Chart, transit: Chart, fromLagna: boolean, stars28: boolean): Table {
  const star = (c: Chart, b: number) => (stars28 ? nak28(c.positions, b) : nak27(c.positions, b));
  const from = star(natal, fromLagna ? 0 : 2);
  const rows = Array.from({ length: 9 }, (_, k) => [NAMES[k + 1], specialText(specialIndex(star(transit, k + 1), from, stars28))]);
  return { headers: ['Planet', `Special nakshatra occupied in transit (${fromLagna ? 'Lagna' : 'Moon'})`], rows };
}

function specialAspects(natal: Chart, transit: Chart, fromLagna: boolean, stars28: boolean): Table {
  const m = stars28 ? 28 : 27;
  const star = (c: Chart, b: number) => (stars28 ? nak28(c.positions, b) : nak27(c.positions, b));
  const from = star(natal, fromLagna ? 0 : 2);
  const rows: string[][] = [];
  for (let i = 1; i <= 9; i++) {
    const own = star(transit, i);
    const parts: string[] = [];
    if (i < 8) {
      for (const n of SBC_GRAHA_DRISHTI[i - 1]) {
        const aspected = (n - 1 + own) % m;
        SPECIAL_NAKS.forEach(([name, meaning, off]) => { if (aspected === (off - 1 + from) % m) parts.push(`${name} (${meaning})`); });
      }
    }
    rows.push([NAMES[i], specialText(specialIndex(own, from, stars28)), parts.join(', ')]);
  }
  return { headers: ['Planet', 'Occupied special nakshatra', `Special nakshatras aspected in transit (${fromLagna ? 'Lagna' : 'Moon'})`], rows };
}

/** Latta counts and directions of Sun..Ketu (FUN_0048d620 local_10c); Ketu's direction is 0, so its latta is its own star. */
const LATTA: [number, number][] = [[12, 1], [22, -1], [3, 1], [7, -1], [6, 1], [5, -1], [8, 1], [9, -1], [0, 0]];

function latta(natal: Chart, transit: Chart, stars28: boolean): Table {
  const m = stars28 ? 28 : 27;
  const names = stars28 ? NAK28 : NAK28.filter((_, i) => i !== 21);
  const star = (c: Chart, b: number) => (stars28 ? nak28(c.positions, b) : nak27(c.positions, b));
  const moon = star(natal, 2), lagna = star(natal, 0);
  const rows = LATTA.map(([n, d], k) => {
    const l = ((n - 1) * d + 2 * m + star(transit, k + 1)) % m;
    let special = '-';
    if (l === moon) special = 'Janma nakshatra (nakshatra of natal Moon)';
    else if (l === lagna) special = 'Lagna nakshatra (nakshatra of natal lagna)';
    else {
      const s = specialIndex(l, moon, stars28);
      if (s >= 0) special = `${SPECIAL_NAKS[s][0]} nakshatra (${SPECIAL_NAKS[s][1]})`;
    }
    return [NAMES[k + 1], names[l], special];
  });
  return { headers: ['Planet', 'Latta on', 'Anything special about it'], rows };
}

/** Anga graha limbs and results per planet (CString tables of FUN_0048d970). */
const SB = ['Face', 'Head', 'Chest', 'Right hand', 'Two feet', 'Left hand', 'Two eyes', 'Privities', '-'];
const MO = ['Face', 'Head', 'Back', 'Tow eyes', 'Chest', 'Left hand', 'Two feet', 'Right hand', '-'];
const MA = ['Face', 'Two feet', 'Chest', 'Left hand', 'Head', 'Face', 'Right hand', 'Two eyes', '-'];
const MJV = ['Head', 'Face', 'Two hands', 'Stomach', 'Privities', 'Two feet', '-', '-', '-'];
const SRK = ['Face', 'Right hand', 'Right leg', 'Left leg', 'Left hand', 'Stomach', 'Head', 'Eyes', 'Back'];
export const ANGA_LIMBS = [SB, MO, MA, MJV, MJV, MJV, SRK, SRK, SRK];
const R_SU = ['Destruction', 'Influx of wealth', 'Success', 'Monetary benefits', 'Loss of wealth', 'Physical ailments', 'Gain', 'Danger to life', '-'];
const R_MO = ['Great fear', 'Safety', 'Defeat of enemies', 'Monetary gains', 'Calm of mind', 'Quarrel', 'Going abroad', 'Financial gain', '-'];
const R_MA = ['Death', 'Quarrel', 'Success', 'Poverty', 'Gain', 'Great fear', 'Happiness', 'Going abroad', '-'];
const R_MJV = ['Grief', 'Gains', 'Untoward events', 'Influx of wealth', 'Loss', 'Honor and fame', '-', '-', '-'];
const R_SRK = ['Sorrow', 'Happiness', 'Travel', 'Loss', 'Profit', 'Sexual union', 'Joy', 'Comforts', 'Danger to life'];
export const ANGA_RESULTS = [R_SU, R_MO, R_MA, R_MJV, R_MJV, R_MJV, R_SRK, R_SRK, R_SRK];
/** Limb index per star counted (0..26) from the natal star, per planet Sun..Ketu (local table at local_4a0). */
const runs = (counts: number[]) => counts.flatMap((n, i) => Array<number>(n).fill(i));
const T_SU = runs([1, 4, 4, 4, 6, 4, 2, 2]);
const T_MO = runs([2, 4, 2, 2, 5, 3, 6, 3]);
const T_MA = runs([2, 6, 3, 4, 2, 4, 4, 2]);
const T_MJV = runs([3, 3, 6, 5, 2, 8]);
const T_SRK = runs([1, 4, 3, 3, 4, 5, 3, 2, 2]);
export const ANGA_PARTS = [T_SU, T_MO, T_MA, T_MJV, T_MJV, T_MJV, T_SRK, T_SRK, T_SRK];

function angaGraha(natal: Chart, transit: Chart): Table {
  const np = natal.positions;
  const refs = [nak27(np, 2), nak27(np, 0), nak27(np, 1)];   // natal Moon, lagna, Sun (27 stars)
  const rows = Array.from({ length: 9 }, (_, k) => {
    const n = nak27(transit.positions, k + 1);
    const cells = refs.flatMap((r) => {
      const part = ANGA_PARTS[k][(n - r + 27) % 27];
      return [ANGA_LIMBS[k][part], ANGA_RESULTS[k][part]];
    });
    return [NAMES[k + 1], ...cells];
  });
  return { headers: ['Planet', 'Limb (Moon)', 'Result (from Moon)', 'Limb (lagna)', 'Result (from lagna)', 'Limb (Sun)', 'Result (from Sun)'], rows };
}

/** One mode of the Basic Transit Results list. */
export function basicTransitTable(natal: Chart, transit: Chart, mode: number, opts: BasicOptions = {}): Table {
  const o = { ref: opts.ref ?? 'Moon', refVarga: opts.refVarga ?? 0, avNatalVarga: opts.avNatalVarga ?? 0, avTransitVarga: opts.avTransitVarga ?? 0, stars28: opts.stars28 ?? true, murthis: opts.murthis };
  switch (mode) {
    case 1: return houses(natal, transit);
    case 2: return avMode(natal, transit, o.avNatalVarga, o.avTransitVarga);
    case 3: return specialOccupied(natal, transit, false, o.stars28);
    case 4: return specialAspects(natal, transit, false, o.stars28);
    case 5: return latta(natal, transit, o.stars28);
    case 6: return specialOccupied(natal, transit, true, o.stars28);
    case 7: return specialAspects(natal, transit, true, o.stars28);
    case 8: return angaGraha(natal, transit);
    default: return standard(natal, transit, o);
  }
}
