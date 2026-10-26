// Mixed 2-Vargas drawing (CMixedChartView, South Indian style FUN_0045d1e0):
// one 4x4 South Indian frame; the band outside the inner separator square
// (inset half a cell) carries the outer varga's bodies, the half of every sign
// box facing the centre carries the inner varga's. Centre: "Outer: ..." and
// "Inner: ..." captions with the varga names. Like JHora, no sign names.
//
// Charts (DAT_0065b8d4 / DAT_0065b8d8): the inner one is the natal chart (doc+0x50), the outer
// one the chart on screen (doc+0x76d00): with a derived chart shown (Tajaka, TP, progression,
// transit, ...) that chart is drawn outside, D-1 in both halves (OnInitialUpdate 0x45c6a0: outer
// varga D-9 only for a plain natal chart; the derived-chart setups 0x422040 / 0x470fd0 and the
// "Mixed ... Chart" buttons, handler 0x4853e0, do the same), captioned "Outer: <chart name>".
//
// Right-click: menu 153 (context menu 0x45c8d0, see core/chakras/mixedVargas.ts): the half is
// the inner one inside the separator square, else the outer one (slots 12 / 13); the commands
// are CChartView's on that half (ChartPane.tsx useSlotMenu, ChartMenu.tsx MENU_153): its varga
// (Bhava/Chalit = varga 28 included), body view, display mode (Automatic = the chart on screen,
// Natal chart only), the timing / ashtakavarga / MKS / relationship / highlight commands and the
// text copies. The views and the optional bodies change the drawn bodies (chartSigns).
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { ChakraChart } from '../../core/chakras/common';
import { useJob } from '../EngineProvider';
import { useActiveDoc } from '../state/store';
import type { ChartSpec } from '../../engine/protocol';
import type { ChakraBody } from '../../core/chakras/common';
import { MIXED_BHAVA_VARGA, mixedSlots, mixedVargas, NATAL_CHART_NAME } from '../../core/chakras/mixedVargas';
import type { ChartView } from '../../core/chartBodies';
import { bhavaSigns, needsCusps } from '../../core/bhavaChart';
import { GRAHAS } from '../../core/positions';
import { DEFAULTS, type JhoraIni } from '../../settings/generated';
import { displayIndexOf, slotChart, slotVargaOf, useSlotMenu } from '../shell/ChartPane';
import { BODY_NAMES } from '../shell/ChartMenu';
import { bodyClass, ChakraSvg, OptionBar, VARGA_OPTIONS, type ChakraViewProps } from './common';
import './mixed.css';

const SIZE = 480, CELL = SIZE / 4, Q = CELL / 4, HALF = CELL / 2;
// South Indian cell (col, row) per sign, Aries first (Pisces top-left)
const CELLS: [number, number][] = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]];
// quarter-cell offsets of the two half-size sub-boxes (FUN_0045d1e0 tables)
const INNER_X = [1, 1, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2], INNER_Y = [2, 2, 2, 1, 1, 0, 0, 0, 0, 1, 1, 2];
const OUTER_X = [1, 1, 2, 2, 2, 2, 1, 1, 0, 0, 0, 0], OUTER_Y = [0, 0, 0, 1, 1, 2, 2, 2, 2, 1, 1, 0];
/** The varga pickers: D-1 .. D-144 and the Bhava/Chalit chakra (33009). */
const MIXED_VARGA_OPTIONS: [number, string][] = [...VARGA_OPTIONS, [MIXED_BHAVA_VARGA, 'Bhava/Chalit chakra']];
const HALF_NAMES = ['Inner', 'Outer'];

/** JHora's colour groups: special lagnas, upagrahas, AL, the other arudhas (the rest use bodyClass). */
const kindClass = (i: number) =>
  i >= 13 && i <= 20 ? ' mixed-special' : i >= 21 && i <= 32 ? ' mixed-upagraha' : i === 59 ? ' mixed-al' : i > 59 ? ' mixed-arudha' : '';

/**
 * The body a label stands for in the menu's hit test and the relationship colours: Lagna..Ketu,
 * and graha arudha 83+j as planet 1+j (FUN_0045d1e0 stores its rect in planet 1+j's slot).
 */
const hitBody = (i: number): string | null => (i <= 9 ? BODY_NAMES[i] : i >= 83 && i <= 91 ? GRAHAS[i - 83] : null);

