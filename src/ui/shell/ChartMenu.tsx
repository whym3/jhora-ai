// JHora's chart right-click menus: menu 103 (CChartView: the chart pane and Chakras > Many
// Vargas) and menu 138 (CEntryChartView, the "Entry chart of this period" window).
// Handlers: CChartView 0x4405e0..0x442440 (message map 0x547ee0); enabling and labels come
// from FUN_0043b770 (ON_UPDATE_COMMAND_UI of every item):
//   33076 "When will lagna change sign in %s" (always; %s = varga short name 0x8a2800[v])
//   33160 "When will %s change sign in %s" (clicked body 1..9 only)
//   33294 "Show chart based on houses from %s" (clicked body 0..9)
//   33109 Pachakadi of planet: body 1..7; 33110 / 32809 / 32811 / 32812: a rasi was clicked;
//   32808 32810 32815..32817 32819 and the relationships: body 1..9; 33287 checked = packed
//   mode; everything else always enabled.
// Highlights: JHora has no "clear" command. CChartView::OnContextMenu (0x439ab0, WM_CONTEXTMENU)
// first clears every highlight and relationship colouring of the view (FUN_00440570, flag
// DAT_0065c918 and view+0x88c4[15]) and redraws, then shows the menu; each highlight command
// also clears the previous one (useSlotMenu in ChartPane.tsx does both).
import { useEffect } from 'react';
import { GRAHAS, type Graha } from '../../core/positions';
import { SIGNS } from '../../core/zodiac';
import type { RelationKind, SignHighlight } from '../../core/chartMenu';

export interface MenuTarget {
  x: number; y: number; slot: number; sign: number; body: string | null;
  /** short name of the slot's varga (0x8a2800[v], "D-9") for the item labels */
  varga?: string;
  /** packed chart mode on (33287 check mark) */
  packed?: boolean;
  /** entries on the undo stack of "Change birthtime to move lagna to" beyond the first */
  undo?: number;
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
  | { kind: 'aspectTable' };

/** Which menu: 103 (CChartView) or 138 (CEntryChartView). */
export type MenuKind = 'chart' | 'entry';

type Need = 'none' | 'planet' | 'body10' | 'seven' | 'undo';
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
  ['having argala on this rasi', { kind: 'highlight', what: 'argala' }, 'none'],
  ['having virodhargala on this rasi', { kind: 'highlight', what: 'virodhargala' }, 'none'],
  ['aspected by this planet (graha drishti)', { kind: 'highlight', what: 'grahaDrishti' }, 'planet'],
  ['aspected by this planet (rasi drishti)', { kind: 'highlight', what: 'rasiDrishtiPlanet' }, 'planet'],
  ['aspected by this rasi (rasi drishti)', { kind: 'highlight', what: 'rasiDrishtiRasi' }, 'none'],
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
  ['Pachakadi relationships of this rasi', { kind: 'pachakadiRasi' }, 'none'],
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
    }
  };
  const items = menu === 'entry' ? MENU_138 : MENU_103;
  return (
    <div className="ctx-menu" role="menu"
      style={{ left: Math.min(target.x, window.innerWidth - 300), top: Math.max(4, Math.min(target.y, window.innerHeight - 640)), maxHeight: 'calc(100vh - 8px)', overflowY: 'auto' }}
      onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="ctx-head">{target.body ?? 'No body'} · {SIGNS[target.sign]}</div>
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
