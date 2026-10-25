// Kalachakra wheel in JHora's layout (FUN_004553c0): circle with 8 spokes,
// 28 stars from the natal Sun's star (East at the top, clockwise), the eight
// dikpalas, and the selected body set (default Planets: Sun..Ketu).
import { useState } from 'react';
import { kalachakraChakra, KC_SLOT_X, KC_SLOT_Y, type KalachakraMode, type KalachakraOptions } from '../../core/chakras/kalachakra';
import { StarChakraOptions } from './StarChakraOptions';
import { bodyClass, ChakraSvg, type ChakraViewProps } from './common';
import './kalachakra.css';

const S = 10, TOP = 24, BOX = 72 * S, CELL = BOX / 12;
const P = (u144: number) => (u144 * BOX) / 144;

const KC_MODES: KalachakraMode[] = ['planets', 'yogini', 'trisphuta', 'upagrahas', 'specialLagnas', 'sahamas'];

export function KalachakraView({ chart, transit, mode }: ChakraViewProps & { mode?: KalachakraMode }) {
  const [opts, setOpts] = useState<KalachakraOptions>({ mode });
  const kc = kalachakraChakra(chart, transit, opts);
  const cellW = kc.mode === 'sahamas' ? CELL * 1.5 : CELL;
  const lines: [number, number, number, number][] = [
    [20, 20, 55, 55], [89, 89, 124, 124], [124, 20, 89, 55], [20, 124, 55, 89],
    [0, 72, 48, 72], [96, 72, 144, 72], [72, 0, 72, 48], [72, 96, 72, 144],
  ];
  return (
    <div>
    <StarChakraOptions modes={KC_MODES} value={opts} onChange={setOpts} />
    <ChakraSvg w={BOX} h={TOP + BOX + 24} title="Kalachakra">
      <text x={4} y={17} className="ck-title">{kc.title}</text>
      <circle cx={P(72)} cy={TOP + P(72)} r={P(24)} className="kc-wheel" />
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={P(x1)} y1={TOP + P(y1)} x2={P(x2)} y2={TOP + P(y2)} className="ck-line" />
      ))}
      {kc.dikpalas.map((d) => {
        const x0 = d.x * S, w = 16 * S;
        const x = d.align === 'left' ? x0 : d.align === 'right' ? x0 + w : x0 + w / 2;
        const y = TOP + d.y * S + (d.above ? -24 : 0) + 16;
        return <text key={d.text} x={x} y={y} className="kc-dikpala" textAnchor={d.align === 'left' ? 'start' : d.align === 'right' ? 'end' : 'middle'}>{d.text}</text>;
      })}
      {kc.stars.map((s) => (
        <g key={s.k}>
          <text x={s.x * S + CELL / 2} y={TOP + s.y * S + 12} textAnchor="middle" className={s.k === 0 ? 'ck-star ck-title' : 'ck-star'}>{s.label}</text>
          {s.bodies.map((b, n) => (
            <text key={`${b.index}-${b.label}-${n}`} x={s.x * S + ((KC_SLOT_X[n % 8] + kc.slotShift.x) * cellW) / 16} y={TOP + s.y * S + ((KC_SLOT_Y[n % 8] + kc.slotShift.y) * CELL) / 16 + 11}
              className={bodyClass(b)}>
              {b.retrograde ? `(${b.label})` : b.label}
            </text>
          ))}
        </g>
      ))}
    </ChakraSvg>
    </div>
  );
}
