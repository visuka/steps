/**
 * Calls to our barcode routes (stepsinfra docs/barcode-scan.md): look a pack
 * up by its barcode, read a nutrition label photo, and confirm what was read.
 * Codes and photos go in POST bodies only, never in URLs. Answers are checked
 * in scan-read.ts. Same sign-in and premium handling as food-api.ts.
 */
import { getAccessToken } from '@/auth/session';
import { STEPS_API_URL } from '@/constants/app';
import { premiumRequired } from '@/premium/premium';

import { errorCode } from './food-read';
import {
  base64Bytes,
  type ConfirmForm,
  confirmRequest,
  type ConfirmResult,
  LABEL_MAX_BYTES,
  type LabelResult,
  type LookupResult,
  readConfirm,
  readLabel,
  readLookup,
  ScanError,
  scanBadAnswer,
  scanErrorFor,
  type ScanRoute,
  scanTimedOut,
  scanTokenError,
  SCAN_MESSAGES,
} from './scan-read';

export { ScanError } from './scan-read';
export type { ConfirmForm, ConfirmResult, LabelResult, LookupResult, ScanProduct } from './scan-read';

/** The server waits 4 s for Open Food Facts; the label read waits on a vision model (about 28 s). */
const TIMEOUT_MS: Record<ScanRoute, number> = { barcode: 15_000, 'barcode/label': 40_000, 'barcode/confirm': 15_000 };

/** For tests: the fetch and token used. */
export interface ScanDeps {
  fetch: typeof fetch;
  token: () => Promise<string>;
  baseUrl: string;
}

const defaults: ScanDeps = { fetch: (...a) => fetch(...a), token: getAccessToken, baseUrl: STEPS_API_URL };

async function post(route: ScanRoute, body: unknown, deps: ScanDeps): Promise<unknown> {
  let token: string;
  try {
    token = await deps.token();
  } catch (e) {
    throw scanTokenError(e);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS[route]);
  try {
    let res: Response;
    try {
      res = await deps.fetch(`${deps.baseUrl}/v1/food/${route}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw controller.signal.aborted ? scanTimedOut() : scanErrorFor(route, null);
    }
    if (!res.ok) {
      const code = await res.json().then(errorCode, () => undefined);
      if (res.status === 402) premiumRequired();
      throw scanErrorFor(route, res.status, code);
    }
    try {
      return await res.json();
    } catch {
      throw controller.signal.aborted ? scanTimedOut() : scanBadAnswer();
    }
  } finally {
    clearTimeout(timer);
  }
}

/** A barcode → the product, or that we don't know it yet. `code`: as printed; `gtin`: its 14 digits. */
export async function lookupBarcode(code: string, gtin: string, deps: ScanDeps = defaults): Promise<LookupResult> {
  return readLookup(await post('barcode', { code }, deps), gtin);
}

/** A nutrition label photo (base64 JPEG) → per-100 g values to confirm. The photo is not kept. */
export async function readLabelPhoto(code: string, gtin: string, imageBase64: string, deps: ScanDeps = defaults): Promise<LabelResult> {
  if (base64Bytes(imageBase64) > LABEL_MAX_BYTES) throw new ScanError('too_large', SCAN_MESSAGES.too_large);
  return readLabel(await post('barcode/label', { code, image: imageBase64 }, deps), gtin);
}

/** Confirms a label read: name and serving from the person, numbers from the server's draft. */
export async function confirmLabel(
  draftId: string,
  code: string,
  gtin: string,
  form: ConfirmForm,
  deps: ScanDeps = defaults,
): Promise<ConfirmResult> {
  return readConfirm(await post('barcode/confirm', confirmRequest(draftId, code, form), deps), gtin, form.brand.trim() || undefined);
}
