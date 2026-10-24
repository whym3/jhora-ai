// Left pane: JHora shows the natal chart(s) here on every tab.
import { useCallback, useMemo, useState } from 'react';
import type { ChartResult, ChartSpec } from '../../engine/protocol';
import { useJob } from '../EngineProvider';
import { TableView } from '../widgets/TableView';
import { signsInVarga } from '../../core/chart';
import { ALL_VARGAS, vargaLongitude, type VargaName } from '../../core/vargas';
import { signOf } from '../../core/zodiac';
import type { Graha } from '../../core/positions';
import { highlightSigns, maranaKarakaSthana, pachakadiOfPlanet, pachakadiOfRasi, RELATION_CODE_NAMES, relationCodes } from '../../core/chartMenu';
import { GRAHAS } from '../../core/positions';
import { SIGN_NAMES } from '../../core/zodiac';
import { ChartDiagram } from '../ChartDiagram';
import { setView, useStore } from '../state/store';
import { ChartMenu, type MenuAction, type MenuTarget } from './ChartMenu';

export const VARGA_TITLES: Record<VargaName, string> = {
  D1: 'Rasi', D2: 'Hora', D3: 'Drekkana', D4: 'Chaturthamsa', D5: 'Panchamsa', D6: 'Shashthamsa',
  D7: 'Saptamsa', D8: 'Ashtamsa', D9: 'Navamsa', D10: 'Dasamsa', D11: 'Rudramsa', D12: 'Dwadasamsa',
  D16: 'Shodasamsa', D20: 'Vimsamsa', D24: 'Siddhamsa', D27: 'Nakshatramsa', D30: 'Trimsamsa',
  D40: 'Khavedamsa', D45: 'Akshavedamsa', D60: 'Shashtyamsa', D81: 'Nava-navamsa',
  D108: 'Ashtottaramsa', D144: 'Dwadasa-dwadasamsa', D10xD9: 'D-9 of D-10', D0: 'Empty',
};
const VARGA_NAMES = Object.keys(VARGA_TITLES) as VargaName[];
const dn = (v: VargaName) => v.replace('D', 'D-');

/** What a right-click command left on one chart: highlights, coloured planets and/or a message. */
interface SlotMarks {
  signs: number[];
  bodyClasses?: Record<string, string>;
  caption?: string;
  rows?: [string, string][];
  lines?: string[];
  signChange?: { body: string; varga: VargaName };
}
const RELATION_TITLE = { permanent: 'Permanent', temporary: 'Temporary', compound: 'Compound' };

/** Result of "When will this planet change sign" (needs the ephemeris, so it runs in the worker). */
function SignChangeNote({ spec, body, varga }: { spec: ChartSpec; body: string; varga: VargaName }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'chart.signChange', params: { body, varga } });
  if (job.status === 'error') return <p className="error">{job.error}</p>;
  if (!job.data) return <p className="status">Searching…</p>;
  return <><strong>{job.data.caption}</strong><pre>{job.data.text?.join('\n')}</pre></>;
}

/** "Aspect table with relationships" (JHora opens it as a separate window). */
function AspectTableDialog({ spec, varga, onClose }: { spec: ChartSpec; varga: VargaName; onClose: () => void }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'aspects.table', params: { varga } });
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Aspect Table with Relationships" onClick={(e) => e.stopPropagation()}>
        <div className="note-bar"><strong>Aspect Table with Relationships</strong><button onClick={onClose}>Close</button></div>
        <TableView job={job} />
      </div>
    </div>
  );
}

