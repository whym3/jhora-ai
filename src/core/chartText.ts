// "Copy chart > as text to clipboard" of JHora's chart diagrams (CChartView commands 32985
// "current chart style" and 32992 "south-north-east styles").
//
// jhora.exe facts:
// * 32985 (handler 0x4326f0) copies FUN_00434ac0(slot varga): by ChartStyle (DAT_0065b930)
//   0 South Indian = FUN_00434c60(.., unmirrored), 1 South Indian mirrored = FUN_00434c60(..),
//   2 North Indian = FUN_00435110, 3 East Indian = FUN_00435910(.., 0), 4 East Indian with
//   frame = FUN_00435910(.., 1). 32992 (0x432790) copies South (unmirrored) + North + East
//   with frame, one after the other. The chart is the slot's (natal unless a derived chart is
//   displayed and the slot's display mode is automatic) in the slot's varga.
// * All three builders use the same FIXED body set, whatever the slot's view: As..Ke, HL, GL,
//   Md, Gk, AL (indices < 10, 14, 15, 31, 32, 59), in index order, at most 10 per sign, each
//   written "%s%c" (label from the 0x4ef180 table, 'R' when the body's retrograde flag is set,
//   else a blank) over a fixed template (lines of 49 characters + CRLF), then CRLF appended.
// * South (template 0x579b84): sign box (col, row) Ar (1,0) Ta (2,0) Ge (3,0) Cn (3,1) Le (3,2)
//   Vi (3,3) Li (2,3) Sc (1,3) Sg (0,3) Cp (0,2) Aq (0,1) Pi (0,0) (mirrored: col 3 - col), box
//   offset row*306 + col*12, body k at (k>>1)*51 + 52 + (k&1)*5. Caption: long varga name
//   (0x8a4110) centred in 23 columns at 0x271 (line 12; one line higher for vargas other than
//   D-1) and the short name (0x8a2874, e.g. "D-9", "D-3 (Trd)") at 0x2a4.
// * North (template 0x57a084, first line blank for the title): houses from the lagna (sign of
//   As), house h at block (row, col) (NORTH_ROW, NORTH_COL), offset 51 + row*306 + col*12, slot
//   table group NORTH_GROUP[h]; the lagna sign number ("%d") at 0x249; title line: D-1 "Rasi"
//   centred in 49 columns, other vargas the long name at column 0, the short name right-aligned.
// * East (templates 0x57aab4 with frame / 0x57a5b4 without): signs fixed, box offset
//   row*408 + col*16, slot group EAST_GROUP[sign]; captions as South.
import type { ChakraChart } from './chakras/common';
import { chartSigns } from './chartBodies';
import type { VargaName } from './vargas';
import { VARGA_INDEX, vargaColumnLabel } from './vargaOptions';
import { JHORA_VARGA_LONG_NAMES } from './chakras/mixedVargas';
import type { JhoraIni } from '../settings/generated';

/** JHora's ChartStyle values (DAT_0065b930). */
export const CHART_STYLE_NAMES = ['South Indian', 'South Indian (mirrored)', 'North Indian', 'East Indian', 'East Indian (with frame)'];

