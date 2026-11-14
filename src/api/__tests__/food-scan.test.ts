import { describe, expect, it, jest } from '@jest/globals';

import { onPremiumRequired } from '@/premium/premium';

import { confirmLabel, lookupBarcode, readLabelPhoto, type ScanDeps } from '../food-scan';
import {
  checkConfirmForm,
  type ConfirmForm,
  confirmRequest,
  OFF_ATTRIBUTION,
  offProductUrl,
  readConfirm,
  readLabel,
  readLookup,
  SCAN_MESSAGES,
  ScanError,
  scanErrorFor,
} from '../scan-read';

jest.mock('@/auth/session', () => ({ getAccessToken: async () => 'token' }));

const GTIN = '08901058851298';
const CODE = '8901058851298';

const food = {
  id: `gtin-${GTIN}`,
  name: 'Marie biscuits',
  category: 'sweet',
  per100g: { kcal: 440, protein: 7, carbs: 75, fat: 12, bogus: 5 },
  units: [
    { key: 'serving', label: '4 biscuits (25 g)', grams: 25 },
    { key: 'g', label: 'grams', grams: 1 },
  ],
  defaultUnit: 'serving',
  source: 'Open Food Facts contributors (ODbL)',
};

const foundBody = {
  found: true,
  food,
  product: { gtin: GTIN, name: 'Marie biscuits', brand: 'Acme', packText: '250 g', origin: 'off', attribution: { text: 'x', url: 'https://world.openfoodfacts.org/product/8901058851298' } },
  cached: true,
};

/** A fake fetch that answers once and remembers what it was asked. */
function deps(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const d: ScanDeps = {
    baseUrl: 'https://api.test',
    token: async () => 't0k',
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
    }) as unknown as typeof fetch,
  };
  return { d, calls };
}

describe('reading a look-up', () => {
  it('a found product, checked like any food, with the pack’s notes', () => {
    const r = readLookup(foundBody, GTIN);
    if (!r.found) throw new Error('expected found');
    expect(r.cached).toBe(true);
    expect(r.food.per100g).toEqual({ kcal: 440, protein: 7, carbs: 75, fat: 12 });
    expect(r.food).toMatchObject({ barcode: GTIN, brand: 'Acme', packText: '250 g', origin: 'off' });
    expect(r.product).toEqual({
      gtin: GTIN,
      name: 'Marie biscuits',
      brand: 'Acme',
      packText: '250 g',
      origin: 'off',
      attribution: { text: OFF_ATTRIBUTION, url: 'https://world.openfoodfacts.org/product/8901058851298' },
    });
  });

  it('OFF data always carries their line; a link elsewhere is replaced', () => {
    const r = readLookup({ ...foundBody, product: { ...foundBody.product, attribution: { url: 'https://evil.example/' } } }, GTIN);
    expect(r.found && r.product.attribution).toEqual({ text: OFF_ATTRIBUTION, url: 'https://world.openfoodfacts.org/product/8901058851298' });
    const r2 = readLookup({ ...foundBody, product: { gtin: GTIN } }, GTIN);
    expect(r2.found && r2.product.attribution?.text).toBe(OFF_ATTRIBUTION);
  });

  it('label products have no OFF line, and scans are never pending', () => {
    const r = readLookup({ found: true, food: { ...food, pending: true, missing: ['kcal'] }, product: { gtin: GTIN, origin: 'label' } }, GTIN);
    if (!r.found) throw new Error('expected found');
    expect(r.product.attribution).toBeUndefined();
    expect(r.food.pending).toBeUndefined();
    expect(r.food.missing).toBeUndefined();
    expect(r.food.origin).toBe('label');
  });

  it('not found, with what OFF had', () => {
    expect(readLookup({ found: false, gtin: GTIN, partial: { name: ' Marie ', brand: 'Acme' }, canReadLabel: true })).toEqual({
      found: false,
      gtin: GTIN,
      partial: { name: 'Marie', brand: 'Acme', attribution: { text: OFF_ATTRIBUTION, url: offProductUrl(GTIN) } },
      canReadLabel: true,
    });
    expect(readLookup({ found: false }, GTIN)).toEqual({ found: false, gtin: GTIN, canReadLabel: true });
  });

  it("OFF's partial keeps their line and only their own link", () => {
    const url = 'https://world.openfoodfacts.org/product/1234';
    const ok = readLookup({ found: false, gtin: GTIN, partial: { name: 'Marie', origin: 'off', attribution: { text: 'x', url } } });
    expect(ok.found === false && ok.partial?.attribution).toEqual({ text: OFF_ATTRIBUTION, url });
    const bad = readLookup({ found: false, gtin: GTIN, partial: { name: 'Marie', attribution: { url: 'https://evil.example/' } } });
    expect(bad.found === false && bad.partial?.attribution?.url).toBe(offProductUrl(GTIN));
  });

  it('throws on a broken answer or a food it can’t use', () => {
    expect(() => readLookup(null)).toThrow(ScanError);
    expect(() => readLookup({ found: true, food: { ...food, id: 'own:1' } }, GTIN)).toThrow(ScanError);
    expect(() => readLookup({ found: true, food: { ...food, per100g: {} } }, GTIN)).toThrow(ScanError);
  });
});

