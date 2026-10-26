// TimeDisplayWithAmPm outside Key Info (src/core/format/clock.ts): the transit calendar row
// labels (0x48847a), the eclipse contact times (FUN_004b2370) and dialog 2005's combo 1080
// (FUN_00403d80). The JHora renderings (calendar row labels, Key Info) are checked against
// golden/jhora-ampm when captured (tools/harness/views-ampm.json); until then those cases skip.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { birthHourFromFields, birthTimeFields, calendarLabelAmPm, hmToAmPm } from '../src/core/format/clock';
import { clockText } from '../src/core/transits/common';
import { contactTime } from '../src/core/derived/mundane';
import { nodeSweph } from './helpers';
import { computeChart } from '../src/core/chart';
import { parseJhd } from '../src/core/jhd';
import { keyInfoText } from '../src/core/keyInfo';
import { ASYNC_TABLES } from '../src/engine/jobs';

describe('h:mm am (FUN_004c1c10 after FUN_004c1d40 rounding)', () => {
  it('12-hour hours, pm from 12:00, carry to 24:00 = 12:00 pm', () => {
    expect(hmToAmPm('0:05')).toBe('12:05 am');
    expect(hmToAmPm('11:59')).toBe('11:59 am');
    expect(hmToAmPm('12:00')).toBe('12:00 pm');
    expect(hmToAmPm('13:30')).toBe('1:30 pm');
    expect(hmToAmPm('24:00')).toBe('12:00 pm');
    // the minute is rounded first (seconds >= 30), so am/pm follows the rounded hour
    expect(hmToAmPm(clockText(11 + 59 / 60 + 40 / 3600))).toBe('12:00 pm');
    expect(hmToAmPm(clockText(9 + 15 / 60 + 29 / 3600))).toBe('9:15 am');
  });
  it('calendar row labels', () => {
    expect(calendarLabelAmPm('2024-03-05 (17:42)')).toBe('2024-03-05 (5:42 pm)');
    expect(calendarLabelAmPm('2024-03-05 (0:00)')).toBe('2024-03-05 (12:00 am)');
  });
});

describe('dialog 2005 combo 1080 (FUN_00403d80)', () => {
  it('fills the hours and the combo from the flag', () => {
    expect(birthTimeFields(13.5, false)).toEqual({ hour: 13.5, mode: 2 });
    expect(birthTimeFields(13.5, true)).toEqual({ hour: 1.5, mode: 1 });
    expect(birthTimeFields(0.25, true)).toEqual({ hour: 12.25, mode: 0 });
    expect(birthTimeFields(12.75, true)).toEqual({ hour: 12.75, mode: 1 });
  });
  it('stores hour % 12 (+12 for pm) and sets / clears the flag on OK', () => {
    expect(birthHourFromFields(13.5, 2)).toEqual({ hour: 13.5, ampm: false });
    expect(birthHourFromFields(1.5, 1)).toEqual({ hour: 13.5, ampm: true });
    expect(birthHourFromFields(12.25, 0)).toEqual({ hour: 0.25, ampm: true });
    expect(birthHourFromFields(12.75, 1)).toEqual({ hour: 12.75, ampm: true });
    // JHora takes 13 pm as 13 % 12 + 12
    expect(birthHourFromFields(13, 1)).toEqual({ hour: 13, ampm: true });
    expect(birthHourFromFields(13, 0)).toEqual({ hour: 1, ampm: true });
  });
});

describe('eclipse contact times (FUN_004b2370)', async () => {
  const swe = await nodeSweph();
  it('h:mm:ss am (Month d, yyyy) with the flag, unchanged without', () => {
    // 2000-01-01 12:00 UT, zone +5.5
    const jd = 2451545.0;
    expect(contactTime(swe, jd, 5.5)).toBe('17:30:00 (January 1, 2000)');
    expect(contactTime(swe, jd, 5.5, true)).toBe('5:30:00 pm (January 1, 2000)');
    expect(contactTime(swe, jd, -12.25, true)).toBe('11:45:00 pm (December 31, 1999)');
  });
});

// ---- against JHora (golden/jhora-ampm/<chart>.json from tools/harness/views-ampm.json) ----
interface Golden {
  draws?: { sub: string; events: { fn: string; text?: string }[] }[];
  texts?: { sub: string; name?: string; lines?: string[] }[];
}
const DIR = 'golden/jhora-ampm';
const goldens = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
describe.skipIf(goldens.length === 0)('JHora with TimeDisplayWithAmPm=1', async () => {
  const swe = await nodeSweph();
  for (const f of goldens) {
    const name = f.slice(0, -5);
    const g = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as Golden;
    it(`${name}: transit calendar row labels (OnDraw 0x487e50)`, async () => {
      const natal = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), { TimeDisplayWithAmPm: 1 });
      const start = { year: 2000, month: 1, day: 1, hour: 15 + 20 / 60 };
      await swe.ensureEphemeris(swe.julday(2000, 1, 1, 12));
      const t = await ASYNC_TABLES['transits.calendar'](natal, { start, rows: 15 }, swe);
      const ours = t.rows.map((r) => calendarLabelAmPm(r[0]));
      const draw = g.draws?.find((d) => d.sub === 'Transit Calendar');
      const theirs = (draw?.events ?? []).map((e) => e.text?.trim() ?? '').filter((x) => /^\d{4}-\d\d-\d\d \(/.test(x));
      expect([...new Set(theirs)]).toEqual(ours);
    });
    it(`${name}: Key Info Time / Sunrise / Sunset (FUN_004b1400)`, async () => {
      const lines = g.texts?.find((x) => x.sub === 'Key Info' && x.name === 'key_info')?.lines ?? [];
      const chart = await computeChart(swe, parseJhd(readFileSync(`golden/charts/${name}.jhd`, 'latin1')), { TimeDisplayWithAmPm: 1 });
      const ours = keyInfoText(swe, chart);
      for (const key of ['Time:', 'Sunrise:', 'Sunset:']) expect(ours.find((l) => l.startsWith(key))).toBe(lines.find((l) => l.startsWith(key)));
    });
  }
});
