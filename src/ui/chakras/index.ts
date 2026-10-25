// Chakras top tab: one SVG view per sub-tab (names as in src/ui/shell/tabs.ts SUB_TABS.Chakras).
//
// Every view takes ChakraViewProps:
//   chart:    the natal chart. A full core `Chart` (src/core/chart.ts) gives every body set;
//             the worker's `ChartResult` ({ positions, bodies }) also works, but bodies that need
//             `longitudes` (special lagnas, upagrahas, sphutas) or `day`/`birth` (weekday, sahamas)
//             are then left out.
//   transit?: optional second chart. JHora has NO transit overlay in these views: they draw the
//             bodies of whatever chart the document is showing (natal by default; a transit chart
//             after "View transits on this date", commands 32968/33020, which reuse the shared transit
//             date at 0x896720). Passing `transit` reproduces that state: bodies come from `transit`,
//             while base stars/signs and ring starts stay natal. Omit it for JHora's default view.
// Some views accept extra optional props (body-set `mode`, varga choices) - see each component.
//
// 'Many Vargas' is the chart view filling the window (ManyVargas.tsx; App passes it the chart spec too).
import type { ComponentType } from 'react';
import type { ChakraViewProps } from './common';
import { ManyVargasView } from './ManyVargas';
import { MixedVargasView } from './MixedVargas';
import { KalachakraView } from './Kalachakra';
import { SarvatobhadraView } from './Sarvatobhadra';
import { KotaChakraView } from './KotaChakra';
import { SuryaKalanalaView, ChandraKalanalaView } from './Kalanala';
import { SudarsanaView } from './Sudarsana';
import { ShoolaView } from './Shoola';
import { TripatakiView } from './Tripataki';

export type ChakraSubTab =
  | 'Many Vargas' | 'Mixed 2-Vargas' | 'Kalachakra' | 'Sarvatobhadra' | 'Kota Chakra' | 'Surya Kalanala'
  | 'Chandra Kalanala' | 'Sudarsana' | 'Shoola' | 'Tripataki';

export const CHAKRA_VIEWS: Record<ChakraSubTab, ComponentType<ChakraViewProps>> = {
  'Many Vargas': ManyVargasView,
  'Mixed 2-Vargas': MixedVargasView,
  Kalachakra: KalachakraView,
  Sarvatobhadra: SarvatobhadraView,
  'Kota Chakra': KotaChakraView,
  'Surya Kalanala': SuryaKalanalaView,
  'Chandra Kalanala': ChandraKalanalaView,
  Sudarsana: SudarsanaView,
  Shoola: ShoolaView,
  Tripataki: TripatakiView,
};

export type { ChakraViewProps } from './common';
export type { ChakraChart } from '../../core/chakras/common';
