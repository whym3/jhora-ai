// Place search over JHora's own atlas (public/atlas/jhworld.adb, falling back to
// jhlite.adb like JHora does); install the files with `npm run atlas`.
import { useState } from 'react';
import { Atlas, ATLAS_COUNTRIES, US_FIRST, type AtlasResult, type AtlasScope, type Place } from '../core/atlas';

let atlasPromise: Promise<Atlas> | null = null;

async function fetchCached(url: string): Promise<Uint8Array | null> {
  try {
    const cache = 'caches' in self ? await caches.open('jhora-atlas') : null;
    let res = await cache?.match(url);
    if (!res) {
      res = await fetch(url);
      if (!res.ok) return null;
      await cache?.put(url, res.clone());
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function loadAtlas(): Promise<Atlas> {
  atlasPromise ??= (async () => {
    for (const f of ['atlas/jhworld.adb', 'atlas/jhlite.adb']) {
      const bytes = await fetchCached(f);
      if (bytes) return new Atlas(bytes);
    }
    throw new Error('No atlas found: run "npm run atlas" to install JHora\'s atlas files.');
  })();
  atlasPromise.catch(() => { atlasPromise = null; });
  return atlasPromise;
}

const dm = (v: number, pos: string, neg: string) => {
  const t = Math.round(Math.abs(v) * 60);
  return `${Math.floor(t / 60)} ${pos === neg ? '' : v < 0 ? neg : pos} ${String(t % 60).padStart(2, '0')}`;
};

export function PlaceSearch({ onPick }: { onPick: (p: Place) => void }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<string>('ALL');
  const [result, setResult] = useState<AtlasResult | null>(null);
  const [status, setStatus] = useState('');

  const search = async () => {
    setStatus('Loading atlas…');
    try {
      const atlas = await loadAtlas();
      const sc: AtlasScope = /^\d+$/.test(scope) ? Number(scope) : (scope as AtlasScope);
      setResult(atlas.search(query, sc));
      setStatus('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="place-search">
      <div className="place-bar">
        <input aria-label="Search place" value={query} placeholder="Search the atlas"
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} />
        <select aria-label="Countries" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="ALL">All places</option>
          <option value="WORLD">All the countries (except USA)</option>
          <option value="US">All the states in USA</option>
          {ATLAS_COUNTRIES.map(([, name], i) => <option key={i} value={i}>{i >= US_FIRST ? '  ' : ''}{name}</option>)}
        </select>
        <button type="button" onClick={() => void search()}>Search</button>
      </div>
      {status && <p className="status">{status}</p>}
      {result && (
        <div className="place-results">
          {result.approximate && <p className="status">Approximate matches below (no perfect matches)</p>}
          {result.truncated && <p className="status">Too many matches; showing the first 100</p>}
          <ul>
            {result.places.map((p, i) => (
              <li key={i}><button type="button" onClick={() => { onPick(p); setResult(null); }}>
                {p.name}, {ATLAS_COUNTRIES[p.country][1]} ({dm(p.lon, 'E', 'W')}, {dm(p.lat, 'N', 'S')}; UTC{p.tz >= 0 ? '+' : ''}{p.tz}{p.tzDst !== p.tz ? ` / ${p.tzDst >= 0 ? '+' : ''}${p.tzDst} DST` : ''})
              </button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
