import { useEffect, useMemo, useState } from 'react';
import type { Sweph } from '../sweph';
import { loadEngine } from '../core/engine';
import { computeChart, signsInVarga, type Chart } from '../core/chart';
import { parseJhd, writeJhd, type BirthData } from '../core/jhd';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../core/vargas';
import { formatLongitude, nakshatraOf, NAKSHATRAS, padaOf, signOf, SIGNS } from '../core/zodiac';
import { BirthForm } from './BirthForm';
import { ChartDiagram, type ChartStyle } from './ChartDiagram';

const VARGA_TITLES: Record<VargaName, string> = {
  D1: 'Rasi', D2: 'Hora', D3: 'Drekkana', D4: 'Chaturthamsa', D5: 'Panchamsa', D6: 'Shashthamsa',
  D7: 'Saptamsa', D8: 'Ashtamsa', D9: 'Navamsa', D10: 'Dasamsa', D11: 'Rudramsa', D12: 'Dwadasamsa',
  D16: 'Shodasamsa', D20: 'Vimsamsa', D24: 'Siddhamsa', D27: 'Nakshatramsa', D30: 'Trimsamsa',
  D40: 'Khavedamsa', D45: 'Akshavedamsa', D60: 'Shashtyamsa', D81: 'Nava-navamsa',
  D108: 'Ashtottaramsa', D144: 'Dwadasa-dwadasamsa',
};

const SAMPLES = ['Swami Vivekananda', 'Mahatma Gandhi', 'India', 'Ramana Maharshi', 'Prof. B. V. Raman', 'Author of this software'];

async function fetchFile(name: string): Promise<Uint8Array | null> {
  const r = await fetch(`${import.meta.env.BASE_URL}ephe/${name}`);
  return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
}

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function App() {
  const [swe, setSwe] = useState<Sweph | null>(null);
  const [birth, setBirth] = useState<BirthData | null>(() => load('jh.birth', null));
  const [chart, setChart] = useState<Chart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState<ChartStyle>(() => load('jh.style', 'south'));
  const [varga, setVarga] = useState<VargaName>(() => load('jh.varga', 'D9'));

  useEffect(() => { loadEngine(fetchFile).then(setSwe, (e) => setError(String(e))); }, []);
  useEffect(() => {
    if (!birth) {
      fetch(`${import.meta.env.BASE_URL}samples/${SAMPLES[0]}.jhd`).then((r) => r.text()).then((t) => setBirth({ ...parseJhd(t), city: SAMPLES[0] }));
    }
  }, [birth]);
  useEffect(() => {
    if (!swe || !birth) return;
    save('jh.birth', birth);
    computeChart(swe, birth).then(setChart, (e) => setError(String(e)));
  }, [swe, birth]);
  useEffect(() => save('jh.style', style), [style]);
  useEffect(() => save('jh.varga', varga), [varga]);

  const openFile = async (f: File) => setBirth({ ...parseJhd(await f.text()), city: f.name.replace(/\.jhd$/i, '') });
  const loadSample = async (name: string) => {
    const t = await (await fetch(`${import.meta.env.BASE_URL}samples/${name}.jhd`)).text();
    setBirth({ ...parseJhd(t), city: parseJhd(t).city || name });
  };
  const download = () => {
    if (!birth) return;
    const url = URL.createObjectURL(new Blob([writeJhd(birth)], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${birth.city || 'chart'}.jhd` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const lagna = chart ? signOf(chart.positions.ascendant) : 0;
  const d1 = useMemo(() => chart && signsInVarga(chart, 'D1'), [chart]);
  const dv = useMemo(() => chart && signsInVarga(chart, varga), [chart, varga]);
  const vargaLagna = chart ? signOf(vargaLongitude(chart.positions.ascendant, ALL_VARGAS[varga])) : 0;

  return (
    <div className="app">
      <header>
        <h1>Jagannatha Hora <span>web</span></h1>
        <div className="toolbar">
          <select aria-label="Sample charts" value="" onChange={(e) => e.target.value && loadSample(e.target.value)}>
            <option value="">Sample charts…</option>
            {SAMPLES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="file">Open .jhd<input type="file" accept=".jhd" onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} /></label>
          <button onClick={download} disabled={!birth}>Save .jhd</button>
          <select aria-label="Chart style" value={style} onChange={(e) => setStyle(e.target.value as ChartStyle)}>
            <option value="south">South Indian</option>
            <option value="north">North Indian</option>
          </select>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {!swe && !error && <p className="status">Loading ephemeris…</p>}

      {birth && (
        <details className="panel" open={!chart}>
          <summary>Birth data{chart ? ` — ${birth.city || 'chart'}, ${birth.year}-${birth.month}-${birth.day}` : ''}</summary>
          <BirthForm key={JSON.stringify(birth)} initial={birth} onSubmit={setBirth} />
        </details>
      )}

      {chart && d1 && dv && (
        <>
          <section className="charts">
            <ChartDiagram style={style} signs={d1} lagnaSign={lagna} title="Rasi" subtitle="D-1" />
            <div>
              <ChartDiagram style={style} signs={dv} lagnaSign={vargaLagna} title={VARGA_TITLES[varga]} subtitle={varga.replace('D', 'D-')} />
              <select aria-label="Divisional chart" value={varga} onChange={(e) => setVarga(e.target.value as VargaName)}>
                {(Object.keys(VARGA_TITLES) as VargaName[]).map((v) => <option key={v} value={v}>{v.replace('D', 'D-')} {VARGA_TITLES[v]}</option>)}
              </select>
            </div>
          </section>

          <section className="panel">
            <h2>Longitudes</h2>
            <table>
              <thead><tr><th>Body</th><th>Longitude</th><th>Nakshatra</th><th>Pada</th><th>Rasi</th><th>Navamsa</th></tr></thead>
              <tbody>
                {chart.bodies.map((b) => (
                  <tr key={b.id}>
                    <td>{b.id}{b.retrograde ? ' (R)' : ''}</td>
                    <td className="mono">{formatLongitude(b.lon)}</td>
                    <td>{NAKSHATRAS[nakshatraOf(b.lon)]}</td>
                    <td>{padaOf(b.lon)}</td>
                    <td>{SIGNS[signOf(b.lon)]}</td>
                    <td>{SIGNS[signOf(vargaLongitude(b.lon, ALL_VARGAS.D9))]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">Ayanamsa (True Chitrapaksha): {formatLongitude(chart.positions.ayanamsa).replace(/ \w\w /, '° ')}</p>
          </section>
        </>
      )}
    </div>
  );
}
