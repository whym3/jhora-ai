import { describe, expect, it } from 'vitest';
import type { ChakraChart } from '../../src/core/chakras/common';
import type { Positions } from '../../src/core/positions';
import { GRAHAS } from '../../src/core/positions';
import { NAK28 } from '../../src/core/zodiac';
import {
  grahaDrishtiOn, lattasOn, sarvatobhadra, sarvatobhadraGrid, sarvatobhadraVedhasFrom, sarvatobhadraVedhasOn,
  SBC_STAR_CELLS, sbcStarAt, tithiGroupOf,
} from '../../src/core/chakras/sarvatobhadra';

/** Synthetic chart: longitudes for As, Su..Ke. */
function fixture(lons: number[], retro: Partial<Record<string, boolean>> = {}): ChakraChart {
  const body = (lon: number, r = false) => ({ lon, lat: 0, speed: r ? -1 : 1, retrograde: r });
  const grahas = Object.fromEntries(GRAHAS.map((g, i) => [g, body(lons[i + 1], retro[g] ?? (g === 'Rahu' || g === 'Ketu'))])) as Positions['grahas'];
  const positions: Positions = {
    jdUt: 2451545, jdEt: 2451545, ayanamsa: 23.85, ayanamsaMean: 23.85, ascendant: lons[0], grahas,
    outer: { Uranus: body(0), Neptune: body(0), Pluto: body(0) },
  };
  return { positions, bodies: [] };
}
// As 0, Su 15 (Bharani), Mo 100 (Pushya), Ma 200, Me 30, Ju 277 (Abhijit), Ve 45, Sa 300, Ra 120, Ke 300
const natal = fixture([0, 15, 100, 200, 30, 277, 45, 300, 120, 300], { Saturn: true });

