import { describe, expect, it } from '@jest/globals';

import { errorFor, FoodApiError, readEstimate, timedOut } from '@/api/food-read';
import {
  checkFill,
  fieldDecimals,
  FILLED_NOTE,
  fillDescription,
  fillErrorMessage,
  fillFromEstimate,
  fillKey,
  fillNote,
  mergeFill,
  STALE_NOTE,
  ZERO_NOTE,
} from '@/nutrition/own-fill';

/** A food as the server sends it (synthetic numbers). */
const food = (id: string, per100g: Record<string, number>, units: { key: string; label: string; grams: number }[]) => ({
  id,
  name: id.replace('ai:', ''),
  aliases: [],
  category: 'dish',
  per100g,
  units: [...units, { key: 'g', label: 'grams', grams: 1 }],
  defaultUnit: units[0]?.key ?? 'g',
  source: 'Worked out from its ingredients',
});

const bhujia = food('ai:bhujia', { kcal: 560, protein: 12, fat: 38, sodium: 900, iron: 3, vitC: 0.5, vitB12: 0.04 }, [
  { key: 'packet', label: 'packet', grams: 40 },
]);
const milk = food('ai:milk', { kcal: 60, protein: 3.2, carbs: 4.8, calcium: 120 }, [{ key: 'glass', label: 'glass', grams: 250 }]);
const banana = food('ai:banana', { kcal: 90, protein: 1.1, carbs: 23, potassium: 360 }, [{ key: 'piece', label: 'banana', grams: 120 }]);

const answer = (items: unknown[], unknown: string[] = []) => readEstimate({ items, unknown });

describe('fillDescription', () => {
  it('puts the serving before the name', () => {
    expect(fillDescription('Haldiram aloo bhujia', '1 packet')).toBe('1 packet of Haldiram aloo bhujia');
    expect(fillDescription(' my  protein shake ', 'half glass')).toBe('half glass of my protein shake');
  });
  it('makes a serving with no amount one of it', () => {
    expect(fillDescription('Bhujia', 'packet')).toBe('1 packet of Bhujia');
  });
  it('leaves a loose amount as it is', () => {
    expect(fillDescription('Chakli', 'few pieces')).toBe('few pieces of Chakli');
    expect(fillDescription('Chivda', 'some')).toBe('some of Chivda');
    expect(fillDescription('Ladoo', 'couple')).toBe('couple of Ladoo');
  });
  it('sends the name alone with no serving', () => {
    expect(fillDescription('Haldiram aloo bhujia, 1 packet', '')).toBe('Haldiram aloo bhujia, 1 packet');
  });
  it('needs a name and keeps under the server limit', () => {
    expect(checkFill('  ', '1 packet')).toBe('Type the food’s name first.');
    expect(checkFill('x'.repeat(220), '')).toMatch(/under 200/);
    expect(checkFill('Bhujia', '1 packet')).toBeNull();
  });
  it('keys on description and place', () => {
    expect(fillKey('1 packet of X', null)).toBe(fillKey('1 PACKET of x', undefined));
    expect(fillKey('X', { place: 'home', restaurant: null })).not.toBe(fillKey('X', { place: 'delivery', restaurant: 'A' }));
  });
});