/** One sub-box's bodies at JHora's slots (mixedSlots), text top-left 2 px in. */
function SubBox({ bodies, x, y, half, classes }: { bodies: ChakraBody[]; x: number; y: number; half: number; classes?: Record<string, string> }) {
  const slots = mixedSlots(bodies);
  return (
    <>
      {bodies.map((b, i) => {
        const id = hitBody(b.index);
        const rel = id && classes?.[id] ? ` ${classes[id]}` : '';
        return (
          <text key={`${b.transit ? 't' : 'n'}${b.index}-${b.label}-${i}`} x={x + slots[i][0] * CELL + 2} y={y + slots[i][1] * CELL + 11}
            className={bodyClass(b) + kindClass(b.index) + rel} data-half={half} data-body={id ?? undefined}>
            {b.retrograde ? `(${b.label})` : b.label}
          </text>
        );
      })}
    </>
  );
}

export interface MixedVargasViewProps extends ChakraViewProps {
  /** JHora varga index of the inner chart (default 0 = D-1) */
  inner?: number;
  /** JHora varga index of the outer chart (default 1 = D-9; 0 when `transit` is drawn outside) */
  outer?: number;
  /** draw the transit chart in the outer half (JHora's behaviour when a transit chart is displayed) */
  showTransit?: boolean;
  /** the outer chart's name (chart+0x1698: "Tajaka annual", "Transit", ...) for "Outer: %s" */
  outerName?: string;
  /** specs of the natal chart and of the chart on screen, for the menu's worker commands */
  natalSpec?: ChartSpec | null;
  currentSpec?: ChartSpec | null;
}

export function MixedVargasView(props: MixedVargasViewProps) {
  // Chakras > Mixed 2-Vargas with a derived chart on screen: natal inside, that chart outside
  const doc = useActiveDoc();
  const derived = !props.showTransit && props.spec && doc?.derived ? doc.derived : null;
  if (!derived || !props.spec || !doc) {
    return <MixedVargasChart {...props} natalSpec={props.natalSpec ?? props.spec ?? null} currentSpec={props.currentSpec ?? props.spec ?? null} />;
  }
  return <WithNatal {...props} natalSpec={{ ...props.spec, birth: doc.birth }} outerName={derived.label} />;
}

function WithNatal(props: MixedVargasViewProps & { natalSpec: ChartSpec; outerName: string }) {
  const natal = useJob({ kind: 'chart' as const, chart: props.natalSpec });
  if (!natal.data) return <p className="status">Calculating…</p>;
  return <MixedVargasChart {...props} chart={natal.data as ChakraChart} transit={props.chart} showTransit currentSpec={props.spec ?? null} />;
}

/** One half's menu-153 state: DisplayVarga[12 / 13], the body view, DAT_0065b8a4[12 / 13]. */
interface HalfSettings { varga: number; view: ChartView; natalOnly: boolean }

type Signs = (number | null)[];

/** Signs of the Bhava/Chalit chakra of a half's chart, when they need no house cusps from the ephemeris. */
function useBhava(chart: ChakraChart, ini: Partial<JhoraIni>, wanted: boolean): { signs: Signs | null; cusps: boolean } {
  const cusps = wanted && needsCusps({ ...DEFAULTS, ...(chart.ini ?? {}), ...ini });
  const signs = useMemo(() => (wanted && !cusps ? bhavaSigns(chart, ini) : null), [wanted, cusps, chart, ini]);
  return { signs, cusps };
}

/** The worker's Bhava/Chalit signs (core/chartJobs.ts chart.bhavaSigns) of a spec, handed to `onSigns`. */
function CuspSigns({ spec, onSigns }: { spec: ChartSpec; onSigns: (s: Signs | null) => void }) {
  const job = useJob({ kind: 'table' as const, chart: spec, table: 'chart.bhavaSigns' });
  const text = job.data?.text?.[0];
  useEffect(() => { onSigns(text ? (JSON.parse(text) as Signs) : null); }, [text, onSigns]);
  return null;
}

