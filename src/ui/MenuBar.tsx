// JHora's Edit, View and Preferences menus (main menu 128, tools/harness/res/menus.txt),
// with the commands this port implements: the Edit dialogs (src/ui/dialogs/EditDialogs.tsx),
// View > Navigate Backward/Forward (Alt+Left / Alt+Right, store.ts) and every option dialog
// of the Preferences menu (src/ui/dialogs/optionRegistry.ts, rendered by OptionDialog).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RECOMMENDED_OPTIONS, RESTORED_DEFAULT_OPTIONS } from '../core/presetOptions';
import { defaultLocationMessage } from '../core/newChart';
import { AyanamsaDialog } from './AyanamsaDialog';
import { Preferences } from './Preferences';
import { VargaOptions } from './VargaOptions';
import { ColorsDialog } from './dialogs/ColorsDialog';
import { ChartNotesDialog, NOTES_NEED_SAVE, SpecialLagnaDialog, SpecialPointDialog, TimezoneDialog } from './dialogs/EditDialogs';
import { OptionDialogHost } from './dialogs/OptionDialog';
import { optionDialog } from './dialogs/optionRegistry';
import {
  canNavigateBack, canNavigateForward, getState, navigateBack, navigateForward, setCurrentLocationAsDefault, setIni,
  useActiveDoc, useStore,
} from './state/store';

type Open =
  | { kind: 'option'; dialog: number } | { kind: 'ayanamsa' } | { kind: 'vargas' } | { kind: 'colors' } | { kind: 'prefs' }
  | { kind: 'timezone' } | { kind: 'specialPoint' } | { kind: 'specialLagna' } | { kind: 'notes' } | null;

interface Entry { label: string; cmd?: number; run?: () => void; disabled?: boolean; hint?: string; shortcut?: string }
type MenuLine = Entry | 'sep' | { heading: string };

