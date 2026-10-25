// Menu 152 of the star/sign chakras (Kalachakra, Surya/Chandra Kalanala, Shoola, Tripataki) as
// compact controls: "Show Planets / Yogini and Mrityu / Trisphuta etc / Upagrahas / Special
// Lagnas / Sahamas" (33091, 33094, 33092, 33095, 33096, 33093), "Base planet and division"
// (33255: base body + its varga), "Divisional chart to be used for planets" (33254) and "Fully
// customize base nakshatra" (33126; Tripataki: a fixed base sign).
import { BASE_BODY_OPTIONS, BASE_SIGN_OPTIONS, BASE_STAR_OPTIONS, BODY_SET_LABELS, OptionBar, VARGA_OPTIONS, type OptionField } from './common';

export interface StarChakraOptionValues<M> {
  mode?: M;
  baseBody?: number;
  baseVargaIndex?: number;
  vargaIndex?: number;
  baseStar?: number;
  fixedBaseStar?: number;
  fixedBaseSign?: number;
}

export function StarChakraOptions<M extends string | number, V extends StarChakraOptionValues<M>>({
  modes, labels = BODY_SET_LABELS, value, onChange, defaultMode, baseKey = 'baseStar', defaultBaseBody = 1,
}: {
  /** the body sets, in menu order */
  modes: readonly M[];
  labels?: readonly string[];
  value: V;
  onChange: (v: V) => void;
  defaultMode?: M;
  /** option holding the custom base (star, or sign for Tripataki) */
  baseKey?: 'baseStar' | 'fixedBaseStar' | 'fixedBaseSign';
  defaultBaseBody?: number;
}) {
  const set = (patch: Partial<V>) => onChange({ ...value, ...patch });
  const base = value[baseKey];
  const fields = [
    { label: 'Show', value: value.mode ?? defaultMode ?? modes[0], options: modes.map((m, i) => [m, labels[i]] as const), onChange: (m: M) => set({ mode: m } as Partial<V>) },
    { label: 'Base planet', value: value.baseBody ?? defaultBaseBody, options: BASE_BODY_OPTIONS, onChange: (b: number) => set({ baseBody: b } as Partial<V>) },
    { label: 'in', value: value.baseVargaIndex ?? 0, options: VARGA_OPTIONS, onChange: (v: number) => set({ baseVargaIndex: v } as Partial<V>) },
    { label: 'Planets in', value: value.vargaIndex ?? 0, options: VARGA_OPTIONS, onChange: (v: number) => set({ vargaIndex: v } as Partial<V>) },
    {
      label: baseKey === 'fixedBaseSign' ? 'Base sign' : 'Base nakshatra', value: base ?? -1,
      options: baseKey === 'fixedBaseSign' ? BASE_SIGN_OPTIONS : BASE_STAR_OPTIONS,
      onChange: (s: number) => set({ [baseKey]: s < 0 ? undefined : s } as Partial<V>),
    },
  ] as OptionField[];
  return <OptionBar fields={fields} />;
}
