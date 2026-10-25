// "Entry chart of this period" (dasa menus, command 32892, 0x4505b0): JHora casts the chart of the
// selected dasa period's start into doc+0x4f370 (name chart+0x1698 = the period's label, period
// length doc+0x61760 = end - start in days) and opens a CEntryChartView window (runtime class
// 0x54b320) on it: one chart (slot 14), right-click menu 138:
//   33076 / 33160  when will lagna / this planet change sign (FUN_004427a0)
//   32969 Planet longitudes            0x452980: a CEntryBasicInfoView window (Longitudes & Basic
//                                       Info of the entry chart)
//   32827 Show ashtakavarga            0x4529f0: a CEntryAshtakaVargaView window (DAT_00597fac =
//                                       the entry chart, varga DAT_00579a68)
//   32970 Compressed Patyayini dasa    0x452a80: a CEntryDasaView window, dasa type 0x41
//                                       (Patyayini) of the entry chart compressed into its period
//   33009 Bhava/Chalit chakra, the varga items, MKS, relationships, highlights, aspect table, copy
//   and view items as in menu 103.
// The dasa pane's "Entry chart of this period" opens it (DasasView.tsx). The Patyayini compression uses the mundane-chart rule (kind 5,
// DERIVED_KIND_CODE) - JHora's year definition for CEntryDasaView is not traced.
import { useMemo, useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { BirthData } from '../../core/jhd';
import { useJob } from '../EngineProvider';
import { ChartDiagram } from '../ChartDiagram';
import { useStore } from '../state/store';
import { DerivedDasaPane } from './DasasView';
import { DEFAULT_SLOT, slotChart, SlotBar, useSlotMenu, type SlotSettings, type SlotVarga } from './ChartPane';

export interface EntryChartProps {
  natalSpec: ChartSpec;
  /** birth record of the period's start */
  birth: BirthData;
  /** the period's label (the chart name) */
  label: string;
  /** period length in days (doc+0x61760) */
  periodDays: number;
  onClose: () => void;
}

export function EntryChartWindow({ natalSpec, birth, label, periodDays, onClose }: EntryChartProps) {
  const spec = useMemo<ChartSpec>(() => ({ ...natalSpec, birth }), [natalSpec, birth]);
  const chart = useJob({ kind: 'chart' as const, chart: spec });
  const style = useStore((s) => s.view.chartStyle);
  const [varga, setVarga] = useState<SlotVarga>('D1');
  const [settings, setSettings] = useState<SlotSettings>(DEFAULT_SLOT);
  const [patyayini, setPatyayini] = useState(false);
  const slot = useMemo(
    () => (chart.data ? slotChart(chart.data, spec.ini, varga, settings.view, label, { spec }) : null),
    [chart.data, spec, varga, settings.view, label],
  );
  const slots = useMemo(() => [slot], [slot]);
  const { onMenu, marks, overlay, note } = useSlotMenu(slots, spec, {
    menu: 'entry',
    setVarga: (_i, v) => setVarga(v),
    onPatyayini: () => setPatyayini(true),
  });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={label} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="note-bar"><strong>{label}</strong><button onClick={onClose}>Close</button></div>
        {overlay}
        <SlotBar label="Entry chart" slot={slot} settings={settings} onSettings={setSettings} varga={varga} onVarga={setVarga} style={style} hasDerived={false} />
        {slot
          ? <ChartDiagram style={style} signs={slot.signs} lagnaSign={slot.lagna} caption={slot.caption}
            highlights={marks[0]?.signs} bodyClasses={marks[0]?.bodyClasses} onMenu={onMenu(0)} />
          : <p className="status">Calculating…</p>}
        {note(0)}
        {patyayini && (
          <div className="chart-note">
            <div className="note-bar"><strong>Compressed Patyayini dasa</strong><button onClick={() => setPatyayini(false)}>Close</button></div>
            <DerivedDasaPane natalSpec={natalSpec} derived={{ kind: 'mundane', label, birth, params: { periodDays } }}
              choices={[['Patyayini dasa', 'dasas.other', 'Patyayini']]} />
          </div>
        )}
      </div>
    </div>
  );
}