function Menu({ name, lines, open, setOpen }: { name: string; lines: MenuLine[]; open: string | null; setOpen: (m: string | null) => void }) {
  return (
    <span className="menu">
      <button className={open === name ? 'active' : undefined} aria-haspopup="menu" aria-expanded={open === name}
        onClick={() => setOpen(open === name ? null : name)}>{name}</button>
      {open === name && (
        <div className="menu-items" role="menu">
          {lines.map((l, i) => {
            if (l === 'sep') return <hr key={i} />;
            if ('heading' in l) return <div key={i} className="menu-heading">{l.heading}</div>;
            return (
              <button key={i} role="menuitem" disabled={l.disabled} title={l.hint ?? (l.cmd ? `JHora command ${l.cmd}` : undefined)}
                onClick={() => { setOpen(null); l.run?.(); }}>
                <span>{l.label}</span>{l.shortcut && <span className="muted">{l.shortcut}</span>}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

export function MenuBar() {
  const doc = useActiveDoc();
  const canBack = useStore(canNavigateBack);
  const canForward = useStore(canNavigateForward);
  const [open, setOpen] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Open>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateBack(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateForward(); }
    };
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, []);

  const option = (dialog: number, label?: string): Entry => {
    const d = optionDialog(dialog)!;
    return { label: label ?? d.menu, cmd: d.cmd, run: () => setDlg({ kind: 'option', dialog }) };
  };
  const other = (label: string, cmd: number, owner: string): Entry => ({ label, cmd, disabled: true, hint: `${owner} (not in this menu yet)` });
  const font = (step: number) => {
    const f = getState().ini.FontSizeSelection;
    // 33121 / 33122 (FUN_004e7a90 / FUN_004e7b10): one step within 0..7
    if ((step > 0 && f < 7) || (step < 0 && f > 0)) setIni({ FontSizeSelection: f + step });
  };

  const edit: MenuLine[] = [
    { label: 'Change timezone', cmd: 33200, disabled: !doc, run: () => setDlg({ kind: 'timezone' }) },
    { label: 'User defined special point', cmd: 33199, run: () => setDlg({ kind: 'specialPoint' }) },
    { label: 'Planetary Special Lagnas (research)', cmd: 33252, run: () => setDlg({ kind: 'specialLagna' }) },
    'sep',
    {
      label: 'Chart notes (in notepad)', cmd: 32988, disabled: !doc,
      run: () => (doc?.saved === false ? window.alert(`First save it\n\n${NOTES_NEED_SAVE}`) : setDlg({ kind: 'notes' })),
    },
  ];
  const view: MenuLine[] = [
    { label: 'Navigate Backward', cmd: 33104, shortcut: 'Alt+Left', disabled: !canBack, run: navigateBack },
    { label: 'Navigate Forward', cmd: 33105, shortcut: 'Alt+Right', disabled: !canForward, run: navigateForward },
    'sep',
    { label: 'View jhora.ini file (preference settings)', cmd: 33292, run: () => setDlg({ kind: 'prefs' }) },
  ];
  const prefs: MenuLine[] = [
    { heading: 'Related to Calculations' },
    option(2072),
    { label: 'Ayanamsa', cmd: 32993, run: () => setDlg({ kind: 'ayanamsa' }) },
    'sep',
    option(149), option(170),
    { label: 'Divisional Chart Calculation Options', cmd: 32935, run: () => setDlg({ kind: 'vargas' }) },
    option(2076), option(2045), option(2027), option(2030),
    option(165), option(2047),
    option(2040), option(2065), option(2080), option(2082), option(2031), option(2077), option(2059), option(2026),
    'sep',
    { label: 'Restore Default Calculation Options', cmd: 32938, run: () => setIni(RESTORED_DEFAULT_OPTIONS) },
    { label: 'Set Calculation Options as recommended by author', cmd: 33328, run: () => setIni(RECOMMENDED_OPTIONS) },
    { heading: 'Related to Display' },
    option(145), option(2036),
    { label: 'Use bigger fonts', cmd: 33121, run: () => font(1) },
    { label: 'Use smaller fonts', cmd: 33122, run: () => font(-1) },
    option(2039),
    { label: 'Colors to be used', cmd: 33049, run: () => setDlg({ kind: 'colors' }) },
    option(157), option(2028),
    'sep',
    {
      label: 'Set Current Location as Default', cmd: 32934, disabled: !doc,
      run: () => { const p = setCurrentLocationAsDefault(); if (p) window.alert(defaultLocationMessage(p)); },
    },
    'sep',
    { label: 'Save Preferences', cmd: 32900, run: () => window.alert('Preferences are saved (this browser keeps jhora.ini; File > Export preferences writes the file).') },
    'sep',
    option(2078),
    'sep',
    { label: 'All options (jhora.ini keys)…', run: () => setDlg({ kind: 'prefs' }) },
  ];

  let modal: ReactNode = null;
  const close = () => setDlg(null);
  if (dlg?.kind === 'option') modal = <OptionDialogHost dialog={dlg.dialog} onClose={close} onOpenAyanamsa={() => setDlg({ kind: 'ayanamsa' })} />;
  else if (dlg?.kind === 'ayanamsa') modal = <AyanamsaDialog onClose={close} />;
  else if (dlg?.kind === 'vargas') modal = <VargaOptions onClose={close} />;
  else if (dlg?.kind === 'colors') modal = <ColorsDialog onClose={close} />;
  else if (dlg?.kind === 'prefs') modal = <Preferences onClose={close} />;
  else if (dlg?.kind === 'specialPoint') modal = <SpecialPointDialog onClose={close} />;
  else if (dlg?.kind === 'specialLagna') modal = <SpecialLagnaDialog onClose={close} />;
  else if (dlg?.kind === 'timezone' && doc) modal = <TimezoneDialog doc={doc} onClose={close} />;
  else if (dlg?.kind === 'notes' && doc) modal = <ChartNotesDialog doc={doc} onClose={close} />;

  return (
    <div className="menubar" ref={ref}>
      <Menu name="Edit" lines={edit} open={open} setOpen={setOpen} />
      <Menu name="View" lines={view} open={open} setOpen={setOpen} />
      <Menu name="Preferences" lines={prefs} open={open} setOpen={setOpen} />
      {doc?.displayTz !== undefined && doc.displayTz !== null && doc.displayTz !== doc.birth.tzHours && (
        <span className="muted" title="Edit > Change timezone">Times shown in zone {doc.displayTz >= 0 ? '+' : ''}{doc.displayTz}</span>
      )}
      {modal}
    </div>
  );
}