describe('reading a label', () => {
  const body = {
    draft: { id: 'abcDEF12_-34', expiresAt: 1_800_000_000 },
    food: { ...food, units: [{ key: 'g', label: 'grams', grams: 1 }] },
    read: { name: 'Marie', brand: 'Acme', servingGrams: 25, packGrams: 9000, basis: 'serving', servingText: '4 biscuits' },
    warnings: ['Sugars looked low', 3],
  };

  it('keeps the draft, the checked sizes and the warnings', () => {
    const r = readLabel(body, GTIN);
    expect(r.draft).toEqual({ id: 'abcDEF12_-34', expiresAt: 1_800_000_000_000 });
    expect(r.read).toEqual({ name: 'Marie', brand: 'Acme', servingGrams: 25, basis: 'serving', servingText: '4 biscuits' });
    expect(r.warnings).toEqual(['Sugars looked low']);
    expect(r.food).toMatchObject({ barcode: GTIN, origin: 'label' });
  });

  it('refuses a bad draft id', () => {
    expect(() => readLabel({ ...body, draft: { id: '../x', expiresAt: 1 } }, GTIN)).toThrow(ScanError);
    expect(() => readLabel({ ...body, draft: undefined }, GTIN)).toThrow(ScanError);
  });

  it("confirm: someone else's record keeps its own brand, never the form's", () => {
    const theirs = { ...food, brand: 'Haldiram' };
    expect(readConfirm({ food: theirs, shared: false, existing: true }, GTIN, 'Bikaji').food.brand).toBe('Haldiram');
    expect(readConfirm({ food, shared: false, existing: true }, GTIN, 'Bikaji').food.brand).toBeUndefined();
    expect(readConfirm({ food, shared: true }, GTIN, 'Bikaji').food.brand).toBe('Bikaji');
  });

  it('confirm answers', () => {
    expect(readConfirm({ food, shared: false, existing: true }, GTIN)).toMatchObject({ shared: false, existing: true, food: { origin: 'label' } });
    expect(() => readConfirm({ shared: true }, GTIN)).toThrow(ScanError);
  });
});

describe('the confirm form', () => {
  const form: ConfirmForm = { name: ' Marie ', brand: '', servingGrams: 25, servingLabel: ' 4 biscuits ', packGrams: null };

  it('needs a name and sane sizes', () => {
    expect(checkConfirmForm(form)).toBeNull();
    expect(checkConfirmForm({ ...form, name: ' ' })).toMatch(/name/);
    expect(checkConfirmForm({ ...form, servingGrams: 0 })).toMatch(/serving/);
    expect(checkConfirmForm({ ...form, packGrams: 6000 })).toMatch(/pack/);
    expect(checkConfirmForm({ ...form, brand: 'b'.repeat(61) })).toMatch(/brand/);
  });

  it('sends names and sizes only, never nutrients', () => {
    expect(confirmRequest('d1', CODE, form)).toEqual({ draft: 'd1', code: CODE, name: 'Marie', servingGrams: 25, servingLabel: '4 biscuits' });
  });
});

