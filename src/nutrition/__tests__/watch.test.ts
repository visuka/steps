import { describe, expect, it } from '@jest/globals';

import type { FoodItem, Nutrients } from '@/nutrition/types';
import { glBand, glycemicIndex, watchOuts } from '@/nutrition/watch';

/** Synthetic foods only: the built-in list is regenerated separately. */
const food = (per100g: Nutrients, over: Partial<FoodItem> = {}): FoodItem => ({
  id: 'ai:test',
  name: 'Test dish',
  aliases: [],
  category: 'dish',
  per100g,
  units: [
    { key: 'bowl', label: 'bowl', grams: 150 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'bowl',
  source: 'test',
  ...over,
});

const texts = (f: FoodItem, grams: number) => watchOuts(f, grams).map((w) => w.text);

describe('watch-outs per 100 g (UK FSA)', () => {
  it('rates salt high, medium or not at all', () => {
    expect(watchOuts(food({ sodium: 700 }), 100)).toEqual([{ key: 'sodium', level: 'high', text: 'High in salt' }]);
    expect(texts(food({ sodium: 600 }), 100)).toEqual(['Medium salt']);
    expect(texts(food({ sodium: 121 }), 100)).toEqual(['Medium salt']);
    expect(texts(food({ sodium: 120 }), 100)).toEqual([]);
  });

  it('rates fat, saturated fat and sugar', () => {
    expect(texts(food({ fat: 18, satFat: 6, sugars: 23 }), 100)).toEqual([
      'High in sugar',
      'High in saturated fat',
      'High in fat',
    ]);
    expect(texts(food({ fat: 4, satFat: 2, sugars: 6 }), 100)).toEqual(['Medium sugar', 'Medium saturated fat', 'Medium fat']);
    expect(texts(food({ fat: 3, satFat: 1.5, sugars: 5 }), 100)).toEqual([]);
  });

  it('uses half the thresholds for drinks, with their own salt figures', () => {
    const drink = (n: Nutrients) => food(n, { category: 'drink' });
    expect(texts(drink({ sugars: 12 }), 250)).toEqual(['High in sugar']);
    expect(texts(food({ sugars: 12 }), 100)).toEqual(['Medium sugar']);
    expect(texts(drink({ fat: 9 }), 100)).toEqual(['High in fat']);
    expect(texts(drink({ satFat: 1 }), 100)).toEqual(['Medium saturated fat']);
    expect(texts(drink({ sodium: 350 }), 100)).toEqual(['High in salt']);
    expect(texts(drink({ sodium: 200 }), 100)).toEqual(['Medium salt']);
  });

  it('rates a big portion high on what it holds', () => {
    const f = food({ fat: 15 });
    expect(texts(f, 100)).toEqual(['Medium fat']);
    // 140 g holds exactly 21 g: not more than 21.
    expect(texts(f, 140)).toEqual(['Medium fat']);
    expect(texts(f, 150)).toEqual(['High in fat']);
    expect(texts(food({ sodium: 500 }), 150)).toEqual(['High in salt']);
    // 100 g or less never uses the portion rule.
    expect(texts(food({ sugars: 20 }), 100)).toEqual(['Medium sugar']);
  });

  it('mentions trans fat from 0.5 g in the portion', () => {
    const f = food({ transFat: 0.4 });
    expect(texts(f, 100)).toEqual([]);
    expect(watchOuts(f, 125)).toEqual([{ key: 'transFat', level: 'high', text: 'Has trans fat' }]);
  });

  it('flags deep-fried food, after the highs', () => {
    const out = watchOuts(food({ sodium: 700, fat: 5 }, { flags: ['deep-fried'] }), 100);
    expect(out.map((w) => [w.key, w.level])).toEqual([
      ['sodium', 'high'],
      ['deep-fried', 'medium'],
      ['fat', 'medium'],
    ]);
  });

  it('judges own foods (per serving) only on what the portion holds', () => {
    const own = food({ sodium: 700, fat: 10 }, { id: 'own:x', category: 'own' });
    // One serving is 100 "grams": 700 mg is not over 720 mg.
    expect(texts(own, 100)).toEqual([]);
    expect(texts(own, 200)).toEqual(['High in salt']);
  });

  it('says nothing about nutrients it does not know', () => {
    expect(watchOuts(food({ kcal: 300 }), 500)).toEqual([]);
  });
});

describe('glycemic index and load', () => {
  it('works the GI back from the glycemic load', () => {
    // 28 g of available carbs, GL 19.6 → GI 70.
    expect(glycemicIndex(food({ carbs: 30, fiber: 2, gl: 19.6 }))).toBe(70);
    expect(glycemicIndex(food({ carbs: 20, gl: 10 }))).toBe(50);
  });

  it('gives no GI when there is little available carb or no glycemic load', () => {
    expect(glycemicIndex(food({ carbs: 4, gl: 2 }))).toBeNull();
    expect(glycemicIndex(food({ carbs: 6, fiber: 2, gl: 2 }))).toBeNull();
    expect(glycemicIndex(food({ carbs: 30 }))).toBeNull();
    expect(glycemicIndex(food({ gl: 5 }))).toBeNull();
  });

  it('bands a portion and a day', () => {
    expect(glBand(10, 'portion')).toBe('low');
    expect(glBand(15, 'portion')).toBe('medium');
    expect(glBand(20, 'portion')).toBe('high');
    expect(glBand(79, 'day')).toBe('low');
    expect(glBand(100, 'day')).toBe('medium');
    expect(glBand(121, 'day')).toBe('high');
  });

  it('bands the edges as the notes say: a portion up to 10 low, 20 up high; a day under 80 low, over 120 high', () => {
    expect(glBand(11, 'portion')).toBe('medium');
    expect(glBand(19, 'portion')).toBe('medium');
    expect(glBand(80, 'day')).toBe('medium');
    expect(glBand(120, 'day')).toBe('medium');
  });

  it('bands the whole number shown, so "10" is never called medium', () => {
    expect(glBand(10.4, 'portion')).toBe('low');
    expect(glBand(19.6, 'portion')).toBe('high');
    expect(glBand(79.4, 'day')).toBe('low');
    expect(glBand(120.4, 'day')).toBe('medium');
    expect(glBand(120.6, 'day')).toBe('high');
  });
});
