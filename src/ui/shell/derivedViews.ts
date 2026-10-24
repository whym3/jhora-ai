// Form views of the derived-chart tabs, keyed by "<top tab>" or "<top tab>/<sub tab>".
// App.tsx renders DERIVED_VIEWS[key] with the natal spec, the document id and the spec of
// the chart currently shown (a derived chart replaces the natal one in every view).
import type { ComponentType } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import { TithiPraveshaView } from './TithiPraveshaView';
import { MundaneView } from './MundaneView';
import { AngularReturnView } from './AngularReturnView';
import { ProgressionsView } from './ProgressionsView';
import { PrasnaView } from './PrasnaView';
import { PanchangaView } from './PanchangaView';
import { LaghuParasariView } from './LaghuParasariView';

export interface DerivedViewProps { natalSpec: ChartSpec; docId: string; spec: ChartSpec }

export type DerivedViewKey =
  | 'Tithi Pravesha' | 'Mundane'
  | 'Miscellany/Angular Return' | 'Miscellany/Progressions' | 'Miscellany/Prasna (Horary)'
  | 'Miscellany/Panchanga' | 'Miscellany/Laghu Parasari';

export const DERIVED_VIEWS: Record<DerivedViewKey, ComponentType<DerivedViewProps>> = {
  'Tithi Pravesha': TithiPraveshaView,
  Mundane: MundaneView,
  'Miscellany/Angular Return': AngularReturnView,
  'Miscellany/Progressions': ProgressionsView,
  'Miscellany/Prasna (Horary)': PrasnaView,
  'Miscellany/Panchanga': PanchangaView,
  'Miscellany/Laghu Parasari': LaghuParasariView,
};
