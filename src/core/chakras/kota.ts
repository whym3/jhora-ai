// Kota Chakra (Chakras > Kota Chakra), CKotaChakraView.
//
// jhora.exe:
// * OnDraw FUN_00457ad0: base nakshatra = byte doc+0x1757, i.e. the 28-star
//   index (chart+0x1705+b, b = 2) of the NATAL Moon (natal chart object at
//   doc+0x50); overridden by DAT_008846f4 / DAT_008846f8 ("Change the base
//   nakshatra", 33127, FUN_00458db0, dialog text "Natal Moonstar is taken as
//   the base nakshatra." / "It is placed in the northeastern corner.").
//   Bodies come from doc+0x76d00, the chart the document currently shows: the
//   natal chart unless "View transits on this date" (33020, FUN_00458c10) was
//   used - that opens the date dialog on the global transit date
//   (DAT_00896720.., initialised at startup by FUN_00407150, presumably to the
//   current time) and makes the document show that transit chart.
// * Draw FUN_00457b40: a 9x9 grid (cell = width/9) with concentric squares at
//   1..8, 2..7, 3..6: Bahya/Exterior (ring 0), Praakaara/Wall (ring 1),
//   Durgantara/Interior (ring 2), Stambha/Pillar (centre 3x3). Area labels
//   "Stambha\r\nPillar" 0x57cafc, "Durgantara\r\nInterior" 0x57cae4,
//   "Praakaara\r\nWall" 0x57cad4, "Bahya\r\nExterior" 0x57cac4 are drawn
//   centred in one-cell boxes at (col, row) = (5.0, 5.3), (5.0, 6.3),
//   (5.5, 7.3), (6.0, 8.3).
//   Star k (k = 0..27, star = (base + k) mod 28, names "Aswi".."Reva" with
//   "Abhi" from the table at 0x8a3fc8) goes to row KOTA_ROW[k], col KOTA_COL[k]
//   (stack tables local_3f4[8..35] / [36..63]), text centred at the cell top.
//   Bodies Sun..Ketu (b = 1..9, no lagna) go to the cell of their star; the
//   n-th body in a cell is offset ((2,8,2,8,2,8)[n%6], (4,4,8,8,12,12)[n%6])
//   sixteenths of a cell. Text "%s", or "(%s)" when the retro byte
//   (chart+0x108+0x30b) is set; benefic colour for b in {Mo, Me, Ju, Ve}
//   (flags 1,0,1,0,1,1,1,0,0,0 for b = 0..9), malefic colour otherwise.
// * Kota Swami = lord (table 3,6,4,2,1,4,6,3,5,7,7,5) of the Moon's rasi
//   (byte *(chart+0x25cc)+0x1811 = D-1 sign of body 2).
//   Kota Pala = KOTA_PALA[4 * star27 + pada] with star27 = *(chart+0x25cc)+0x169e
//   (27-star index of the Moon) and pada = chart+0x1770 (0..3).
//   Printed above the grid: "Kota Swami (fort lord): %s" left-aligned and
//   "Kota Pala (fort guard): %s" right-aligned, long planet names (0x8a4b54).
import { type ChakraBody, type ChakraChart, JHORA_BODIES, bodiesByIndex, NAK28, nakshatra28Of } from './common';
import { nakshatraOf, padaOf, signOf } from '../zodiac';

export type KotaZone = 'Bahya' | 'Praakaara' | 'Durgantara' | 'Stambha';
export const KOTA_ZONE_LABELS: Record<KotaZone, [string, string]> = {
  Stambha: ['Stambha', 'Pillar'], Durgantara: ['Durgantara', 'Interior'],
  Praakaara: ['Praakaara', 'Wall'], Bahya: ['Bahya', 'Exterior'],
};
/** Area label boxes (col, row) in cell units, from FUN_00457b40. */
export const KOTA_ZONE_LABEL_POS: [KotaZone, number, number][] = [
  ['Stambha', 5.0, 5.3], ['Durgantara', 5.0, 6.3], ['Praakaara', 5.5, 7.3], ['Bahya', 6.0, 8.3],
];

