// The dasa pane's session state, which JHora keeps in globals and does not write to jhora.ini:
//  - tribhagi: "Use Tribhagi variation" (menu 32971, DAT_008a4b60);
//  - nakVarga: the nakshatra dasas' divisional chart (dialog 2055, DAT_00597ed8);
//  - cycles: the dasa cycle shown per dasa slot (DAT_00597d30[slot], the `<` `|` `>` buttons);
//  - overrides: the temporary rasi dasa strengths of the Options dialogs, per chart (its birth
//    data, so editing it drops them as JHora recomputes the strengths) and dasa slot;
//  - shifts: "Shift dasa dates" (33196, DAT_008a1af0 / DAT_008a1898 per slot, cleared when a chart
//    is opened or recalculated): days, per chart and slot like the overrides;
//  - narayanaKind (dialog 2006, DAT_00597eec..ee), shoolaFromHouse (dialog 2007, DAT_00597ed0),
//    tithiSeed (dialog 2034, DAT_008a4b74 / 78, DAT_005922cc / d0), rbvVarga (dialog 2044,
//    DAT_008a4b90), rasiVarga (the varga picker of Drigdasa / Trikona / Chara (Parasara) / Yogardha,
//    DAT_008a4b94), charaSeed (dialog 2079, DAT_008a4c48): the Options dialogs' session globals.
import { useSyncExternalStore } from 'react';
import type { StrengthOverrides } from '../../core/dasas/overrides';
import type { NarayanaKind } from '../../core/dasas/narayana';
import type { TithiSeedOptions } from '../../core/dasas/tithiAshtottari';
import type { CharaSeed } from '../../core/dasas/charaParasara';

export interface DasaSession {
  tribhagi: boolean;
  nakVarga: number;
  cycles: Record<number, number>;
  overrides: Record<string, StrengthOverrides>;
  shifts: Record<string, number>;
  narayanaKind: NarayanaKind;
  shoolaFromHouse: number;
  tithiSeed: TithiSeedOptions;
  rbvVarga: number;
  rasiVarga: number;
  charaSeed: CharaSeed;
}

let session: DasaSession = { tribhagi: false, nakVarga: 0, cycles: {}, overrides: {}, shifts: {}, narayanaKind: 0, shoolaFromHouse: 0, tithiSeed: {}, rbvVarga: 0, rasiVarga: 0, charaSeed: 0 };
const listeners = new Set<() => void>();

export function getDasaSession(): DasaSession { return session; }
export function setDasaSession(patch: Partial<DasaSession> | ((s: DasaSession) => Partial<DasaSession>)) {
  session = { ...session, ...(typeof patch === 'function' ? patch(session) : patch) };
  for (const l of listeners) l();
}
export function useDasaSession(): DasaSession {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => session);
}

/** Key of the temporary strengths of one chart (its birth data) and dasa slot. */
export const overridesKey = (birth: unknown, slot: number) => `${JSON.stringify(birth)}#${slot}`;

export function setCycle(slot: number, cycle: number) {
  setDasaSession((s) => ({ cycles: { ...s.cycles, [slot]: cycle } }));
}
