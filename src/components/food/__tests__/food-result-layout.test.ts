import { describe, expect, it } from '@jest/globals';

import {
  contentUnderFooter,
  estimateLines,
  hasTelugu,
  heroFits,
  ingredientIcon,
  ingredientLine,
  ingredientRowLayout,
  ingredientSpoken,
  ingredientSuffix,
  ingredientTitle,
  RESULT,
  titleLayout,
} from '../food-result-layout';

/** A 390 dp phone: the content is 390 - 2 x 24. */
const W = 390 - 2 * RESULT.sideMargin;
const FORTY = 'Gongura Mutton Dum Biryani with Raita Se'; // 40 characters

describe('food result layout numbers (spec 5.9, 5.10, 7)', () => {
  it('uses the spec figures', () => {
    expect(RESULT.topGap).toBe(16);
    expect(RESULT.topBarHeight).toBe(40);
    expect(RESULT.heroMinHeight).toBe(136);
    expect(RESULT.macroColumns).toEqual([64, 64, 56]);
    expect(RESULT.ingredientRowHeight).toBe(48);
    expect(RESULT.editWidth).toBe(112);
    expect(RESULT.footerTop).toBe(16);
    expect(RESULT.footerBottom).toBe(24);
    expect(W).toBe(342);
  });
});

describe('long names wrap and never clip', () => {
  it('the test name is 40 characters', () => {
    expect(FORTY).toHaveLength(40);
  });

  it('a 40-character dish title wraps onto 2 lines, with no line limit and room for both', () => {
    const t = titleLayout(FORTY, W);
    expect(t.lines).toBe(2);
    expect(t.numberOfLines).toBeUndefined();
    expect(t.height).toBeGreaterThanOrEqual(2 * 30);
  });

  it('a short title takes one line; a very long one keeps growing', () => {
    expect(titleLayout('Idli', W).lines).toBe(1);
    expect(titleLayout(`${FORTY} ${FORTY} ${FORTY}`, W).lines).toBeGreaterThan(3);
  });

  it('a Telugu title is measured wider, so it wraps sooner', () => {
    const te = 'ఎండు చేపల గుడ్డు కూర ఎండు చేపల గుడ్డు కూర';
    expect(hasTelugu(te)).toBe(true);
    expect(hasTelugu(FORTY)).toBe(false);
    expect(titleLayout(te, W).lines).toBeGreaterThanOrEqual(2);
  });

  it('a 40-character ingredient name takes 2 lines, is not cut, and the row stays at least 48', () => {
    const r = ingredientRowLayout(FORTY, '40 g', W);
    expect(r.lines).toBe(2);
    expect(r.truncated).toBe(false);
    expect(r.minHeight).toBeGreaterThanOrEqual(48);
    expect(r.minHeight).toBeGreaterThanOrEqual(2 * 22);
  });

  it('a name needing more than 2 lines ends with an ellipsis (spec 10.4) and the row still fits 2 lines', () => {
    const r = ingredientRowLayout(`${FORTY} ${FORTY}`, '40 g', W);
    expect(r.lines).toBe(2);
    expect(r.truncated).toBe(true);
  });

  it('a short name sits in the 48 dp row as drawn', () => {
    const r = ingredientRowLayout('Egg · boiled', '100 g', W);
    expect(r.lines).toBe(1);
    expect(r.minHeight).toBe(48);
  });

  it('at 1.3 x text the row grows from 48 instead of clipping', () => {
    const r = ingredientRowLayout(FORTY, '40 g', W, 1.3);
    expect(r.minHeight).toBeGreaterThan(48);
    expect(r.lines).toBe(2);
  });

  it('breaks a word longer than the line', () => {
    expect(estimateLines('Pesarapappuchaarupulusu'.repeat(3), 100, 15)).toBeGreaterThan(2);
    expect(estimateLines('', 100, 15)).toBe(1);
  });
});

