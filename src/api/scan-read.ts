/**
 * Checks what the barcode routes send back (stepsinfra docs/barcode-scan.md
 * 3.2 to 3.4) before any of it reaches the screen, and turns failures into
 * short plain messages. No React Native here, so jest can run it.
 *
 * Products come from Open Food Facts or from other people's label photos,
 * so nothing is trusted: foods go through readFoodItem like any other.
 */
import { APP_NAME } from '@/constants/app';
import { offCode } from '@/nutrition/barcode';
import type { FoodItem, NutrientKey } from '@/nutrition/types';

import { readFoodItem, tokenError } from './food-read';

export type ScanRoute = 'barcode' | 'barcode/label' | 'barcode/confirm';

/** The line every screen showing Open Food Facts data carries (ODbL). */
export const OFF_ATTRIBUTION = 'Data from Open Food Facts contributors, ODbL';
export const OFF_TERMS_URL = 'https://world.openfoodfacts.org/terms-of-use';
export const LABEL_ATTRIBUTION = `From a label photo by a ${APP_NAME} user. Check it against the pack.`;

export interface ScanProduct {
  /** 14 digits. */
  gtin: string;
  name: string;
  brand?: string;
  packText?: string;
  origin: 'off' | 'label';
  /** Open Food Facts products: the line to show, and the product's page on their site. */
  attribution?: { text: string; url?: string };
}

/** A name (and brand) Open Food Facts has without nutrients: shown with their line when it came from them. */
export interface ScanPartial {
  name: string;
  brand?: string;
  attribution?: { text: string; url?: string };
}

export type LookupResult =
  | { found: true; food: FoodItem; product: ScanProduct; cached: boolean }
  | { found: false; gtin: string; partial?: ScanPartial; canReadLabel: boolean };

/** What the model read off the label (the numbers are in `food`, per 100 g). */
export interface LabelRead {
  name?: string;
  brand?: string;
  servingText?: string;
  servingGrams?: number;
  packGrams?: number;
  basis: '100g' | '100ml' | 'serving';
}

export interface LabelResult {
  draft: { id: string; expiresAt: number };
  food: FoodItem;
  read: LabelRead;
  warnings: string[];
}

export interface ConfirmResult {
  food: FoodItem;
  /** Saved for everyone who scans this barcode. */
  shared: boolean;
  /** Someone confirmed it first: theirs is what came back. */
  existing: boolean;
}

export type ScanErrorKind =
  | 'offline'
  | 'timeout'
  | 'signin'
  | 'premium'
  | 'bad_code'
  | 'not_food_code'
  | 'unreadable'
  | 'not_label'
  | 'failed_checks'
  | 'too_large'
  | 'expired'
  | 'text_not_allowed'
  | 'bad_form'
  | 'limit'
  | 'busy'
  | 'unavailable'
  | 'bad_answer'
  | 'other';

export class ScanError extends Error {
  readonly kind: ScanErrorKind;
  constructor(kind: ScanErrorKind, message: string) {
    super(message);
    this.name = 'ScanError';
    this.kind = kind;
  }
}

export const SCAN_MESSAGES: Record<ScanErrorKind, string> = {
  offline: "Couldn't reach our server. Check your internet and try again.",
  timeout: 'That took too long. Please try again.',
  signin: 'Please sign in again to look up food.',
  premium: `Food and nutrition are part of ${APP_NAME} Premium.`,
  bad_code: "That number doesn't look right. Check it against the pack.",
  not_food_code: "This code is for a book or a shop's own label, not a food pack.",
  unreadable: "We couldn't read the label. Hold the phone closer and steady, with no glare on the numbers.",
  not_label: "That doesn't look like a nutrition label. Photograph the table of values on the pack.",
  failed_checks:
    "The numbers we read don't add up, so we didn't use them. Try again with the whole table in the frame, flat and in good light.",
  too_large: 'That photo is too big to send. Please try again.',
  expired: 'That label read has expired. Please photograph it again.',
  text_not_allowed: "The name, brand or serving can't include links or certain words. Please change them and try again.",
  bad_form: "We couldn't save that. Check the name, brand and sizes, then try again.",
  limit: 'You’ve reached today’s limit for scans. Try again tomorrow, or add it as your own food.',
  busy: 'Lots of people are scanning right now. Please try again in a moment.',
  unavailable: "Couldn't look that up just now. Try again in a minute.",
  bad_answer: 'Something went wrong. Please try again.',
  other: 'Something went wrong. Please try again.',
};

const LABEL_LIMIT = 'You’ve reached today’s limit for label photos. Try again tomorrow, or add it as your own food.';

