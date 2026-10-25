// Jobs of the calculation options ported from jhora.exe (strength / chakra / calculation
// options): registered in jobs.ts ASYNC_TABLES.
//
// 'derived.nisheka' (Modes > "Go to Nisheka/Aadhana Chakra", 33291, FUN_00407390) runs on the
// natal chart spec and returns, like 'mundane.find', one row [chart, start, end of the
// period] and `text[0]` = JSON { birth, label, periodDays }: the UI shows the chart as a
// derived chart with its dasas compressed into the period (src/core/derived/nisheka.ts).
import type { Table } from './protocol';
import type { AsyncTableFn } from '../core/derived/common';
import { formatDasaTime } from '../core/dasas/format';
import { birthAt } from '../core/tajaka/annual';
import { nishekaMoment } from '../core/derived/nisheka';

export const OPTION_ASYNC_JOBS: Record<string, AsyncTableFn> = {
  'derived.nisheka': async (natal, _params, swe) => {
    const m = nishekaMoment(swe, natal);
    await swe.ensureEphemeris(m.jd);
    const when = (jd: number) => formatDasaTime(jd, natal.birth.tzHours, (x) => swe.revjul(x));
    return {
      caption: m.label, headers: ['Chart', 'Start', 'End'], rows: [[m.label, when(m.jd), when(m.jd + m.days)]],
      text: [JSON.stringify({ birth: birthAt(swe, natal, m.jd), label: m.label, periodDays: m.days })],
    } satisfies Table;
  },
};
