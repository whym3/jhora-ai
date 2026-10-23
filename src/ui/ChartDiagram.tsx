// South Indian (fixed signs) and North Indian (fixed houses) chart diagrams as SVG.
import type { ChartBody } from '../core/chart';
import { SIGNS } from '../core/zodiac';

export type ChartStyle = 'south' | 'north';

interface Props {
  signs: ChartBody[][];       // bodies per sign, index 0 = Aries
  lagnaSign: number;
  title: string;
  subtitle?: string;
  style: ChartStyle;
}

const SIZE = 360;

function BodyList({ bodies, x, y, w }: { bodies: ChartBody[]; x: number; y: number; w: number }) {
  const perRow = Math.max(1, Math.floor(w / 30));
  return (
    <>
      {bodies.map((b, i) => (
        <text key={b.id} x={x + (i % perRow) * 30} y={y + Math.floor(i / perRow) * 20}
          className={b.id === 'Lagna' ? 'body lagna' : 'body'} textAnchor="middle">
          {b.label}{b.retrograde ? <tspan className="retro">R</tspan> : null}
        </text>
      ))}
    </>
  );
}

// South Indian layout: Pisces top-left, signs run clockwise.
const SOUTH_CELLS: [number, number][] = [
  [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0],
];

function South({ signs, lagnaSign, title, subtitle }: Props) {
  const c = SIZE / 4;
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="chart" role="img" aria-label={`${title} chart`}>
      {SOUTH_CELLS.map(([col, row], sign) => (
        <g key={sign}>
          <rect x={col * c} y={row * c} width={c} height={c} className={sign === lagnaSign ? 'cell lagna-cell' : 'cell'} />
          <text x={col * c + c - 4} y={row * c + c - 5} className="sign-label" textAnchor="end">{SIGNS[sign]}</text>
          {sign === lagnaSign && <line x1={col * c} y1={row * c + 14} x2={col * c + 14} y2={row * c} className="lagna-mark" />}
          <BodyList bodies={signs[sign]} x={col * c + 18} y={row * c + 26} w={c - 10} />
        </g>
      ))}
      <rect x={c} y={c} width={2 * c} height={2 * c} className="center" />
      <text x={SIZE / 2} y={SIZE / 2 - 6} textAnchor="middle" className="chart-title">{title}</text>
      {subtitle && <text x={SIZE / 2} y={SIZE / 2 + 16} textAnchor="middle" className="chart-subtitle">{subtitle}</text>}
    </svg>
  );
}

// North Indian layout: houses fixed, house 1 at top centre, counted anticlockwise.
// Anchor points (as fractions of the square) for each house's contents.
const NORTH_ANCHORS: [number, number][] = [
  [0.5, 0.25], [0.25, 0.1], [0.1, 0.25], [0.25, 0.5], [0.1, 0.75], [0.25, 0.9],
  [0.5, 0.75], [0.75, 0.9], [0.9, 0.75], [0.75, 0.5], [0.9, 0.25], [0.75, 0.1],
];
const NORTH_SIGN_POS: [number, number][] = [
  [0.5, 0.43], [0.25, 0.2], [0.2, 0.25], [0.43, 0.5], [0.2, 0.75], [0.25, 0.8],
  [0.5, 0.57], [0.75, 0.8], [0.8, 0.75], [0.57, 0.5], [0.8, 0.25], [0.75, 0.2],
];

function North({ signs, lagnaSign, title, subtitle }: Props) {
  const s = SIZE;
  return (
    <svg viewBox={`0 0 ${s} ${s}`} className="chart" role="img" aria-label={`${title} chart`}>
      <rect x={0} y={0} width={s} height={s} className="cell" />
      <path d={`M0 0 L${s} ${s} M${s} 0 L0 ${s} M${s / 2} 0 L${s} ${s / 2} L${s / 2} ${s} L0 ${s / 2} Z`} className="north-lines" />
      {NORTH_ANCHORS.map(([ax, ay], house) => {
        const sign = (lagnaSign + house) % 12;
        const [sx, sy] = NORTH_SIGN_POS[house];
        return (
          <g key={house}>
            <text x={sx * s} y={sy * s + 4} className="sign-number" textAnchor="middle">{sign + 1}</text>
            <BodyList bodies={signs[sign]} x={ax * s - 15} y={ay * s - 4} w={70} />
          </g>
        );
      })}
      <text x={s / 2} y={s - 8} textAnchor="middle" className="chart-subtitle">{title}{subtitle ? ` · ${subtitle}` : ''}</text>
    </svg>
  );
}

export function ChartDiagram(props: Props) {
  return props.style === 'south' ? <South {...props} /> : <North {...props} />;
}
