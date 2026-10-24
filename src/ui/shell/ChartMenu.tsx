// JHora's chart right-click menu (CChartView handlers 0x4405e0..0x442440).
import { useEffect } from 'react';
import type { Graha } from '../../core/positions';
import { SIGNS } from '../../core/zodiac';
import type { RelationKind, SignHighlight } from '../../core/chartMenu';

export interface MenuTarget { x: number; y: number; slot: number; sign: number; body: string | null }

export type MenuAction =
  | { kind: 'highlight'; what: SignHighlight }
  | { kind: 'relations'; what: RelationKind }
  | { kind: 'pachakadiPlanet' }
  | { kind: 'pachakadiRasi' }
  | { kind: 'mks' }
  | { kind: 'signChange' }
  | { kind: 'aspectTable' }
  | { kind: 'clear' };

type Need = 'none' | 'planet' | 'body' | 'seven';
const ITEMS: (['head', string] | ['sep'] | [string, MenuAction, Need])[] = [
  ['When will this planet change sign in this chart?', { kind: 'signChange' }, 'body'],
  ['Planets in marana karaka sthana', { kind: 'mks' }, 'none'],
  ['head', 'Relationships'],
  ['Permanent relationships of this planet', { kind: 'relations', what: 'permanent' }, 'planet'],
  ['Temporary relationships of this planet', { kind: 'relations', what: 'temporary' }, 'planet'],
  ['Compound relationships of this planet', { kind: 'relations', what: 'compound' }, 'planet'],
  ['Pachakadi relationships of this planet', { kind: 'pachakadiPlanet' }, 'seven'],
  ['Pachakadi relationships of this rasi', { kind: 'pachakadiRasi' }, 'none'],
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
  ['Aspect table with relationships', { kind: 'aspectTable' }, 'none'],
  ['sep'],
  ['Clear highlights', { kind: 'clear' }, 'none'],
];
const SEVEN = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

export function ChartMenu({ target, onAction, onClose }: { target: MenuTarget; onAction: (a: MenuAction) => void; onClose: () => void }) {
  useEffect(() => {
    const close = () => onClose();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('click', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', key); };
  }, [onClose]);
  const planet = target.body && target.body !== 'Lagna' ? (target.body as Graha) : null;
  const ok = (need: Need) => need === 'none' || (need === 'body' ? !!target.body : need === 'seven' ? !!planet && SEVEN.includes(planet) : !!planet);
  return (
    <div className="ctx-menu" role="menu"
      style={{ left: Math.min(target.x, window.innerWidth - 300), top: Math.min(target.y, window.innerHeight - 560) }}
      onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <div className="ctx-head">{target.body ?? 'No body'} · {SIGNS[target.sign]}</div>
      {ITEMS.map((it, i) => {
        if (it[0] === 'head') return <div key={i} className="ctx-head">{it[1] as string}</div>;
        if (it[0] === 'sep') return <hr key={i} />;
        const [label, a, need] = it as [string, MenuAction, Need];
        return <button key={i} role="menuitem" disabled={!ok(need)} onClick={() => { onAction(a); onClose(); }}>{label}</button>;
      })}
    </div>
  );
}