describe('errors', () => {
  it.each([
    ['barcode', null, undefined, 'offline'],
    ['barcode', 400, 'bad_request', 'bad_code'],
    ['barcode', 401, undefined, 'signin'],
    ['barcode', 402, 'premium_required', 'premium'],
    ['barcode', 422, 'not_food_code', 'not_food_code'],
    ['barcode', 429, 'daily_limit', 'limit'],
    ['barcode', 429, undefined, 'busy'],
    ['barcode', 503, 'unavailable', 'unavailable'],
    ['barcode/label', 413, 'too_large', 'too_large'],
    ['barcode/label', 422, 'unreadable', 'unreadable'],
    ['barcode/label', 422, 'not_label', 'not_label'],
    ['barcode/label', 422, 'failed_checks', 'failed_checks'],
    ['barcode/confirm', 404, 'draft_expired', 'expired'],
    ['barcode/confirm', 400, 'text_not_allowed', 'text_not_allowed'],
    ['barcode/confirm', 400, 'bad_request', 'bad_form'],
    ['barcode/label', 400, 'bad_request', 'bad_code'],
    ['barcode', 500, undefined, 'other'],
  ] as const)('%s %s %s → %s', (route, status, code, kind) => {
    expect(scanErrorFor(route, status, code).kind).toBe(kind);
  });

  it('a refused confirm names the form, not the barcode', () => {
    expect(scanErrorFor('barcode/confirm', 400, 'text_not_allowed').message).toMatch(/name, brand or serving can't include links/);
    expect(scanErrorFor('barcode/confirm', 400).message).not.toBe(SCAN_MESSAGES.bad_code);
  });

  it('the label route has its own daily limit words', () => {
    expect(scanErrorFor('barcode/label', 429, 'daily_limit').message).toMatch(/label photos/);
    expect(scanErrorFor('barcode', 503).message).toBe("Couldn't look that up just now. Try again in a minute.");
    expect(scanErrorFor('barcode', 422, 'not_food_code').message).toBe("This code is for a book or a shop's own label, not a food pack.");
  });
});

describe('the client', () => {
  it('posts the code in the body, never the URL, with the token', async () => {
    const { d, calls } = deps(200, foundBody);
    const r = await lookupBarcode(CODE, GTIN, d);
    expect(r.found).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.test/v1/food/barcode');
    expect(calls[0].url).not.toContain(CODE);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ code: CODE });
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer t0k');
  });

  it('402 sends the app to free, then throws', async () => {
    const heard = jest.fn();
    const off = onPremiumRequired(heard);
    const { d } = deps(402, { error: 'premium_required' });
    await expect(lookupBarcode(CODE, GTIN, d)).rejects.toMatchObject({ kind: 'premium' });
    expect(heard).toHaveBeenCalledTimes(1);
    off();
  });

  it('daily limit and offline', async () => {
    await expect(lookupBarcode(CODE, GTIN, deps(429, { error: 'daily_limit' }).d)).rejects.toMatchObject({ kind: 'limit' });
    const offline: ScanDeps = { ...deps(200, {}).d, fetch: (async () => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch };
    await expect(lookupBarcode(CODE, GTIN, offline)).rejects.toMatchObject({ kind: 'offline' });
  });

  it('no token: sign in again; offline token refresh: offline', async () => {
    const noToken: ScanDeps = { ...deps(200, {}).d, token: async () => Promise.reject(new Error('no session')) };
    await expect(lookupBarcode(CODE, GTIN, noToken)).rejects.toMatchObject({ kind: 'signin' });
    const err = Object.assign(new Error('offline'), { name: 'AuthApiError', code: 'offline' });
    const offToken: ScanDeps = { ...deps(200, {}).d, token: async () => Promise.reject(err) };
    await expect(lookupBarcode(CODE, GTIN, offToken)).rejects.toMatchObject({ kind: 'offline' });
  });

  it('a photo over the limit is never sent', async () => {
    const { d, calls } = deps(200, {});
    await expect(readLabelPhoto(CODE, GTIN, 'A'.repeat(2_100_000), d)).rejects.toMatchObject({ kind: 'too_large' });
    expect(calls).toHaveLength(0);
  });

  it('label read and confirm', async () => {
    const label = deps(200, { draft: { id: 'draft_123456', expiresAt: 1 }, food, read: { basis: '100g' } });
    const r = await readLabelPhoto(CODE, GTIN, 'AAAA', label.d);
    expect(r.draft.id).toBe('draft_123456');
    expect(JSON.parse(label.calls[0].init.body as string)).toEqual({ code: CODE, image: 'AAAA' });
    expect(label.calls[0].url).toBe('https://api.test/v1/food/barcode/label');

    const confirm = deps(200, { food, shared: true });
    const c = await confirmLabel('draft_123456', CODE, GTIN, { name: 'Marie', brand: 'Acme', servingGrams: null, servingLabel: '', packGrams: 250 }, confirm.d);
    expect(c).toMatchObject({ shared: true, existing: false, food: { brand: 'Acme', origin: 'label' } });
    expect(JSON.parse(confirm.calls[0].init.body as string)).toEqual({ draft: 'draft_123456', code: CODE, name: 'Marie', brand: 'Acme', packGrams: 250 });

    await expect(confirmLabel('d', CODE, GTIN, { name: 'x', brand: '', servingGrams: null, servingLabel: '', packGrams: null }, deps(404, { error: 'draft_expired' }).d)).rejects.toMatchObject({ kind: 'expired' });
  });
});

describe('the Open Food Facts product link', () => {
  it('uses the code OFF files the product under', () => {
    expect(offProductUrl(GTIN)).toBe('https://world.openfoodfacts.org/product/8901058851298');
    expect(offProductUrl('00000096385074')).toBe('https://world.openfoodfacts.org/product/96385074');
    expect(offProductUrl('00036000291452')).toBe('https://world.openfoodfacts.org/product/0036000291452');
    expect(offProductUrl('18901058851295')).toBe('https://world.openfoodfacts.org/product/18901058851295');
  });
});
