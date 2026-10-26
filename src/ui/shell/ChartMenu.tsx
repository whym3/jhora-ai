// JHora's chart right-click menus: menu 103 (CChartView: the chart pane and Chakras > Many
// Vargas), menu 138 (CEntryChartView, the "Entry chart of this period" window) and menu 153
// (CMixedChartView 0x45c8d0: Chakras > Mixed 2-Vargas and the mixed-chart windows; its commands
// are CChartView's, run on the half the menu was opened on, see core/chakras/mixedVargas.ts).
// Handlers: CChartView 0x4405e0..0x442440 (message map 0x547ee0); enabling and labels come
// from FUN_0043b770 (ON_UPDATE_COMMAND_UI of every item):
//   33076 "When will lagna change sign in %s" (always; %s = varga short name 0x8a2800[v])
//   33160 "When will %s change sign in %s" (clicked body 1..9 only)
//   33294 "Show chart based on houses from %s" (clicked body 0..9)
//   33109 Pachakadi of planet: body 1..7; 33110 / 32809 / 32811 / 32812: a rasi was clicked;
//   32808 32810 32815..32817 32819 and the relationships: body 1..9; 33287 checked = packed
//   mode; everything else always enabled. (In menus 103/138 a sign is always hit; the mixed
//   chart's centre square is no sign, so there the rasi items need one: Need 'rasi'.)
// Highlights: JHora has no "clear" command. CChartView::OnContextMenu (0x439ab0, WM_CONTEXTMENU)
// first clears every highlight and relationship colouring of the view (FUN_00440570, flag
// DAT_0065c918 and view+0x88c4[15]) and redraws, then shows the menu; each highlight command
// also clears the previous one (useSlotMenu in ChartPane.tsx does both).
import { useEffect } from 'react';
import { GRAHAS, type Graha } from '../../core/positions';
import { SIGNS } from '../../core/zodiac';
import type { RelationKind, SignHighlight } from '../../core/chartMenu';
import { CHART_VIEWS, OPTIONAL_BODIES, type ChartView } from '../../core/chartBodies';
import { MIXED_VIEW_CHECK } from '../../core/chakras/mixedVargas';
import type { VargaName } from '../../core/vargas';
import type { JhoraIni } from '../../settings/generated';

export interface MenuTarget {
  /** `sign` -1: no sign box was hit (the mixed chart's centre) */
  x: number; y: number; slot: number; sign: number; body: string | null;
  /** short name of the slot's varga (0x8a2800[v], "D-9") for the item labels */
  varga?: string;
  /** packed chart mode on (33287 check mark) */
  packed?: boolean;
  /** entries on the undo stack of "Change birthtime to move lagna to" beyond the first */
  undo?: number;
  /** menu 153: the slot's body view and display mode (check marks) */
  view?: ChartView;
  natalOnly?: boolean;
}

export type MenuAction =
  | { kind: 'highlight'; what: SignHighlight }
  | { kind: 'relations'; what: RelationKind }
  | { kind: 'pachakadiPlanet' }
  | { kind: 'pachakadiRasi' }
  | { kind: 'mks' }
  | { kind: 'signChange' }
  | { kind: 'lagnaChange' }
  | { kind: 'moveLagna'; dir: 'prev' | 'next' }
  | { kind: 'undoLagna'; all: boolean }
  | { kind: 'ashtakavarga' }
  | { kind: 'bhava'; base: number | null }
  | { kind: 'bhavaOptions' }
  | { kind: 'signsChart' }
  | { kind: 'housesFrom' }
  | { kind: 'packed' }
  | { kind: 'longitudes' }
  | { kind: 'patyayini' }
  | { kind: 'aspectTable' }
  | { kind: 'varga'; varga: VargaName }
  | { kind: 'view'; view: ChartView }
  | { kind: 'optionalBody'; key: keyof JhoraIni }
  | { kind: 'displayMode'; natalOnly: boolean }
  | { kind: 'copyText'; sne: boolean };