describe('Sarvatobhadra grid', () => {
  const grid = sarvatobhadraGrid();
  it('has 81 distinct cells', () => {
    expect(grid).toHaveLength(81);
    expect(new Set(grid.map((c) => `${c.row},${c.col}`)).size).toBe(81);
  });
  it('places each of the 28 stars (incl. Abhijit) once on the outer ring', () => {
    const stars = grid.filter((c) => c.kind === 'nakshatra');
    expect(stars.map((c) => c.label).sort()).toEqual([...NAK28].sort());
    for (const c of stars) expect(c.row === 0 || c.row === 8 || c.col === 0 || c.col === 8).toBe(true);
    expect(grid.find((c) => c.label === 'Abhi')).toMatchObject({ row: 2, col: 0 });
    expect(grid.find((c) => c.label === 'Aswi')).toMatchObject({ row: 0, col: 6 });
  });
  it('has 12 rasis, 5 tithi groups, 7 weekdays, 17 vowel and 19 consonant cells', () => {
    expect(grid.filter((c) => c.kind === 'rasi').map((c) => c.sign).sort((a, b) => a! - b!)).toEqual([...Array(12).keys()]);
    const tithi = grid.filter((c) => c.kind === 'tithi');
    expect(tithi.map((c) => c.label)).toHaveLength(5);
    expect(tithi.flatMap((c) => c.weekdays!).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(grid.find((c) => c.label === 'Poorna')).toMatchObject({ row: 4, col: 4, weekdays: [6] });
    expect(grid.find((c) => c.label === 'Nanda')?.weekdays).toEqual([0, 2]);
    expect(grid.filter((c) => c.kind === 'vowel')).toHaveLength(17);
    expect(grid.filter((c) => c.kind === 'consonant')).toHaveLength(19);
    for (const [r, c] of [[0, 0], [0, 8], [8, 0], [8, 8], [1, 1], [2, 2], [3, 3]]) expect(grid[r * 9 + c].kind).toBe('vowel');
  });
  it('maps cells back to stars', () => {
    SBC_STAR_CELLS.forEach(([r, c], k) => expect(sbcStarAt(r, c)).toBe(k));
    expect(sbcStarAt(4, 4)).toBe(-1);
    expect(tithiGroupOf(0)).toBe(0);
    expect(tithiGroupOf(14)).toBe(4);
  });
});

describe('Sarvatobhadra bodies', () => {
  const sbc = sarvatobhadra(natal);
  const where = (label: string) => sbc.cells.find((c) => c.bodies.some((b) => b.label === label))!;
  it('puts the ten bodies in their 28-scheme stars', () => {
    expect(sbc.cells.reduce((n, c) => n + c.bodies.length, 0)).toBe(10);
    expect(where('As').label).toBe('Aswi');
    expect(where('Su').label).toBe('Bhar');
    expect(where('Mo').label).toBe('Push');
    expect(where('Ju').label).toBe('Abhi');
    expect(sbc.cells.find((c) => c.label === 'Dhan')!.bodies.map((b) => b.label)).toEqual(['Sa', 'Ke']);
    expect(where('Sa').bodies.find((b) => b.label === 'Sa')!.retrograde).toBe(true);
    expect(sbc.transit).toBe(false);
  });
  it('uses transit bodies when given, natal stars for the table', () => {
    const tr = fixture([10, 10, 10, 10, 10, 10, 10, 10, 10, 190]);
    const t = sarvatobhadra(natal, tr);
    expect(t.transit).toBe(true);
    expect(t.cells.find((c) => c.label === 'Aswi')!.bodies).toHaveLength(9);
    expect(t.special[0]).toEqual({ name: 'Janma', fromMoon: 'Push', fromLagna: 'Aswi' });
    // Karma = 10th from Pushya (index 7) in the 28-star list
    expect(t.special[1].fromMoon).toBe(NAK28[16]);
    expect(t.special[7]).toMatchObject({ name: 'Abhisheka', fromLagna: 'Reva' });
  });
});

describe('Sarvatobhadra vedhas', () => {
  const key = (m: { row: number; col: number }) => `${m.row},${m.col}`;
  it('FROM Aswini: its column and both diagonals', () => {
    const v = sarvatobhadraVedhasFrom(0, 6);
    expect(v.find((m) => m.state === 1)).toMatchObject({ row: 0, col: 6 });
    const to = new Set(v.filter((m) => m.state === 2).map(key));
    for (let r = 1; r < 9; r++) expect(to.has(`${r},6`)).toBe(true); // straight across to Pphal
    expect(to.has('1,7')).toBe(true); expect(to.has('2,8')).toBe(true);   // right diagonal to Rohini
    expect(to.has('6,0')).toBe(true);                                     // left diagonal to Jyeshtha
    expect(to.has('0,5')).toBe(false);                                    // no row line on the outer row
    expect(to.has('0,8')).toBe(false);
  });
  it('a corner vowel is hit by its neighbouring stars', () => {
    expect(sarvatobhadraVedhasFrom(0, 7).some((m) => m.row === 0 && m.col === 8 && m.state === 2)).toBe(true);
    expect(sarvatobhadraVedhasFrom(1, 0).some((m) => m.row === 0 && m.col === 0)).toBe(true);
  });
  it('ON a box marks only aspecting stars', () => {
    const v = sarvatobhadraVedhasOn(4, 4);
    expect(v.find((m) => m.state === 2)).toMatchObject({ row: 4, col: 4 });
    const from = v.filter((m) => m.state === 1);
    for (const m of from) expect(sbcStarAt(m.row, m.col)).toBeGreaterThanOrEqual(0);
    // centre: column (UBha/Hast) and row (Mool/Ardr); its diagonals end in corner vowels
    expect(from.map(key).sort()).toEqual(['0,4', '8,4', '4,0', '4,8'].sort());
  });
  it('graha drishti and lattas on a star', () => {
    // Mars in Visakha (200 deg, index 15): 3rd = Jyeshtha, 7th = PSha, 8th = USha, 15th = Srav (28-scheme)
    const [r, c] = SBC_STAR_CELLS[17];
    expect(grahaDrishtiOn(natal, r, c)).toContain(3);
    // Sun in Bharani (1): latta 12th forward (Bharani = 1st) = Hast (12)
    const [lr, lc] = SBC_STAR_CELLS[12];
    expect(lattasOn(natal, lr, lc)).toContain(1);
    expect(lattasOn(natal, 4, 4)).toEqual([]);
  });
});
