import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { Atlas, ATLAS_COUNTRIES, dstInEffect } from '../src/core/atlas';

const dir = `${homedir()}/.local/share/jhweb/jhora-harness/jhcore/atlas`;
const lite = `${dir}/jhlite.adb`;

describe.skipIf(!existsSync(lite))('JHora atlas (jhlite.adb)', () => {
  const atlas = new Atlas(new Uint8Array(readFileSync(lite)));
  it('finds Kabul with JHora coordinates and zone', () => {
    const r = atlas.search('kabul');
    const k = r.places.find((p) => p.name === 'Kabul')!;
    expect(ATLAS_COUNTRIES[k.country][1]).toBe('Afghanistan');
    expect(k.lon).toBeCloseTo(69 + 11 / 60, 6);
    expect(k.lat).toBeCloseTo(34 + 31 / 60, 6);
    expect(k.tz).toBe(4.5);
    expect(r.approximate).toBe(false);
  });
  it('approximate matches drop letters', () => {
    const r = atlas.search('Kabulzz');
    expect(r.approximate).toBe(true);
    expect(r.places.some((p) => p.name === 'Kabul')).toBe(true);
  });
  it('southern and western hemispheres', () => {
    const ba = atlas.search('Buenos Aires', 'WORLD').places[0];
    expect(ba.lat).toBeLessThan(0);
    expect(ba.lon).toBeLessThan(0);
  });
});

describe('atlas DST rules (0x4aaa10)', () => {
  const place = (code: string, tz: number, tzDst: number) => ({ country: ATLAS_COUNTRIES.findIndex(([c]) => c === code), name: '', lat: 0, lon: 0, tz, tzDst, altitude: 0 });
  it('US era rules and war time', () => {
    const ny = place('USNY', -5, -4);
    expect(dstInEffect(ny, 2010, 7, 4, 12)).toBe(true);
    expect(dstInEffect(ny, 2010, 1, 4, 12)).toBe(false);
    expect(dstInEffect(ny, 1943, 1, 4, 12)).toBe(true);
    expect(dstInEffect(ny, 1950, 7, 4, 12)).toBe(false);
  });
  it('EU default and southern hemisphere', () => {
    expect(dstInEffect(place('UK', 0, 1), 2000, 7, 1, 12)).toBe(true);
    expect(dstInEffect(place('UK', 0, 1), 2000, 12, 1, 12)).toBe(false);
    expect(dstInEffect(place('AS', 10, 11), 2000, 1, 15, 12)).toBe(true);
    expect(dstInEffect(place('AS', 10, 11), 2000, 7, 15, 12)).toBe(false);
    expect(dstInEffect(place('IN', 5.5, 5.5), 2000, 7, 15, 12)).toBe(false);
  });
});
