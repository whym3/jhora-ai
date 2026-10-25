// JHora's "Copy to clipboard" text of a list view (CListCtrl), used by every list pane:
// Key Info 32975, Amsa rulers 32976, Strengths 32977 / 32978, Houses 33010, KP 33013,
// Transits 32979, and inside "Copy basic / complete calculations" (32982 / 32983).
//
// Ported from jhora.exe: all those handlers call FUN_004ba0a0(view, &text, view+0x48) =
// FUN_004b9d30(view, &text, ncols, 0), then FUN_004484e0 puts the text on the clipboard.
// FUN_004b9d30:
// * ncols is the view's column count (view+0x48), which some modes set larger than the
//   columns they insert (Planetary drekkanas: 2 inserted, 7 declared; Rasis occupied in all
//   vargas: 30 declared). For a column that does not exist LVM_GETCOLUMN fails and the
//   header buffer keeps the previous header; the cells of such a column are empty.
// * Headers are read with cchTextMax = 30 (at most 29 characters); cells in full.
// * width[c] = longest header or cell of the column; gap = ncols < 100 ? 2 : 1.
// * Header line, then "\n\n"; each row, then "\n"; then a final "\n". A field is padded
//   with blanks to width + gap - 1 when it is not the last column and the running width
//   sum is < 370 (0x172). When the running sum exceeds 384 (0x180) the line breaks with
//   "\n    " (header: sum restarts at 0; rows: at the column's width).

/** A list pane: headers, rows and (when larger) JHora's declared column count. */
export interface ListCopySource { headers: string[]; rows: string[][]; copyColumns?: number }

/** The copied text as lines (JHora joins them with "\n"; the clipboard gets CRLF). */
export function listCopyLines(t: ListCopySource): string[] {
  const n = Math.max(t.copyColumns ?? 0, t.headers.length);
  const headers: string[] = [];
  let last = '';
  for (let c = 0; c < n; c++) {
    if (c < t.headers.length) last = t.headers[c].slice(0, 29);
    headers.push(last);
  }
  const cell = (r: string[], c: number) => r[c] ?? '';
  const width = headers.map((h) => h.length);
  for (const r of t.rows) for (let c = 0; c < n; c++) width[c] = Math.max(width[c], cell(r, c).length);
  const gap = n < 100 ? 2 : 1;
  let out = '';
  const line = (field: (c: number) => string, header: boolean) => {
    let sum = 0;
    for (let c = 0; c < n; c++) {
      sum += width[c];
      if (sum > 0x180) { sum = header ? 0 : width[c]; out += '\n    '; }
      const s = field(c);
      out += s;
      const to = width[c] - 1 + gap;
      if (c + 1 < n && sum < 0x172 && s.length < to) out += ' '.repeat(to - s.length);
    }
  };
  line((c) => headers[c], true);
  out += '\n\n';
  for (const r of t.rows) {
    line((c) => cell(r, c), false);
    out += '\n';
  }
  out += '\n';
  return out.split('\n');
}

/** The clipboard text (CRLF line ends). */
export function listCopyText(t: ListCopySource): string {
  return listCopyLines(t).join('\r\n');
}
