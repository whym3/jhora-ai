// Left pane: JHora shows the natal chart(s) here on every tab.
import { useMemo } from 'react';
import type { ChartResult } from '../../engine/protocol';
import { signsInVarga } from '../../core/chart';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../../core/vargas';
import { signOf } from '../../core/zodiac';
import { ChartDiagram } from '../ChartDiagram';
import { setView, useStore } from '../state/store';

export const VARGA_TITLES: Record<VargaName, string> = {
  D1: 'Rasi', D2: 'Hora', D3: 'Drekkana', D4: 'Chaturthamsa', D5: 'Panchamsa', D6: 'Shashthamsa',
  D7: 'Saptamsa', D8: 'Ashtamsa', D9: 'Navamsa', D10: 'Dasamsa', D11: 'Rudramsa', D12: 'Dwadasamsa',
  D16: 'Shodasamsa', D20: 'Vimsamsa', D24: 'Siddhamsa', D27: 'Nakshatramsa', D30: 'Trimsamsa',
  D40: 'Khavedamsa', D45: 'Akshavedamsa', D60: 'Shashtyamsa', D81: 'Nava-navamsa',
  D108: 'Ashtottaramsa', D144: 'Dwadasa-dwadasamsa',
};
const VARGA_NAMES = Object.keys(VARGA_TITLES) as VargaName[];
const dn = (v: VargaName) => v.replace('D', 'D-');

export function ChartPane({ chart }: { chart: ChartResult | null }) {
  const { leftVargas, chartStyle } = useStore((s) => s.view);
  const charts = useMemo(() => {
    if (!chart) return null;
    return leftVargas.map((v) => ({
      varga: v,
      signs: signsInVarga(chart, v),
      lagna: signOf(vargaLongitude(chart.positions.ascendant, ALL_VARGAS[v])),
    }));
  }, [chart, leftVargas]);

  return (
    <div className="chart-pane">
      {charts?.map((c, i) => (
        <div key={i} className="chart-slot">
          <ChartDiagram style={chartStyle} signs={c.signs} lagnaSign={c.lagna} title={VARGA_TITLES[c.varga]} subtitle={dn(c.varga)} />
          <select aria-label={`Chart ${i + 1} varga`} value={c.varga}
            onChange={(e) => setView({ leftVargas: leftVargas.map((x, j) => (j === i ? e.target.value : x)) as [VargaName, VargaName] })}>
            {VARGA_NAMES.map((v) => <option key={v} value={v}>{dn(v)} {VARGA_TITLES[v]}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
