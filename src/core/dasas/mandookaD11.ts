// Mandooka dasa of D-11 (Rath) (FUN_00408840), with JHora 8.0's rules - all in
// the D-11 chart (JHora varga index 10):
//  - the dasas start from the 11th house of the D-11 lagna; the direction is
//    zodiacal from an odd sign, backwards from an even one, Saturn there forces
//    zodiacal and Ketu reverses (SK flags of D-11);
//  - frog jumps: the first six dasas skip a sign each time (start, start+2d,
//    ... start+10d), then the other six (start+d, start+3d, ...);
//  - years: 7 movable, 8 fixed, 9 dual (one cycle, 96 years);
//  - antardasas: twelve signs from the D-11 sign holding the lord
//    (FUN_004ad3f0) of strong7 of the dasa sign, by that sign's parity with
//    the SK flags of strong7 of the dasa sign; each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { sequenceDirection } from './narayana';
import { buildRasiDasa, lordOfStrong7Run, mod12, rasiCtx, sthiraYears } from './rasiCommon';

export const MANDOOKA_D11_TITLE = 'Mandooka dasa of D-11 (an ayur dasa showing wars and destruction)';
const D11 = 10;

export function mandookaD11Dasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, D11);
  const start = mod12(ctx.lagna + 10);
  const d = sequenceDirection(start, ctx);
  const seq = Array.from({ length: 12 }, (_, i) => mod12(start + 2 * d * i + (i > 5 ? d : 0)));
  return buildRasiDasa(seq, seq.map(sthiraYears), (s) => lordOfStrong7Run(s, ctx), levels, false);
}