/** Which menu: 103 (CChartView), 138 (CEntryChartView) or 153 (CMixedChartView). */
export type MenuKind = 'chart' | 'entry' | 'mixed';

type Need = 'none' | 'planet' | 'body10' | 'seven' | 'undo' | 'rasi';
type Label = string | ((t: MenuTarget) => string);
type Item = ['head', string] | ['sep'] | [Label, MenuAction, Need];

/** JHora's body names (0x8a4b54): Lagna, Sun .. Ketu. */
export const BODY_NAMES: readonly string[] = ['Lagna', ...GRAHAS];
const vn = (t: MenuTarget) => t.varga ?? 'D-1';

/** Menu 103 "Bhava chakra or Chalit chakra" 33330..33362: BhavaChartVarga 0..22 (handlers 0x43bb20..0x43c620). */
export const BHAVA_MENU = [
  'rasi (D-1)', 'navamsa (D-9)', 'hora (D-2)', 'drekkana (D-3)', 'chaturthamsa (D-4)', 'panchamsa (D-5)', 'shashthamsa (D-6)',
  'saptamsa (D-7)', 'ashtamsa (D-8)', 'dasamsa (D-10)', 'rudramsa (D-11)', 'dwadasamsa (D-12)', 'shodasamsa (D-16)',
  'vimsamsa (D-20)', 'siddhamsa (D-24)', 'nakshatramsa (D-27)', 'trimsamsa (D-30)', 'khavedamsa (D-40)', 'akshavedamsa (D-45)',
  'shashtyamsa (D-60)', 'nava-navamsa (D-81)', 'ashtottaramsa (D-108)', 'dwadasa-dwadasamsa (D-144)',
];

const LAGNA_CHANGE: Item = [(t) => `When will lagna change sign in ${vn(t)}`, { kind: 'lagnaChange' }, 'none'];
const PLANET_CHANGE: Item = [(t) => `When will ${t.body && GRAHAS.includes(t.body as Graha) ? t.body : 'this planet'} change sign in ${vn(t)}`, { kind: 'signChange' }, 'planet'];
const AV: Item = ['Show ashtakavarga of this chart', { kind: 'ashtakavarga' }, 'none'];
const RELATIONS: Item[] = [
  ['head', 'Relationships'],
  ['Permanent relationships of this planet', { kind: 'relations', what: 'permanent' }, 'planet'],
  ['Temporary relationships of this planet', { kind: 'relations', what: 'temporary' }, 'planet'],
  ['Compound relationships of this planet', { kind: 'relations', what: 'compound' }, 'planet'],
];
const HIGHLIGHTS: Item[] = [
  ['head', 'Highlight rasi(s)'],
  ['having argala on this rasi', { kind: 'highlight', what: 'argala' }, 'rasi'],
  ['having virodhargala on this rasi', { kind: 'highlight', what: 'virodhargala' }, 'rasi'],
  ['aspected by this planet (graha drishti)', { kind: 'highlight', what: 'grahaDrishti' }, 'planet'],
  ['aspected by this planet (rasi drishti)', { kind: 'highlight', what: 'rasiDrishtiPlanet' }, 'planet'],
  ['aspected by this rasi (rasi drishti)', { kind: 'highlight', what: 'rasiDrishtiRasi' }, 'rasi'],
  ['owned by this planet', { kind: 'highlight', what: 'owned' }, 'planet'],
  ['which is moolatrikona of this planet', { kind: 'highlight', what: 'moolatrikona' }, 'planet'],
  ['where this planet is exalted', { kind: 'highlight', what: 'exalted' }, 'planet'],
  ['where this planet is debilitated', { kind: 'highlight', what: 'debilitated' }, 'planet'],
];
const ASPECT_TABLE: Item = ['Aspect table with relationships', { kind: 'aspectTable' }, 'none'];

