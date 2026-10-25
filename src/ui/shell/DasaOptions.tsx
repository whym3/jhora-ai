// The dasa pane's "Options" button (button 1, FUN_0044be00 -> FUN_0044c170, a jump table on the
// dasa shown, DAT_008a4b58) and the "Preferences related to dasas" dialogs of menu 108:
//   0, 1, 3..12  dialog 2055 "Nakshatra dasa options" (FUN_0044d670): NakshatraDasaStartPoint,
//                NaksDasaADMethodPreference, AntiZodiacalDasa, NakshatraDasaShift (shown as the
//                star that takes the base star's lord, 0x591c60 / 0x591c94; 28 stars for
//                Ashtottari and Shashtihayani) of the slot, and the divisional chart (session)
//   2            dialog 2057 Kalachakra: starting point, KCDRohini4NavamsaInLeo, chart (session)
//   25 26 27 37  dialogs 2006 / 2053 / 2054 / 2011: NarayanaDasaChart, LagnamsakaDasaChart,
//                PadanathamsaDasaChart, ParyaayaDasaChart + the temporary strengths (overrides.ts)
//   28 29        dialogs 2049 Sudasa, 2064 Drigdasa (DrigdasaOfParasara) + strengths
//   30..36 39..41 dialog 2022 "Rasi dasa options": strengths (Chara Parasara: dialog 2079's
//                CharaDasaExaltationException); 38 dialog 2007 ShoolaDasaAntardasaStart
//   60 2008 Moola, 61 2046 Naisargika, 62 2075 Tara, 66 / 67 2056 Sudarsana chakra / Buddhi gati,
//   68 2044 RBV starting point
// Only the keys the dasa builders read are offered (Sudasa's antardasa method, Shoola's start
// house, Kalachakra's calculation method, the tithi dasas' seed and RBV's varga are not ported).
// Menu 108's 33019 "Dasa seed settings for Tajaka" (dialog 159, FUN_004508a0) writes
// UseDasaSeedFromNatalInTajaka / ProgressDasaSeedInTajaka for this dasa, all 75 or this category.
import { useState, type ReactElement } from 'react';
import type { JhoraIni } from '../../settings/generated';
import { setIni, useStore } from '../state/store';
import { NAKSHATRA_SEEDS } from '../../core/dasas/nakshatra';
import { adIndex } from '../../core/dasas/vimsottari';
import { JHORA_VARGAS } from '../../core/dasas/rasiCommon';
import { vargaLabel, type StrengthOverrides } from '../../core/dasas/overrides';
import { SIGNS } from '../../core/zodiac';
import { overridesKey, setDasaSession, useDasaSession } from './dasaSession';

/** JHora's full star names (CString table 0x8a4038). */
const STARS = ['Aswini', 'Bharani', 'Krittika', 'Rohini', 'Mrigasira', 'Aardra', 'Punarvasu', 'Pushyami', 'Aasresha', 'Magha',
  'Poorva Phalguni', 'Uttara Phalguni', 'Hastha', 'Chitra', 'Swaati', 'Visakha', 'Anuraadha', 'Jyeshtha', 'Moola', 'Poorvashadha',
  'Uttarashadha', 'Sravanam', 'Dhanishtha', 'Satabhishak', 'Poorvabhadra', 'Uttarabhadra', 'Revati'];
