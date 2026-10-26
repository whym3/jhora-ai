// Basics jobs ported from jhora.exe's Key Info view (CKeyInfoView, modes dispatched by
// FUN_0042b0b0), the Amsa rulers view (FUN_00495500) and the yoga pane's "List of supported
// yogas" (33077, FUN_00497290). Registered in src/engine/jobs.ts (TABLES / TEXTS spreads).
//
//  'basics.longitudes'       FUN_0042b400 (mode 0): params.varga (33242 "Choose divisional chart
//                            for longitudes", DAT_0065b184; default D1); rows per the body selection
//  'basics.natalLongitudes'  FUN_0042c8e0 (mode 21, 33115): D-1 rows, header "NATAL Longitude"
//  'basics.natalSahamas'     FUN_0042f5a0 (mode 22, 33116): header "NATAL Position"
//  'basics.coordinates'      FUN_0042f800 (mode 3, 33071): swe_calc's six values of Sun..Rahu
//  'basics.amsaRulers'       FUN_00495500: params.varga (JHora varga index; default AmsaRulerVarga)
//  'strengths.yogaList'      FUN_00497290 via FUN_004c2180: every yoga JHora knows, params.mode
//                            (a YOGA_MODES label) picks the category
import type { Chart } from './chart';
import type { Sweph } from '../sweph';
import type { Table } from '../engine/protocol';
import { ayanamsa, bodyLongitude, calcFlags, norm360, type Graha } from './positions';
import { calcSettingsFromIni } from './settings';
import { jhoraDeltaT } from './deltat';
import { SE } from '../sweph';
import { formatLongitude, NAK28, nakshatra28Of, nakshatraOf, NAKSHATRAS, padaOf, signOf, SIGNS } from './zodiac';
import { vargaLongitude, type VargaName } from './vargas';
import { VARGA_INDEX, vargaColumnLabel, vargasOf } from './vargaOptions';
import { bodyShown, charaKarakas, JHORA_BODY_NAMES, selectedBodies } from './basics';
import { varnada } from './bodies';
import { sahamas } from './sahamas';
import { D150_INDEX, vargaAmsaRuler } from './amsaRulers';
import { supportedYogas, YOGA_MODES } from './yogas';

type TableFn = (chart: Chart, params: Record<string, unknown>, swe?: Sweph) => Table;

/** A body of the Key Info tables: JHora index, name and D-1 longitude. */
export interface KeyInfoBody { index: number; name: string; lon: number; retrograde: boolean }

/** JHora body index -> D-1 longitude and retrograde flag (the nodes are never flagged). */
export function jhoraBody(chart: Chart, index: number): KeyInfoBody {
  const name = JHORA_BODY_NAMES[index];
  const p = chart.positions;
  if (index === 0) return { index, name, lon: p.ascendant, retrograde: false };
  if (index <= 9) {
    const g = p.grahas[name as Graha];
    return { index, name, lon: g.lon, retrograde: g.retrograde && index < 8 };
  }
  if (index <= 12) {
    const o = p.outer[name as 'Uranus' | 'Neptune' | 'Pluto'];
    return { index, name, lon: o.lon, retrograde: o.retrograde };
  }
  const b = chart.longitudes.find((x) => x.name === name);
  if (!b) throw new Error(`no body ${name}`);
  return { index, name, lon: b.lon, retrograde: false };
}

/** The bodies the Key Info tables list (BodiesToShow groups, JHora indices below `limit`). */
export function keyInfoBodies(chart: Chart, limit = 59): KeyInfoBody[] {
  return selectedBodies(chart.ini as unknown as Record<string, unknown>, limit).map((i) => jhoraBody(chart, i));
}

/**
 * A body's longitude in a varga. Varnadas are recomputed inside the varga (from the varga's
 * lagna and hora lagna) rather than mapped from D-1, as JHora does (as jobs.ts bodyInVarga).
 */
