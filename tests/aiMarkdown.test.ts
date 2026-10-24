// The AI panel's markdown renderer must finish on any input: a streamed table row has no
// closing pipe until it is complete, and such a line once looped forever (tab out of memory).
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from '../src/ui/AiPanel';

const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

describe('AI panel markdown', () => {
  it('renders a half-streamed table row', () => {
    expect(html('Timeline\n| Period | Dates')).toContain('<th>Period</th><th>Dates</th>');
  });

  it('accepts rows without closing pipes', () => {
    const h = html('| A | B\n|---|---\n| 1 | 2');
    expect(h).toContain('<th>A</th>');
    expect(h).toContain('<td>1</td><td>2</td>');
  });

  it('renders a normal table and skips the separator row', () => {
    expect(html('| A | B |\n| :-- | --: |\n| 1 | 2 |').match(/<tr>/g)).toHaveLength(2);
  });

  it('finishes on lines no branch recognises', () => {
    const h = html('|\n##### five hashes\ntext | with pipe\n- item');
    expect(h).toContain('five hashes');
    expect(h).toContain('<li>item</li>');
  });
});