const CRLF = '\r\n';
const SOUTH_TEMPLATE = [
  "+-----------------------------------------------+",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "|-----------+-----------------------+-----------|",
  "|           |                       |           |",
  "|           |                       |           |",
  "|           |                       |           |",
  "|           |                       |           |",
  "|           |                       |           |",
  "|-----------|                       |-----------|",
  "|           |                       |           |",
  "|           |                       |           |",
  "|           |                       |           |",
  "|           |                       |           |",
  "|           |                       |           |",
  "|-----------+-----------------------+-----------|",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "|           |           |           |           |",
  "+-----------------------------------------------+",
  " "
].join(CRLF);
const NORTH_TEMPLATE = [
  "                                                 ",
  "+-----------------------------------------------+",
  "| \\                   /   \\                   / |",
  "|   \\               /       \\               /   |",
  "|     \\           /           \\           /     |",
  "|       \\       /               \\       /       |",
  "|         \\   /                   \\   /         |",
  "|           x                       x           |",
  "|         /   \\                   /   \\         |",
  "|       /       \\               /       \\       |",
  "|     /           \\           /           \\     |",
  "|   /               \\       /               \\   |",
  "| /                   \\   /                   \\ |",
  "|                       x                       |",
  "| \\                   /   \\                   / |",
  "|   \\               /       \\               /   |",
  "|     \\           /           \\           /     |",
  "|       \\       /               \\       /       |",
  "|         \\   /                   \\   /         |",
  "|           x                       x           |",
  "|         /   \\                   /   \\         |",
  "|       /       \\               /       \\       |",
  "|     /           \\           /           \\     |",
  "|   /               \\       /               \\   |",
  "| /                   \\   /                   \\ |",
  "+-----------------------------------------------+",
  " "
].join(CRLF);
const EAST_FRAME_TEMPLATE = [
  "+-----------------------------------------------+",
  "| \\             |               |             / |",
  "|   \\           |               |           /   |",
  "|     \\         |               |         /     |",
  "|       \\       |               |       /       |",
  "|         \\     |               |     /         |",
  "|           \\   |               |   /           |",
  "|             \\ |               | /             |",
  "|---------------+---------------+---------------|",
  "|               |               |               |",
  "|               |               |               |",
  "|               |               |               |",
  "|               |               |               |",
  "|               |               |               |",
  "|               |               |               |",
  "|               |               |               |",
  "|---------------+---------------+---------------|",
  "|             / |               | \\             |",
  "|           /   |               |   \\           |",
  "|         /     |               |     \\         |",
  "|       /       |               |       \\       |",
  "|     /         |               |         \\     |",
  "|   /           |               |           \\   |",
  "| /             |               |             \\ |",
  "+---------------+---------------+---------------+",
  " "
].join(CRLF);
const EAST_TEMPLATE = [
  "\\               |               |               /",
  "  \\             |               |             /  ",
  "    \\           |               |           /    ",
  "      \\         |               |         /      ",
  "        \\       |               |       /        ",
  "          \\     |               |     /          ",
  "            \\   |               |   /            ",
  "              \\ |               | /              ",
  "----------------+---------------+----------------",
  "                |               |                ",
  "                |               |                ",
  "                |               |                ",
  "                |               |                ",
  "                |               |                ",
  "                |               |                ",
  "                |               |                ",
  "----------------+---------------+----------------",
  "              / |               | \\              ",
  "            /   |               |   \\            ",
  "          /     |               |     \\          ",
  "        /       |               |       \\        ",
  "      /         |               |         \\      ",
  "    /           |               |           \\    ",
  "  /             |               |             \\  ",
  "/               |               |               \\",
  " "
].join(CRLF);

/** The bodies every text copy shows (FUN_00434c60 / FUN_00435110 / FUN_00435910). */
export const TEXT_BODIES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 14, 15, 31, 32, 59];

const SOUTH_COL = [1, 2, 3, 3, 3, 3, 2, 1, 0, 0, 0, 0], SOUTH_ROW = [0, 0, 0, 1, 2, 3, 3, 3, 3, 2, 1, 0];
const NORTH_ROW = [0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0], NORTH_COL = [1, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2];
const NORTH_GROUP = [0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1];
/** North slot k of group g: line (row + 1) and column within the house block. */
const NORTH_SLOT_ROW = [
  [5, 3, 7, 5, 5, 4, 6, 2, 4, 4], [1, 0, 0, 2, 2, 1, 1, 3, 0, 0], [5, 5, 4, 6, 3, 7, 2, 8, 4, 4],
  [9, 10, 10, 8, 8, 9, 9, 7, 10, 10], [5, 5, 4, 6, 3, 7, 2, 8, 4, 4],
];
const NORTH_SLOT_COL = [
  [11, 11, 11, 5, 17, 11, 11, 11, 6, 16], [11, 8, 13, 8, 13, 6, 16, 11, 18, 3], [1, 6, 1, 1, 3, 3, 1, 1, 6, 6],
  [11, 8, 13, 8, 13, 6, 16, 11, 18, 3], [20, 15, 20, 20, 19, 19, 20, 20, 16, 16],
];
const EAST_ROW = [0, 0, 0, 1, 2, 2, 2, 2, 2, 1, 0, 0], EAST_COL = [1, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2];
const EAST_GROUP = [0, 1, 2, 0, 3, 4, 0, 2, 1, 0, 4, 3];
const EAST_SLOT_ROW = [
  [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], [3, 1, 1, 0, 2, 2, 4, 0, 0, 5], [3, 5, 5, 6, 4, 4, 2, 6, 6, 1],
  [3, 1, 1, 0, 2, 2, 4, 0, 0, 5], [3, 5, 5, 6, 4, 4, 2, 6, 6, 1],
];
const EAST_SLOT_COL = [
  [3, 10, 3, 10, 3, 10, 3, 10, 3, 10], [11, 11, 6, 8, 12, 7, 12, 3, 12, 13], [2, 2, 7, 6, 1, 6, 2, 1, 10, 1],
  [2, 2, 7, 6, 1, 6, 2, 1, 10, 1], [11, 11, 6, 8, 12, 7, 12, 3, 12, 13],
];

