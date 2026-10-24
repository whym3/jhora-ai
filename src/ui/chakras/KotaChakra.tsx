// Kota Chakra drawing in JHora's layout (FUN_00457b40): 9x9 grid, four nested
// zones, 28 stars from the natal Moon's star, Sun..Ketu in their stars, Kota
// Swami (left) and Kota Pala (right) above the grid.
import { kotaChakra, KOTA_BENEFIC, KOTA_SLOT_X, KOTA_SLOT_Y, KOTA_ZONE_LABEL_POS, KOTA_ZONE_LABELS } from '../../core/chakras/kota';
import { bodyClass, ChakraSvg, type ChakraViewProps } from './common';
import './kota.css';

const C = 60, TOP = 28, N = 9;

export function KotaChakraView({ chart, transit }: ChakraViewProps) {
  const k = kotaChakra(chart, transit);
  const W = C * N, H = TOP + C * N;
  return (
    <ChakraSvg w={W} h={H} title="Kota Chakra">
      <text x={4} y={18} className="ck-label">{k.swamiText}</text>
      <text x={W - 4} y={18} className="ck-label" textAnchor="end">{k.palaText}</text>
      <rect x={1} y={TOP + 1} width={W - 2} height={C * N - 2} className="kota-bahya" />
      <rect x={C} y={TOP + C} width={C * 7} height={C * 7} className="kota-praakaara" />
      <rect x={2 * C} y={TOP + 2 * C} width={C * 5} height={C * 5} className="kota-durgantara" />
      <rect x={3 * C} y={TOP + 3 * C} width={C * 3} height={C * 3} className="kota-stambha" />
      {KOTA_ZONE_LABEL_POS.map(([zone, col, row]) => (
        <text key={zone} x={col * C + C / 2} y={TOP + row * C + 11} textAnchor="middle" className="kota-area">
          <tspan x={col * C + C / 2}>{KOTA_ZONE_LABELS[zone][0]}</tspan>
          <tspan x={col * C + C / 2} dy={11}>{KOTA_ZONE_LABELS[zone][1]}</tspan>
        </text>
      ))}
      {k.stars.map((s) => (
        <g key={s.k}>
          <text x={s.col * C + C / 2} y={TOP + s.row * C + 12} textAnchor="middle" className={s.k === 0 ? 'ck-star ck-title' : 'ck-star'}>{s.label}</text>
          {s.bodies.map((b, n) => (
            <text key={`${b.index}-${n}`} x={s.col * C + (KOTA_SLOT_X[n % 6] * C) / 16} y={TOP + s.row * C + (KOTA_SLOT_Y[n % 6] * C) / 16 + 12}
              className={`${bodyClass(b)} ${KOTA_BENEFIC[b.index] ? 'kota-benefic' : 'kota-malefic'}`}>
              {b.retrograde ? `(${b.label})` : b.label}
            </text>
          ))}
        </g>
      ))}
    </ChakraSvg>
  );
}
