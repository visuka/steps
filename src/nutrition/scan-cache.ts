/**
 * What the phone keeps about scans, so they work offline (docs/barcode-scan.md
 * 5.4): the last 100 products scanned, codes to look up once back online, and
 * which own food the person made from a code. Plain lists, read back checked;
 * kept in the kv table by state/use-scan-store.ts. No photos, ever.
 */
import { readFoodItem } from '@/api/food-read';
import { OFF_ATTRIBUTION, offProductUrl, offUrl, type ScanProduct } from '@/api/scan-read';

import type { FoodItem } from './types';

export const RECENT_KEY = 'scan.recent';
export const QUEUE_KEY = 'scan.queue';
export const OWN_KEY = 'scan.own';

export const RECENT_MAX = 100;
export const QUEUE_MAX = 20;
export const OWN_MAX = 200;

export interface RecentScan {
  gtin: string;
  food: FoodItem;
  product: ScanProduct;
  /** When it was looked up (epoch ms). */
  at: number;
}

const isGtin = (v: unknown): v is string => typeof v === 'string' && /^\d{14}$/.test(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Newest first, one per code, at most RECENT_MAX. */
export function rememberScan(list: RecentScan[], scan: RecentScan): RecentScan[] {
  return [scan, ...list.filter((s) => s.gtin !== scan.gtin)].slice(0, RECENT_MAX);
}

export function findRecent(list: RecentScan[], gtin: string): RecentScan | null {
  return list.find((s) => s.gtin === gtin) ?? null;
}

/** The kept list, checked: anything that doesn't read back is dropped. */
export function readRecent(v: unknown): RecentScan[] {
  if (!Array.isArray(v)) return [];
  const out: RecentScan[] = [];
  for (const raw of v.slice(0, RECENT_MAX)) {
    if (!isObject(raw) || !isGtin(raw.gtin) || !isObject(raw.product)) continue;
    const food = readFoodItem(raw.food);
    const p = raw.product;
    if (!food || typeof p.name !== 'string') continue;
    const origin = p.origin === 'label' ? 'label' : 'off';
    const product: ScanProduct = { gtin: raw.gtin, name: p.name.slice(0, 80), origin };
    if (typeof p.brand === 'string') product.brand = p.brand.slice(0, 60);
    if (typeof p.packText === 'string') product.packText = p.packText.slice(0, 40);
    if (isObject(p.attribution) && typeof p.attribution.text === 'string') {
      const url = offUrl(p.attribution.url);
      product.attribution = { text: p.attribution.text.slice(0, 120), ...(url ? { url } : {}) };
    }
    // Their data is never shown without their line.
    if (origin === 'off') product.attribution = { text: OFF_ATTRIBUTION, url: product.attribution?.url ?? offProductUrl(raw.gtin) };
    // readFoodItem drops a scan's own notes; they come back from the product.
    food.barcode = raw.gtin;
    food.origin = origin;
    if (product.brand) food.brand = product.brand;
    if (product.packText) food.packText = product.packText;
    out.push({ gtin: raw.gtin, food, product, at: typeof raw.at === 'number' ? raw.at : 0 });
  }
  return out;
}

/** A code to look up when back online: once each, oldest dropped past QUEUE_MAX. */
export function queueCode(queue: string[], gtin: string): string[] {
  return [...queue.filter((g) => g !== gtin), gtin].slice(-QUEUE_MAX);
}

export function dropQueued(queue: string[], gtin: string): string[] {
  return queue.filter((g) => g !== gtin);
}

export function readQueue(v: unknown): string[] {
  return Array.isArray(v) ? v.filter(isGtin).slice(-QUEUE_MAX) : [];
}

/** Code → the id of the own food made from it ("Add it yourself", "Add to my foods"). */
export type OwnByCode = Record<string, string>;

export function linkOwn(map: OwnByCode, gtin: string, ownId: string): OwnByCode {
  const entries = Object.entries(map).filter(([g]) => g !== gtin);
  entries.push([gtin, ownId]);
  return Object.fromEntries(entries.slice(-OWN_MAX));
}

export function readOwnByCode(v: unknown): OwnByCode {
  if (!isObject(v)) return {};
  const out: OwnByCode = {};
  for (const [g, id] of Object.entries(v)) if (isGtin(g) && typeof id === 'string' && id.length <= 80) out[g] = id;
  return out;
}
