import { describe, expect, it } from 'vitest';
import { goldenCharts, parseLongitude, view } from './golden';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../src/core/vargas';
import { formatVargaLongitude, SIGNS } from '../src/core/zodiac';

// JHora column header -> our varga
const COLUMNS: Record<string, VargaName> = {
  'D-1': 'D1', 'D-9': 'D9', 'D-10 (Trd)': 'D10', 'D-2 (US)': 'D2', 'D-3 (Trd)': 'D3', 'D-4': 'D4',
  'D-7 (Trd)': 'D7', 'D-12 (Trd)': 'D12', 'D-16 (Trd)': 'D16', 'D-20 (Trd)': 'D20', 'D-24 (Trd)': 'D24',
  'D-27 (Trd)': 'D27', 'D-30': 'D30', 'D-40': 'D40', 'D-45': 'D45', 'D-60 (Trd)': 'D60', 'D-5': 'D5',
  'D-6': 'D6', 'D-8': 'D8', 'D-11': 'D11', 'D-81': 'D81', 'D-108': 'D108', 'D-144': 'D144',
};

const parseShort = (s: string) => {
  const m = /(\d+)(\w\w)(\d+)/.exec(s)!;
  return { sign: SIGNS.indexOf(m[2] as never), minutes: +m[1] * 60 + +m[3] };
};

describe('divisional longitudes match JHora 8.0 defaults', () => {
  for (const chart of goldenCharts()) {
    it(chart.name, () => {
      const base = new Map(view(chart, 'Longitudes & Basic Info').rows.map((r) => [r[0].split(/ - | \(R\)/)[0].trim(), parseLongitude(r[1])]));
      const table = view(chart, 'All Divisional Longitudes');
      let checked = 0;
      for (const row of table.rows) {
        const body = row[0].trim();
        // varnadas are recomputed in each varga, not mapped from D-1
        if (body.startsWith('Varnada') || /^V\d+$/.test(body) || !base.has(body)) continue;
        table.headers.forEach((h, i) => {
          const v = COLUMNS[h];
          if (!v) return;
          // The golden D-1 longitudes carry only 0.01" precision, which D-40..D-144
          // amplify; so the sign must match exactly and the minutes within 1'.
          const lon = vargaLongitude(base.get(body)!, ALL_VARGAS[v]);
          const want = parseShort(row[i]);
          expect(Math.floor(lon / 30), `${body} ${h} sign`).toBe(want.sign);
          expect(Math.abs((lon % 30) * 60 - want.minutes), `${body} ${h} ${formatVargaLongitude(lon)} vs ${row[i]}`).toBeLessThanOrEqual(1);
          checked++;
        });
      }
      expect(checked).toBeGreaterThan(400);
    });
  }
});
