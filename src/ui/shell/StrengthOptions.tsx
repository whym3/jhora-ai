// View options of the Strengths and Houses tabs that JHora keeps in its context menus:
// * Other strengths, second pane (menu 129): 33046 "Change varga for avasthas related to
//   alertness and mood" (a varga index of the view, not in the ini), 33044/33045
//   "Relationships to be used in avasthas: Permanent / Compound"
//   (UseCompundRelationshipInAvasthas) and 33047/33048 "Relationships in avasthas/vimsopaka
//   are based on: Rasi chart always / Relevant varga chart" (CompoundRelationshipsFromRasi).
// * Ashtakavarga (menu 106): 32973 "Recompute taking another sign as lagna" / 33097 "Go back
//   to the actual lagna" (a per-varga lagna shift, FUN_004246e0) and 33117 "Use natal chart or
//   derived chart (Tajaka/TP)?" (FUN_004243c0, DAT_00597fac). 32839 / 32841 only change how
//   JHora's drawn AV charts highlight signs; the port shows the AV as tables.
// * Houses / KP (menu 145): 33248 "Choose the reference longitude for finding houses"
//   (dialog 2060, DAT_008846d0; core/kpHouses.ts).
import { setIni, useStore } from '../state/store';
import { VARGA_INDEX, vargaColumnLabel } from '../../core/vargaOptions';
import { SIGNS } from '../../core/zodiac';
import { HOUSE_REFERENCES } from '../../core/kpHouses';

export function AvasthaOptionsBar({ varga, onVarga }: { varga: number; onVarga: (v: number) => void }) {
  const ini = useStore((s) => s.ini);
  return (
    <>
      <label>Varga for alertness and mood{' '}
        <select aria-label="Varga for avasthas" value={varga} onChange={(e) => onVarga(Number(e.target.value))}>
          {VARGA_INDEX.map((v, i) => <option key={v} value={i}>{vargaColumnLabel(v, ini)}</option>)}
        </select>
      </label>
      <label>Relationships to be used in avasthas{' '}
        <select aria-label="Relationships in avasthas" value={ini.UseCompundRelationshipInAvasthas ? 1 : 0}
          onChange={(e) => setIni({ UseCompundRelationshipInAvasthas: Number(e.target.value) })}>
          <option value={0}>Permanent</option>
          <option value={1}>Compound</option>
        </select>
      </label>
      <label>Relationships in avasthas/vimsopaka are based on{' '}
        <select aria-label="Relationships based on" value={ini.CompoundRelationshipsFromRasi ? 1 : 0}
          onChange={(e) => setIni({ CompoundRelationshipsFromRasi: Number(e.target.value) })}>
          <option value={1}>Rasi chart always</option>
          <option value={0}>Relevant varga chart</option>
        </select>
      </label>
    </>
  );
}

/** 32973 / 33097: the sign the AV takes as lagna (shift from the actual lagna), and 33117. */
export function AvLagnaBar({ shift, onShift, natal, onNatal, derived }: {
  shift: number; onShift: (s: number) => void; natal: boolean; onNatal: (n: boolean) => void; derived: boolean;
}) {
  return (
    <>
      <label>Lagna{' '}
        <select aria-label="Recompute taking another sign as lagna" value={shift} onChange={(e) => onShift(Number(e.target.value))}>
          <option value={0}>Actual lagna</option>
          {SIGNS.slice(1).map((_, i) => <option key={i + 1} value={i + 1}>{`${i + 1} sign${i ? 's' : ''} on`}</option>)}
        </select>
      </label>
      {derived && (
        <label><input type="checkbox" checked={natal} onChange={(e) => onNatal(e.target.checked)} /> Use natal chart</label>
      )}
    </>
  );
}

export function HouseReferenceSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <select aria-label="Reference longitude for finding houses" value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {HOUSE_REFERENCES.map((r, i) => <option key={r} value={i}>{`Houses from ${r}`}</option>)}
    </select>
  );
}