/** Row and column (0..8) of the k-th star from the base. */
export const KOTA_ROW = [0, 1, 2, 3, 2, 1, 0, 0, 1, 2, 4, 4, 4, 4, 8, 7, 6, 5, 6, 7, 8, 8, 7, 6, 4, 4, 4, 4];
export const KOTA_COL = [0, 1, 2, 4, 4, 4, 4, 8, 7, 6, 5, 6, 7, 8, 8, 7, 6, 4, 4, 4, 4, 0, 1, 2, 3, 2, 1, 0];

/** Body slot offsets inside a cell, in sixteenths (n-th body uses n % 6). */
export const KOTA_SLOT_X = [2, 8, 2, 8, 2, 8];
export const KOTA_SLOT_Y = [4, 4, 8, 8, 12, 12];

/** Kota Pala (body index 1..9) by 4 * (Moon's 27-star index) + pada (0..3). */
export const KOTA_PALA = [
  6, 6, 6, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 6, 3, 3, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4,
  7, 7, 7, 7, 7, 4, 4, 4, 4, 4, 7, 7, 7, 8, 4, 4, 7, 7, 2, 2, 2, 2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 2, 2, 2,
  2, 2, 7, 7, 7, 5, 7, 4, 7, 7, 6, 6, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 8, 8, 8, 8, 5, 5, 5, 5, 6, 6, 5, 5, 6, 6,
];
/** Sign lords Aries..Pisces (body indices). */
const SIGN_LORD_IDX = [3, 6, 4, 2, 1, 4, 6, 3, 5, 7, 7, 5];
/** Benefic flag per body 0..9 (colour choice). */
export const KOTA_BENEFIC = [true, false, true, false, true, true, true, false, false, false];

export function kotaZone(row: number, col: number): KotaZone {
  const ring = Math.min(row, col, 8 - row, 8 - col);
  return ring === 0 ? 'Bahya' : ring === 1 ? 'Praakaara' : ring === 2 ? 'Durgantara' : 'Stambha';
}

export interface KotaStar {
  /** position from the base star, 0..27 */
  k: number;
  /** index into NAK28 */
  star: number;
  label: string;
  row: number;
  col: number;
  zone: KotaZone;
  bodies: ChakraBody[];
}

export interface KotaChakra {
  baseStar: number;
  stars: KotaStar[];
  swami: { index: number; name: string };
  pala: { index: number; name: string };
  swamiText: string;
  palaText: string;
}

export interface KotaOptions {
  /** "Change the base nakshatra" (NAK28 index); default = natal Moon's star */
  baseStar?: number;
}

/**
 * Kota chakra of a natal chart. Bodies Su..Ke come from `transit` when given
 * (JHora after "View transits on this date"), else from the natal chart.
 */
export function kotaChakra(chart: ChakraChart, transit?: ChakraChart | null, opts: KotaOptions = {}): KotaChakra {
  const moon = chart.positions.grahas.Moon.lon;
  const baseStar = opts.baseStar ?? nakshatra28Of(moon);
  const stars: KotaStar[] = Array.from({ length: 28 }, (_, k) => {
    const star = (baseStar + k) % 28;
    return { k, star, label: NAK28[star], row: KOTA_ROW[k], col: KOTA_COL[k], zone: kotaZone(KOTA_ROW[k], KOTA_COL[k]), bodies: [] };
  });
  const src = transit ?? chart;
  for (const b of bodiesByIndex(src, [1, 2, 3, 4, 5, 6, 7, 8, 9], !!transit)) {
    stars[(nakshatra28Of(b.lon) - baseStar + 28) % 28].bodies.push(b);
  }
  const swamiIdx = SIGN_LORD_IDX[signOf(moon)];
  const palaIdx = KOTA_PALA[4 * nakshatraOf(moon) + padaOf(moon) - 1];
  const swami = { index: swamiIdx, name: JHORA_BODIES[swamiIdx][0] };
  const pala = { index: palaIdx, name: JHORA_BODIES[palaIdx][0] };
  return {
    baseStar, stars, swami, pala,
    swamiText: `Kota Swami (fort lord): ${swami.name}`,
    palaText: `Kota Pala (fort guard): ${pala.name}`,
  };
}
