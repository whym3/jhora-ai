// Smoke test: every CHAKRA_VIEWS entry renders an <svg> for a synthetic chart, with and without a transit chart.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fixtureChart } from './fixture';

describe('CHAKRA_VIEWS', async () => {
  const { CHAKRA_VIEWS } = await import('../../src/ui/chakras/index');
  const natal = fixtureChart([278, 45, 200, 110, 300, 80, 250, 15, 195], 10, ['Mars']);
  const transit = fixtureChart([190, 3, 50, 175, 66, 210, 330, 120, 300], 200);
  it('covers the nine sub-tabs after Many Vargas', () => {
    expect(Object.keys(CHAKRA_VIEWS)).toEqual(['Mixed 2-Vargas', 'Kalachakra', 'Sarvatobhadra', 'Kota Chakra',
      'Surya Kalanala', 'Chandra Kalanala', 'Sudarsana', 'Shoola', 'Tripataki']);
  });
  for (const [name, View] of Object.entries(CHAKRA_VIEWS)) {
    it(`${name} renders`, () => {
      expect(renderToStaticMarkup(createElement(View, { chart: natal }))).toContain('<svg');
      expect(renderToStaticMarkup(createElement(View, { chart: natal, transit }))).toContain('<svg');
    });
  }
});
