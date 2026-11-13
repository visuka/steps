import { describe, expect, it } from '@jest/globals';

import { catalogFood } from '@/nutrition/catalog';
import { dietAllows, dietOf, pickOrder, SOURCE_FLOOR, SOURCE_PICKS, sourceLine, sourcesFor, sourcesSentence } from '@/nutrition/diet';
import { FOODS } from '@/nutrition/foods.generated';
import { DOCTOR_LINE, gapNoteText, NOTE_FOOTER, noteTitle, waterReminderLine, weeklySummaryText } from '@/nutrition/note-text';
import { NUTRIENT, NUTRIENTS } from '@/nutrition/nutrients';
import type { FoodItem, NutrientKey } from '@/nutrition/types';
import { watchOuts } from '@/nutrition/watch';

const portion = (f: FoodItem) => (f.units.find((u) => u.key === f.defaultUnit) ?? f.units[0]).grams;

describe('dietOf', () => {
  it('calls every meat, fish or egg dish non-veg or egg', () => {
    const word = /chicken|mutton|fish|egg|prawn|keema|meat/i;
    for (const f of FOODS.filter((x) => word.test(x.id) || word.test(x.name))) {
      expect([f.id, dietOf(f)]).toEqual([f.id, expect.stringMatching(/^(nonveg|egg)$/)]);
    }
    expect(dietOf(catalogFood('egg-curry')!)).toBe('egg');
    expect(dietOf(catalogFood('chicken-biryani')!)).toBe('nonveg');
    expect(dietOf(catalogFood('paneer-curry')!)).toBe('veg');
    expect(dietOf(catalogFood('dal')!)).toBe('veg');
  });
  it('reads saved and own foods by name and ingredients, else unknown', () => {
    const saved = (over: Partial<FoodItem>): FoodItem => ({
      id: 'ai:x',
      name: 'x',
      aliases: [],
      category: 'dish',
      per100g: { kcal: 100 },
      units: [{ key: 'plate', label: 'plate', grams: 300 }],
      defaultUnit: 'plate',
      source: 'AI',
      ...over,
    });
    expect(dietOf(saved({ id: 'ai:chicken-65', name: 'Chicken 65' }))).toBe('nonveg');
    expect(dietOf(saved({ name: 'Anda bhurji' }))).toBe('egg');
    expect(dietOf(saved({ name: 'Special thali' }))).toBe('unknown');
    expect(dietOf(saved({ name: 'Special thali', ingredients: [{ name: 'Rice', grams: 150 }, { name: 'Mutton', grams: 80 }] }))).toBe('nonveg');
    expect(dietOf(saved({ name: 'Grandma dal', ingredients: [{ name: 'Toor dal', grams: 50 }] }))).toBe('veg');
    expect(dietOf(saved({ id: 'own:1', category: 'own', name: 'Lunch box' }))).toBe('unknown');
  });
  it('orders diets veg ⊂ egg ⊂ nonveg, null as veg, unknown never', () => {
    expect(dietAllows('veg', 'egg')).toBe(false);
    expect(dietAllows(null, 'egg')).toBe(false);
    expect(dietAllows('egg', 'egg')).toBe(true);
    expect(dietAllows('egg', 'nonveg')).toBe(false);
    expect(dietAllows('nonveg', 'veg')).toBe(true);
    expect(dietAllows('nonveg', 'unknown')).toBe(false);
  });
});

