import { describe, expect, it } from '@jest/globals';

import { OFF_ATTRIBUTION, type LabelResult, type ScanProduct } from '@/api/scan-read';

import { labelFood, ownFoodFromScan, productTable, productTitle, scanEntry } from '../scan';
import {
  dropQueued,
  findRecent,
  linkOwn,
  OWN_MAX,
  QUEUE_MAX,
  queueCode,
  readOwnByCode,
  readQueue,
  readRecent,
  RECENT_MAX,
  type RecentScan,
  rememberScan,
} from '../scan-cache';
import { queueAction, scanReducer, type ScanStep, START } from '../scan-flow';
import type { FoodItem } from '../types';

const GTIN = '08901058851298';

const biscuits = (): FoodItem => ({
  id: `gtin-${GTIN}`,
  name: 'Marie biscuits',
  aliases: [],
  category: 'sweet',
  per100g: { kcal: 440, protein: 7, carbs: 75, fat: 12, sodium: 300 },
  units: [
    { key: 'serving', label: '4 biscuits (25 g)', grams: 25 },
    { key: 'pack', label: 'pack (250 g)', grams: 250 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'serving',
  source: 'Open Food Facts contributors (ODbL)',
  barcode: GTIN,
  brand: 'Acme',
  origin: 'off',
});

const juice = (): FoodItem => ({
  ...biscuits(),
  id: 'gtin-08901234567890',
  name: 'Mango drink',
  per100g: { kcal: 60, carbs: 15, sugars: 14 },
  units: [
    { key: 'pack', label: 'pack (200 ml)', grams: 200 },
    { key: 'ml', label: 'ml', grams: 1 },
    { key: 'g', label: 'ml', grams: 1 },
  ],
  defaultUnit: 'pack',
});

const product: ScanProduct = { gtin: GTIN, name: 'Marie biscuits', brand: 'Acme', origin: 'off', attribution: { text: OFF_ATTRIBUTION } };

describe('the saved entry', () => {
  it('logs the amount picked, with calories worked out from it', () => {
    const { entry, nutrients } = scanEntry(biscuits(), 'serving', 2, {}, 1_000, 'e1');
    expect(entry).toEqual({
      id: 'e1',
      loggedAt: 1_000,
      name: 'Marie biscuits',
      foodId: `gtin-${GTIN}`,
      unit: 'serving',
      quantity: 2,
      kcal: 220,
      healthSampleId: null,
      place: 'home',
      restaurant: null,
    });
    expect(nutrients.protein).toBeCloseTo(3.5);
    // Unknown stays unknown.
    expect(nutrients.fiber).toBeUndefined();
  });

  it('uses the person’s own portion size for the pack', () => {
    const { entry } = scanEntry(biscuits(), 'serving', 1, { [`gtin-${GTIN}:serving`]: 30 }, 0, 'e2');
    expect(entry.kcal).toBe(132);
  });
});

describe('Add to my foods', () => {
  it('one serving, named "Brand Name"', () => {
    const own = ownFoodFromScan(biscuits(), 'serving', 'o1', 5);
    expect(own).toEqual({
      id: 'o1',
      name: 'Acme Marie biscuits',
      serving: '4 biscuits (25 g)',
      nutrients: { kcal: 110, protein: 1.75, carbs: 19, fat: 3, sodium: 75 },
      updatedAt: 5,
    });
  });

  it('grams become 100 g; liquids 100 ml', () => {
    expect(ownFoodFromScan(biscuits(), 'g', 'o2', 0)).toMatchObject({ serving: '100 g', nutrients: biscuits().per100g });
    expect(ownFoodFromScan(juice(), 'ml', 'o3', 0)).toMatchObject({ serving: '100 ml', nutrients: { kcal: 60, carbs: 15, sugars: 14 } });
    expect(ownFoodFromScan(juice(), 'pack', 'o4', 0)).toMatchObject({ serving: 'pack (200 ml)', nutrients: { kcal: 120, carbs: 30, sugars: 28 } });
  });

  it('uses and shows the grams the person set for the serving', () => {
    const own = ownFoodFromScan(biscuits(), 'serving', 'o5', 0, { [`gtin-${GTIN}:serving`]: 40 });
    expect(own.serving).toBe('4 biscuits (40 g)');
    expect(own.nutrients).toEqual({ kcal: 176, protein: 2.8, carbs: 30, fat: 4.8, sodium: 120 });
    // Unchanged units, and overrides for other foods, keep the pack's label.
    expect(ownFoodFromScan(biscuits(), 'serving', 'o6', 0, { 'gtin-other:serving': 40 }).serving).toBe('4 biscuits (25 g)');
    expect(ownFoodFromScan(juice(), 'pack', 'o7', 0, { [`${juice().id}:pack`]: 330 }).serving).toBe('pack (330 ml)');
  });

  it('does not repeat a brand already in the name', () => {
    expect(productTitle('Acme Marie Gold', 'Acme')).toBe('Acme Marie Gold');
    expect(productTitle('Marie Gold', '  ')).toBe('Marie Gold');
    expect(productTitle('x'.repeat(90), 'B')).toHaveLength(80);
  });
});

describe('the pack table', () => {
  it('per serving and per 100 g, in label order, known keys only', () => {
    const rows = productTable(biscuits(), ['kcal', 'protein', 'fiber', 'sodium']);
    expect(rows.map((r) => r.key)).toEqual(['kcal', 'protein', 'sodium']);
    expect(rows[0]).toMatchObject({ per100: 440, perServing: 110, unit: 'kcal' });
    expect(rows[2]).toMatchObject({ per100: 300, perServing: 75, unit: 'mg' });
  });

  it('no serving column without a serving', () => {
    expect(productTable(juice(), ['kcal'])[0].perServing).toBeNull();
  });
});

describe('a label read kept privately', () => {
  it('gets the name and serving the person gave', () => {
    const f = labelFood(biscuits(), { name: ' Marie Gold ', brand: 'Acme', servingGrams: 30, servingLabel: '5 biscuits' });
    expect(f.name).toBe('Marie Gold');
    expect(f.units).toEqual([
      { key: 'serving', label: '5 biscuits (30 g)', grams: 30 },
      { key: 'g', label: 'grams', grams: 1 },
    ]);
    expect(f.defaultUnit).toBe('serving');
    expect(ownFoodFromScan(f, f.defaultUnit, 'o5', 0)).toMatchObject({
      name: 'Acme Marie Gold',
      serving: '5 biscuits (30 g)',
      nutrients: { kcal: 132 },
    });
  });

  it('with no serving, per 100 g', () => {
    const f = labelFood(biscuits(), { name: 'Rusk', brand: '', servingGrams: null, servingLabel: '' });
    expect(f.defaultUnit).toBe('g');
    expect(ownFoodFromScan(f, f.defaultUnit, 'o6', 0).serving).toBe('100 g');
  });
});

describe('recent scans on the phone', () => {
  const scan = (gtin: string, at = 0): RecentScan => ({ gtin, food: biscuits(), product: { ...product, gtin }, at });

  it('newest first, one per code, at most 100', () => {
    let list: RecentScan[] = [];
    for (let i = 0; i < RECENT_MAX + 5; i++) list = rememberScan(list, scan(String(i).padStart(14, '0'), i));
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0].at).toBe(RECENT_MAX + 4);
    list = rememberScan(list, scan(list[50].gtin, 999));
    expect(list).toHaveLength(RECENT_MAX);
    expect(list[0].at).toBe(999);
    expect(findRecent(list, list[0].gtin)?.at).toBe(999);
    expect(findRecent(list, '99999999999999')).toBeNull();
  });

  it('reads back checked, with the scan’s notes and the OFF line restored', () => {
    const stored = JSON.parse(JSON.stringify([scan(GTIN, 7)]));
    stored[0].product.attribution = { text: 'anything', url: 'https://evil.example/x' };
    const [back] = readRecent([...stored, { gtin: 'nope' }, { gtin: GTIN, food: { id: 'own:x' }, product: {} }, null]);
    expect(back.gtin).toBe(GTIN);
    expect(back.food).toMatchObject({ barcode: GTIN, brand: 'Acme', origin: 'off', per100g: biscuits().per100g });
    expect(back.product.attribution).toEqual({ text: OFF_ATTRIBUTION, url: 'https://world.openfoodfacts.org/product/8901058851298' });
    expect(readRecent('junk')).toEqual([]);
  });

  it('codes to look up later: once each, oldest dropped', () => {
    let q: string[] = [];
    for (let i = 0; i < QUEUE_MAX + 3; i++) q = queueCode(q, String(i).padStart(14, '0'));
    expect(q).toHaveLength(QUEUE_MAX);
    expect(q[0]).toBe('00000000000003');
    q = queueCode(q, q[0]);
    expect(q[q.length - 1]).toBe('00000000000003');
    expect(q).toHaveLength(QUEUE_MAX);
    expect(dropQueued(q, '00000000000003')).toHaveLength(QUEUE_MAX - 1);
    expect(readQueue([GTIN, 'x', 5, '123'])).toEqual([GTIN]);
  });

  it('own foods made from a code', () => {
    let map = {};
    for (let i = 0; i < OWN_MAX + 2; i++) map = linkOwn(map, String(i).padStart(14, '0'), `o${i}`);
    expect(Object.keys(map)).toHaveLength(OWN_MAX);
    map = linkOwn(map, GTIN, 'mine');
    expect(readOwnByCode(map)[GTIN]).toBe('mine');
    expect(readOwnByCode({ bad: 'x', [GTIN]: 3 })).toEqual({});
  });
});