function MixedVargasChart({ chart, transit, inner: inner0, outer: outer0, showTransit = false, outerName, natalSpec, currentSpec }: MixedVargasViewProps) {
  // the two vargas: DAT_00579a60 / DAT_00579a64 (DisplayVarga[12], [13]); inner from the natal chart
  // (DAT_0065b8d4 = 1), outer from the chart on screen (DAT_0065b8d8 = 0), standard views (0x45c6a0)
  const [halves, setHalves] = useState<HalfSettings[]>(() => [
    { varga: inner0 ?? 0, view: 'standard', natalOnly: true },
    { varga: outer0 ?? (showTransit ? 0 : 1), view: 'standard', natalOnly: false },
  ]);
  const update = (i: number, patch: Partial<HalfSettings>) => setHalves((x) => x.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const ini = useMemo<Partial<JhoraIni>>(() => natalSpec?.ini ?? chart.ini ?? {}, [natalSpec, chart]);
  // a half shows the chart on screen unless it is in "Natal chart only" mode or no derived chart is shown
  const src = (h: HalfSettings) => (showTransit && transit && !h.natalOnly
    ? { chart: transit, derived: true, name: outerName, spec: currentSpec ?? null }
    : { chart, derived: false, name: NATAL_CHART_NAME as string | undefined, spec: natalSpec ?? null });
  const [is, os] = [src(halves[0]), src(halves[1])];
  // varga 28: the Bhava/Chalit signs (from the worker when the house system needs the ephemeris)
  const ib = useBhava(is.chart, ini, halves[0].varga === MIXED_BHAVA_VARGA);
  const ob = useBhava(os.chart, ini, halves[1].varga === MIXED_BHAVA_VARGA);
  const [cuspSigns, setCuspSigns] = useState<[Signs | null, Signs | null]>([null, null]);
  const onInnerCusps = useCallback((x: Signs | null) => setCuspSigns((c) => [x, c[1]]), []);
  const onOuterCusps = useCallback((x: Signs | null) => setCuspSigns((c) => [c[0], x]), []);
  const innerBhava = ib.cusps ? cuspSigns[0] : ib.signs;
  const outerBhava = ob.cusps ? cuspSigns[1] : ob.signs;
  const pending = (halves[0].varga === MIXED_BHAVA_VARGA && !innerBhava) || (halves[1].varga === MIXED_BHAVA_VARGA && !outerBhava);
  const data = useMemo(() => (pending ? null : mixedVargas(chart, {
    inner: halves[0].varga, outer: halves[1].varga,
    innerChart: is.derived ? is.chart : null, outerChart: os.derived ? os.chart : null,
    innerName: is.derived ? is.name : undefined, outerName: os.derived ? os.name : undefined,
    innerView: halves[0].view, outerView: halves[1].view, ini, innerBhavaSigns: innerBhava, outerBhavaSigns: outerBhava,
  })), [pending, chart, halves, is.derived, is.chart, is.name, os.derived, os.chart, os.name, ini, innerBhava, outerBhava]);
  // the halves as chart slots for the menu commands (signs, lagna, specs, text copies)
  const slots = useMemo(() => ([[is, innerBhava], [os, outerBhava]] as const).map(([s, bh], i) =>
    slotChart(s.chart, ini, slotVargaOf(halves[i].varga), halves[i].view, s.name ?? '', { bhavaSigns: bh, spec: s.spec })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [is.chart, is.name, is.spec, os.chart, os.name, os.spec, innerBhava, outerBhava, halves, ini]);
  const { onMenu, marks, overlay, note } = useSlotMenu(slots, currentSpec ?? natalSpec ?? null, {
    menu: 'mixed',
    setVarga: (i, v) => update(i, { varga: displayIndexOf(v) }),
    setView: (i, view) => update(i, { view }),
    setNatalOnly: (i, natalOnly) => update(i, { natalOnly }),
    targetExtra: (i) => ({ view: halves[i].view, natalOnly: halves[i].natalOnly }),
  });
  // the clicked sign stays from the previous click when none is hit (view+0x8ad4; none at first)
  const lastSign = useRef(-1);
  const onContextMenu = (e: MouseEvent<SVGGElement>) => {
    const m = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    // 0x45c8d0: inner (slot 12) inside the separator square, else outer (slot 13)
    const half = p.x >= HALF && p.x <= SIZE - HALF && p.y >= HALF && p.y <= SIZE - HALF ? 0 : 1;
    const hit = CELLS.findIndex(([c, r]) => c === Math.floor(p.x / CELL) && r === Math.floor(p.y / CELL));
    if (hit >= 0) lastSign.current = hit;
    const label = (e.target as Element).closest?.('[data-body]');
    const body = label && label.getAttribute('data-half') === String(half) ? label.getAttribute('data-body') : null;
    onMenu(half)(e, lastSign.current, body);
  };
  const highlighted = new Set([...(marks[0]?.signs ?? []), ...(marks[1]?.signs ?? [])]);
  return (
    <div>
    {overlay}
    {ib.cusps && is.spec && <CuspSigns key={`i${is.derived}`} spec={is.spec} onSigns={onInnerCusps} />}
    {ob.cusps && os.spec && <CuspSigns key={`o${os.derived}`} spec={os.spec} onSigns={onOuterCusps} />}
    <OptionBar fields={[
      { label: 'Inner', value: halves[0].varga, options: MIXED_VARGA_OPTIONS, onChange: (v) => update(0, { varga: v as number }) },
      { label: 'Outer', value: halves[1].varga, options: MIXED_VARGA_OPTIONS, onChange: (v) => update(1, { varga: v as number }) },
    ]} />
    {!data ? <p className="status">Calculating…</p> : (
    <ChakraSvg w={SIZE} h={SIZE} title={`Mixed chart: ${data.innerCaption[1]} inside, ${data.outerCaption[1]} outside`}>
      <g onContextMenu={onContextMenu}>
      <rect x={0} y={0} width={SIZE} height={SIZE} className="mixed-band" />
      <rect x={HALF} y={HALF} width={SIZE - CELL} height={SIZE - CELL} className="mixed-innerbg" />
      {/* rasi highlights of either half (FUN_0045d1e0 inner pass, FUN_0049eea0) */}
      {CELLS.map(([c, r], s) => highlighted.has(s) && <rect key={`h${s}`} x={c * CELL} y={r * CELL} width={CELL} height={CELL} className="hl-cell" />)}
      {CELLS.map(([c, r], s) => <rect key={s} x={c * CELL} y={r * CELL} width={CELL} height={CELL} className="mixed-grid" />)}
      <rect x={CELL} y={CELL} width={2 * CELL} height={2 * CELL} className="mixed-grid" />
      <rect x={HALF} y={HALF} width={SIZE - CELL} height={SIZE - CELL} className="mixed-sep" />
      {data.signs.map((sg) => {
        const [c, r] = CELLS[sg.sign];
        const x0 = c * CELL, y0 = r * CELL;
        return (
          <g key={sg.sign} className="mixed-small">
            {sg.sign === data.lagnaSign && <line x1={x0} y1={y0 + 12} x2={x0 + 12} y2={y0} className="lagna-mark" />}
            <SubBox bodies={sg.inner} x={x0 + INNER_X[sg.sign] * Q} y={y0 + INNER_Y[sg.sign] * Q} half={0} classes={marks[0]?.bodyClasses} />
            <SubBox bodies={sg.outer} x={x0 + OUTER_X[sg.sign] * Q} y={y0 + OUTER_Y[sg.sign] * Q} half={1} classes={marks[1]?.bodyClasses} />
          </g>
        );
      })}
      {/* JHora centres each caption line in a CELL/4-high box from the top and from the middle of the centre square;
          the short varga name (top-aligned) and "Arudhas of Planets" (centred) share the next CELL/2 box */}
      <text x={SIZE / 2} y={(CELL * 9) / 8 + 4} textAnchor="middle" className="mixed-caption">{data.outerCaption[0]}</text>
      <text x={SIZE / 2} y={(CELL * 11) / 8 + 6} textAnchor="middle" className="mixed-varga">{data.outerCaption[1]}</text>
      {data.outerShort && <text x={SIZE / 2} y={CELL * 1.5 + 14} textAnchor="middle" className="mixed-short">{data.outerShort}</text>}
      {data.outerNote && <text x={SIZE / 2} y={CELL * 1.75 + 4} textAnchor="middle" className="mixed-note">{data.outerNote}</text>}
      <text x={SIZE / 2} y={(CELL * 17) / 8 + 4} textAnchor="middle" className="mixed-caption">{data.innerCaption[0]}</text>
      <text x={SIZE / 2} y={(CELL * 19) / 8 + 6} textAnchor="middle" className="mixed-varga">{data.innerCaption[1]}</text>
      {data.innerShort && <text x={SIZE / 2} y={CELL * 2.5 + 14} textAnchor="middle" className="mixed-short">{data.innerShort}</text>}
      {data.innerNote && <text x={SIZE / 2} y={CELL * 2.75 + 4} textAnchor="middle" className="mixed-note">{data.innerNote}</text>}
      </g>
    </ChakraSvg>
    )}
    {HALF_NAMES.map((n, i) => note(i) && <div key={n}><strong>{n} chart</strong>{note(i)}</div>)}
    </div>
  );
}