describe('hand-picked sources', () => {
  const keys = Object.keys(SOURCE_PICKS) as NutrientKey[];
  it('every pick is in the catalog, in its tier, and gives 10% of daily need per usual portion', () => {
    const wrong: string[] = [];
    for (const key of keys) {
      for (const [tier, list] of Object.entries(SOURCE_PICKS[key]!)) {
        for (const pick of list ?? []) {
          const food = catalogFood(pick.id);
          if (!food) wrong.push(`${key}: ${pick.id} missing`);
          else if (dietOf(food) !== tier) wrong.push(`${key}: ${pick.id} is ${dietOf(food)}, listed ${tier}`);
          else if (((food.per100g[key] ?? 0) * portion(food)) / 100 < SOURCE_FLOOR * NUTRIENT[key].daily!) wrong.push(`${key}: ${pick.id} under 10%`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
  it('every suggestion keeps the 10% floor and has no high watch-out', () => {
    for (const key of keys) {
      for (const diet of [null, 'veg', 'egg', 'nonveg'] as const) {
        for (const s of sourcesFor(key, diet).foods) {
          const food = catalogFood(s.id)!;
          expect(s.amount).toBeGreaterThanOrEqual(SOURCE_FLOOR * NUTRIENT[key].daily!);
          expect(watchOuts(food, portion(food)).filter((w) => w.level === 'high')).toEqual([]);
        }
      }
    }
  });
  it('gives vegetarians only dairy for B12, and non-vegetarians fish or meat', () => {
    const veg = sourcesFor('vitB12', 'veg').foods.map((f) => catalogFood(f.id)!.category);
    expect(veg.length).toBeGreaterThanOrEqual(2);
    expect(veg.every((c) => c === 'dairy')).toBe(true);
    const nonveg = sourcesFor('vitB12', 'nonveg').foods.map((f) => catalogFood(f.id)!.category);
    expect(nonveg.some((c) => c === 'fish' || c === 'meat')).toBe(true);
  });
  it('never suggests egg or meat to vegetarians or to a diet not asked yet', () => {
    for (const key of keys) {
      for (const diet of [null, 'veg'] as const) {
        for (const s of sourcesFor(key, diet).foods) expect(dietOf(catalogFood(s.id)!)).toBe('veg');
      }
    }
  });
  it('leaves palak out of calcium', () => {
    for (const diet of [null, 'veg', 'egg', 'nonveg'] as const) {
      const ids = sourcesFor('calcium', diet, { logged: ['spinach', 'palak-paneer'] }).foods.map((f) => f.id);
      expect(ids).not.toContain('spinach');
      expect(ids).not.toContain('palak-paneer');
    }
  });
  it('puts foods logged in the last 14 days first', () => {
    const plain = sourcesFor('protein', 'veg').foods.map((f) => f.id);
    const logged = sourcesFor('protein', 'veg', { logged: ['kidney-beans'] }).foods.map((f) => f.id);
    expect(plain).not.toContain('kidney-beans');
    expect(logged[0]).toBe('kidney-beans');
  });
  it('merges milk variants into one chip, and honours "Not for me"', () => {
    const ids = sourcesFor('calcium', 'veg', { logged: ['milk', 'milk-buffalo'] }).foods.map((f) => f.id);
    expect(ids.filter((id) => id.startsWith('milk'))).toEqual(['milk-toned']);
    expect(sourcesFor('calcium', 'veg', { notForMe: ['milk-toned'] }).foods.map((f) => f.id)).not.toContain('milk-toned');
  });
  it('suggests beef only after the person logged it in the last 30 days', () => {
    expect(sourcesFor('zinc', 'nonveg', { logged: ['beef'], logged30: [] }).foods.map((f) => f.id)).not.toContain('beef');
    // Beef mince is high in saturated fat per patty, so it never passes anyway; the rule still holds for the list.
    for (const key of keys) expect(pickOrder(key, 'nonveg').map((p) => p.id)).not.toContain('beef');
  });
  it('drops the foods when fewer than 2 pass, keeping the line', () => {
    expect(sourcesFor('vitD', 'nonveg')).toEqual({ foods: [], line: 'Sunlight on face and arms.' });
  });
  it('mixes tiers for non-vegetarians', () => {
    const order = pickOrder('protein', 'nonveg').map((p) => p.id);
    expect(order.slice(0, 3)).toEqual(['chicken-breast', 'egg-boiled', 'masoor-dal']);
  });
});

describe('fallback lines', () => {
  it('covers vitamin D, B12 without a diet, and omega-3 by diet', () => {
    expect(sourceLine('vitD', 'veg')).toBe('Sunlight on face and arms.');
    expect(sourceLine('vitB12', null)).toBe('Eggs and fish have more, if you eat them.');
    expect(sourceLine('vitB12', 'veg')).toBeNull();
    expect(sourceLine('omega3', 'nonveg')).toBe('Fish like mackerel or sardine.');
    expect(sourceLine('omega3', 'veg')).toBe('Walnuts and soybeans.');
  });
});

describe('note wording', () => {
  it('writes the day note in plain words', () => {
    const t = gapNoteText({ key: 'vitC', kind: 'day', percent: 40, doctor: false }, 'veg');
    expect(t.title).toBe('Vitamin C has been on the low side lately.');
    expect(t.why).toBe('It helps heal cuts and take up iron.');
    expect(t.body).toBe('Vitamin C has been on the low side lately. It helps heal cuts and take up iron. Guava, orange and tomato have plenty.');
    expect(t.sourcesLine).toBe('Good sources: Guava, Orange, Tomato, Papaya');
    expect(t.footer).toBe(NOTE_FOOTER);
    expect(t.doctor).toBeNull();
  });
  it('adds the doctor line to a third note', () => {
    expect(gapNoteText({ key: 'iron', kind: 'week', percent: 40, doctor: true }, 'veg').body.endsWith(DOCTOR_LINE)).toBe(true);
  });
  it('says "could be higher" for adequate intakes', () => {
    expect(noteTitle({ key: 'fiber', kind: 'day' })).toBe('Fibre could be higher lately.');
  });
  it('joins sources for a sentence', () => {
    expect(sourcesSentence([{ id: 'a', label: 'Curd', amount: 1, percent: 10 }])).toBe('Curd');
    expect(
      sourcesSentence([
        { id: 'a', label: 'Curd', amount: 1, percent: 10 },
        { id: 'b', label: 'Milk', amount: 1, percent: 10 },
      ]),
    ).toBe('Curd and milk');
  });

  it('never uses words the app must not say', () => {
    const banned = [/deficien/i, /anaemi/i, /supplement/i, /\bdose/i, /\bmust\b/i, /disease/i, /\bcure/i, /prevent/i];
    const texts: string[] = [DOCTOR_LINE, NOTE_FOOTER, waterReminderLine('0.75 of 2.25 L')];
    for (const n of NUTRIENTS) texts.push(n.why);
    for (const key of Object.keys(SOURCE_PICKS) as NutrientKey[]) {
      for (const diet of [null, 'veg', 'egg', 'nonveg'] as const) {
        for (const kind of ['day', 'week'] as const) {
          const t = gapNoteText({ key, kind, percent: 30, doctor: true }, diet);
          texts.push(t.body, t.title, t.why, t.sourcesLine ?? '', t.sources.line ?? '');
        }
      }
    }
    texts.push(weeklySummaryText({ judgedDays: 5, waterMetDays: 4, onTrack: { ok: 6, known: 11 }, split: 'balanced' }).body);
    for (const text of texts) for (const word of banned) expect([text, word.test(text)]).toEqual([text, false]);
    // "must" as a word only: mustard greens and mustard oil are fine.
    expect(/\bmust\b/i.test('Mustard greens')).toBe(false);
  });
  it('keeps every why line to one short line', () => {
    for (const n of NUTRIENTS) {
      expect(n.why.length).toBeLessThanOrEqual(70);
      expect(n.why.split('. ').length).toBe(1);
    }
  });
});