export function keyInfoVargaLongitude(chart: Chart, body: { name: string; lon: number }, v: VargaName): number {
  const spec = vargasOf(chart.ini)[v];
  const house = body.name === 'Varnada Lagna' ? 1 : /^V(\d+)$/.test(body.name) ? Number(body.name.slice(1)) : 0;
  if (house && v !== 'D1') {
    if (v === 'D10xD9') return 0;
    const lagna = vargaLongitude(chart.positions.ascendant, spec);
    const hl = vargaLongitude(chart.longitudes.find((b) => b.name === 'Hora Lagna')!.lon, spec);
    const sign = signOf(varnada(norm360(lagna + 30 * (house - 1)), norm360(hl + 30 * (house - 1))));
    return sign * 30 + (vargaLongitude(body.lon, spec) % 30);
  }
  return vargaLongitude(body.lon, spec);
}

/**
 * Rows of the Longitudes tables (FUN_0042b400 / FUN_0042c8e0): "%s%s%s" = name, " (R) " or
 * " ", and the chara karaka ("- AK", FUN_004a4fd0) - so bodies without a karaka end in a blank.
 */
function longitudeRows(chart: Chart, varga: VargaName): string[][] {
  const karaka = new Map(charaKarakas(chart.positions).map((k) => [k.planet as string, k.karaka]));
  const V = vargasOf(chart.ini);
  const row = (label: string, lon: number, nav: number) => {
    // SiderealNaksharasInTropical: nakshatra bytes from lon + FUN_0049a930's offset (chart.ts)
    const nl = chart.nakshatraShift ? (((lon + chart.nakshatraShift) % 360) + 360) % 360 : lon;
    return [label, formatLongitude(lon), NAKSHATRAS[nakshatraOf(nl)], String(padaOf(nl)), SIGNS[signOf(lon)], SIGNS[signOf(nav)]];
  };
  const rows = keyInfoBodies(chart).map((b) => {
    const lon = varga === 'D1' ? b.lon : keyInfoVargaLongitude(chart, b, varga);
    // navamsa: JHora's per-body D-9 sign (varnadas recomputed in the D-9 like any varga)
    const nav = varga === 'D1' ? keyInfoVargaLongitude(chart, b, 'D9') : vargaLongitude(lon, V.D9);
    const k = karaka.get(b.name);
    return row(`${b.name}${b.retrograde ? ' (R) ' : ' '}${k ? `- ${k}` : ''}`, lon, nav);
  });
  // the Edit menu's special point and planetary special lagna follow the 56 bodies (bodies 103/104)
  for (const u of chart.userPoints ?? []) {
    const lon = varga === 'D1' ? u.lon : vargaLongitude(u.lon, V[varga]);
    rows.push(row(`${u.name} `, lon, vargaLongitude(u.lon, V.D9)));
  }
  // a Prasna chart that leaves the lagna as it is lists Prasna Lagna last (no trailing blank)
  const plag = chart.birth.override?.prasnaLagna;
  if (plag !== undefined) rows.push(row('Prasna Lagna', varga === 'D1' ? plag : vargaLongitude(plag, V[varga]), vargaLongitude(plag, V.D9)));
  return rows;
}

/** FUN_0042f800: "%.3f deg", "%.3f deg/day", "%.4f AU", "%.6f AU/day" of swe_calc for Sun..Rahu. */
function coordinates(chart: Chart, swe?: Sweph): string[][] {
  const p = chart.positions;
  const s = calcSettingsFromIni(chart.ini);
  const ids: [Graha, number][] = [['Sun', SE.SUN], ['Moon', SE.MOON], ['Mars', SE.MARS], ['Mercury', SE.MERCURY],
    ['Jupiter', SE.JUPITER], ['Venus', SE.VENUS], ['Saturn', SE.SATURN], ['Rahu', s.trueNodes ? SE.TRUE_NODE : SE.MEAN_NODE]];
  // printf("%.3f") keeps the sign of a tiny negative value ("-0.000"), as toFixed does
  const f = (x: number, d: number) => x.toFixed(d);
  return ids.map(([g, id]) => {
    let lat = p.grahas[g].lat, speed = p.grahas[g].speed, latSpeed = 0, dist = 0, distSpeed = 0;
    if (swe && !s.sss) {
      if (s.topocentric) swe.setTopo(chart.birth.lon, chart.birth.lat, chart.birth.altitudeM);
      const jdEt = p.jdUt + (jhoraDeltaT(p.jdUt) ?? swe.deltaT(p.jdUt));
      // JHora stores the speeds without the nutation rate (FUN_0049aaa0 calls swe_calc with SEFLG_NONUT)
      const x = bodyLongitude(swe, jdEt, id, calcFlags(s) | SE.FLG_NONUT, ayanamsa(swe, p.jdUt, jdEt, s, chart.birth.lon));
      lat = x.lat; speed = x.speedLon; latSpeed = x.speedLat; dist = x.dist; distSpeed = x.speedDist;
    }
    return [g, `${f(p.grahas[g].lon, 3)} deg`, `${f(speed, 3)} deg/day`, `${f(lat, 3)} deg`,
      `${f(latSpeed, 3)} deg/day`, `${f(dist, 4)} AU`, `${f(distSpeed, 6)} AU/day`];
  });
}