/** Menu 103 in JHora's order (the varga, variant, copy, view and display-mode items are in the slot bar). */
const MENU_103: Item[] = [
  LAGNA_CHANGE,
  ['head', 'Change birthtime to move lagna to'],
  ['The previous sign', { kind: 'moveLagna', dir: 'prev' }, 'none'],
  ['The next sign', { kind: 'moveLagna', dir: 'next' }, 'none'],
  ['Undo the latest change', { kind: 'undoLagna', all: false }, 'undo'],
  ['Undo all changes', { kind: 'undoLagna', all: true }, 'undo'],
  ['sep'],
  AV,
  ['sep'],
  ['head', 'Bhava chakra or Chalit chakra'],
  ...BHAVA_MENU.map((label, i): Item => [`Based on ${label}`, { kind: 'bhava', base: i }, 'none']),
  ['Choose reference used for bhava/chalit chakra', { kind: 'bhavaOptions' }, 'none'],
  ['sep'],
  PLANET_CHANGE,
  ['Planets in marana karaka sthana', { kind: 'mks' }, 'none'],
  ...RELATIONS,
  ['Pachakadi relationships of this planet', { kind: 'pachakadiPlanet' }, 'seven'],
  ['Pachakadi relationships of this rasi', { kind: 'pachakadiRasi' }, 'rasi'],
  ...HIGHLIGHTS,
  ASPECT_TABLE,
  ['sep'],
  [(t) => `${t.packed ? '✓ ' : ''}Packed chart mode (more charts)`, { kind: 'packed' }, 'none'],
  ['sep'],
  ['Show chart based on signs', { kind: 'signsChart' }, 'none'],
  [(t) => `Show chart based on houses from ${t.body && BODY_NAMES.includes(t.body) ? t.body : 'this planet'}`, { kind: 'housesFrom' }, 'body10'],
];

/** Menu 138 (CEntryChartView: 32969 0x452980, 32827 0x4529f0, 32970 0x452a80; 33009 = varga 28 directly). */
const MENU_138: Item[] = [
  LAGNA_CHANGE,
  PLANET_CHANGE,
  ['Planet longitudes', { kind: 'longitudes' }, 'none'],
  AV,
  ['Compressed Patyayini dasa', { kind: 'patyayini' }, 'none'],
  ['sep'],
  ['Bhava chakra or Chalit chakra', { kind: 'bhava', base: null }, 'none'],
  ['sep'],
  ['Planets in marana karaka sthana', { kind: 'mks' }, 'none'],
  ...RELATIONS,
  ...HIGHLIGHTS,
  ASPECT_TABLE,
];

/** Menu 153's divisional charts (32777, 32778, 32782..32800, 33239, 33063; 33009 = varga 28). */
const vargaItem = (label: string, varga: VargaName): Item => [label, { kind: 'varga', varga }, 'none'];
const MIXED_VARGAS: Item[] = [
  vargaItem('Rasi chakra', 'D1'),
  ['Bhava chakra or Chalit chakra', { kind: 'bhava', base: null }, 'none'],
  vargaItem('Navamsa chakra', 'D9'),
  ['sep'],
  ...([['Hora', 'D2'], ['Drekkana', 'D3'], ['Chaturthamsa', 'D4'], ['Panchamsa', 'D5'], ['Shashthamsa', 'D6'], ['Saptamsa', 'D7'],
    ['Ashtamsa', 'D8'], ['Dasamsa', 'D10'], ['Rudramsa', 'D11'], ['Dwadasamsa', 'D12'], ['Shodasamsa', 'D16'], ['Vimsamsa', 'D20'],
    ['Siddhamsa', 'D24'], ['Nakshatramsa', 'D27'], ['Trimsamsa', 'D30']] as [string, VargaName][]).map(([n, v]) => vargaItem(`${n} (${v.replace('D', 'D-')})`, v)),
  ['head', 'Higher divisions'],
  vargaItem('Khavedamsa (D-40)', 'D40'), vargaItem('Akshavedamsa (D-45)', 'D45'), vargaItem('Shashtyamsa (D-60)', 'D60'),
  vargaItem('Navanavamsa (D-81)', 'D81'), vargaItem('Ashtottaramsa (D-108)', 'D108'), vargaItem('Dwadasamsa-Dwadasamsa (D-144)', 'D144'),
];
/** Menu 153's views (no 33211) with the check mark of 0x45c8d0 (MIXED_VIEW_CHECK). */
const MIXED_VIEWS: Item[] = CHART_VIEWS.filter((v) => v.view !== 'standardGrahaArudhas').map((v): Item => [
  (t) => `${t.view && MIXED_VIEW_CHECK[t.view] === v.view ? '✓ ' : ''}${v.label}`, { kind: 'view', view: v.view }, 'none',
]);