/**
 * Text-copy geometry, reused by the North/East diagrams: per house (North) or sign (East) the
 * block (row, col) and slot group; per group the slot lines/columns of bodies 0..9.
 */
export const TEXT_LAYOUT = {
  north: { row: NORTH_ROW, col: NORTH_COL, group: NORTH_GROUP, slotRow: NORTH_SLOT_ROW, slotCol: NORTH_SLOT_COL },
  east: { row: EAST_ROW, col: EAST_COL, group: EAST_GROUP, slotRow: EAST_SLOT_ROW, slotCol: EAST_SLOT_COL },
};

/** FUN_004b2340 / FUN_004b22d0: overwrite characters at an offset. */
function put(buf: string[], at: number, s: string) {
  for (let i = 0; i < s.length; i++) buf[at + i] = s[i];
}

interface TextBody { label: string; retrograde: boolean }
interface TextInput { signs: TextBody[][]; lagna: number; long: string; short: string; first: boolean }

function textInput(chart: ChakraChart, varga: VargaName, ini: Partial<JhoraIni>): TextInput {
  const signs = chartSigns(chart, varga, { ini, indices: TEXT_BODIES });
  const lagna = signs.findIndex((l) => l.some((b) => b.index === 0));
  const v = VARGA_INDEX.indexOf(varga);
  return {
    signs, lagna, first: v === 0,
    long: v >= 0 ? JHORA_VARGA_LONG_NAMES[v] : '', short: vargaColumnLabel(varga, { ...(chart.ini ?? {}), ...ini }),
  };
}

const cell = (b: TextBody) => `${b.label}${b.retrograde ? 'R' : ' '}`;

/** Centred caption lines of the South and East copies. */
function boxCaption(buf: string[], t: TextInput) {
  put(buf, ((23 - t.long.length) >> 1) + 0x271 - (t.first ? 0 : 0x33), t.long);
  if (!t.first) put(buf, ((23 - t.short.length) >> 1) + 0x2a4, t.short);
}

function southText(t: TextInput, mirror: boolean): string {
  const buf = [...SOUTH_TEMPLATE];
  t.signs.forEach((list, s) => {
    const base = SOUTH_ROW[s] * 306 + (mirror ? 3 - SOUTH_COL[s] : SOUTH_COL[s]) * 12;
    list.slice(0, 10).forEach((b, k) => put(buf, base + (k >> 1) * 51 + 52 + (k & 1) * 5, cell(b)));
  });
  boxCaption(buf, t);
  return buf.join('') + CRLF;
}

function northText(t: TextInput): string {
  const buf = [...NORTH_TEMPLATE];
  t.signs.forEach((list, s) => {
    const h = (s - t.lagna + 12) % 12, g = NORTH_GROUP[h];
    const base = NORTH_COL[h] * 12 + 51 + NORTH_ROW[h] * 306;
    list.slice(0, 10).forEach((b, k) => put(buf, base + (NORTH_SLOT_ROW[g][k] + 1) * 51 + NORTH_SLOT_COL[g][k], cell(b)));
  });
  put(buf, 0x249, String(t.lagna + 1));
  if (t.first) put(buf, (49 - t.long.length) >> 1, t.long);
  else {
    put(buf, 0, t.long);
    put(buf, 49 - t.short.length, t.short);
  }
  return buf.join('') + CRLF;
}

function eastText(t: TextInput, frame: boolean): string {
  const buf = [...(frame ? EAST_FRAME_TEMPLATE : EAST_TEMPLATE)];
  t.signs.forEach((list, s) => {
    const g = EAST_GROUP[s], base = EAST_ROW[s] * 408 + EAST_COL[s] * 16;
    list.slice(0, 10).forEach((b, k) => put(buf, base + (EAST_SLOT_ROW[g][k] + 1) * 51 + EAST_SLOT_COL[g][k], cell(b)));
  });
  boxCaption(buf, t);
  return buf.join('') + CRLF;
}

/** 32985: the chart in one ChartStyle (0..4). */
export function chartText(chart: ChakraChart, varga: VargaName, style: number, ini: Partial<JhoraIni> = {}): string {
  const t = textInput(chart, varga, ini);
  switch (style) {
    case 1: return southText(t, true);
    case 2: return northText(t);
    case 3: return eastText(t, false);
    case 4: return eastText(t, true);
    default: return southText(t, false);
  }
}

/** 32992: South, North and East (with frame) one after the other. */
export function chartTextSne(chart: ChakraChart, varga: VargaName, ini: Partial<JhoraIni> = {}): string {
  const t = textInput(chart, varga, ini);
  return southText(t, false) + northText(t) + eastText(t, true);
}
