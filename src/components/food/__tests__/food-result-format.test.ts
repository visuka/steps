import { describe, expect, it } from '@jest/globals';

import {
  groupDigits,
  mealOfLabel,
  mealWord,
  nutrientRowKeys,
  nutrientLabel,
  nutrientShare,
  nutrientText,
  portionText,
  spokenNutrientText,
  splitIngredient,
} from '../food-result-format';

describe('food result text, as the mockups print it', () => {
  it('groups thousands', () => {
    expect(groupDigits('1850')).toBe('1,850');
    expect(groupDigits('412')).toBe('412');
    expect(groupDigits('12345.6')).toBe('12,345.6');
  });

  it('prints nutrients with "≥" for partly known ones', () => {
    expect(nutrientText('sodium', 1850, true)).toBe('≥ 1,850 mg');
    expect(nutrientText('iron', 3.1, true)).toBe('≥ 3.1 mg');
    expect(nutrientText('vitB12', 2.4, true)).toBe('≥ 2.4 µg');
    expect(nutrientText('protein', 38, false)).toBe('38 g');
    expect(nutrientText('kcal', 412.4, false, false)).toBe('412');
    expect(spokenNutrientText('sodium', 1850, true)).toBe('at least 1,850 mg');
  });

  it('prints the portion', () => {
    expect(portionText(1, 'bowl', 'bowl')).toBe('1 bowl');
    expect(portionText(1.5, 'bowl', 'bowl')).toBe('1.5 × bowl');
    expect(portionText(150, 'g', 'grams')).toBe('150 g');
  });

  it('splits an ingredient into name, bracketed note and count', () => {
    expect(splitIngredient('Dried anchovy (methallu)')).toEqual({ main: 'Dried anchovy', aside: '(methallu)', count: null });
    expect(splitIngredient('Egg 2')).toEqual({ main: 'Egg', aside: null, count: '2' });
    expect(splitIngredient('Oil')).toEqual({ main: 'Oil', aside: null, count: null });
    expect(splitIngredient('7 Up')).toEqual({ main: '7 Up', aside: null, count: null });
  });

  it('reads the meal from the save label and from the time', () => {
    expect(mealOfLabel('Save to lunch')).toBe('lunch');
    expect(mealOfLabel('Add')).toBeNull();
    expect(mealWord(new Date(2025, 10, 14, 8, 0))).toBe('breakfast');
    expect(mealWord(new Date(2025, 10, 14, 13, 30))).toBe('lunch');
    expect(mealWord(new Date(2025, 10, 14, 17, 0))).toBe('snacks');
    expect(mealWord(new Date(2025, 10, 14, 21, 0))).toBe('dinner');
  });

  it('names nutrients as the mockups do', () => {
    expect(nutrientLabel('sodium')).toBe('Sodium');
    expect(nutrientLabel('vitB12')).toBe('Vitamin B12');
    expect(nutrientLabel('vitB12', 'b12')).toBe('B12');
    expect(nutrientLabel('vitA', 'b12')).toBe('Vitamin A');
    expect(nutrientLabel('vitA', 'all')).toBe('Vit A');
  });

  it('lists the first five nutrients, warnings first, and the rest behind "Show all nutrients"', () => {
    const n = { kcal: 412, protein: 38, carbs: 14, fat: 22, sodium: 1850, calcium: 210, iron: 3.1, vitB12: 2.4, vitA: 180, vitC: 12, potassium: 400 };
    const { first, rest } = nutrientRowKeys(n, ['sodium']);
    expect(first).toEqual(['sodium', 'calcium', 'iron', 'vitB12', 'vitA']);
    expect(rest).toEqual(expect.arrayContaining(['vitC', 'potassium']));
    expect(rest).not.toContain('sodium');
    expect(rest).not.toContain('protein');
    expect(nutrientRowKeys({ kcal: 100 }, []).first).toEqual([]);
  });

  it('fills a bar from the limit or the daily need, never past full', () => {
    expect(nutrientShare('sodium', 1850)).toBeGreaterThan(0.9);
    expect(nutrientShare('calcium', 210)).toBeCloseTo(210 / 1300, 1);
    expect(nutrientShare('sodium', 99999)).toBe(1);
    expect(nutrientShare('calcium', 0)).toBe(0);
  });
});
