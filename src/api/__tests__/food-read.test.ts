import { describe, expect, it } from '@jest/globals';

import {
  checkDescription,
  checkRecipe,
  errorCode,
  errorFor,
  estimateRequest,
  FoodApiError,
  readEstimate,
  readFoodItem,
  readNutrients,
  readRecipe,
  tokenError,
} from '@/api/food-read';

/** A dish as the server sends it (synthetic numbers). */
const dish = (over: Record<string, unknown> = {}) => ({
  id: 'ai:0123456789ab',
  name: 'Pesarattu',
  aliases: [],
  category: 'dish',
  per100g: { kcal: 180, protein: 9, carbs: 22, fiber: 4, fat: 6, sodium: 300, gl: 9 },
  units: [
    { key: 'piece', label: 'pesarattu', grams: 121 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'piece',
  source: 'Worked out from its ingredients',
  ingredients: [
    { name: 'Moong dal (raw)', grams: 100 },
    { name: 'Oil', grams: 6 },
  ],
  ...over,
});

const thrown = (fn: () => unknown): FoodApiError => {
  try {
    fn();
  } catch (e) {
    return e as FoodApiError;
  }
  throw new Error('did not throw');
};

describe('reading nutrients', () => {
  it('keeps only known keys with finite, non-negative, possible numbers', () => {
    expect(
      readNutrients({
        kcal: 120,
        protein: 0,
        fat: -1,
        carbs: Number.NaN,
        fiber: Number.POSITIVE_INFINITY,
        sugars: '5',
        vitC: 12.5,
        madeUp: 3,
        sodium: 100_001, // more than 100 g of sodium in 100 g
        gl: 101,
      }),
    ).toEqual({ kcal: 120, protein: 0, vitC: 12.5 });
    expect(readNutrients({ kcal: 901 })).toEqual({});
    expect(readNutrients(null)).toEqual({});
    expect(readNutrients([1, 2])).toEqual({});
  });
});

describe('reading a food', () => {
  it('reads a well-formed dish as it is', () => {
    const f = readFoodItem(dish())!;
    expect(f.id).toBe('ai:0123456789ab');
    expect(f.per100g.kcal).toBe(180);
    expect(f.units.map((u) => u.key)).toEqual(['piece', 'g']);
    expect(f.defaultUnit).toBe('piece');
    expect(f.ingredients).toEqual([
      { name: 'Moong dal (raw)', grams: 100 },
      { name: 'Oil', grams: 6 },
    ]);
    expect(f.flags).toBeUndefined();
  });

  it('always has a gram unit that weighs 1 g', () => {
    const f = readFoodItem(dish({ units: [{ key: 'bowl', label: 'bowl', grams: 150 }] }))!;
    expect(f.units).toEqual([
      { key: 'bowl', label: 'bowl', grams: 150 },
      { key: 'g', label: 'grams', grams: 1 },
    ]);
    const g = readFoodItem(dish({ units: [{ key: 'g', label: 'grams', grams: 50 }] }))!;
    expect(g.units).toEqual([{ key: 'g', label: 'grams', grams: 1 }]);
    expect(g.defaultUnit).toBe('g');
  });

  it('drops bad units and falls back to a real default unit', () => {
    const f = readFoodItem(
      dish({
        units: [
          { key: 'plate', label: 'plate', grams: 0 },
          { key: 'cup', label: '', grams: 200 },
          'piece',
          { key: 'bowl', label: 'bowl', grams: 180 },
          { key: 'bowl', label: 'big bowl', grams: 300 },
        ],
        defaultUnit: 'plate',
      }),
    )!;
    expect(f.units.map((u) => [u.key, u.grams])).toEqual([
      ['bowl', 180],
      ['g', 1],
    ]);
    expect(f.defaultUnit).toBe('bowl');
  });

  it('caps text lengths and list sizes', () => {
    const f = readFoodItem(
      dish({
        name: `  ${'Very long dish name '.repeat(10)}`,
        source: 'x'.repeat(500),
        notes: Array.from({ length: 30 }, (_, i) => `Note ${i} ${'y'.repeat(300)}`),
        ingredients: Array.from({ length: 60 }, (_, i) => ({ name: `Part ${i}`, grams: 1 })),
      }),
    )!;
    expect(f.name.length).toBeLessThanOrEqual(80);
    expect(f.name.startsWith('Very long dish name')).toBe(true);
    expect(f.source.length).toBe(120);
    expect(f.notes).toHaveLength(10);
    expect(f.notes!.every((n) => n.length <= 200)).toBe(true);
    expect(f.ingredients).toHaveLength(40);
  });

  it('keeps known flags and categories only', () => {
    expect(readFoodItem(dish({ flags: ['deep-fried', 'grilled', 3] }))!.flags).toEqual(['deep-fried']);
    expect(readFoodItem(dish({ category: 'drink' }))!.category).toBe('drink');
    // 'own' would make the app treat it as a per-serving food of the person's own.
    expect(readFoodItem(dish({ category: 'own' }))!.category).toBe('dish');
    expect(readFoodItem(dish({ category: 'toString' }))!.category).toBe('dish');
    expect(readFoodItem(dish({ category: 7 }))!.category).toBe('dish');
  });

  it('never carries catalog-only marks', () => {
    const f = readFoodItem(dish({ ingredientOnly: true, cooked: true }))!;
    expect(f.ingredientOnly).toBeUndefined();
    expect(f.cooked).toBeUndefined();
  });

  it('drops foods it cannot use', () => {
    expect(readFoodItem(dish({ id: '' }))).toBeNull();
    expect(readFoodItem(dish({ id: 42 }))).toBeNull();
    expect(readFoodItem(dish({ name: '   ' }))).toBeNull();
    expect(readFoodItem(dish({ id: 'own:abc' }))).toBeNull();
    expect(readFoodItem(dish({ per100g: { protein: 3 } }))).toBeNull();
    expect(readFoodItem('pesarattu')).toBeNull();
    expect(readFoodItem(null)).toBeNull();
  });
});

describe('reading an estimate', () => {
  it('keeps good items and drops malformed ones', () => {
    const r = readEstimate({
      items: [
        { food: dish(), unit: 'piece', quantity: 2, ingredients: [{ name: 'Moong dal (raw)', grams: 200 }], cached: true },
        { food: dish({ id: 'ai:bad', per100g: {} }), unit: 'g', quantity: 100 },
        'nonsense',
        { unit: 'g', quantity: 100 },
      ],
      unknown: ["grandma's kootu", 5, '  ', 'x'.repeat(200)],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ unit: 'piece', quantity: 2, cached: true });
    expect(r.items[0].ingredients).toEqual([{ name: 'Moong dal (raw)', grams: 200 }]);
    expect(r.unknown).toEqual(["grandma's kootu", 'x'.repeat(80)]);
  });

  it('falls back to the default unit and a sensible amount', () => {
    const r = readEstimate({
      items: [
        { food: dish(), unit: 'plate', quantity: 3 },
        { food: dish({ id: 'ai:two' }), unit: 'g', quantity: -5 },
        { food: dish({ id: 'ai:three' }), unit: 'piece', quantity: 500 },
      ],
    });
    expect(r.items.map((i) => [i.unit, i.quantity, i.cached])).toEqual([
      ['piece', 1, false],
      ['g', 100, false],
      ['piece', 1, false],
    ]);
    expect(r.unknown).toEqual([]);
  });

  it('adds up the same food in the same unit, so no part of the meal is lost', () => {
    // "2 roti and 1 phulka": two names, one food.
    const r = readEstimate({
      items: [
        { food: dish(), unit: 'piece', quantity: 2, ingredients: [{ name: 'Moong dal (raw)', grams: 200 }], cached: true },
        { food: dish(), unit: 'piece', quantity: 1, ingredients: [{ name: 'Moong dal (raw)', grams: 100 }], cached: false },
      ],
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ unit: 'piece', quantity: 3, cached: false });
    expect(r.items[0].ingredients).toEqual([{ name: 'Moong dal (raw)', grams: 300 }]);
  });

  it('keeps the same food in different units as separate parts', () => {
    const r = readEstimate({ items: [{ food: dish(), unit: 'piece', quantity: 1 }, { food: dish(), unit: 'g', quantity: 50 }] });
    expect(r.items.map((i) => [i.food.id, i.unit, i.quantity])).toEqual([
      ['ai:0123456789ab', 'piece', 1],
      ['ai:0123456789ab', 'g', 50],
    ]);
  });

  it('caps an added-up amount like any other', () => {
    const r = readEstimate({ items: [{ food: dish(), unit: 'piece', quantity: 40 }, { food: dish(), unit: 'piece', quantity: 30 }] });
    expect(r.items[0].quantity).toBe(50);
  });

  it('throws a plain error for an answer it cannot read', () => {
    expect(thrown(() => readEstimate(null)).kind).toBe('bad_answer');
    expect(thrown(() => readEstimate({ items: 'none' })).kind).toBe('bad_answer');
    expect(thrown(() => readEstimate([])).message).toBe('Something went wrong. Please try again.');
  });
});

describe('where a food was from', () => {
  it('sends a place only when there is one, and a restaurant only with dine-in or delivery', () => {
    expect(estimateRequest('  biryani ')).toEqual({ description: 'biryani' });
    expect(estimateRequest('biryani', null)).toEqual({ description: 'biryani' });
    expect(estimateRequest('biryani', { place: 'home', restaurant: 'Paradise' })).toEqual({
      description: 'biryani',
      place: 'home',
    });
    expect(estimateRequest('biryani', { place: 'dine-in', restaurant: ' <Paradise> ' })).toEqual({
      description: 'biryani',
      place: 'dine-in',
      restaurant: 'Paradise',
    });
    expect(estimateRequest('pizza', { place: 'delivery', restaurant: null })).toEqual({
      description: 'pizza',
      place: 'delivery',
    });
  });

  it("reads each item's style; anything else is auto", () => {
    const r = readEstimate({
      items: [
        { food: dish({ id: 'ai:a' }), unit: 'piece', quantity: 1, style: 'restaurant' },
        { food: dish({ id: 'ai:b' }), unit: 'piece', quantity: 1, style: 'home' },
        { food: dish({ id: 'ai:c' }), unit: 'piece', quantity: 1, style: 'fancy' },
        { food: dish({ id: 'ai:d' }), unit: 'piece', quantity: 1 },
      ],
    });
    expect(r.items.map((i) => i.style)).toEqual(['restaurant', 'home', 'auto', 'auto']);
  });

  it('reads where the server took the food to be from, when it says', () => {
    const items = [{ food: dish(), unit: 'piece', quantity: 1 }];
    expect(readEstimate({ items }).where).toBeNull();
    expect(readEstimate({ items, place: 'somewhere' }).where).toBeNull();
    expect(readEstimate({ items, place: 'delivery', restaurant: 'x'.repeat(90) }).where).toEqual({
      place: 'delivery',
      restaurant: 'x'.repeat(60),
    });
    expect(readEstimate({ items, place: 'home', restaurant: 'Paradise' }).where).toEqual({ place: 'home', restaurant: null });
  });

  it("keeps a saved food's style notes, but never takes them from the server", () => {
    const saved = dish({ style: 'restaurant', restaurant: 'Paradise', homeId: 'chicken-biryani' });
    expect(readFoodItem(saved)).toMatchObject({ style: 'restaurant', restaurant: 'Paradise', homeId: 'chicken-biryani' });
    expect(readFoodItem(dish({ style: 'home', restaurant: 'Paradise', homeId: 'x' }))).toMatchObject({ style: 'home' });
    expect(readFoodItem(dish({ style: 'home', restaurant: 'Paradise', homeId: 'x' }))?.homeId).toBeUndefined();
    expect(readFoodItem(dish({ style: 'restaurant', homeId: 'own:k1' }))?.homeId).toBeUndefined();

    const food = readEstimate({ items: [{ food: saved, unit: 'piece', quantity: 1 }] }).items[0].food;
    expect(food.style).toBeUndefined();
    expect(food.restaurant).toBeUndefined();
    expect(food.homeId).toBeUndefined();
    expect(readRecipe({ food: saved, servings: 2 }).food.homeId).toBeUndefined();
  });
});

describe('reading a recipe', () => {
  it('reads the food, servings and notes', () => {
    const r = readRecipe({
      food: dish({ id: 'recipe:abc', notes: ['Salt not listed: 5 g assumed.'] }),
      servings: 4,
      cookedGrams: 820,
      ingredients: [{ name: 'Moong dal (raw)', grams: 200, method: 'pressure-cooked' }],
      notes: ['Salt not listed: 5 g assumed.'],
      cached: false,
    });
    expect(r.food.id).toBe('recipe:abc');
    expect(r.food.notes).toEqual(['Salt not listed: 5 g assumed.']);
    expect(r).toMatchObject({ servings: 4, cookedGrams: 820, cached: false });
    expect(r.ingredients).toEqual([{ name: 'Moong dal (raw)', grams: 200, method: 'pressure-cooked' }]);
  });

  it('defaults what it can and throws without a food', () => {
    const r = readRecipe({ food: dish({ id: 'recipe:abc' }), servings: 'four' });
    expect(r.servings).toBe(1);
    expect(r.notes).toEqual([]);
    expect(thrown(() => readRecipe({ servings: 4 })).kind).toBe('bad_answer');
  });
});

describe('errors and checks', () => {
  it('maps failures to short plain messages', () => {
    expect(errorFor('estimate', null).kind).toBe('offline');
    expect(errorFor('estimate', 401).kind).toBe('signin');
    expect(errorFor('recipe', 403).kind).toBe('signin');
    expect(errorFor('estimate', 422).message).toMatch(/food or drink/);
    expect(errorFor('recipe', 422).message).toMatch(/recipe/);
    expect(errorFor('estimate', 429, 'daily_limit').kind).toBe('limit');
    expect(errorFor('recipe', 429, 'daily_limit').message).toMatch(/recipes/);
    expect(errorFor('estimate', 503).kind).toBe('unavailable');
    expect(errorFor('estimate', 413).kind).toBe('too_long');
    expect(errorFor('estimate', 500).kind).toBe('other');
    expect(errorFor('estimate', 400).kind).toBe('other');
    expect(errorFor('estimate', 500)).toBeInstanceOf(FoodApiError);
  });

  it('tells API Gateway throttling from the daily limit', () => {
    // API Gateway's own 429 has no "error" field; it means "try again in a moment".
    expect(errorFor('estimate', 429).kind).toBe('busy');
    expect(errorFor('recipe', 429, errorCode({ message: 'Too Many Requests' })).kind).toBe('busy');
    expect(errorFor('estimate', 429, errorCode({ error: 'daily_limit' })).kind).toBe('limit');
    expect(errorFor('estimate', 429).message).toMatch(/moment/);
  });

  it('reads the error code of a failed reply', () => {
    expect(errorCode({ error: 'daily_limit' })).toBe('daily_limit');
    expect(errorCode({ error: 5 })).toBeUndefined();
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode('daily_limit')).toBeUndefined();
  });

  it('says offline, not "sign in again", when the session could not be renewed', () => {
    const named = (name: string, extra: object = {}) => Object.assign(new Error('x'), { name }, extra);
    // Supabase: getSession() with no signal and an expired token.
    expect(tokenError('estimate', named('AuthRetryableFetchError')).kind).toBe('offline');
    // The passkeys session (src/auth/session.ts on that branch).
    expect(tokenError('estimate', named('AuthApiError', { code: 'offline' })).kind).toBe('offline');
    expect(tokenError('estimate', named('AuthApiError', { code: 'server' })).kind).toBe('other');
    expect(tokenError('estimate', named('AuthApiError', { code: 'signed_out' })).kind).toBe('signin');
    expect(tokenError('recipe', named('AuthSessionMissingError')).kind).toBe('signin');
    expect(tokenError('estimate', null).kind).toBe('signin');
    expect(tokenError('estimate', undefined).kind).toBe('signin');
  });

  it('checks a description before sending it', () => {
    expect(checkDescription('2 idli and sambar')).toBeNull();
    expect(checkDescription('   ')).not.toBeNull();
    expect(checkDescription('a'.repeat(201))).toMatch(/200/);
  });

  it('checks a recipe before sending it', () => {
    const ok = { name: 'Kootu', ingredients: '1 cup moong dal, salt', steps: '' };
    expect(checkRecipe(ok)).toBeNull();
    expect(checkRecipe({ ...ok, servings: 4, unit: 'bowl' })).toBeNull();
    expect(checkRecipe({ ...ok, name: ' ' })).not.toBeNull();
    expect(checkRecipe({ ...ok, ingredients: '' })).not.toBeNull();
    expect(checkRecipe({ ...ok, steps: 'x'.repeat(1501) })).not.toBeNull();
    expect(checkRecipe({ ...ok, servings: 0 })).not.toBeNull();
    expect(checkRecipe({ ...ok, servings: 51 })).not.toBeNull();
    expect(checkRecipe({ ...ok, servings: 2.5 })).not.toBeNull();
  });
});
