import { describe, expect, it } from '@jest/globals';

import { DEFAULT_PROFILE, mergeProfile } from '@/data/profile';
import type { FoodEntry } from '@/data/types';
import { FOODS } from '@/nutrition/foods.generated';
import { NUTRIENT } from '@/nutrition/nutrients';
import {
  attentionFirst,
  collapsedRows,
  groupSummary,
  highWatchChips,
  kcalBalanceText,
  MACRO_KEYS,
  MINERAL_KEYS,
  nutrientRows,
  overDays,
  shortFoodName,
  VITAMIN_KEYS,
  type ViewContext,
  viewContext,
  WATCH_KEYS,
} from '@/nutrition/view';
import { watchOuts } from '@/nutrition/watch';

const ctx: ViewContext = { sex: 'unspecified', weightKg: 65, heightCm: 165, age: 40, kcalTarget: 2000, plain: false };
const full = (keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, 1]));

describe('groups', () => {
  it('puts omega-3 last in Minerals and keeps the four watch-outs', () => {
    expect(MINERAL_KEYS.at(-1)).toBe('omega3');
    expect(WATCH_KEYS).toEqual(['sodium', 'addedSugar', 'satFat', 'transFat']);
    expect(MACRO_KEYS).toEqual(['protein', 'carbs', 'fat', 'fiber']);
    expect(VITAMIN_KEYS.every((k) => NUTRIENT[k].group === 'vitamin')).toBe(true);
  });
});

describe('row values', () => {
  it('writes macros as "62 of 54 g" and micros as "45 mg · 50%"', () => {
    const [protein] = nutrientRows(['protein'], { protein: 62 }, { protein: 1 }, ctx, false, 'of');
    expect(protein.valueText).toBe(`62 of ${protein.state.target.daily} g`);
    const [vitC] = nutrientRows(['vitC'], { vitC: 45 }, { vitC: 1 }, ctx, false, 'percent');
    expect(vitC.valueText).toBe('45 mg · 50%');
    expect(vitC.state.word).toBe('So far');
  });
  it('says "≥" when part of the food has no figure, and "Not known" when too little does', () => {
    const [a] = nutrientRows(['sodium'], { sodium: 1200 }, { sodium: 0.9 }, ctx, false, 'of');
    expect(a.valueText).toBe('≥ 1,200 of 2,000 mg');
    const [b] = nutrientRows(['vitC'], { vitC: 45 }, { vitC: 0.5 }, ctx, true, 'percent');
    expect(b.valueText).toBe('Not known');
    expect(b.state.bar).toBe(0);
  });
  it('gives every row a spoken label with its state word', () => {
    const [r] = nutrientRows(['vitC'], { vitC: 30 }, { vitC: 1 }, ctx, true, 'percent');
    expect(r.spoken).toBe('Vitamin C, 30 milligrams, 33 percent of daily need, low');
  });
  it('shows numbers only for "My needs are different"', () => {
    const rows = nutrientRows(VITAMIN_KEYS, { vitC: 10, vitA: 100 }, full(VITAMIN_KEYS), { ...ctx, plain: true }, true, 'percent');
    expect(rows.filter((r) => r.value !== undefined).every((r) => r.state.word === '')).toBe(true);
  });
});

describe('order and summary', () => {
  const rows = nutrientRows(
    ['vitC', 'vitA', 'vitE', 'vitK', 'thiamin'],
    { vitC: 100, vitA: 100, vitE: 2 },
    { vitC: 1, vitA: 1, vitE: 1, vitK: 0, thiamin: 0 },
    ctx,
    true,
    'percent',
  );
  it('counts states in plain words; adequate intakes "could be higher", never "low"', () => {
    expect(groupSummary(rows)).toBe('1 on track · 1 low · 1 could be higher · 2 not known');
  });
  it('shows rows that need a look first, and only those while collapsed', () => {
    expect(attentionFirst(rows).map((r) => r.key)).toEqual(['vitA', 'vitE', 'vitK', 'thiamin', 'vitC']);
    expect(collapsedRows(rows).map((r) => r.key)).toEqual(['vitA', 'vitE']);
  });
  it('has no summary for numbers only', () => {
    expect(groupSummary(nutrientRows(['vitC'], { vitC: 10 }, { vitC: 1 }, { ...ctx, plain: true }, true, 'percent'))).toBeNull();
  });
});

describe('week and day helpers', () => {
  it('counts days over a limit only where the figure is known', () => {
    const days = [
      { total: { sodium: 2500 }, coverage: { sodium: 1 } },
      { total: { sodium: 2100 }, coverage: { sodium: 0.5 } },
      { total: { sodium: 900 }, coverage: { sodium: 1 } },
    ];
    expect(overDays(days, 'sodium')).toBe(1);
    expect(overDays(days, 'vitC')).toBe(0);
  });
  it('words the calorie balance neutrally, to the nearest 10', () => {
    expect(kcalBalanceText(1240, 1900)).toBe('About 660 left');
    expect(kcalBalanceText(0, 1744)).toBe('About 1,740 left');
    expect(kcalBalanceText(2210, 1900)).toBe('About 310 over');
    expect(kcalBalanceText(1890, 1900)).toBe('About on target');
  });
  it('shortens food names for chips', () => {
    expect(shortFoodName('Toor dal (cooked, plain)')).toBe('Toor dal');
  });
  it('lists high watch-outs from the day’s foods once each', () => {
    const e = (id: string, name: string, unit: string, quantity: number): FoodEntry => ({
      id: `${id}${quantity}`,
      loggedAt: 0,
      name,
      foodId: id,
      unit,
      quantity,
      kcal: 0,
      healthSampleId: null,
      place: 'home',
      restaurant: null,
    });
    const high = FOODS.find((f) => watchOuts(f, f.units.find((u) => u.key === f.defaultUnit)!.grams).some((w) => w.level === 'high'))!;
    const twice = [e(high.id, high.name, high.defaultUnit, 1), e(high.id, high.name, high.defaultUnit, 2), e('nope', 'Mystery', 'g', 1)];
    const chips = highWatchChips(twice, { own: [], saved: [], overrides: {} });
    expect(chips.length).toBeGreaterThan(0);
    expect(new Set(chips).size).toBe(chips.length);
    expect(chips.every((c) => c.startsWith(`${shortFoodName(high.name)}: high in `))).toBe(true);
  });
  it('builds the context from the profile, under 18 as numbers only', () => {
    const now = new Date(2026, 10, 13);
    expect(viewContext(DEFAULT_PROFILE, now, 0).plain).toBe(false);
    expect(viewContext(mergeProfile(DEFAULT_PROFILE, { birthYear: 2012 }), now, 0).plain).toBe(true);
    expect(viewContext(mergeProfile(DEFAULT_PROFILE, { nutrition: { differentNeeds: true } }), now, 0).plain).toBe(true);
  });
});
