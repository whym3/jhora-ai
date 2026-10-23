interface Props { tabs: readonly string[]; active: string; onSelect: (t: string) => void; level: 'top' | 'sub' }

export function TabBar({ tabs, active, onSelect, level }: Props) {
  return (
    <div className={`tabbar tabbar-${level}`} role="tablist">
      {tabs.map((t) => (
        <button key={t} role="tab" aria-selected={t === active} className={t === active ? 'tab active' : 'tab'} onClick={() => onSelect(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}
