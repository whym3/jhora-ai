import { loadSweph, type FileFetcher, type Sweph } from '../sweph';
import starFile from './data/sefstars.txt?raw';
import { jhoraDeltaT } from './deltat';

/**
 * JHora 8.0 ships Swiss Ephemeris 2.02.01 (version string in swedll32.dll).
 * Swiss 2.10 can emulate that release's delta-T, precession and nutation
 * models, which keeps the Moon within ~0.05" of JHora for 19th-century dates.
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
