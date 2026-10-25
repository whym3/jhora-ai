// Edit > "Copy basic calculations" (32982) and "Copy complete calculations" (32983) against the
// texts JHora 8.0 put on the clipboard (golden/jhora-v3 texts "basic_calcs" / "complete_calcs"),
// line by line for every chart. The first line is the chart file's path, passed as params.file.
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { goldenV3Charts } from './golden';
import { computeChart } from '../src/core/chart';
import { basicCalculations, completeCalculations } from '../src/core/format/calcsText';
import { runText } from '../src/engine/jobs';

const charts = goldenV3Charts().map((c) => ({
  ...c,
  basic: c.texts.find((t) => t.name === 'basic_calcs' && t.lines?.length)?.lines,
  complete: c.texts.find((t) => t.name === 'complete_calcs' && t.lines?.length)?.lines,
})).filter((c) => c.basic || c.complete);

describe.skipIf(!charts.length)('basic and complete calculations match JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const c of charts) {
    describe(c.name, async () => {
      const chart = await computeChart(swe, c.birth);
      if (c.basic) {
        it('32982 basic calculations', () => {
          const lines = basicCalculations(swe, chart, { file: c.basic![0] });
          c.basic!.forEach((l, i) => expect(lines[i], `line ${i}`).toBe(l));
          expect(lines.length).toBe(c.basic!.length);
        });
      }
      if (c.complete) {
        it('32983 complete calculations', () => {
          const lines = completeCalculations(swe, chart, { file: c.complete![0] });
          c.complete!.forEach((l, i) => expect(lines[i], `line ${i}`).toBe(l));
          expect(lines.length).toBe(c.complete!.length);
        });
      }
    });
  }
  it('text jobs 32982 / 32983 give the same text CRLF-joined', async () => {
    const c = charts[0];
    const chart = await computeChart(swe, c.birth);
    expect(runText(chart, 32982, { file: 'X' }, swe)).toBe(basicCalculations(swe, chart, { file: 'X' }).join('\r\n'));
    expect(runText(chart, 32983, {}, swe).split('\r\n')[0]).toBe('');
  });
});
