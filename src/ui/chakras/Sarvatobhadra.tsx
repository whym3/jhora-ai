// Sarvatobhadra chakra drawing (JHora's CSarvatobhadraChakraView, OnDraw 0x471c20):
// 9x9 grid with North at the top, bodies in their star cells, and the special
// nakshatra table to the right. Clicking a cell selects it; the mode picks the
// context-menu command JHora would run (32961 / 32963 / 33253). The special-point
// commands of the same menu (32959..32967, 33022, 33023, 33243 with dialogs 2016-2019
// and 2058) fill boxes in the special-point colour (core/chakras/sarvatobhadra.ts).
import { useMemo, useState } from 'react';
import {
  grahaDrishtiOn, lattasOn, sarvatobhadra, sarvatobhadraVedhasFrom, sarvatobhadraVedhasOn,
  SBC_BODY_OFFSETS, SBC_HOUSE_REFS, SBC_PLANET_POINTS, SBC_SPECIAL_NAKSHATRAS, SBC_SPECIAL_TITHIS, SBC_TARAS, SBC_WEEKDAYS,
  sbcHouse, sbcKey, sbcPlanetNakshatra, sbcSpecialNakshatraFrom, sbcSpecialNakshatraNatal, sbcSpecialTithi, sbcStar27At,
  sbcTaraFrom, sbcTaraNatal, type SbcCell, type SbcCellRef, type SbcMark,
} from '../../core/chakras/sarvatobhadra';
import { vargaChart } from '../../core/chakras/common';
import { DEFAULTS } from '../../settings/generated';
import { ORDINAL } from '../../core/basics';
import { ChakraSvg, bodyClass, VARGA_OPTIONS, type ChakraViewProps } from './common';
import './sarvatobhadra.css';

const C = 52;           // cell size
const TX = 9 * C + 24;  // table x
const W = TX + 300, H = 9 * C + 4;

type Mode = 'from' | 'on' | 'drishti' | 'lattas' | 'all';
const MODES: [Mode, string][] = [
  ['from', 'Highlight aspects (vedhas) FROM this star'],
  ['on', 'Highlight aspects (vedhas) ON this box'],
  ['drishti', 'Highlight fixed graha drishti on this star'],
  ['lattas', 'Highlight lattas on this star'],
  ['all', 'Highlight vedhas, aspects and lattas on this star'],
];

/** Special-point commands of menu 152, in menu order. */
type SpecialCmd = 'nakNatal' | 'taraNatal' | 'tithi' | 'house' | 'planet' | 'set' | 'nakFrom' | 'taraFrom' | 'reset' | 'resetAll';
const SPECIAL_CMDS: [SpecialCmd, number, string][] = [
  ['nakNatal', 32964, 'Set a special nakshatra (natal) as a special point'],
  ['taraNatal', 32965, 'Set a natal tara as a special point (nava-tara scheme)'],
  ['tithi', 32966, 'Set a special tithi (natal) as a special point'],
  ['house', 32967, 'Set a house in natal chart as a special point'],
  ['planet', 33243, 'Set the natal nakshatra of a planet as a special point'],
  ['set', 32960, 'Set this box as a special point'],
  ['nakFrom', 33023, 'Set a special nakshatra from here as a special point'],
  ['taraFrom', 33022, 'Set a tara from here as a special point'],
  ['reset', 32962, 'Reset this special point box'],
  ['resetAll', 32959, 'Reset all special points'],
];
/** Commands enabled only on an outer, non-corner (star) box (0x473af0). */
const NEEDS_STAR = new Set<SpecialCmd>(['nakFrom', 'taraFrom']);
const NEEDS_BOX = new Set<SpecialCmd>(['set', 'reset', 'nakFrom', 'taraFrom']);
/** Commands whose dialog picks the natal varga (DAT_00884850). */
const PICKS_VARGA = new Set<SpecialCmd>(['nakNatal', 'taraNatal', 'tithi', 'house', 'planet']);

function CellText({ cell }: { cell: SbcCell }) {
  const x = cell.col * C, y = cell.row * C;
  switch (cell.kind) {
    case 'nakshatra':
      return <text x={x + C / 2} y={y + 12} textAnchor="middle" className="ck-star">{cell.label}</text>;
    case 'tithi':
      // JHora centres the group in the top half, the first weekday in [C/4, C], Tue/Wed in [5C/8, C]
      return (
        <>
          <text x={x + C / 2} y={y + C / 4 + 4} textAnchor="middle" className="sbc-tithi">{cell.label}</text>
          {cell.weekdays!.map((w, i) => (
            <text key={w} x={x + C / 2} y={y + (C * (i ? 13 : 10)) / 16 + 4} textAnchor="middle" className="sbc-vaara">{SBC_WEEKDAYS[w]}</text>
          ))}
        </>
      );
    default:
      return <text x={x + C / 2} y={y + C / 2 + 4} textAnchor="middle" className={`sbc-${cell.kind}`}>{cell.label}</text>;
  }
}

