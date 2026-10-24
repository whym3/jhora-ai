import { loadSweph, type FileFetcher, type Sweph } from '../sweph';
import starFile from './data/sefstars.txt?raw';
import { jhoraDeltaT } from './deltat';

/**
 * JHora 8.0 ships Swiss Ephemeris 2.02.01 (version string in swedll32.dll).
 * Swiss 2.10 emulates that release's precession and nutation models; its
 * delta-T is replaced by the DLL's own table (deltat.ts) and the Moon's frame
 * rotation by tools/sweph-patches, so positions match the DLL to ~1e-7".
 */
export const JHORA_SWISS_MODELS = 'SE2.02.01';

/** Star name of JHora's Spica record in our sefstars.txt (used for the ayanamsa). */
export const JHORA_SPICA = 'JHoraSpica';

export async function loadEngine(fetcher: FileFetcher): Promise<Sweph> {
  const swe = await loadSweph(fetcher);
  swe.setAstroModels(JHORA_SWISS_MODELS);
  // the DLL's own delta-T for every UT call: its sunrise (to the ms) and pre-1850 sidereal time depend on it
  swe.setDeltaTModel(jhoraDeltaT);
  swe.addFile('sefstars.txt', new TextEncoder().encode(starFile));
  return swe;
}