/** The error for a failed call; `status` null means no answer came. `code`: our server's `error` field. */
export function scanErrorFor(route: ScanRoute, status: number | null, code?: string): ScanError {
  const err = (kind: ScanErrorKind, message = SCAN_MESSAGES[kind]) => new ScanError(kind, message);
  if (status === null) return err('offline');
  if (status === 402) return err('premium');
  if (status === 401 || status === 403) return err('signin');
  if (status === 400) {
    // Confirm 400s are about the form the person filled in, not the barcode.
    if (route === 'barcode/confirm') return err(code === 'text_not_allowed' ? 'text_not_allowed' : 'bad_form');
    return err('bad_code');
  }
  if (status === 404) return err(route === 'barcode/confirm' ? 'expired' : 'other');
  if (status === 413) return err('too_large');
  if (status === 422) {
    if (code === 'not_food_code' || code === 'unreadable' || code === 'not_label' || code === 'failed_checks') return err(code);
    return err(route === 'barcode' ? 'not_food_code' : 'unreadable');
  }
  // API Gateway answers 429 when everyone asks at once; only our "daily_limit" is this person's limit.
  if (status === 429 && code !== 'daily_limit') return err('busy');
  if (status === 429) return err('limit', route === 'barcode/label' ? LABEL_LIMIT : SCAN_MESSAGES.limit);
  if (status === 503) return err('unavailable');
  return err('other');
}

/** No token: offline said as offline, other trouble as "sign in again" (as food-read.ts tokenError). */
export function scanTokenError(cause: unknown): ScanError {
  const e = tokenError('estimate', cause);
  if (e.kind === 'offline') return new ScanError('offline', SCAN_MESSAGES.offline);
  if (e.kind === 'other') return new ScanError('other', SCAN_MESSAGES.other);
  return new ScanError('signin', SCAN_MESSAGES.signin);
}

export const scanBadAnswer = () => new ScanError('bad_answer', SCAN_MESSAGES.bad_answer);
export const scanTimedOut = () => new ScanError('timeout', SCAN_MESSAGES.timeout);

// ── reading answers ──────────────────────────────────────────────────────

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return t || undefined;
}

function num(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
}

const gtinOf = (v: unknown): string | undefined => (typeof v === 'string' && /^\d{14}$/.test(v) ? v : undefined);

/** Only a link to Open Food Facts itself is kept (https, their domain). */
export function offUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 300) return undefined;
  const m = /^https:\/\/([a-z0-9-]+\.)*openfoodfacts\.(org|net)(\/[^\s]*)?$/i.exec(v);
  return m ? v : undefined;
}

/** Their product page, for when the answer gave none. */
export const offProductUrl = (gtin: string) => `https://world.openfoodfacts.org/product/${offCode(gtin)}`;

/** A scanned food: checked like any food, with the pack's notes added and no "pending" (scans never are). */
function scanFood(v: unknown, product: ScanProduct): FoodItem | null {
  const food = readFoodItem(v);
  if (!food) return null;
  delete food.pending;
  delete food.pendingSince;
  delete food.recipe;
  delete food.missing;
  food.barcode = product.gtin;
  // The pack's notes as given, else as the server's food carries them.
  const raw = isObject(v) ? v : {};
  const brand = product.brand ?? text(raw.brand, 60);
  if (brand) food.brand = brand;
  const packText = product.packText ?? text(raw.packText, 40);
  if (packText) food.packText = packText;
  food.origin = product.origin;
  return food;
}

/** The checked answer to POST /v1/food/barcode. */
export function readLookup(body: unknown, asked?: string): LookupResult {
  if (!isObject(body) || typeof body.found !== 'boolean') throw scanBadAnswer();
  if (!body.found) {
    const gtin = gtinOf(body.gtin) ?? asked;
    if (!gtin) throw scanBadAnswer();
    const result: LookupResult = { found: false, gtin, canReadLabel: body.canReadLabel !== false };
    if (isObject(body.partial)) {
      const name = text(body.partial.name, 80);
      const brand = text(body.partial.brand, 60);
      if (name) {
        // OFF's name is their data: always shown with their line.
        const a = isObject(body.partial.attribution) ? body.partial.attribution : {};
        result.partial = { name, ...(brand ? { brand } : {}), attribution: { text: OFF_ATTRIBUTION, url: offUrl(a.url) ?? offProductUrl(gtin) } };
      }
    }
    return result;
  }
  const p = isObject(body.product) ? body.product : {};
  const gtin = gtinOf(p.gtin) ?? asked;
  if (!gtin) throw scanBadAnswer();
  const origin = p.origin === 'label' ? 'label' : 'off';
  const product: ScanProduct = { gtin, name: '', origin };
  const brand = text(p.brand, 60);
  if (brand) product.brand = brand;
  const packText = text(p.packText, 40);
  if (packText) product.packText = packText;
  if (origin === 'off') {
    // Their data is always shown with their line, whatever the answer said.
    const a = isObject(p.attribution) ? p.attribution : {};
    product.attribution = { text: OFF_ATTRIBUTION, url: offUrl(a.url) ?? offProductUrl(gtin) };
  }
  const food = scanFood(body.food, product);
  if (!food) throw scanBadAnswer();
  product.name = text(p.name, 80) ?? food.name;
  return { found: true, food, product, cached: body.cached === true };
}