export const BASICS_JOBS: Record<string, TableFn> = {
  // Basics > Key Info > "Longitudes & Basic Info" (32822); params.varga: 33242's divisional chart
  'basics.longitudes': (chart, params) => {
    const varga = String(params.varga ?? 'D1') as VargaName;
    return {
      headers: ['Body', varga === 'D1' ? 'Longitude' : `Longitude (in ${vargaColumnLabel(varga, chart.ini)})`, 'Nakshatra', 'Pada', 'Rasi', 'Navamsa'],
      rows: longitudeRows(chart, varga),
    };
  },
  // "Natal Longitudes" (33115): the natal chart's longitudes even when a derived chart is shown
  'basics.natalLongitudes': (chart) => ({
    headers: ['Body', 'NATAL Longitude', 'Nakshatra', 'Pada', 'Rasi', 'Navamsa'],
    rows: longitudeRows(chart, 'D1'),
  }),
  // "Natal Sahamas" (33116)
  'basics.natalSahamas': (chart) => ({
    headers: ['Sahama name', 'NATAL Position', 'Nakshatra', 'Meaning of sahama'],
    rows: sahamas(chart.positions, chart.day.isDay).map((s) => [s.name, formatLongitude(s.lon), NAK28[nakshatra28Of(s.lon)], s.meaning]),
  }),
  // "Latitudes, speeds etc (co-ordinates)" (33071)
  'basics.coordinates': (chart, _params, swe) => ({
    headers: ['Planet', 'Longitude', 'Lon Speed', 'Latitude', 'Lat Speed', 'Distance', 'Dist Speed'],
    rows: coordinates(chart, swe),
  }),
  // Basics > Amsa rulers (menu 141): body rows 0..58 per the body selection, "%s (R)" for retrograde
  'basics.amsaRulers': (chart, params) => {
    const varga = Number(params.varga ?? chart.ini.AmsaRulerVarga ?? D150_INDEX);
    const ini = chart.ini as unknown as Record<string, unknown>;
    const label = varga === D150_INDEX ? 'D-150' : vargaColumnLabel(VARGA_INDEX[varga], chart.ini);
    return {
      headers: ['Body', 'Division', 'Index', `In whose amsa in ${label}`],
      // FUN_00495500 walks the indices 0..58 in order, skipping unselected groups
      rows: JHORA_BODY_NAMES.map((_, i) => i).filter((i) => bodyShown(ini, i)).map((i) => jhoraBody(chart, i)).map((b) => {
        const r = vargaAmsaRuler(b.lon, varga, Number(chart.ini.D150NamePreference ?? 0));
        return [b.retrograde ? `${b.name} (R)` : b.name, String(r.division + 1), String(r.index + 1), r.name];
      }),
    };
  },
  // Strengths > yogas, "List of supported yogas" (33077): "%d %s" index and type, name, definition, results
  'strengths.yogaList': (_chart, params) => {
    const cat = (YOGA_MODES.find(([label]) => label === params.mode) ?? YOGA_MODES[0])[1];
    return {
      headers: ['Index & Type', 'Yoga', 'Brief definition of yoga', 'Results ascribed to yoga'],
      rows: supportedYogas(cat).map((y, i) => [`${i + 1} ${y.type}`, y.name, y.definition, y.result]),
    };
  },
};