const STARS28 = [...STARS.slice(0, 21), 'Abhijit', ...STARS.slice(21)];
/** Base star and its lord (0x591c60 / 0x591c94 -> names 0x8a49bc) of the shift field. */
const SHIFT_BASE = [2, 5, 2, 0, 18, 21, 26, 14, 26, 7, 16, 0, 2];
const SHIFT_LORD = [1, 1, 1, 3, 1, 2, 1, 1, 1, 1, 1, 5, 1];
const LORD_NAMES = ['Lagna', 'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];

/** The antardasa orders of FUN_004b3720 as dialog 2055 explains them (maha dasas A..H, antardasas of F). */
const AD_METHODS = [0, 1, 2, 3, 4, 5].map((m) => Array.from({ length: 8 }, (_, j) => 'ABCDEFGH'[adIndex(5, j, 8, m)]).join(', '));

const VARGA_CHOICES = JHORA_VARGAS.flatMap((v, i) => (v ? [i] : []));

const NAK_SLOTS = new Set([0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const DN_KEY: Partial<Record<number, 'NarayanaDasaChart' | 'LagnamsakaDasaChart' | 'PadanathamsaDasaChart' | 'ParyaayaDasaChart'>> = {
  25: 'NarayanaDasaChart', 26: 'LagnamsakaDasaChart', 27: 'PadanathamsaDasaChart', 37: 'ParyaayaDasaChart',
};
const DN_LABEL: Partial<Record<number, string>> = {
  25: 'Narayana dasa of which D-n:', 26: 'Lagnamsaka dasa of which D-n:', 27: 'Padanaathaamsa dasa of which D-n:', 37: 'Paryaya dasa of which D-n:',
};
const STRENGTH_SLOTS = new Set([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 39, 40, 41]);
const START_SLOTS = new Set([25, 26, 27, 37]);
const TITLES: Record<number, string> = {
  2: 'Kalachakra dasa options', 25: 'Narayana dasa options', 26: 'Lagnamsaka dasa options', 27: 'Padanaathaamsa dasa options',
  28: 'Sudasa options', 29: 'Drigdasa options', 37: 'Paryaya dasa options', 38: 'Shoola dasa options', 60: 'Moola dasa options',
  61: 'Naisargika dasa options', 62: 'Tara dasa options', 66: 'Sudarsana Chakra Dasa Options', 67: 'Buddhi gati dasa options', 68: 'RBV dasa options',
};

/** Does the Options button open a dialog for this dasa (FUN_0044c170's table)? */
export function hasDasaOptions(slot: number): boolean {
  return NAK_SLOTS.has(slot) || slot === 2 || STRENGTH_SLOTS.has(slot) || [38, 60, 61, 62, 66, 67, 68].includes(slot);
}

type IntKey = { [K in keyof JhoraIni]: JhoraIni[K] extends number ? K : never }[keyof JhoraIni];
type ArrKey = 'NakshatraDasaStartPoint' | 'NakshatraDasaShift' | 'NaksDasaADMethodPreference' | 'AntiZodiacalDasa';

export function DasaOptionsDialog({ slot, birth, onClose }: { slot: number; birth: unknown; onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const session = useDasaSession();
  const okey = overridesKey(birth, slot);
  const [draft, setDraft] = useState<Partial<JhoraIni>>({});
  const [varga, setVarga] = useState(session.nakVarga);
  const [ov, setOv] = useState<StrengthOverrides>(session.overrides[okey] ?? {});
  const val = <K extends IntKey>(k: K): number => (draft[k] as number | undefined) ?? (ini[k] as number);
  const set = (patch: Partial<JhoraIni>) => setDraft((d) => ({ ...d, ...patch }));
  const arr = (k: ArrKey) => (draft[k] as number[] | undefined) ?? ini[k];
  const setArr = (k: ArrKey, v: number) => set({ [k]: arr(k).map((x, i) => (i === slot ? v : x)) });
  const check = (k: IntKey, label: string, invert = false) => (
    <label><input type="checkbox" checked={(val(k) !== 0) !== invert} onChange={(e) => set({ [k]: e.target.checked !== invert ? 1 : 0 })} /> {label}</label>
  );
  const ok = () => {
    if (Object.keys(draft).length) setIni(draft);
    setDasaSession((s) => ({ nakVarga: varga, overrides: { ...s.overrides, [okey]: ov } }));
    onClose();
  };
  const vargaSelect = (value: number, onChange: (v: number) => void, label: string) => (
    <label>{label} <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {VARGA_CHOICES.map((i) => <option key={i} value={i}>{vargaLabel(i, ini)}</option>)}
    </select></label>
  );
  const seedSelect = (s: number) => (
    <label>{s === 2 ? 'Kalachakra dasa starting point' : 'Nakshatra dasa starting point'} <select value={arr('NakshatraDasaStartPoint')[s]}
      onChange={(e) => setArr('NakshatraDasaStartPoint', Number(e.target.value))}>
      {NAKSHATRA_SEEDS.map((n, i) => <option key={n} value={i}>{n}</option>)}
    </select></label>
  );
  const sections: ReactElement[] = [];
  if (NAK_SLOTS.has(slot)) {
    const n = slot === 1 || slot === 11 ? 28 : 27;
    const names = n === 28 ? STARS28 : STARS;
    const base = SHIFT_BASE[slot];
    sections.push(
      <fieldset key="nak"><legend>Nakshatra dasa options</legend>
        {seedSelect(slot)}
        <label>Antardasa order (maha dasas A..H, antardasas of F) <select value={arr('NaksDasaADMethodPreference')[slot]}
          onChange={(e) => setArr('NaksDasaADMethodPreference', Number(e.target.value))}>
          {AD_METHODS.map((t, i) => <option key={i} value={i}>{t}</option>)}
        </select></label>
        {vargaSelect(varga, setVarga, 'Divisional chart used for calculations')}
        <label><input type="checkbox" checked={arr('AntiZodiacalDasa')[slot] !== 0} onChange={(e) => setArr('AntiZodiacalDasa', e.target.checked ? 1 : 0)} /> Reckon everything antizodiacally (applies only to Vimsottari dasa)</label>
        <label>Shift nakshatra ownership: {names[base]} (owned by {LORD_NAMES[SHIFT_LORD[slot]]}) becomes <select
          value={(base + arr('NakshatraDasaShift')[slot]) % n} onChange={(e) => setArr('NakshatraDasaShift', (n - base + Number(e.target.value)) % n)}>
          {names.map((s, i) => <option key={s} value={i}>{s}</option>)}
        </select></label>
      </fieldset>,
    );
  }
  if (slot === 2) {
    sections.push(
      <fieldset key="kc"><legend>Kalachakra dasa options</legend>
        {seedSelect(2)}
        {check('KCDRohini4NavamsaInLeo', 'Navamsa of the 4th pada of Rohini is Le (unchecked: Cn)')}
        {vargaSelect(varga, setVarga, 'Divisional chart used as the base for calculations')}
      </fieldset>,
    );
  }
  const dn = DN_KEY[slot];
  if (dn) sections.push(<fieldset key="dn"><legend>Chart</legend>{vargaSelect(val(dn), (v) => set({ [dn]: v }), DN_LABEL[slot]!)}</fieldset>);
  if (slot === 29) sections.push(<fieldset key="drig"><legend>Which version of drigdasa to use</legend>{check('DrigdasaOfParasara', "Parasara's (96 years)")}</fieldset>);
  if (slot === 33) sections.push(<fieldset key="chara"><legend>Chara dasa (Parasara)</legend>{check('CharaDasaExaltationException', 'Add/subtract one year to/from dasa length if lord exalted/debilitated')}</fieldset>);
  if (STRENGTH_SLOTS.has(slot)) {
    const pair = (i: number) => ov.stronger?.[i] ?? null;
    const setPair = (i: number, v: number | null) => setOv((o) => ({ ...o, stronger: Array.from({ length: 6 }, (_, k) => (k === i ? v : o.stronger?.[k] ?? null)) }));
    sections.push(
      <fieldset key="str"><legend>Strengths</legend>
        <p className="status">When you edit birthdata or re-open the chart, strengths will be automatically computed again. Until then, what you enter below will be used temporarily.</p>
        <label>Lord of Aquarius <select value={ov.aqLord ?? ''} onChange={(e) => setOv((o) => ({ ...o, aqLord: (e.target.value || undefined) as StrengthOverrides['aqLord'] }))}>
          <option value="">(computed)</option><option value="Saturn">Saturn</option><option value="Rahu">Rahu</option></select></label>
        <label>Lord of Scorpio <select value={ov.scLord ?? ''} onChange={(e) => setOv((o) => ({ ...o, scLord: (e.target.value || undefined) as StrengthOverrides['scLord'] }))}>
          <option value="">(computed)</option><option value="Mars">Mars</option><option value="Ketu">Ketu</option></select></label>
        {START_SLOTS.has(slot) && (
          <>
            <label>Start dasas from <select value={ov.start ?? ''} onChange={(e) => setOv((o) => ({ ...o, start: e.target.value === '' ? undefined : Number(e.target.value) }))}>
              <option value="">(computed)</option>{SIGNS.map((s, i) => <option key={s} value={i}>{s}</option>)}</select></label>
            <label>Does Saturn or Ketu exception apply? <select value={ov.sk ?? ''} disabled={ov.start === undefined}
              onChange={(e) => setOv((o) => ({ ...o, sk: e.target.value === '' ? undefined : (Number(e.target.value) as 0 | 1 | 2) }))}>
              <option value="">(computed)</option><option value={0}>No</option><option value={1}>Saturn</option><option value={2}>Ketu</option></select></label>
          </>
        )}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <label key={i}>Stronger of {SIGNS[i]} &amp; {SIGNS[i + 6]}: <select value={pair(i) ?? ''} onChange={(e) => setPair(i, e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">(computed)</option><option value={i}>{SIGNS[i]}</option><option value={i + 6}>{SIGNS[i + 6]}</option></select></label>
        ))}
      </fieldset>,
    );
  }
  if (slot === 38) {
    sections.push(
      <fieldset key="shoola"><legend>Where do antardasas start?</legend>
        <select value={val('ShoolaDasaAntardasaStart')} onChange={(e) => set({ ShoolaDasaAntardasaStart: Number(e.target.value) })}>
          <option value={0}>The dasa sign</option><option value={1}>The stronger of the dasa sign and its 7th</option>
          <option value={2}>The sign occupied by the lord of the stronger of the dasa sign and its 7th</option>
        </select>
      </fieldset>,
    );
  }
  if (slot === 60) {
    sections.push(
      <fieldset key="moola"><legend>Moola dasa options</legend>
        {check('LagnaUsedInMoolaDasa', 'Use lagna as a candidate for starting Moola dasa')}
        {check('MoonUsedInMoolaDasa', 'Use Moon as a candidate for starting Moola dasa')}
        {check('SunUsedInMoolaDasa', 'Use Sun as a candidate for starting Moola dasa')}
        <label>If a planet occupies its moolatrikona, is the moolatrikona correction (to be subtracted from Vimsottari dasa years) 0 or 12 years? <select
          value={val('MoolaDasaNoCorrectionInMoolaTrikona')} onChange={(e) => set({ MoolaDasaNoCorrectionInMoolaTrikona: Number(e.target.value) })}>
          <option value={0}>12 years</option><option value={1}>0 years</option></select></label>
      </fieldset>,
    );
  }
  if (slot === 61) {
    sections.push(
      <fieldset key="nais"><legend>Naisargika dasa options</legend>
        {check('NaisargikaDasaNoADForMDLord', 'Mahadasa lord has no antardasa')}
        {check('NaisargikaDasa3rd10thNoAD', 'Planets in 3rd and 10th from dasa lord have no antardasas')}
        {check('NaisargikaDasaOthersNoAD', 'Planets in 2nd, 6th, 11th and 12th from dasa lord have no antardasas')}
      </fieldset>,
    );
  }
  if (slot === 62) {
    sections.push(
      <fieldset key="tara"><legend>Tara dasa options</legend>
        <label>Which definition of Tara dasa do you want to use? <select value={val('TaraDasaParasara')} onChange={(e) => set({ TaraDasaParasara: Number(e.target.value) })}>
          <option value={0}>Pt Rath's method</option><option value={1}>Parasara's</option></select></label>
        {check('TaraDasaDirectionFromStar', 'Use nakshatra (savya/apasavya) to reckon direction, instead of sign (odd/even)')}
        {check('TaraDasaUseSesham', "Apply dasa sesham to the first dasa (Pt Rath's method)")}
        {check('TaraDasaSeshamRevApasavya', 'Reverse the sesham in apasavya')}
      </fieldset>,
    );
  }
  if (slot === 66 || slot === 67) {
    const k = slot === 66 ? 'SCDasaVarga' : 'BuddhiGatiDasaVarga';
    sections.push(
      <fieldset key="sc"><legend>{TITLES[slot]}</legend>
        {vargaSelect(val(k), (v) => set({ [k]: v }), 'Based on which varga?')}
        {slot === 66 && check('SudarsanaChakraDasaAD', 'Antardasas from the sign occupied by the lord')}
      </fieldset>,
    );
  }
  if (slot === 68) sections.push(<fieldset key="rbv"><legend>RBV dasa options</legend>{seedSelect(0)}</fieldset>);
  return (
    <div className="dasa-options" role="dialog" aria-label={TITLES[slot] ?? 'Nakshatra dasa options'}>
      <strong>{TITLES[slot] ?? 'Nakshatra dasa options'}</strong>
      {sections}
      <div><button onClick={ok}>OK</button> <button onClick={onClose}>Cancel</button></div>
    </div>
  );
}

/** Dialog 159 "Dasa Seed Settings for Tajaka" (33019). */
export function TajakaSeedDialog({ slot, category, onClose }: { slot: number; category: 0 | 1 | 2; onClose: () => void }) {
  const ini = useStore((s) => s.ini);
  const [natal, setNatal] = useState(ini.UseDasaSeedFromNatalInTajaka[slot] !== 0);
  const [progress, setProgress] = useState(ini.ProgressDasaSeedInTajaka[slot] !== 0);
  const [scope, setScope] = useState<0 | 1 | 2>(0);
  const ok = () => {
    const [lo, hi] = scope === 0 ? [slot, slot + 1] : scope === 1 ? [0, 75] : category === 0 ? [0, 25] : category === 1 ? [25, 60] : [60, 75];
    const fill = (a: number[], v: boolean) => a.map((x, i) => (i >= lo && i < hi ? (v ? 1 : 0) : x));
    setIni({ UseDasaSeedFromNatalInTajaka: fill(ini.UseDasaSeedFromNatalInTajaka, natal), ProgressDasaSeedInTajaka: fill(ini.ProgressDasaSeedInTajaka, progress) });
    onClose();
  };
  return (
    <div className="dasa-options" role="dialog" aria-label="Dasa Seed Settings for Tajaka">
      <strong>Dasa Seed Settings for Tajaka</strong>
      <label><input type="checkbox" checked={natal} onChange={(e) => setNatal(e.target.checked)} /> Use dasa seed (nakshatra/lagna) from natal chart</label>
      <label><input type="checkbox" checked={progress} onChange={(e) => setProgress(e.target.checked)} /> Progress dasa seed of natal chart by one nakshatra/rasi per year</label>
      <label>Apply these settings to <select value={scope} onChange={(e) => setScope(Number(e.target.value) as 0 | 1 | 2)}>
        <option value={0}>This dasa only</option><option value={1}>All dasas</option><option value={2}>All dasas of this category</option></select></label>
      <div><button onClick={ok}>OK</button> <button onClick={onClose}>Cancel</button></div>
    </div>
  );
}
