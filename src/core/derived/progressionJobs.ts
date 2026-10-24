// Jobs of Miscellany > Progressions and Miscellany > Angular Return (spread into
// engine/jobs.ts ASYNC_TABLES). Both run on the natal chart and return the derived
// chart's birth data as JSON in `text[0]` ({ birth, label }), like 'tajaka.find'.
import type { AsyncTableFn } from './common';
import { derivedTable, whenText } from './common';
import { formatLongitude } from '../zodiac';
import { PROG_BODIES, PROG_VARGA_LABELS, progression, progressedVargaLongitudes, vargaNameOf, type ProgressionInput } from './progression';
import { angularReturn, type AngularReturnInput } from './angularReturn';

export const PROGRESSION_JOBS: Record<string, AsyncTableFn> = {
  // buttons 1001 / 1012 / 1008 / 1009: params ProgressionInput
  // ({ kind: 'solar'|'bhrigu'|'scd'|'nakshatra', varga, year, month, day, hour, body?, dasa? })
  'progression.find': async (natal, params, swe) => {
    const inp = params as unknown as ProgressionInput;
    const jd = swe.julday(inp.year, inp.month, inp.day, inp.hour - natal.birth.tzHours);
    await swe.ensureEphemeris(jd);
    const p = progression(swe, natal, inp);
    await swe.ensureEphemeris(p.chartJd);
    const v = vargaNameOf(p.n);
    const d1 = progressedVargaLongitudes(natal, p, 'D1');
    const dv = progressedVargaLongitudes(natal, p, v);
    const vl = PROG_VARGA_LABELS[inp.varga] ?? 'Rasi';
    const notes = [`Progression date: ${whenText(swe, natal, p.jd)}; solar arc ${p.arc.toFixed(4)} deg (${(p.arc / 360).toFixed(4)} years)`];
    if (p.kind === 'solar') notes.push(`Chart cast for ${whenText(swe, natal, p.chartJd)} (1 sign per year in D-${p.n})`);
    if (p.shift !== undefined) notes.push(`Shift added to divisional longitudes: ${p.shift.toFixed(4)} deg (the rasi chart shown elsewhere is exact only for D-1)`);
    if (p.n !== 1 || vl !== 'Rasi') notes.push(`Varga combo "${vl}" uses D-${p.n} (jhora.exe division table 0x591ed4)`);
    return derivedTable(swe, natal, p.label, p.birth, p.chartJd, {
      headers: ['Body', 'Progressed (D-1)', `Progressed (D-${p.n})`],
      rows: PROG_BODIES.map((b) => [b, formatLongitude(d1[b]), formatLongitude(dv[b])]),
      notes,
    });
  },
};

export const ANGULAR_JOBS: Record<string, AsyncTableFn> = {
  // button 1004: params AngularReturnInput ({ a, b, before, year, month, day, hour, tzHours })
  'angularReturn.find': async (natal, params, swe) => {
    const inp = params as unknown as AngularReturnInput;
    await swe.ensureEphemeris(swe.julday(inp.year, inp.month, inp.day, inp.hour - inp.tzHours));
    const r = angularReturn(swe, natal, inp);
    return derivedTable(swe, natal, r.label, r.birth, r.start, {
      headers: ['Chart', 'Start', 'End'],
      rows: [[r.label, whenText(swe, natal, r.start), whenText(swe, natal, r.end)]],
      notes: [`Natal angle: ${r.angle.toFixed(4)} deg; period ${(r.end - r.start).toFixed(4)} days`],
    });
  },
};
