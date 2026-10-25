// The dasa pane's session state, which JHora keeps in globals and does not write to jhora.ini:
//  - tribhagi: "Use Tribhagi variation" (menu 32971, DAT_008a4b60);
//  - nakVarga: the nakshatra dasas' divisional chart (dialog 2055, DAT_00597ed8);
//  - cycles: the dasa cycle shown per dasa slot (DAT_00597d30[slot], the `<` `|` `>` buttons);
//  - overrides: the temporary rasi dasa strengths of the Options dialogs, per chart (its birth
//    data, so editing it drops them as JHora recomputes the strengths) and dasa slot.
import { useSyncExternalStore } from 'react';
import type { StrengthOverrides } from '../../core/dasas/overrides';

export interface DasaSession {
  tribhagi: boolean;
  nakVarga: number;
  cycles: Record<number, number>;
  overrides: Record<string, StrengthOverrides>;
}

let session: DasaSession = { tribhagi: false, nakVarga: 0, cycles: {}, overrides: {} };
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
