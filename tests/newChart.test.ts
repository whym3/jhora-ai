// File > New, "Set Current Location as Default" and the birth dialog's LMT option
// (src/core/newChart.ts, after jhora.exe FUN_00402bc0 / FUN_00407150 / FUN_004df6c0 / FUN_00403d80).
import { describe, expect, it } from 'vitest';
import { defaultLocationFromChart, defaultLocationMessage, lmtZone, newChartBirth } from '../src/core/newChart';
import { parseJhd, writeJhd } from '../src/core/jhd';
import { DEFAULTS } from '../src/settings/generated';

describe('new chart', () => {
  it('is now at the default location, in summer time when its DST rule says so', () => {
    const b = newChartBirth(DEFAULTS, new Date(Date.UTC(2026, 6, 1, 12, 0, 30, 900)));
    expect(b).toMatchObject({
      year: 2026, month: 7, day: 1, tzHours: -4, dst: true, lon: -71.686111, lat: 42.202778, altitudeM: 425,
      city: 'South Grafton', country: 'Massachusetts, USA', placeCode: 271, standardTz: -5, summerTz: -4,
    });
    expect(b.hour * 3600).toBeCloseTo(8 * 3600 + 30, 6);   // whole seconds, as gmtime gives them
    const w = newChartBirth(DEFAULTS, new Date(Date.UTC(2026, 0, 15, 3, 0, 0)));
    expect(w).toMatchObject({ year: 2026, month: 1, day: 14, tzHours: -5, dst: false });
    expect(w.hour).toBeCloseTo(22, 9);
  });

  it('writes a .jhd JHora reads back', () => {
    const b = newChartBirth(DEFAULTS, new Date(Date.UTC(2026, 9, 25, 10, 20, 0)));
    const r = parseJhd(writeJhd(b));
    expect(r).toMatchObject({ year: 2026, month: 10, day: 25, tzHours: -4, city: 'South Grafton', placeCode: 271, altitudeM: 425 });
    expect(r.lon).toBeCloseTo(-71.686111, 5);
  });

  it('sets the current location as default and says so like JHora', () => {
    const b = newChartBirth({ ...DEFAULTS, DefaultLongitude: -88.5, DefaultLatitude: 22.5, DefaultTimeZone: -5.5, DefaultSummerTimeZone: -5.5, DefaultLocationCountryCode: 105, DefaultLocationCityName: 'Calcutta', DefaultLocationCountryName: 'India', DefaultAltitude: 6 }, new Date(Date.UTC(2026, 6, 1)));
    expect(b).toMatchObject({ tzHours: 5.5, dst: false, lon: 88.5 });
    const ini = defaultLocationFromChart(b);
    expect(ini).toEqual({
      DefaultLongitude: -88.5, DefaultLatitude: 22.5, DefaultAltitude: 6, DefaultTimeZone: -5.5, DefaultSummerTimeZone: -5.5,
      DefaultLocationCountryCode: 105, DefaultLocationCityName: 'Calcutta', DefaultLocationCountryName: 'India',
    });
    expect(defaultLocationFromChart(newChartBirth(DEFAULTS))).toEqual({
      DefaultLongitude: DEFAULTS.DefaultLongitude, DefaultLatitude: DEFAULTS.DefaultLatitude, DefaultAltitude: DEFAULTS.DefaultAltitude,
      DefaultTimeZone: DEFAULTS.DefaultTimeZone, DefaultSummerTimeZone: DEFAULTS.DefaultSummerTimeZone,
      DefaultLocationCountryCode: DEFAULTS.DefaultLocationCountryCode, DefaultLocationCityName: DEFAULTS.DefaultLocationCityName,
      DefaultLocationCountryName: DEFAULTS.DefaultLocationCountryName,
    });
    const msg = defaultLocationMessage(DEFAULTS);
    expect(msg).toContain('South Grafton, Massachusetts, USA');
    expect(msg).toContain('Longitude: 71 W 41\' 10"');
    expect(msg).toContain('Latitude: 42 N 12\' 10"');
    expect(msg).toContain('Standard Timezone: 5:00 (West of GMT)');
    expect(defaultLocationMessage(ini)).toContain('Standard Timezone: 5:30 (East of GMT)');
  });

  it('LMT uses the longitude degrees and minutes only', () => {
    expect(lmtZone(88 + 30 / 60 + 59 / 3600)).toBeCloseTo(88.5 / 15, 12);
    expect(lmtZone(-(71 + 41 / 60 + 10 / 3600))).toBeCloseTo(-(71 + 41 / 60) / 15, 12);
  });
});
