// Karaka dasa slots (FUN_004a4c30) with CharaKarakaDefinition 3: a tie of whole degrees
// switches to 8 karakas with Rahu inserted and natural karakas substituted.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nodeSweph } from './helpers';
import { parseJhd } from '../src/core/jhd';
import { computeChart } from '../src/core/chart';
import { karakaDasa, karakaSlots } from '../src/core/dasas/karaka';

describe('Karaka dasa, CharaKarakaDefinition 3 (FUN_004a4c30 / FUN_004139a0)', async () => {
  const swe = await nodeSweph();
  const birth = parseJhd(readFileSync('golden/charts/Mahatma Gandhi.jhd', 'latin1'));
  // Sun Ar 25.3, Moon Ta 20.1, Mars Ge 20.7, Mercury Cn 15, Jupiter Le 12, Venus Vi 5, Saturn Li 2, Rahu Pi 10 (20 from the end)
  const grahas = { Sun: 25.3, Moon: 50.1, Mars: 80.7, Mercury: 105, Jupiter: 132, Venus: 155, Saturn: 182, Rahu: 340, Ketu: 160 };
  const tied = { ...birth, legacy: null, override: { ascendant: 5, grahas } };

  it('a whole-degree tie (Mars 20.7 / Moon 20.1) gives 8 karakas with natural substitutes', async () => {
    const c = await computeChart(swe, tied, { CharaKarakaDefinition: 3 });
    const k = karakaSlots(c);
    expect(k.scheme).toBe(8);
    // sorted Su Ma Mo Me Ju Ve Sa, Rahu (20.0) before Mercury; k=0: Mo/Ma tie -> AmK Mercury, Ma down;
    // k=1: Rahu 20.0 / Ma 20.7 tie -> BK Mars, Ma down to MK
    expect(k.slots).toEqual([1, 4, 3, 3, 4, 5, 6, 7]);
    const d = karakaDasa(c, 1);
    expect(d.length).toBe(16);
    expect(d.slice(0, 8).map((p) => p.label)).toEqual(['AK Su', 'AmK Me', 'BK Ma', 'MK Ma', 'PiK Me', 'PK Ju', 'GK Ve', 'DK Sa']);
  });

  it('without a tie definition 3 fills the slots as definition 2 (7 karakas, PiK the fifth)', async () => {
    const c3 = await computeChart(swe, { ...tied, override: { ascendant: 5, grahas: { ...grahas, Moon: 49.1 } } }, { CharaKarakaDefinition: 3 });
    const c2 = await computeChart(swe, { ...tied, override: { ascendant: 5, grahas: { ...grahas, Moon: 49.1 } } }, { CharaKarakaDefinition: 2 });
    expect(karakaSlots(c3)).toEqual(karakaSlots(c2));
    expect(karakaSlots(c3).scheme).toBe(7);
    expect(karakaDasa(c3, 2)).toEqual(karakaDasa(c2, 2));
  });

  it('definition 0 is the 8-karaka order with Rahu counted from the end of its sign', async () => {
    const c = await computeChart(swe, tied, {});
    expect(karakaSlots(c)).toEqual({ scheme: 8, slots: [1, 3, 2, 8, 4, 5, 6, 7] });
  });
});
