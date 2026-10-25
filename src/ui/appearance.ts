// JHora's display preferences applied to the web app: Preferences > Related to Display >
// "Colors to be used" (33049, dialog 2023) and the font size (33121 / 33122 / 33118,
// dialog 2039).
//
// jhora.exe facts:
// * Colours are COLORREFs (0x00BBGGRR) in the 125 Color* ini keys (section [Colors]), held
//   in DAT_008976e0[125]. Dialog 2023 (handler FUN_004e72f0) lists them by frame: combo
//   1003 holds the 13 frame names (CStrings 0x8970d0.., built at 0x4da060), combo 1004 the
//   items of that frame (labels 0x8972f8.., built at 0x4d9140, one per key in ini order).
//   See src/ui/dialogs/colorItems.ts.
// * FontSizeSelection (0..7, default 3) scales every font by the table at 0x5922e0
//   (0.7, 0.8, 0.9, 1.0, 1.15, 1.25, 1.35, 1.5); "bigger" / "smaller" step it within 0..7.
//
// The app keeps its own palette (light and dark): a JHora colour is applied only once it
// differs from JHora's default, through one generated style sheet, so changing a colour in
// the Colors dialog (or importing a jhora.ini) changes the matching parts of the app.
import { DEFAULTS, type JhoraIni } from '../settings/generated';

/** JHora's font scale table (0x5922e0) by FontSizeSelection. */
export const FONT_SCALES = [0.7, 0.8, 0.9, 1.0, 1.15, 1.25, 1.35, 1.5];

/** COLORREF (0x00BBGGRR) -> "#rrggbb". */
export function colorrefToHex(c: number): string {
  const r = c & 0xff, g = (c >> 8) & 0xff, b = (c >> 16) & 0xff;
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
/** "#rrggbb" -> COLORREF. */
export function hexToColorref(hex: string): number {
  const v = parseInt(hex.replace('#', ''), 16);
  return ((v & 0xff) << 16) | (v & 0xff00) | ((v >> 16) & 0xff);
}
export const rgbOf = (c: number) => ({ r: c & 0xff, g: (c >> 8) & 0xff, b: (c >> 16) & 0xff });
export const colorref = (r: number, g: number, b: number) => (r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16);

/**
 * Where each JHora colour shows in the app: a CSS custom property of styles.css's :root
 * ("--name") or a [selector, property] rule. Keys absent here have no counterpart in the
 * web UI (Kota/Sarvatobhadra/Kalachakra frames draw their own fixed palettes, etc.).
 */
export const COLOR_TARGETS: Record<string, (string | [string, string])[]> = {
  // All frames with lists
  ColorListViewTitle: [['td:first-child', 'color']],
  ColorListViewItem: [['td', 'color']],
  ColorListViewOddLineBackground: [['tbody tr:nth-child(odd) td', 'background']],
  ColorListViewEvenLineBackground: [['tbody tr:nth-child(even) td', 'background']],
  ColorListViewBackground: [['.right-pane', 'background'], ['.panel', 'background']],
  ColorListViewHighlight: ['--hl'],
  ColorListViewTitleDescription: [['th', 'color']],
  // Form frames
  ColorFornViewBackground: ['--bg'],
  ColorFornViewText: ['--ink'],
  ColorFornViewControlBackground: [['button, select, input, textarea, .file', 'background']],
  ColorFornViewControlText: [['button, select, input, textarea, .file', 'color']],
  // Chart frames
  ColorChartViewFrame: [['.chart, .many-vargas', 'background']],
  ColorChartViewCartBackground: ['--cell'],
  ColorChartViewChartLine: [['.cell, .center, .north-lines, .cb-frame', 'stroke']],
  ColorChartViewLagna: ['--lagna', ['.cb.cb-lagna', 'fill']],
  ColorChartViewPlanet: [['.cb', 'fill']],
  ColorChartViewAL: [['.cb.cb-al', 'fill']],
  ColorChartViewSpecialLagna: [['.cb.cb-special', 'fill']],
  ColorChartViewBhavaArudha: [['.cb.cb-arudha', 'fill']],
  ColorChartViewUpagraha: [['.cb.cb-upagraha', 'fill']],
  ColorChartViewSpecialPoint: [['.cb.cb-user', 'fill']],
  ColorChartViewSelectedRasi: [['.cb-selbox', 'stroke']],
  ColorChartViewHighlightedRasi: [['.hl-cell', 'fill']],
  ColorChartViewStartRasi: [['.cb-signnum', 'fill']],
  ColorChartViewHint: [['.cb-caption', 'fill']],
  ColorChartViewAdhimitraForeground: [['.cb.relbox1', 'fill'], ['td.rel1', 'color']],
  ColorChartViewMitraForeground: [['.cb.relbox2', 'fill'], ['td.rel2', 'color']],
  ColorChartViewSamaForeground: [['.cb.relbox3', 'fill'], ['td.rel3', 'color']],
  ColorChartViewSatruForeground: [['.cb.relbox4', 'fill'], ['td.rel4', 'color']],
  ColorChartViewAdhisatruForeground: [['.cb.relbox5', 'fill'], ['td.rel5', 'color']],
  // Core info frame (Key Info)
  ColorCoreViewBackground: [['.key-info', 'background']],
  ColorCoreViewItemValue: [['.key-info', 'color']],
  // Strength bar graph frame
  ColorStrengthGraphViewOutline: [['.bar-graph', 'border-color']],
  ColorStrengthGraphViewGraphBackground: [['.bar-graph', 'background']],
  ColorStrengthGraphViewBar: [['.bg-fill', 'fill']],
  ColorStrengthGraphViewItemName: [['.bg-label', 'fill']],
  ColorStrengthGraphViewTitle: [['.bar-graph figcaption', 'color']],
  // General
  ColorSelectedTab: [['.tab.active', 'color']],
};

/** The style sheet for the colours and font size that differ from JHora's defaults. */
export function appearanceCss(ini: Partial<JhoraIni>): string {
  const vars: string[] = [];
  const rules: string[] = [];
  for (const [key, targets] of Object.entries(COLOR_TARGETS)) {
    const v = ini[key as keyof JhoraIni] as number | undefined;
    if (v === undefined || v === DEFAULTS[key as keyof JhoraIni]) continue;
    const hex = colorrefToHex(v);
    for (const t of targets) {
      if (typeof t === 'string') vars.push(`${t}: ${hex};`);
      else rules.push(`:root ${t[0].split(',').map((s) => s.trim()).join(', :root ')} { ${t[1]}: ${hex}; }`);
    }
  }
  const font = Number(ini.FontSizeSelection ?? DEFAULTS.FontSizeSelection);
  if (font !== DEFAULTS.FontSizeSelection && FONT_SCALES[font]) vars.push(`font-size: ${FONT_SCALES[font] * 100}%;`);
  return [vars.length ? `:root { ${vars.join(' ')} }` : '', ...rules].filter(Boolean).join('\n');
}

/** Install (or update) the generated style sheet. */
export function applyAppearance(ini: Partial<JhoraIni>): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('jhora-colors') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'jhora-colors';
    document.head.appendChild(el);
  }
  el.textContent = appearanceCss(ini);
}
