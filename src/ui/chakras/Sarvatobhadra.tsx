// Sarvatobhadra chakra drawing (JHora's CSarvatobhadraChakraView, OnDraw 0x471c20):
// 9x9 grid with North at the top, bodies in their star cells, and the special
// nakshatra table to the right. Clicking a cell selects it; the mode picks the
// context-menu command JHora would run (32961 / 32963 / 33253).
import { useMemo, useState } from 'react';
import {
  grahaDrishtiOn, lattasOn, sarvatobhadra, sarvatobhadraVedhasFrom, sarvatobhadraVedhasOn,
  SBC_BODY_OFFSETS, SBC_WEEKDAYS, type SbcCell, type SbcMark,
} from '../../core/chakras/sarvatobhadra';
import { ChakraSvg, bodyClass, type ChakraViewProps } from './common';
import './sarvatobhadra.css';

const C = 52;           // cell size
const TX = 9 * C + 24;  // table x
const W = TX + 300, H = 9 * C + 4;

type Mode = 'from' | 'on' | 'all';
const MODES: [Mode, string][] = [
  ['from', 'Highlight aspects (vedhas) FROM this star'],
  ['on', 'Highlight aspects (vedhas) ON this box'],
  ['all', 'Highlight vedhas, aspects and lattas on this star'],
];

function CellText({ cell }: { cell: SbcCell }) {
  const x = cell.col * C, y = cell.row * C;
  switch (cell.kind) {
    case 'nakshatra':
      return <text x={x + C / 2} y={y + 12} textAnchor="middle" className="ck-star">{cell.label}</text>;
    case 'tithi':
      return (
        <>
          <text x={x + C / 2} y={y + 14} textAnchor="middle" className="sbc-tithi">{cell.label}</text>
          {cell.weekdays!.map((w, i) => (
            <text key={w} x={x + C / 2} y={y + 30 + i * 13} textAnchor="middle" className="sbc-vaara">{SBC_WEEKDAYS[w]}</text>
          ))}
        </>
      );
    default:
      return <text x={x + C / 2} y={y + C / 2 + 4} textAnchor="middle" className={`sbc-${cell.kind}`}>{cell.label}</text>;
  }
}

export function SarvatobhadraView({ chart, transit }: ChakraViewProps) {
  const sbc = useMemo(() => sarvatobhadra(chart, transit), [chart, transit]);
  const [sel, setSel] = useState<{ row: number; col: number } | null>(null);
  const [mode, setMode] = useState<Mode>('from');
  const cur = transit ?? chart;

  const { marks, drishti, lattas } = useMemo(() => {
    if (!sel) return { marks: [] as SbcMark[], drishti: [] as number[], lattas: [] as number[] };
    if (mode === 'from') return { marks: sarvatobhadraVedhasFrom(sel.row, sel.col), drishti: [], lattas: [] };
    const marks = sarvatobhadraVedhasOn(sel.row, sel.col);
    if (mode === 'on') return { marks, drishti: [], lattas: [] };
    return { marks, drishti: grahaDrishtiOn(cur, sel.row, sel.col), lattas: lattasOn(cur, sel.row, sel.col) };
  }, [sel, mode, cur]);
  const stateOf = (r: number, c: number) => marks.find((m) => m.row === r && m.col === c)?.state ?? 0;

  return (
    <div>
      <div className="sbc-bar">
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="Highlight mode">
          {MODES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
        </select>
        {sel && <button onClick={() => setSel(null)}>Clear</button>}
        <span className="note">{sbc.transit ? 'Transit planets' : 'Natal planets'} · click a box</span>
      </div>
      <ChakraSvg w={W} h={H} title="Sarvatobhadra chakra">
        <g transform="translate(2 2)">
          {sbc.cells.map((cell) => {
            const st = stateOf(cell.row, cell.col);
            const x = cell.col * C, y = cell.row * C;
            return (
              <g key={`${cell.row}-${cell.col}`}>
                <rect x={x} y={y} width={C} height={C} className={`ck-frame${st === 1 ? ' sbc-from' : st === 2 ? ' sbc-to' : ''}`} />
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
              <text x={TX} y={110 + i * 30} className="sbc-td">{s.name}</text>
              <text x={TX + 120} y={110 + i * 30} className="sbc-td">{s.fromMoon}</text>
              <text x={TX + 210} y={110 + i * 30} className="sbc-td">{s.fromLagna}</text>
            </g>
          ))}
        </g>
      </ChakraSvg>
    </div>
  );
}