describe('fillFromEstimate', () => {
  it('scales per 100 g to exactly one serving', () => {
    const out = fillFromEstimate(answer([{ food: bhujia, unit: 'packet', quantity: 1 }]));
    expect(out.kind).toBe('filled');
    if (out.kind !== 'filled') return;
    // 40 g of the per-100 g values.
    expect(out.nutrients.kcal).toBe(224);
    expect(out.nutrients.protein).toBeCloseTo(4.8);
    expect(out.nutrients.fat).toBeCloseTo(15.2);
    expect(out.serving).toBe('1 packet');
    expect(out.parts).toEqual([]);
  });

  it('counts the quantity and the person’s own portion size', () => {
    const two = fillFromEstimate(answer([{ food: bhujia, unit: 'packet', quantity: 2 }]));
    expect(two.kind === 'filled' && two.nutrients.kcal).toBe(448);
    const bigger = fillFromEstimate(answer([{ food: bhujia, unit: 'packet', quantity: 1 }]), { 'ai:bhujia:packet': 50 });
    expect(bigger.kind === 'filled' && bigger.nutrients.kcal).toBe(280);
  });

  it('keeps the full map, beyond the fields the form shows', () => {
    const out = fillFromEstimate(answer([{ food: bhujia, unit: 'packet', quantity: 1 }]));
    if (out.kind !== 'filled') throw new Error('not filled');
    expect(out.nutrients.iron).toBeCloseTo(1.2);
    expect(out.nutrients.vitC).toBeCloseTo(0.2);
    // Small amounts aren't rounded to zero.
    expect(out.nutrients.vitB12).toBeCloseTo(0.016);
    expect(out.nutrients.vitB12).toBeGreaterThan(0);
    // Unknown stays unknown, never zero.
    expect(out.nutrients.calcium).toBeUndefined();
  });

  it('adds up several foods as the one thing named', () => {
    const out = fillFromEstimate(
      answer([
        { food: milk, unit: 'glass', quantity: 1 },
        { food: banana, unit: 'piece', quantity: 1 },
      ]),
    );
    if (out.kind !== 'filled') throw new Error('not filled');
    expect(out.nutrients.kcal).toBe(258); // 150 + 108
    expect(out.nutrients.protein).toBeCloseTo(9.32); // 8 + 1.32
    expect(out.nutrients.carbs).toBeCloseTo(39.6); // 12 + 27.6
    expect(out.serving).toBeNull();
    expect(out.parts).toEqual(['milk (1 glass)', 'banana (1 banana)']);
  });

  it('leaves a nutrient unknown when one of the foods added up has no figure for it', () => {
    const out = fillFromEstimate(
      answer([
        { food: milk, unit: 'glass', quantity: 1 },
        { food: banana, unit: 'piece', quantity: 1 },
      ]),
    );
    if (out.kind !== 'filled') throw new Error('not filled');
    // Banana has no calcium and milk no potassium: a partial sum would look complete in day totals.
    expect(out.nutrients.calcium).toBeUndefined();
    expect(out.nutrients.potassium).toBeUndefined();
  });

  it('ignores a zero-calorie part when checking what is known', () => {
    const water = food('ai:water', { kcal: 0 }, [{ key: 'glass', label: 'glass', grams: 250 }]);
    const out = fillFromEstimate(
      answer([
        { food: milk, unit: 'glass', quantity: 1 },
        { food: water, unit: 'glass', quantity: 1 },
      ]),
    );
    if (out.kind !== 'filled') throw new Error('not filled');
    expect(out.nutrients.calcium).toBeCloseTo(300);
  });

  it('says so when it comes out at 0 calories', () => {
    const tea = food('ai:black tea', { kcal: 1 }, [{ key: 'cup', label: 'cup', grams: 20 }]);
    expect(fillFromEstimate(answer([{ food: tea, unit: 'cup', quantity: 1 }]))).toEqual({ kind: 'zero' });
    expect(ZERO_NOTE).toMatch(/0 calories/);
  });

  it('offers the recipe for a dish the server couldn’t work out, even with other parts', () => {
    expect(fillFromEstimate(answer([], ['Mom’s shake']))).toEqual({ kind: 'unknown', name: 'Mom’s shake' });
    expect(fillFromEstimate(answer([{ food: milk, unit: 'glass', quantity: 1 }], ['Secret mix']))).toEqual({
      kind: 'unknown',
      name: 'Secret mix',
    });
  });

  it('says nothing was found for an empty answer', () => {
    expect(fillFromEstimate(answer([]))).toEqual({ kind: 'nothing' });
  });
});

