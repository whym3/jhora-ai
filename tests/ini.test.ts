import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseIni, writeIni } from '../src/io/ini';
import { DEFAULTS, INI_SPEC } from '../src/settings/generated';

const norm = (t: string) => t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

describe('jhora.ini', () => {
  const text = readFileSync('golden/jhora-defaults.ini', 'latin1');

  it('defaults equal the file JHora wrote', () => {
    const { ini, extra } = parseIni(text);
    expect(extra).toEqual({});
    expect(ini).toEqual(DEFAULTS);
  });

  it('round-trips JHora\'s file line for line', () => {
    expect(norm(writeIni(parseIni(text).ini))).toEqual(norm(text));
  });

  it('reads indexed keys and overrides', () => {
    const { ini } = parseIni('[CalculationPreferences]\r\nUserSelectedAyanamsa=1\r\nYearLength=3 360.000000\r\nAutoUpdateOn=0\r\n');
    expect(ini.UserSelectedAyanamsa).toBe(1);
    expect(ini.YearLength[3]).toBe(360);
    expect(ini.YearLength[2]).toBe(DEFAULTS.YearLength[2]);
    expect(INI_SPEC.find((s) => s.key === 'YearLength')?.length).toBe(75);
  });
});
