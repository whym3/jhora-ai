// Horoscope matching (command 33320) against JHora 8.0: the result message box for the
// other person's every nakshatra and pada, as bride and as bridegroom
// (golden/jhora-matching, tools/harness/capture_matching.py), and the dialog's default
// Bride/Bridegroom choice. Text is compared line by line with whitespace collapsed.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { computeChart } from '../src/core/chart';
import { parseJhd } from '../src/core/jhd';
import { runTable } from '../src/engine/jobs';
import { defaultOtherIsGroom, MATCH_TITLE } from '../src/core/matching';

interface Captured { default_who: number; cases: { who: number; nak: number; pada: number; title: string; text: string }[] }
const DIR = process.env.MATCH_DIR ?? 'golden/jhora-matching';
const charts = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
const norm = (s: string) => s.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

describe.skipIf(!charts.length)('Horoscope matching matches JHora 8.0', async () => {
  const swe = await nodeSweph();
  for (const name of charts) {
    it(name, async () => {
      const g: Captured = JSON.parse(readFileSync(`${DIR}/${name}.json`, 'utf8'));
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')));
      // combo items: 0 = Bride, 1 = Bridegroom (the other person)
      expect(g.default_who === 1).toBe(defaultOtherIsGroom(chart.birth.field18));
      const bad: string[] = [];
      // a case whose window is the input dialog itself ("Horoscope Matching for Marriage")
      // was read before the result box opened: not captured, skipped
      for (const c of g.cases.filter((x) => x.title !== 'Horoscope Matching for Marriage')) {
        const t = runTable(chart, 'matching.result', { otherNak: c.nak, otherPada: c.pada, otherIsGroom: c.who === 1 });
        if (c.title !== MATCH_TITLE) bad.push(`title ${c.title}`);
        const have = norm(t.text!.join('\n')), want = norm(c.text);
        if (JSON.stringify(have) !== JSON.stringify(want)) bad.push(`${c.who ? 'groom' : 'bride'} ${c.nak}/${c.pada}: ${have.join(' | ')} vs ${want.join(' | ')}`);
      }
      expect(bad.slice(0, 5), bad.slice(0, 5).join('\n')).toEqual([]);
    });
  }
});
