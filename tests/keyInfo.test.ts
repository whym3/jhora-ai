import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { keyInfoText } from '../src/core/keyInfo';
import { runText } from '../src/engine/jobs';

/** Lines must match exactly, Janma Ghatis (4 decimals of a ghati = 0.144 s) included. */
function compare(have: string[], want: string[]) {
  expect(have).toEqual(want);
}

describe('Key Info (Basics > Key Info, cmd 32974)', () => {
  const charts = goldenV3Charts()
    .map((c) => ({ c, t: c.texts.find((x) => x.name === 'key_info' && x.lines?.length) }))
    .filter((x) => x.t);
  it('has golden charts', () => expect(charts.length).toBeGreaterThan(0));
  for (const { c, t } of charts) {
    it(c.name, async () => {
      const swe = await nodeSweph();
      const chart = await computeChart(swe, c.birth);
      // golden line 0 is the chart file path, line 1 blank
      const want = t!.lines.slice(2).map((l) => l.trimEnd());
      while (want.length && want[want.length - 1] === '') want.pop();
      const have = keyInfoText(swe, chart);
      compare(have, want);
      expect(runText(chart, 32974, {}, swe)).toBe(have.join('\r\n'));
    });
  }
});