describe('mergeFill', () => {
  const ai = { kcal: 224, protein: 4.8, fat: 15.2, iron: 1.2 };

  it('fills every value on a fresh form', () => {
    expect(mergeFill({}, [], ai)).toEqual(ai);
  });

  it('keeps what the person typed', () => {
    expect(mergeFill({ kcal: 210, protein: 5 }, ['kcal'], ai)).toEqual({ kcal: 210, protein: 4.8, fat: 15.2, iron: 1.2 });
  });

  it('keeps a value the person cleared cleared', () => {
    expect(mergeFill({ kcal: 224 }, ['fat'], ai)).toEqual({ kcal: 224, protein: 4.8, iron: 1.2 });
  });

  it('drops an earlier fill’s values the new answer doesn’t have', () => {
    const first = mergeFill({}, [], { ...ai, calcium: 40 });
    expect(mergeFill(first, [], ai).calcium).toBeUndefined();
  });

  it('keeps typed values the AI didn’t give', () => {
    expect(mergeFill({ addedSugar: 3 }, ['addedSugar'], ai)).toEqual({ ...ai, addedSugar: 3 });
  });
});

describe('fillNote', () => {
  it('shows nothing before a fill', () => {
    expect(fillNote(null, 'k')).toBeNull();
  });
  it('says filled while the name and serving match', () => {
    expect(fillNote('k', 'k')).toBe(FILLED_NOTE);
  });
  it('stays stale after a later Fill for a new name fails', () => {
    // Filled for bhujia, renamed to laddu, Fill failed: the bhujia numbers are still on screen.
    const bhujiaKey = fillKey(fillDescription('Haldiram aloo bhujia', 'packet'), null);
    const nowKey = fillKey(fillDescription('Mom’s special laddu', 'packet'), null);
    expect(fillNote(bhujiaKey, nowKey)).toBe(STALE_NOTE);
  });
  it('doesn’t claim it was guessed', () => {
    expect(FILLED_NOTE).not.toMatch(/AI|guess/i);
  });
});

describe('fieldDecimals', () => {
  it('never shows a small amount as zero', () => {
    expect((0.04).toFixed(fieldDecimals('riboflavin', 0.04))).toBe('0.04');
    expect((0.045).toFixed(fieldDecimals('thiamin', 0.045))).toBe('0.045');
    expect((0.0042).toFixed(fieldDecimals('vitB12', 0.0042))).toBe('0.0042');
  });
  it('keeps one decimal from 1 up and whole calories', () => {
    expect(fieldDecimals('protein', 12.5)).toBe(1);
    expect(fieldDecimals('protein', null)).toBe(1);
    expect(fieldDecimals('kcal', 0.4)).toBe(0);
  });
});

describe('fillErrorMessage', () => {
  it('says not food plainly', () => {
    expect(fillErrorMessage(errorFor('estimate', 422))).toBe('That doesn’t look like food or drink. Check the name and serving.');
  });
  it('offers the label at the daily limit', () => {
    expect(fillErrorMessage(errorFor('estimate', 429, 'daily_limit'))).toMatch(/today’s limit.*type the values from the label/);
  });
  it('treats a busy gateway as busy, not the limit', () => {
    expect(fillErrorMessage(errorFor('estimate', 429))).toMatch(/Lots of people/);
  });
  it('says offline and offers typing', () => {
    expect(fillErrorMessage(errorFor('estimate', null))).toMatch(/internet, or type the values in yourself/);
  });
  it('names premium', () => {
    expect(fillErrorMessage(errorFor('estimate', 402))).toMatch(/Premium/);
  });
  it('says a slow answer took too long', () => {
    expect(fillErrorMessage(timedOut())).toBe('That took too long. Please try again, or type the values in yourself.');
  });
  it('offers typing when the server is busy or down', () => {
    expect(fillErrorMessage(errorFor('estimate', 429))).toMatch(/or type the values in yourself/);
    expect(fillErrorMessage(new FoodApiError('unavailable', 'x'))).toMatch(/or type the values in yourself/);
  });
  it('never shows a raw error', () => {
    expect(fillErrorMessage(new TypeError('x is undefined'))).toMatch(/^Something went wrong/);
  });
});