/**
 * Menu 153 in JHora's order (CMixedChartView). Left out: the bitmap copies (32986, 32987,
 * 33041, 33042; not ported anywhere) and "Show chart from this house" (32914, inserted for the
 * North Indian style only; the mixed chart is drawn South Indian).
 */
const MENU_153: Item[] = [
  LAGNA_CHANGE,
  AV,
  ['sep'],
  ...MIXED_VARGAS,
  ['sep'],
  ['Planets in marana karaka sthana', { kind: 'mks' }, 'none'],
  ...RELATIONS,
  ...HIGHLIGHTS,
  ['sep'],
  ['head', 'Copy chart'],
  ['as text to clipboard (current chart style)', { kind: 'copyText', sne: false }, 'none'],
  ['as text to clipboard (south-north-east styles)', { kind: 'copyText', sne: true }, 'none'],
  ['sep'],
  ['head', 'Choose a view (which bodies to show)'],
  ...MIXED_VIEWS,
  ['head', 'Optional bodies in standard view'],
  ...OPTIONAL_BODIES.filter((o) => o.cmd <= 33061).map((o): Item => [o.label, { kind: 'optionalBody', key: o.key }, 'none']),
  ['head', 'Chart display mode'],
  [(t) => `${t.natalOnly ? '' : '✓ '}Automatic (Natal, Tajaka etc)`, { kind: 'displayMode', natalOnly: false }, 'none'],
  [(t) => `${t.natalOnly ? '✓ ' : ''}Natal chart only`, { kind: 'displayMode', natalOnly: true }, 'none'],
];

const SEVEN = GRAHAS.slice(0, 7) as readonly string[];

export function ChartMenu({ target, onAction, onClose, menu = 'chart' }: {
  target: MenuTarget; onAction: (a: MenuAction) => void; onClose: () => void; menu?: MenuKind;
}) {
  useEffect(() => {
    const close = () => onClose();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', key); };
  }, [onClose]);
  const planet = target.body && (GRAHAS as readonly string[]).includes(target.body) ? target.body : null;
  const ok = (need: Need) => {
    switch (need) {
      case 'none': return true;
      case 'planet': return !!planet;
      case 'seven': return !!planet && SEVEN.includes(planet);
      case 'body10': return !!target.body && BODY_NAMES.includes(target.body);
      case 'undo': return (target.undo ?? 0) > 0;
      case 'rasi': return target.sign >= 0 && target.sign < 12;
    }
  };
  const items = menu === 'entry' ? MENU_138 : menu === 'mixed' ? MENU_153 : MENU_103;
  return (
    <div className="ctx-menu" role="menu"
      style={{ left: Math.min(target.x, window.innerWidth - 300), top: Math.max(4, Math.min(target.y, window.innerHeight - 640)), maxHeight: 'calc(100vh - 8px)', overflowY: 'auto' }}
      onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="ctx-head">{target.body ?? 'No body'} · {SIGNS[target.sign] ?? 'No rasi'}</div>
      {items.map((it, i) => {
        if (it[0] === 'head') return <div key={i} className="ctx-head">{it[1] as string}</div>;
        if (it[0] === 'sep') return <hr key={i} />;
        const [label, a, need] = it as [Label, MenuAction, Need];
        return (
          <button key={i} role="menuitem" disabled={!ok(need)} onClick={() => { onAction(a); onClose(); }}>
            {typeof label === 'function' ? label(target) : label}
          </button>
        );
      })}
    </div>
  );
}
