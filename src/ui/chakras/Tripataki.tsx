// Tripataki chakra in JHora's layout (FUN_00491150): 3x3 grid with vedha diagonals and
// three pennants, the 12 signs from the natal lagna's sign, bodies under their sign.
// See src/core/chakras/tripataki.ts.
import { useMemo } from 'react';
import { tripatakiChakra, type TripatakiMode } from '../../core/chakras/tripataki';
import { bodyClass, ChakraSvg, type ChakraViewProps } from './common';

const S = 5, TOP = 44, PAD = 4;
const X = (u: number) => PAD + u * S, Y = (u: number) => TOP + u * S;

export function TripatakiView({ chart, transit, mode = 'planets' }: ChakraViewProps & { mode?: TripatakiMode }) {
  const c = useMemo(() => tripatakiChakra(chart, { mode, current: transit ?? null }), [chart, transit, mode]);
  return (
    <ChakraSvg w={X(166)} h={Y(156)} title="Tripataki chakra">
      <text x={PAD} y={17} className="ck-title">{c.title}</text>
      {c.lines.map(([x1, y1, x2, y2], i) => <line key={i} x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} className={i < 6 || i >= 18 ? 'ck-strong' : 'ck-line'} />)}
      {c.slots.map((s) => (
        <text key={s.pos} x={X(s.x + 6)} y={Y(s.y) + 12} textAnchor="middle" className={s.pos === 0 ? 'ck-label' : 'ck-star'}>{s.label}</text>
      ))}
      {c.bodies.map((b, i) => (
        <text key={i} x={X(b.x)} y={Y(b.y) + 11} className={bodyClass(b.body)}>{b.text}</text>
      ))}
    </ChakraSvg>
  );
}
