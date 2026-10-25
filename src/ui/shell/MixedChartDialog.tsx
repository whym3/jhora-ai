// The "mixed chart" buttons of the derived-chart forms: "Show Mixed Tajaka-Natal Chart!" (dialog
// 2009, button 1012), "Mixed TP-Natal Chart" (dialogs 2012 and 2061, button 1019), "Show a BIG
// Mixed Progressed-Natal Chart!" (dialog 2014, button 1002) and "Show Mixed Transit-Natal Chart"
// (dialog 2025, button 1002).
//
// jhora.exe: all of them are one handler, 0x4853e0 = FUN_004ed190(DAT_00897d30): it opens a new
// window of the CMixedChartView template (runtime class 0x54ca58) on the document. Its
// OnInitialUpdate (0x45c6a0) draws the natal chart (doc+0x50, DAT_0065b8d4 = 1) inside and the
// chart on screen (doc+0x76d00, DAT_0065b8d8 = 0) outside, inner varga D-1 (DAT_00579a60 = 0)
// and outer varga D-1 (DAT_00579a64 = 0, D-9 only when the document shows the plain natal chart):
// i.e. the derived chart's D-1 around the natal D-1, captioned "Outer: <chart name>" (chart+0x1698,
// e.g. "Tajaka annual", "Transit") and "Inner: Natal Chart". The drawing is the Chakras > Mixed
// 2-Vargas one (src/ui/chakras/MixedVargas.tsx, core/chakras/mixedVargas.ts), here in a dialog.
// Dialog 2025 (CTransitChartFormView, 0x48a330) is never created by JHora 8.0 (its runtime class
// is only returned by GetRuntimeClass); the port puts its button on Basic Transit Results.
import { useState } from 'react';
import type { ChartSpec } from '../../engine/protocol';
import type { ChakraChart } from '../../core/chakras/common';
import { useJob } from '../EngineProvider';
import { MixedVargasView } from '../chakras/MixedVargas';

function MixedChartModal({ title, natalSpec, outerSpec, outerName, onClose }: {
  title: string; natalSpec: ChartSpec; outerSpec: ChartSpec | null; outerName: string; onClose: () => void;
}) {
  const natal = useJob({ kind: 'chart' as const, chart: natalSpec });
  // no derived chart on screen: the natal chart is also the outer one, natal D-9 outside
  const outer = useJob({ kind: 'chart' as const, chart: outerSpec ?? natalSpec });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
        <div className="note-bar"><strong>{title}</strong><button onClick={onClose}>Close</button></div>
        {natal.data && outer.data
          ? (outerSpec
            ? <MixedVargasView chart={natal.data as ChakraChart} transit={outer.data as ChakraChart} showTransit inner={0} outer={0} outerName={outerName} />
            : <MixedVargasView chart={natal.data as ChakraChart} inner={0} outer={1} />)
          : <p className="status">Calculating…</p>}
      </div>
    </div>
  );
}

/**
 * A form's mixed-chart button: the natal chart inside, `outerSpec`'s chart (named `outerName`)
 * outside; without a derived chart (`outerSpec` null) natal D-1 inside and natal D-9 outside.
 */
export function MixedChartButton({ label, natalSpec, outerSpec, outerName }: {
  label: string; natalSpec: ChartSpec; outerSpec: ChartSpec | null; outerName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>{label}</button>
      {open && <MixedChartModal title={label.replace(/!$/, '')} natalSpec={natalSpec} outerSpec={outerSpec} outerName={outerName} onClose={() => setOpen(false)} />}
    </>
  );
}