export function SarvatobhadraView({ chart, transit, spec }: ChakraViewProps) {
  // "Divisional chart used for transit positions" (33244)
  const [varga, setVarga] = useState(0);
  // the natal varga of the special-point dialogs (DAT_00884850; also the special-nakshatra table's)
  const [natalVarga, setNatalVarga] = useState(0);
  // the worker's chart carries no ini: the arudha / varga options come from the chart spec
  const natal = useMemo(() => (spec?.ini && !chart.ini ? { ...chart, ini: { ...DEFAULTS, ...spec.ini } } : chart), [chart, spec]);
  const sbc = useMemo(() => sarvatobhadra(natal, transit, varga, natalVarga), [natal, transit, varga, natalVarga]);
  const [sel, setSel] = useState<{ row: number; col: number } | null>(null);
  const [mode, setMode] = useState<Mode>('from');
  const cur = useMemo(() => vargaChart(transit ?? natal, varga), [natal, transit, varga]);
  // special points (view+0xd0), keyed row * 9 + col
  const [special, setSpecial] = useState<Set<number>>(() => new Set());
  const [cmd, setCmd] = useState<SpecialCmd>('nakNatal');
  const [choice, setChoice] = useState(0);
  const [ref, setRef] = useState(0);
  const [dlgVarga, setDlgVarga] = useState(0);

  const { marks, drishti, lattas } = useMemo(() => {
    if (!sel) return { marks: [] as SbcMark[], drishti: [] as number[], lattas: [] as number[] };
    if (mode === 'from') return { marks: sarvatobhadraVedhasFrom(sel.row, sel.col), drishti: [], lattas: [] };
    // 33249 / 33250 colour the bodies only (FUN_00474000 / FUN_00474270)
    if (mode === 'drishti') return { marks: [] as SbcMark[], drishti: grahaDrishtiOn(cur, sel.row, sel.col), lattas: [] };
    if (mode === 'lattas') return { marks: [] as SbcMark[], drishti: [], lattas: lattasOn(cur, sel.row, sel.col) };
    const marks = sarvatobhadraVedhasOn(sel.row, sel.col);
    if (mode === 'on') return { marks, drishti: [], lattas: [] };
    return { marks, drishti: grahaDrishtiOn(cur, sel.row, sel.col), lattas: lattasOn(cur, sel.row, sel.col) };
  }, [sel, mode, cur]);
  const stateOf = (r: number, c: number) => marks.find((m) => m.row === r && m.col === c)?.state ?? 0;

  const isStar = !!sel && sbcStar27At(sel.row, sel.col) !== null;
  const enabled = (NEEDS_BOX.has(cmd) ? !!sel : true) && (NEEDS_STAR.has(cmd) ? isStar : true);
  const choices: string[] | null = cmd === 'nakNatal' || cmd === 'nakFrom' ? SBC_SPECIAL_NAKSHATRAS.map(([n]) => n)
    : cmd === 'taraNatal' || cmd === 'taraFrom' ? SBC_TARAS
      : cmd === 'tithi' ? SBC_SPECIAL_TITHIS
        : cmd === 'house' ? ORDINAL
          : cmd === 'planet' ? SBC_PLANET_POINTS.map(([n]) => n) : null;
  const apply = () => {
    const add = (cells: SbcCellRef[]) => setSpecial((s) => new Set([...s, ...cells.map(sbcKey)]));
    const v = dlgVarga;
    switch (cmd) {
      case 'resetAll': setSpecial(new Set()); setSel(null); return;
      case 'set': if (sel) add([sel]); return;
      case 'reset': if (sel) setSpecial((s) => { const n = new Set(s); n.delete(sbcKey(sel)); return n; }); return;
      case 'nakNatal': add(sbcSpecialNakshatraNatal(natal, choice, v)); break;
      case 'taraNatal': add(sbcTaraNatal(natal, choice, v)); break;
      case 'tithi': add(sbcSpecialTithi(natal, choice, v)); break;
      case 'house': add(sbcHouse(natal, choice, ref, v)); break;
      case 'planet': add(sbcPlanetNakshatra(natal, choice, v)); break;
      // 33023 / 33022 count from the box; 33022 takes the Moon's pada before its dialog
      case 'nakFrom': if (sel) add(sbcSpecialNakshatraFrom(sel.row, sel.col, choice)); return;
      case 'taraFrom': if (sel) add(sbcTaraFrom(natal, sel.row, sel.col, choice, natalVarga)); return;
    }
    // the dialogs keep their varga as the natal varga
    setNatalVarga(v);
  };

  return (
    <div>
      <div className="sbc-bar">
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Highlight mode">
          {MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        <select value={varga} onChange={(e) => setVarga(Number(e.target.value))} aria-label="Divisional chart used for transit positions">
          {VARGA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {sel && <button onClick={() => setSel(null)}>Clear</button>}
        <span className="note">{sbc.transit ? 'Transit planets' : 'Natal planets'} · click a box</span>
      </div>
      <div className="sbc-bar">
        <select value={cmd} onChange={(e) => { setCmd(e.target.value as SpecialCmd); setChoice(0); }} aria-label="Special point command">
          {SPECIAL_CMDS.map(([c, , l]) => <option key={c} value={c}>{l}</option>)}
        </select>
        {choices && (
          <select value={choice} onChange={(e) => setChoice(Number(e.target.value))} aria-label="Special point choice">
            {choices.map((l, i) => <option key={l} value={i}>{l}</option>)}
          </select>
        )}
        {cmd === 'house' && (
          <label>from{' '}
            <select value={ref} onChange={(e) => setRef(Number(e.target.value))} aria-label="House reference">
              {SBC_HOUSE_REFS.map(([l], i) => <option key={l} value={i}>{l}</option>)}
            </select>
          </label>
        )}
        {PICKS_VARGA.has(cmd) && (
          <label>in the divisional chart{' '}
            <select value={dlgVarga} onChange={(e) => setDlgVarga(Number(e.target.value))} aria-label="Natal divisional chart">
              {VARGA_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        <button onClick={apply} disabled={!enabled}>Apply</button>
        <span className="note">{special.size ? `${special.size} special point${special.size > 1 ? 's' : ''}` : ''}</span>
      </div>
      <ChakraSvg w={W} h={H} title="Sarvatobhadra chakra">
        <g transform="translate(2 2)">
          {sbc.cells.map((cell) => {
            const st = stateOf(cell.row, cell.col);
            const x = cell.col * C, y = cell.row * C;
            const sp = special.has(cell.row * 9 + cell.col);
            return (
              <g key={`${cell.row}-${cell.col}`}>
                <rect x={x} y={y} width={C} height={C} className={`ck-frame${st === 1 ? ' sbc-from' : st === 2 ? ' sbc-to' : ''}`} />
                {/* special point: the whole box, or a 1/8-box inset when it is highlighted too (0x471dec) */}
                {sp && (st === 0
                  ? <rect x={x} y={y} width={C} height={C} className="sbc-special" />
                  : <rect x={x + C / 8} y={y + C / 8} width={(C * 3) / 4} height={(C * 3) / 4} className="sbc-special" />)}
                <CellText cell={cell} />
                {cell.bodies.map((b, n) => {
                  const [ox, oy] = SBC_BODY_OFFSETS[n % 6];
                  const extra = drishti.includes(b.index) ? ' sbc-drishti' : lattas.includes(b.index) ? ' sbc-latta' : '';
                  return (
                    <text key={`${b.index}-${n}`} x={x + (ox * C) / 16} y={y + (oy * C) / 16 + 6} className={bodyClass(b) + extra}>
                      {b.retrograde ? `(${b.label})` : b.label}
                    </text>
                  );
                })}
                <rect x={x} y={y} width={C} height={C} className="sbc-hit" onClick={() => setSel({ row: cell.row, col: cell.col })} />
              </g>
            );
          })}
          <rect x={0} y={0} width={9 * C} height={9 * C} className="ck-strong" />
          <text x={TX} y={70} className="sbc-th">Nakshatra</text>
          <text x={TX + 120} y={70} className="sbc-th">From Moon</text>
          <text x={TX + 210} y={70} className="sbc-th">From Lagna</text>
          {sbc.special.map((s, i) => (
            <g key={s.name}>
              <text x={TX} y={110 + i * 30} className="sbc-td sbc-name">{s.name}</text>
              <text x={TX + 120} y={110 + i * 30} className="sbc-td">{s.fromMoon}</text>
              <text x={TX + 210} y={110 + i * 30} className="sbc-td">{s.fromLagna}</text>
            </g>
          ))}
        </g>
      </ChakraSvg>
    </div>
  );
}
