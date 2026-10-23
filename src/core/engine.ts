import { loadSweph, type FileFetcher, type Sweph } from '../sweph';

/**
 * JHora 8.0 ships Swiss Ephemeris 2.02.01 (version string in swedll32.dll).
 * Swiss 2.10 can emulate that release's delta-T, precession and nutation
 * models, which keeps the Moon within ~0.05" of JHora for 19th-century dates.
 */
export const JHORA_SWISS_MODELS = 'SE2.02.01';

export async function loadEngine(fetcher: FileFetcher): Promise<Sweph> {
  const swe = await loadSweph(fetcher);
  swe.setAstroModels(JHORA_SWISS_MODELS);
  return swe;
}