export function ChartPane({ chart, spec }: { chart: ChartResult | null; spec: ChartSpec | null }) {
  const { leftVargas, chartStyle } = useStore((s) => s.view);
  const charts = useMemo(() => {
    if (!chart) return null;
    return leftVargas.map((v) => ({
      varga: v,
      signs: signsInVarga(chart, v),
      lagna: signOf(vargaLongitude(chart.positions.ascendant, ALL_VARGAS[v])),
    }));
  }, [chart, leftVargas]);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [marks, setMarks] = useState<Record<number, SlotMarks>>({});
  const closeMenu = useCallback(() => setMenu(null), []);
  const [aspectTable, setAspectTable] = useState<VargaName | null>(null);

  const onAction = (a: MenuAction) => {
    if (!menu || !charts) return;
    const slot = charts[menu.slot];
    if (a.kind === 'aspectTable') { setAspectTable(slot.varga); return; }
    const signOfBody = (g: Graha) => slot.signs.findIndex((list) => list.some((b) => b.id === g));
    const planet = menu.body && menu.body !== 'Lagna' ? (menu.body as Graha) : null;
    let m: SlotMarks = { signs: [] };
    if (a.kind === 'highlight') m = { signs: highlightSigns(a.what, signOfBody, planet, menu.sign) };
    else if (a.kind === 'relations' && planet) {
      const codes = relationCodes(a.what, planet, signOfBody);
      m = {
        signs: [],
        bodyClasses: Object.fromEntries(GRAHAS.map((g, k) => [g, `relbox${codes[k]}`])),
        caption: `${RELATION_TITLE[a.what]} relationships of ${planet} (${dn(slot.varga)})`,
        rows: GRAHAS.filter((g) => g !== planet).map((g) => [g, RELATION_CODE_NAMES[codes[GRAHAS.indexOf(g)]]]),
      };
    } else if (a.kind === 'pachakadiRasi') {
      m = { signs: [menu.sign], caption: `${SIGN_NAMES[menu.sign]}: Pachakadi Relationships`, lines: pachakadiOfRasi(menu.sign, signOfBody) };
    } else if (a.kind === 'pachakadiPlanet' && planet) {
      m = { signs: [], caption: `${planet}: Pachakadi Relationships`, lines: pachakadiOfPlanet(planet, menu.sign, signOfBody) };
    } else if (a.kind === 'mks') {
      m = { signs: [], caption: 'Planets in Marana Karaka Sthana', lines: maranaKarakaSthana(slot.lagna, signOfBody, dn(slot.varga)) };
    } else if (a.kind === 'signChange' && menu.body) {
      m = { signs: [], signChange: { body: menu.body, varga: slot.varga } };
    }
    setMarks((x) => ({ ...x, [menu.slot]: m }));
  };

  return (
    <div className="chart-pane">
      {menu && <ChartMenu target={menu} onAction={onAction} onClose={closeMenu} />}
      {aspectTable && spec && <AspectTableDialog spec={spec} varga={aspectTable} onClose={() => setAspectTable(null)} />}
      {charts?.map((c, i) => (
        <div key={i} className="chart-slot">
          <ChartDiagram style={chartStyle} signs={c.signs} lagnaSign={c.lagna} title={VARGA_TITLES[c.varga]} subtitle={dn(c.varga)}
            highlights={marks[i]?.signs} bodyClasses={marks[i]?.bodyClasses}
            onMenu={(e, sign, body) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, slot: i, sign, body }); }} />
          {(marks[i]?.caption || marks[i]?.signChange) && (
            <div className="chart-note">
              <div className="note-bar">
                <strong>{marks[i].caption}</strong>
                <button onClick={() => setMarks((x) => ({ ...x, [i]: { signs: [] } }))}>Close</button>
              </div>
              {marks[i].rows && <table><tbody>{marks[i].rows!.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table>}
              {marks[i].lines && <pre>{marks[i].lines!.join('\n')}</pre>}
              {marks[i].signChange && spec && <SignChangeNote spec={spec} body={marks[i].signChange!.body} varga={marks[i].signChange!.varga} />}
            </div>
          )}
          <select aria-label={`Chart ${i + 1} varga`} value={c.varga}
            onChange={(e) => setView({ leftVargas: leftVargas.map((x, j) => (j === i ? e.target.value : x)) as [VargaName, VargaName] })}>
            {VARGA_NAMES.map((v) => <option key={v} value={v}>{dn(v)} {VARGA_TITLES[v]}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
