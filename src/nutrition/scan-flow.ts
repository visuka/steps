/**
 * The steps of the Scan screen (app/food-scan.tsx) as one reducer, so the
 * flow can be tested without a camera: scan or type a code → look it up →
 * the product, or "we don't know this product yet" → photograph the label →
 * confirm → the product. Answers that come back for a code no longer on
 * screen are dropped.
 */
import type { LabelResult, ScanErrorKind, ScanPartial, ScanProduct } from '@/api/scan-read';

import type { FoodItem } from './types';

export type ScanStep =
  | { kind: 'camera'; hint?: string }
  | { kind: 'manual' }
  | { kind: 'looking'; gtin: string; code: string }
  /** `offline`: shown from the phone's own list of recent scans. */
  | { kind: 'product'; gtin: string; code: string; food: FoodItem; product: ScanProduct; offline?: boolean }
  | { kind: 'unknown'; gtin: string; code: string; partial?: ScanPartial; canReadLabel: boolean }
  | { kind: 'label'; gtin: string; code: string; partial?: ScanPartial }
  | { kind: 'reading'; gtin: string; code: string; partial?: ScanPartial }
  | { kind: 'confirm'; gtin: string; code: string; label: LabelResult; partial?: ScanPartial }
  | { kind: 'own'; gtin: string; code: string; name: string }
  /** Offline and not on the phone: put on the list to look up later. */
  | { kind: 'queued'; gtin: string; code: string }
  /** `back`: where "Try again" goes; `looking` means the look-up is repeated for that code. */
  | { kind: 'problem'; message: string; back: ScanStep };

export type ScanEvent =
  | { type: 'scan' }
  | { type: 'manual' }
  | { type: 'hint'; message: string }
  | { type: 'code'; gtin: string; code: string }
  | { type: 'found'; gtin: string; food: FoodItem; product: ScanProduct; offline?: boolean }
  | { type: 'notFound'; gtin: string; partial?: ScanPartial; canReadLabel: boolean }
  | { type: 'queued'; gtin: string }
  | { type: 'failed'; gtin?: string; message: string }
  | { type: 'photoLabel' }
  | { type: 'photoTaken' }
  | { type: 'labelRead'; gtin: string; label: LabelResult }
  /** The label read was confirmed: the product as saved (ours, or whoever confirmed it first). */
  | { type: 'confirmed'; gtin: string; food: FoodItem; product: ScanProduct }
  | { type: 'addYourself' }
  | { type: 'retry' };

export const START: ScanStep = { kind: 'camera' };

const codeOf = (s: ScanStep): { gtin: string; code: string } | null =>
  'gtin' in s ? { gtin: s.gtin, code: s.code } : s.kind === 'problem' ? codeOf(s.back) : null;

/** The name the pack is known by so far: what OFF had without nutrients, or nothing. */
function partialOf(s: ScanStep): ScanPartial | undefined {
  if (s.kind === 'unknown' || s.kind === 'label' || s.kind === 'reading') return s.partial;
  if (s.kind === 'product')
    return { name: s.product.name, brand: s.product.brand, ...(s.product.attribution ? { attribution: s.product.attribution } : {}) };
  if (s.kind === 'confirm') return s.label.read.name ? { name: s.label.read.name, brand: s.label.read.brand } : s.partial;
  return undefined;
}

export function scanReducer(state: ScanStep, event: ScanEvent): ScanStep {
  const current = codeOf(state);
  const same = (gtin: string) => current?.gtin === gtin;
  switch (event.type) {
    case 'scan':
      return START;
    case 'manual':
      return { kind: 'manual' };
    case 'hint':
      return state.kind === 'camera' ? { kind: 'camera', hint: event.message } : state;
    case 'code':
      return { kind: 'looking', gtin: event.gtin, code: event.code };
    case 'found':
      if (state.kind !== 'looking' || !same(event.gtin)) return state;
      return { kind: 'product', gtin: state.gtin, code: state.code, food: event.food, product: event.product, offline: event.offline };
    case 'notFound':
      if (state.kind !== 'looking' || !same(event.gtin)) return state;
      return { kind: 'unknown', gtin: state.gtin, code: state.code, partial: event.partial, canReadLabel: event.canReadLabel };
    case 'queued':
      if (state.kind !== 'looking' || !same(event.gtin)) return state;
      return { kind: 'queued', gtin: state.gtin, code: state.code };
    case 'failed':
      if (event.gtin !== undefined && !same(event.gtin)) return state;
      if (state.kind === 'problem') return { ...state, message: event.message };
      // A failed look-up keeps its code, so Try again repeats it; a failed or expired label read goes back to the photo.
      return {
        kind: 'problem',
        message: event.message,
        back: state.kind === 'reading' || state.kind === 'confirm' ? labelStep(state) : state,
      };
    case 'photoLabel':
      // From a product whose numbers look wrong too, and again after a read that expired or failed.
      if (state.kind === 'unknown' || state.kind === 'product' || state.kind === 'confirm') return labelStep(state);
      return state.kind === 'problem' && current ? labelStep(state.back) : state;
    case 'photoTaken':
      return state.kind === 'label' ? { kind: 'reading', gtin: state.gtin, code: state.code, partial: state.partial } : state;
    case 'labelRead':
      if (state.kind !== 'reading' || !same(event.gtin)) return state;
      return { kind: 'confirm', gtin: state.gtin, code: state.code, label: event.label, partial: state.partial };
    case 'confirmed':
      if (state.kind !== 'confirm' || !same(event.gtin)) return state;
      return { kind: 'product', gtin: state.gtin, code: state.code, food: event.food, product: event.product };
    case 'addYourself':
      if (!current) return state;
      return { kind: 'own', ...current, name: partialOf(state)?.name ?? '' };
    case 'retry':
      return state.kind === 'problem' ? state.back : state;
  }
}

function labelStep(s: ScanStep): ScanStep {
  const c = codeOf(s);
  return c ? { kind: 'label', ...c, partial: partialOf(s) } : START;
}

/**
 * What the offline list does with a code whose look-up failed: `wait` stops
 * for this open (still offline, the day's limit, our server busy or signed
 * out; every code would fail the same), `drop` takes off a code that will
 * never work, and `later` moves it behind the others so it can't block them.
 */
export function queueAction(kind: ScanErrorKind | undefined): 'wait' | 'drop' | 'later' {
  switch (kind) {
    case undefined:
    case 'offline':
    case 'timeout':
    case 'limit':
    case 'busy':
    case 'unavailable':
    case 'signin':
    case 'premium':
      return 'wait';
    case 'bad_code':
    case 'not_food_code':
      return 'drop';
    default:
      return 'later';
  }
}
