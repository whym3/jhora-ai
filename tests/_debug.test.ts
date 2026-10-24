import { it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV2Charts } from './golden';
import { computeChart } from '../src/core/chart';

it('dasa seeds', async () => {
  const swe = await nodeSweph();
  for (const g of goldenV2Charts()) {
    const c = await computeChart(swe, g.birth);
    const moon = c.positions.grahas.Moon.lon;
    const out: Record<string, unknown> = { chart: g.name, moon, nak: Math.floor(moon / (360 / 27)), frac: (moon % (360 / 27)) / (360 / 27), jd: c.positions.jdUt, tz: g.birth.tzHours };
    for (const t of g.texts.filter((t) => t.sub === 'Nakshatra dasas' && t.name === 'dasa' && t.lines)) {
      const first = t.lines.find((l) => /^ [^:]+: \d{4}-/.test(l))!;
      const m = /^ ([^:]+): (\d{4})-(\d\d)-(\d\d) \((\d+):(\d\d):(\d\d)\) - (\d{4})-(\d\d)-(\d\d) \((\d+):(\d\d):(\d\d)\)/.exec(first)!;
      const jd1 = swe.julday(+m[2], +m[3], +m[4], +m[5] + +m[6] / 60 + +m[7] / 3600) - g.birth.tzHours / 24;
      const jd2 = swe.julday(+m[8], +m[9], +m[10], +m[11] + +m[12] / 60 + +m[13] / 3600) - g.birth.tzHours / 24;
      out[t.mode!] = [m[1], +((c.positions.jdUt - jd1) / 365.256364).toFixed(4), +((jd2 - jd1) / 365.256364).toFixed(3)];
    }
    console.log('SEED ' + JSON.stringify(out));
  }
});