describe('the scan steps', () => {
  const run = (events: Parameters<typeof scanReducer>[1][], from: ScanStep = START) => events.reduce(scanReducer, from);
  const code = { type: 'code', gtin: GTIN, code: '8901058851298' } as const;
  const label: LabelResult = {
    draft: { id: 'draft_12345678', expiresAt: 1 },
    food: biscuits(),
    read: { basis: '100g', name: 'Marie' },
    warnings: [],
  };

  it('scan → found → product', () => {
    const s = run([code, { type: 'found', gtin: GTIN, food: biscuits(), product }]);
    expect(s).toMatchObject({ kind: 'product', gtin: GTIN, code: '8901058851298' });
  });

  it('drops an answer for a code no longer on screen', () => {
    const s = run([code, { type: 'scan' }, { type: 'found', gtin: GTIN, food: biscuits(), product }]);
    expect(s).toEqual(START);
    const t = run([code, { type: 'found', gtin: '00000096385074', food: biscuits(), product }]);
    expect(t.kind).toBe('looking');
  });

  it('unknown → label photo → reading → confirm → product', () => {
    let s = run([code, { type: 'notFound', gtin: GTIN, partial: { name: 'Marie' }, canReadLabel: true }]);
    expect(s).toMatchObject({ kind: 'unknown', partial: { name: 'Marie' } });
    s = run([{ type: 'photoLabel' }], s);
    expect(s).toMatchObject({ kind: 'label', gtin: GTIN, partial: { name: 'Marie' } });
    s = run([{ type: 'photoTaken' }], s);
    expect(s.kind).toBe('reading');
    s = run([{ type: 'labelRead', gtin: GTIN, label }], s);
    expect(s).toMatchObject({ kind: 'confirm', label });
    s = run([{ type: 'confirmed', gtin: GTIN, food: biscuits(), product: { ...product, origin: 'label' } }], s);
    expect(s).toMatchObject({ kind: 'product', product: { origin: 'label' } });
  });

  it('a failed read goes back to the photo; an expired confirm too', () => {
    const reading = run([code, { type: 'notFound', gtin: GTIN, canReadLabel: true }, { type: 'photoLabel' }, { type: 'photoTaken' }]);
    const failed = run([{ type: 'failed', gtin: GTIN, message: 'unreadable' }], reading);
    expect(failed).toMatchObject({ kind: 'problem', message: 'unreadable', back: { kind: 'label', gtin: GTIN } });
    expect(run([{ type: 'retry' }], failed).kind).toBe('label');

    const confirm = run([{ type: 'labelRead', gtin: GTIN, label }], reading);
    const expired = run([{ type: 'failed', gtin: GTIN, message: 'expired' }], confirm);
    expect(run([{ type: 'retry' }], expired)).toMatchObject({ kind: 'label', partial: { name: 'Marie' } });
  });

  it('a failed look-up keeps its code for Try again and "Add it yourself"', () => {
    const failed = run([code, { type: 'failed', gtin: GTIN, message: 'busy' }]);
    expect(failed).toMatchObject({ kind: 'problem', back: { kind: 'looking', gtin: GTIN, code: '8901058851298' } });
    expect(run([{ type: 'retry' }], failed)).toEqual({ kind: 'looking', gtin: GTIN, code: '8901058851298' });
    // The repeated look-up's answer is taken.
    expect(run([code, { type: 'found', gtin: GTIN, food: biscuits(), product }], failed).kind).toBe('product');
    expect(run([{ type: 'addYourself' }], failed)).toEqual({ kind: 'own', gtin: GTIN, code: '8901058851298', name: '' });
    const own = run([code, { type: 'notFound', gtin: GTIN, partial: { name: 'Marie' }, canReadLabel: true }, { type: 'addYourself' }]);
    expect(own).toEqual({ kind: 'own', gtin: GTIN, code: '8901058851298', name: 'Marie' });
  });

  it('the name known without nutrients reaches the confirm form when the label has none', () => {
    const noName: LabelResult = { ...label, read: { basis: '100g' } };
    const s = run([
      code,
      { type: 'notFound', gtin: GTIN, partial: { name: 'Marie', brand: 'Acme' }, canReadLabel: true },
      { type: 'photoLabel' },
      { type: 'photoTaken' },
      { type: 'labelRead', gtin: GTIN, label: noName },
    ]);
    expect(s).toMatchObject({ kind: 'confirm', partial: { name: 'Marie', brand: 'Acme' } });
    expect(run([{ type: 'addYourself' }], s)).toMatchObject({ kind: 'own', name: 'Marie' });
    expect(run([{ type: 'photoLabel' }], s)).toMatchObject({ kind: 'label', partial: { name: 'Marie' } });
  });

  it('offline: queued for later', () => {
    expect(run([code, { type: 'queued', gtin: GTIN }])).toEqual({ kind: 'queued', gtin: GTIN, code: '8901058851298' });
  });

  it('hints only while scanning; manual entry and back', () => {
    expect(run([{ type: 'hint', message: 'not a product' }])).toEqual({ kind: 'camera', hint: 'not a product' });
    expect(run([{ type: 'manual' }, { type: 'hint', message: 'x' }])).toEqual({ kind: 'manual' });
    expect(run([{ type: 'manual' }, { type: 'scan' }])).toEqual(START);
  });

  it('ignores steps that do not fit', () => {
    expect(run([{ type: 'photoLabel' }])).toEqual(START);
    expect(run([{ type: 'photoTaken' }])).toEqual(START);
    expect(run([{ type: 'addYourself' }])).toEqual(START);
    expect(run([{ type: 'labelRead', gtin: GTIN, label }])).toEqual(START);
  });
});

describe('the look-up later list after a failure', () => {
  it('waits on trouble every code would have', () => {
    for (const k of ['offline', 'timeout', 'limit', 'busy', 'unavailable', 'signin', 'premium', undefined] as const) {
      expect(queueAction(k)).toBe('wait');
    }
  });

  it('drops codes that can never work and moves other failures behind the rest', () => {
    expect(queueAction('bad_code')).toBe('drop');
    expect(queueAction('not_food_code')).toBe('drop');
    expect(queueAction('other')).toBe('later');
    expect(queueAction('bad_answer')).toBe('later');
    expect(queueCode(['a', 'b', 'c'], 'a')).toEqual(['b', 'c', 'a']);
  });
});