describe('ingredient names: name, note, cooking method', () => {
  it('prints the mockup rows ("Dried anchovy (methallu) · fried")', () => {
    const a = ingredientLine('Dried anchovy (methallu, fried)');
    expect(a).toEqual({ main: 'Dried anchovy', aside: '(methallu)', method: 'fried', count: null });
    expect(ingredientTitle(a)).toBe('Dried anchovy (methallu)');
    expect(ingredientSuffix(a)).toBe(' · fried');
    expect(`${ingredientTitle(a)}${ingredientSuffix(a)}`).toBe('Dried anchovy (methallu) · fried');
    const e = ingredientLine('Egg (boiled)');
    expect(`${ingredientTitle(e)}${ingredientSuffix(e)}`).toBe('Egg · boiled');
  });

  it('keeps a plain name plain, and a bracket that is not a method as a note', () => {
    expect(ingredientSuffix(ingredientLine('Onion'))).toBe('');
    expect(ingredientLine('Oil')).toEqual({ main: 'Oil', aside: null, method: null, count: null });
    expect(ingredientLine('Tomato (roma)')).toEqual({ main: 'Tomato', aside: '(roma)', method: null, count: null });
  });

  it('finds a method after a comma and a count after the name', () => {
    expect(ingredientLine('Egg, boiled')).toMatchObject({ main: 'Egg', method: 'boiled' });
    expect(ingredientSuffix(ingredientLine('Egg 2'))).toBe(' · 2');
  });

  it('reads out the whole name', () => {
    expect(ingredientSpoken(ingredientLine('Dried anchovy (methallu, fried)'))).toBe('Dried anchovy (methallu), fried');
  });
});

describe('ingredient icons (spec 10.5)', () => {
  it('maps the five drawn ingredients', () => {
    expect(ingredientIcon('Dried anchovy (methallu)')).toBe('fish');
    expect(ingredientIcon('Egg')).toBe('egg');
    expect(ingredientIcon('Onion')).toBe('onion');
    expect(ingredientIcon('Tomato')).toBe('tomato');
    expect(ingredientIcon('Oil')).toBe('bottle');
  });

  it('maps the families', () => {
    expect(ingredientIcon('Chicken')).toBe('fish');
    expect(ingredientIcon('Prawns')).toBe('fish');
    expect(ingredientIcon('Garlic')).toBe('onion');
    expect(ingredientIcon('Potato')).toBe('tomato');
    expect(ingredientIcon('Ghee')).toBe('bottle');
    expect(ingredientIcon('Milk')).toBe('bottle');
  });

  it('everything else is a bowl, and eggplant is not an egg', () => {
    expect(ingredientIcon('Rice')).toBe('bowl');
    expect(ingredientIcon('Turmeric')).toBe('bowl');
    expect(ingredientIcon('Eggplant')).toBe('tomato');
  });
});

describe('the fixed button strip border', () => {
  it('shows only while content is scrolled under the strip', () => {
    expect(contentUnderFooter(1200, 600, 0)).toBe(true);
    expect(contentUnderFooter(1200, 600, 598)).toBe(true);
    expect(contentUnderFooter(1200, 600, 600)).toBe(false);
    expect(contentUnderFooter(500, 600, 0)).toBe(false);
    expect(contentUnderFooter(0, 0, 0)).toBe(false);
  });
});

describe('hero card fit (spec 10.4)', () => {
  const macros = ['100 g', '100 g', '100 g'];
  for (const outer of [390, 360]) {
    for (const scale of [1, 1.3]) {
      it(`wraps instead of overflowing at ${outer} dp, font scale ${scale}`, () => {
        const f = heroFits(outer - 48, scale, '≥ 1,250', macros);
        expect(f.fits).toBe(true);
        expect(f.availWidth).toBeLessThanOrEqual(outer - 96);
        expect(f.macroLines).toBeGreaterThanOrEqual(1);
        expect(f.macroLines).toBeLessThanOrEqual(3);
      });
    }
  }

  it('drops the donut below when the number is too wide beside it', () => {
    const f = heroFits(342, 1.3, '≥ 1,250', macros);
    expect(f.stacked).toBe(true);
    expect(f.kcalLines).toBe(2);
  });

  it('keeps a short number beside the donut and wraps the macros to two lines', () => {
    const f = heroFits(342, 1, '320', macros);
    expect(f.stacked).toBe(false);
    expect(f.kcalLines).toBe(1);
    expect(f.macroLines).toBe(2);
  });

  it('takes one macro line when the donut is below', () => {
    expect(heroFits(342, 1, '≥ 1,250', macros).macroLines).toBe(1);
  });
});
