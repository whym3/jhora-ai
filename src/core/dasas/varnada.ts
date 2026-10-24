// Varnada dasa (FUN_00407de0), with JHora 8.0's rules (D-1):
//  - the dasas start from the stronger of the lagna and the hora lagna
//    (FUN_004ab830 mode 0 = FUN_004ab890, lagna as first argument, winning
//    ties) and run sign by sign, zodiacally from an odd sign and backwards
//    from an even one (no Saturn/Ketu exception);
//  - years = signs from the Varnada Lagna (body 47) to the dasa sign, counted
//    zodiacally exclusive (0 for the Varnada Lagna's own sign); second cycle 12
//    minus the first;
//  - antardasas run sign by sign from the dasa sign itself, zodiacally if it
//    is odd and backwards if even; each a twelfth.
import type { Chart } from '../chart';
import type { Period } from './vimsottari';
import { strongerSign } from '../signStrength';
import { bodySign, buildRasiDasa, mod12, rasiCtx, run } from './rasiCommon';

export const VARNADA_TITLE = 'Varnada dasa';

const parity = (s: number) => (s % 2 === 0 ? 1 : -1);

export function varnadaDasa(chart: Chart, levels = 2): Period[] {
  const ctx = rasiCtx(chart, 0);
  const vl = bodySign(chart, 'Varnada Lagna');
  const start = strongerSign(ctx.lagna, bodySign(chart, 'Hora Lagna'), ctx);
  const seq = run(start, parity(start));
  const years = seq.map((s) => mod12(s - vl));
  return buildRasiDasa(seq, years, (s) => run(s, parity(s)), levels, true);
}