const BASES = ['100g', '100ml', 'serving'] as const;

/** The checked answer to POST /v1/food/barcode/label. */
export function readLabel(body: unknown, gtin: string): LabelResult {
  if (!isObject(body) || !isObject(body.draft) || !isObject(body.read)) throw scanBadAnswer();
  const id = typeof body.draft.id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.draft.id) ? body.draft.id : null;
  const expiresAt = num(body.draft.expiresAt, 0, Number.MAX_SAFE_INTEGER);
  if (!id || expiresAt === undefined) throw scanBadAnswer();
  const r = body.read;
  const read: LabelRead = { basis: (BASES as readonly unknown[]).includes(r.basis) ? (r.basis as LabelRead['basis']) : '100g' };
  const name = text(r.name, 80);
  if (name) read.name = name;
  const brand = text(r.brand, 60);
  if (brand) read.brand = brand;
  const servingText = text(r.servingText, 40);
  if (servingText) read.servingText = servingText;
  const servingGrams = num(r.servingGrams, 1, 1000);
  if (servingGrams !== undefined) read.servingGrams = servingGrams;
  const packGrams = num(r.packGrams, 1, 5000);
  if (packGrams !== undefined) read.packGrams = packGrams;
  const food = scanFood(body.food, { gtin, name: name ?? '', origin: 'label', brand });
  if (!food) throw scanBadAnswer();
  const warnings = (Array.isArray(body.warnings) ? body.warnings.slice(0, 5) : [])
    .map((w) => text(w, 200))
    .filter((w): w is string => w !== undefined);
  // Seconds or milliseconds: the server's DynamoDB TTLs are in seconds.
  return { draft: { id, expiresAt: expiresAt < 1e12 ? expiresAt * 1000 : expiresAt }, food, read, warnings };
}

/**
 * The checked answer to POST /v1/food/barcode/confirm. `brand`: what the person
 * typed, used only for their own save; when someone else's record came back
 * (`existing`), its brand is the server's, never the form's.
 */
export function readConfirm(body: unknown, gtin: string, brand?: string): ConfirmResult {
  if (!isObject(body)) throw scanBadAnswer();
  const existing = body.existing === true;
  const food = scanFood(body.food, { gtin, name: '', origin: 'label', brand: existing ? undefined : brand });
  if (!food) throw scanBadAnswer();
  return { food, shared: body.shared === true, existing };
}

// ── requests ─────────────────────────────────────────────────────────────

/** The server takes a JPEG of at most this many bytes (docs/barcode-scan.md 3.3). */
export const LABEL_MAX_BYTES = 1_500_000;

/** Bytes in a base64 string. */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export interface ConfirmForm {
  name: string;
  brand: string;
  /** Grams (or ml) in one serving, when the pack says. */
  servingGrams: number | null;
  /** "1 biscuit", "1 cup": optional words for the serving. */
  servingLabel: string;
  packGrams: number | null;
}

/** A plain reason the confirm form can't be sent, or null when it can. */
export function checkConfirmForm(f: ConfirmForm): string | null {
  const name = f.name.trim();
  if (!name) return 'Give the product its name, as on the pack.';
  if (name.length > 80) return 'Please keep the name under 80 letters.';
  if (f.brand.trim().length > 60) return 'Please keep the brand under 60 letters.';
  if (f.servingGrams !== null && !(f.servingGrams >= 1 && f.servingGrams <= 1000)) return 'A serving should be 1 to 1000 g.';
  if (f.packGrams !== null && !(f.packGrams >= 1 && f.packGrams <= 5000)) return 'The pack should be 1 to 5000 g.';
  return null;
}

/** The body for POST /v1/food/barcode/confirm: never any numbers but sizes; nutrients stay on the server. */
export function confirmRequest(draftId: string, code: string, f: ConfirmForm): Record<string, string | number> {
  const body: Record<string, string | number> = { draft: draftId, code, name: f.name.trim() };
  const brand = f.brand.trim();
  if (brand) body.brand = brand;
  if (f.servingGrams !== null) body.servingGrams = f.servingGrams;
  const label = f.servingLabel.trim().slice(0, 40);
  if (label) body.servingLabel = label;
  if (f.packGrams !== null) body.packGrams = f.packGrams;
  return body;
}

/** Nutrient keys shown first on a pack's table, in label order. */
export const LABEL_KEYS: NutrientKey[] = ['kcal', 'protein', 'carbs', 'sugars', 'addedSugar', 'fiber', 'fat', 'satFat', 'transFat', 'cholesterol', 'sodium'];
