// Surya Kalanala (CSKChakraView) and Chandra Kalanala (CCKChakraView) drawings.
// Layout follows jhora.exe: a 144-unit box scaled to a W x H area with a 24 px
// heading band ("Planets:") above and 24 px below: H = side - 48; W = 7/6 side for
// Surya (layout 0x47a650), W = side for Chandra (layout 0x478210).
import { chandraKalanala, suryaKalanala, type Kalanala, type KalanalaOptions } from '../../core/chakras/kalanala';
import { NAK28 } from '../../core/chakras/common';
import { bodyClass, ChakraSvg, type ChakraViewProps } from './common';
import './kalanala.css';

const H = 432, TOP = 24, PAD = 8;

function KalanalaSvg({ k, name }: { k: Kalanala; name: string }) {
  const W = k.kind === 'surya' ? 560 : 480;
  const X = (u: number) => PAD + (u * W) / 144;
  const Y = (u: number) => TOP + (u * H) / 144;
  return (
    <ChakraSvg w={W + 2 * PAD} h={TOP + H + 24} title={name}>
      <rect x={0} y={0} width={W + 2 * PAD} height={TOP + H + 24} className="ck-frame" />
      <text x={PAD} y={17} className="ck-title">{k.title}</text>
      <text x={W + PAD} y={17} textAnchor="end" className="ck-small">{name} · base {NAK28[k.baseStar]}</text>
      {k.ellipse && (
        <ellipse cx={(X(k.ellipse.x0) + X(k.ellipse.x1)) / 2} cy={(Y(k.ellipse.y0) + Y(k.ellipse.y1)) / 2}
          rx={(X(k.ellipse.x1) - X(k.ellipse.x0)) / 2} ry={(Y(k.ellipse.y1) - Y(k.ellipse.y0)) / 2} className="ck-strong" />
      )}
      {k.lines.map(([x0, y0, x1, y1], i) => <line key={i} x1={X(x0)} y1={Y(y0)} x2={X(x1)} y2={Y(y1)} className="ck-strong" />)}
      {k.slots.map((s) => (
        <g key={s.pos}>
          {s.pos === 0 && <rect x={X(s.x) - 2} y={Y(s.y) - 1} width={(12 * W) / 144 + 4} height={15} rx={3} className="kl-base" />}
          <text x={X(s.x + 6)} y={Y(s.y) + 11} textAnchor="middle" className="kl-star">{NAK28[s.star]}</text>
          {s.labels.map((l, i) => (
            <text key={i} x={X(l.x)} y={Y(l.y) + 10} className={`${bodyClass(l.body)} kl-body`}>{l.text}</text>
          ))}
        </g>
      ))}
    </ChakraSvg>
  );
}

export interface KalanalaViewProps extends ChakraViewProps {
  /** JHora menu 152 options (body set, custom base star ...); defaults match JHora's */
  options?: Omit<KalanalaOptions, 'transit'>;
}

/** Chakras > Surya Kalanala. Bodies from `transit` when given (JHora shows the displayed chart's bodies). */
export function SuryaKalanalaView({ chart, transit, options }: KalanalaViewProps) {
  return <KalanalaSvg k={suryaKalanala(chart, { ...options, transit })} name="Surya Kalanala" />;
}

/** Chakras > Chandra Kalanala. */
export function ChandraKalanalaView({ chart, transit, options }: KalanalaViewProps) {
  return <KalanalaSvg k={chandraKalanala(chart, { ...options, transit })} name="Chandra Kalanala" />;
}
