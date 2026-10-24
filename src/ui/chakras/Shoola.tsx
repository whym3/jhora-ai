// Shoola chakra in JHora's layout (FUN_004785d0): a trident with the 28 stars from
// the natal Sun's star, bodies listed under their star. See src/core/chakras/shoola.ts.
import { useMemo } from 'react';
import { shoolaChakra, type StarChakraMode } from '../../core/chakras/shoola';
import { bodyClass, ChakraSvg, type ChakraViewProps } from './common';

const S = 5, TOP = 24;
const X = (u: number) => u * S, Y = (u: number) => TOP + u * S;

export function ShoolaView({ chart, transit, mode = 'planets' }: ChakraViewProps & { mode?: StarChakraMode }) {
  // JHora draws the document's current chart: the transit chart when one is shown, else the natal one.
  const c = useMemo(() => shoolaChakra(chart, { mode, current: transit ?? null }), [chart, transit, mode]);
  return (
    <ChakraSvg w={X(144)} h={Y(144) + 24} title="Shoola chakra">
      <text x={4} y={17} className="ck-title">{c.title}</text>
      {c.lines.map(([x1, y1, x2, y2], i) => <line key={i} x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} className="ck-strong" />)}
      {c.slots.map((s) => (
        <text key={s.pos} x={X(s.x + 6)} y={Y(s.y) + 12} textAnchor="middle" className={s.pos === 0 ? 'ck-label' : 'ck-star'}>{s.label}</text>
      ))}
      {c.bodies.map((b, i) => (
        <text key={i} x={X(b.x)} y={Y(b.y) + 11} className={bodyClass(b.body)}>{b.text}</text>
      ))}
    </ChakraSvg>
  );
}
