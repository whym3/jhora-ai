// Sthira dasa (FUN_00408580), with JHora 8.0's default rules (D-1):
//  - the dasas start from the sign of Brahma (chart+0x27520, see brahma.ts;
//    no 7th-house shift here) and run sign by sign, zodiacally from an odd
//    sign and backwards from an even one; Saturn there forces zodiacal, Ketu
//    reverses (SK flags);
//  - years: 7 movable, 8 fixed, 9 dual (one cycle, 96 years);
//  - antardasas: twelve signs from the sign holding the lord (FUN_004ad3f0) of
//    strong7 of the dasa sign, by that sign's parity with the SK flags of
//    strong7 of the dasa sign; each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { sequenceDirection } from './narayana';
import { brahmaSign } from './brahma';
import { buildRasiDasa, lordOfStrong7Run, rasiCtx, run, sthiraYears } from './rasiCommon';
import { narayanaStartOverride } from './overrides';

export const STHIRA_TITLE = 'Sthira dasa (an ayur dasa that shows death)';

export function sthiraDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  // FUN_00408580 0x40860f reads Narayana dasa's D-1 "Start dasas from" (chart+0x17ce0[0]),
  // not the 2022 dialog's chart+0x17eb4[41]
  const start = narayanaStartOverride(ctx) ?? brahmaSign(chart);
  const seq = run(start, sequenceDirection(start, ctx));
  return buildRasiDasa(seq, seq.map(sthiraYears), (s) => lordOfStrong7Run(s, ctx), levels, false);
}
