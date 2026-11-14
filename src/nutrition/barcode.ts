/**
 * Barcodes and QR codes on food packs → one GTIN (the number under the
 * barcode), checked. The same rules as the server's food/gtin.py
 * (stepsinfra docs/barcode-scan.md section 4). No React Native here, so jest
 * can run it.
 *
 * A QR code is only read, never opened: a link that isn't a GS1 product link
 * is "not a product code", and nothing is fetched or followed.
 */

/** Why a code can't be looked up as a food pack. */
export type RestrictedReason = 'book' | 'store' | 'coupon';

export type ScanParse =
  /** `gtin`: 14 digits, left-padded; `code`: the form printed on the pack, sent to the server. */
  | { kind: 'gtin'; gtin: string; code: string }
  /** Looks like a product number, but the last digit doesn't match: misread or mistyped. */
  | { kind: 'bad_check' }
  /** A real code, but for a book, a shop's own label or a coupon. */
  | { kind: 'restricted'; reason: RestrictedReason }
  /** A QR code (or anything else) that isn't a product code. */
  | { kind: 'not_product' };

export const NOT_PRODUCT_MESSAGE =
  "This QR code isn't a product code. Try the barcode on the pack, or type the number under it.";
export const BAD_CHECK_MESSAGE = "That number doesn't add up. Check it against the pack and try again.";
export const RESTRICTED_MESSAGE = "This code is for a book or a shop's own label, not a food pack.";

/** Lengths a GTIN comes in: EAN-8, UPC-A, EAN-13, GTIN-14. */
const GTIN_LENGTHS = [8, 12, 13, 14];

const onlyDigits = (s: string) => /^\d+$/.test(s);

/**
 * The check digit for `body` (the number without its last digit): weights
 * 3, 1, 3, 1… from the right; check = (10 − sum mod 10) mod 10.
 */
export function checkDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48;
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return (10 - (sum % 10)) % 10;
}

/** True for 8, 12, 13 or 14 digits whose last digit is the right check digit. */
export function isValidGtin(digits: string): boolean {
  if (!onlyDigits(digits) || !GTIN_LENGTHS.includes(digits.length)) return false;
  return checkDigit(digits.slice(0, -1)) === Number(digits[digits.length - 1]);
}

/** 8, 12, 13 or 14 digits → 14, left-padded with zeros. */
export function toGtin14(digits: string): string {
  return digits.padStart(14, '0');
}

/**
 * UPC-E (6 digits, or 7 with the number system, or 8 with the check digit
 * too) → the 12-digit UPC-A it stands for, or null when it can't be one.
 * An 8-digit code must carry the right check digit.
 */
export function expandUpcE(raw: string): string | null {
  if (!onlyDigits(raw) || raw.length < 6 || raw.length > 8) return null;
  const ns = raw.length === 6 ? '0' : raw[0];
  if (ns !== '0' && ns !== '1') return null;
  const d = raw.length === 6 ? raw : raw.slice(1, 7);
  const [d1, d2, d3, d4, d5, d6] = d;
  let middle: string;
  if (d6 <= '2') middle = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === '3') middle = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === '4') middle = `${d1}${d2}${d3}${d4}00000${d5}`;
  else middle = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  const body = ns + middle;
  const check = String(checkDigit(body));
  if (raw.length === 8 && raw[7] !== check) return null;
  return body + check;
}

/**
 * Codes that are never a food pack (docs/barcode-scan.md 3.2): books and
 * magazines (978, 979, 977), a shop's own and weighed-item labels (20–29,
 * UPC-A 2, EAN-8 starting 0 or 2), and coupons (99, 981–984, UPC-A 5).
 */
export function restrictedReason(gtin14: string): RestrictedReason | null {
  if (gtin14.startsWith('000000')) {
    const ean8 = gtin14.slice(6);
    return ean8[0] === '0' || ean8[0] === '2' ? 'store' : null;
  }
  if (gtin14[0] !== '0') return null; // A case or outer pack (GTIN-14): looked up as it is.
  const ean13 = gtin14.slice(1);
  const p2 = ean13.slice(0, 2);
  const p3 = ean13.slice(0, 3);
  if (p3 === '977' || p3 === '978' || p3 === '979') return 'book';
  if (p2 === '99' || (p3 >= '981' && p3 <= '984')) return 'coupon';
  if (p2 >= '20' && p2 <= '29') return 'store';
  // UPC-A as EAN-13: "0" then the UPC-A number system.
  if (p2 === '02') return 'store';
  if (p2 === '05') return 'coupon';
  return null;
}

/** The form printed on the pack: EAN-8, UPC-A (12), EAN-13 or GTIN-14. */
export function displayCode(gtin14: string): string {
  if (gtin14.startsWith('000000')) return gtin14.slice(6);
  if (gtin14.startsWith('00')) return gtin14.slice(2);
  if (gtin14.startsWith('0')) return gtin14.slice(1);
  return gtin14;
}

/**
 * The code Open Food Facts files the product under (the server sends it;
 * kept here so both sides agree): six leading zeros → EAN-8, a leading zero
 * → 13 digits, otherwise all 14.
 */
export function offCode(gtin14: string): string {
  if (gtin14.startsWith('000000')) return gtin14.slice(6);
  if (gtin14.startsWith('0')) return gtin14.slice(1);
  return gtin14;
}

/** 8, 12, 13 or 14 digits → checked and sorted into a result. */
export function fromDigits(digits: string): ScanParse {
  if (!onlyDigits(digits) || !GTIN_LENGTHS.includes(digits.length)) return { kind: 'not_product' };
  if (!isValidGtin(digits)) return { kind: 'bad_check' };
  const gtin = toGtin14(digits);
  const reason = restrictedReason(gtin);
  if (reason) return { kind: 'restricted', reason };
  return { kind: 'gtin', gtin, code: displayCode(gtin) };
}

/** The scanner's type, whatever the platform calls it ("org.gs1.EAN-13", "ean13", 32). */
export type CodeType = 'ean13' | 'ean8' | 'upc_a' | 'upc_e' | 'qr' | 'other';

/** ML Kit's numeric formats, in case a platform reports those. */
const ML_KIT: Record<number, CodeType> = { 32: 'ean13', 64: 'ean8', 256: 'qr', 512: 'upc_a', 1024: 'upc_e' };

export function codeType(type: unknown): CodeType {
  if (typeof type === 'number') return ML_KIT[type] ?? 'other';
  if (typeof type !== 'string') return 'other';
  const t = type.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (t.endsWith('ean13')) return 'ean13';
  if (t.endsWith('ean8')) return 'ean8';
  if (t.endsWith('upca')) return 'upc_a';
  if (t.endsWith('upce')) return 'upc_e';
  if (t.endsWith('qr') || t.endsWith('qrcode')) return 'qr';
  return 'other';
}

/** Percent-decoded, or as it was when it isn't valid percent-encoding. */
function decoded(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * A GS1 Digital Link ("https://id.gs1.org/01/08901058851298/10/ABC?x=1"),
 * on any host, or the older "/gtin/" form: the GTIN in it, or null when
 * there is none. Batch, serial and the query are ignored.
 */
function digitalLinkGtin(text: string): string | null {
  const path = decoded(text).split(/[?#]/)[0];
  const m = /\/(?:01|gtin)\/(\d+)(?=\/|$)/.exec(path);
  return m ? m[1] : null;
}

/**
 * A GS1 element string: "(01)08901058851298(17)…", or raw "0108901058851298…"
 * with an optional symbology prefix (]Q3, ]d2, ]C1) and group separators.
 */
function elementStringGtin(text: string): string | null {
  const s = text.replace(/^\][A-Za-z]\d/, '').replace(/\u001d/g, '');
  const bracketed = /\(01\)(\d{14})/.exec(s);
  if (bracketed) return bracketed[1];
  const raw = /^01(\d{14})/.exec(s);
  return raw ? raw[1] : null;
}

/** What a QR code holds, when it's a product code. Never opens or fetches the link. */
export function parseQr(data: string): ScanParse {
  const text = data.trim();
  const plain = text.replace(/\s/g, '');
  if (onlyDigits(plain) && GTIN_LENGTHS.includes(plain.length)) return fromDigits(plain);
  const link = digitalLinkGtin(text);
  if (link !== null) return GTIN_LENGTHS.includes(link.length) ? fromDigits(link) : { kind: 'not_product' };
  const element = elementStringGtin(text);
  if (element !== null) return fromDigits(element);
  return { kind: 'not_product' };
}

/** One scanned code (CameraView's onBarcodeScanned `type` and `data`) → a result. */
export function parseScan(type: unknown, data: unknown): ScanParse {
  if (typeof data !== 'string' || !data.trim()) return { kind: 'not_product' };
  const kind = codeType(type);
  if (kind === 'qr' || kind === 'other') return parseQr(data);
  const digits = data.replace(/\D/g, '');
  if (kind === 'upc_e' || (digits.length >= 6 && digits.length <= 7)) {
    // Some phones send UPC-E already expanded to 12 digits.
    if (digits.length === 12) return fromDigits(digits);
    const upcA = expandUpcE(digits);
    return upcA ? fromDigits(upcA) : { kind: 'bad_check' };
  }
  // iOS can send UPC-A as a 13-digit "ean13" with a leading 0: padding to 14 is the same number.
  return fromDigits(digits);
}

/** The words for a code that can't be looked up. */
export function parseMessage(p: Exclude<ScanParse, { kind: 'gtin' }>): string {
  if (p.kind === 'bad_check') return BAD_CHECK_MESSAGE;
  if (p.kind === 'restricted') return RESTRICTED_MESSAGE;
  return NOT_PRODUCT_MESSAGE;
}

/** Typing the number under the barcode. */
export type ManualState =
  | { status: 'empty' }
  /** Fewer than 8 digits, or 9 to 11: keep typing. */
  | { status: 'typing'; digits: string }
  | { status: 'too_long'; digits: string }
  | { status: 'bad_check'; digits: string }
  | { status: 'restricted'; digits: string }
  | { status: 'ok'; digits: string; gtin: string; code: string };

/** Checked as the person types: digits only, 8 to 14 of them, with the right check digit. */
export function manualState(text: string): ManualState {
  const digits = text.replace(/\D/g, '');
  if (!digits) return { status: 'empty' };
  if (digits.length > 14) return { status: 'too_long', digits };
  if (!GTIN_LENGTHS.includes(digits.length)) return { status: 'typing', digits };
  const p = fromDigits(digits);
  if (p.kind === 'gtin') return { status: 'ok', digits, gtin: p.gtin, code: p.code };
  if (p.kind === 'restricted') return { status: 'restricted', digits };
  // 8 or 12 digits that don't check may be a 13-digit number half typed; 13 or 14 are wrong.
  return digits.length < 13 ? { status: 'typing', digits } : { status: 'bad_check', digits };
}

/** A line under the number field, or null when there's nothing to say yet. */
export function manualHint(s: ManualState): string | null {
  switch (s.status) {
    case 'too_long':
      return 'A barcode number has at most 14 digits.';
    case 'bad_check':
      return BAD_CHECK_MESSAGE;
    case 'restricted':
      return RESTRICTED_MESSAGE;
    case 'typing':
      return s.digits.length >= 8 ? 'Keep going: most food packs have 13 digits.' : null;
    default:
      return null;
  }
}

/**
 * Deciding what to do with each code the camera reports. It reports many a
 * second: the first product code locks the scanner; codes that aren't one are
 * ignored for a moment (a wrong guess mid-focus is common) and only then the
 * hint is shown, once per kind of problem.
 */
export const HINT_AFTER_MS = 1500;

export type GateResult =
  | { action: 'accept'; gtin: string; code: string }
  | { action: 'ignore' }
  /** A code that isn't a product code, or a misread number, seen for a moment (haptics: warning). */
  | { action: 'hint'; message: string };

export interface ScanGate {
  feed(type: unknown, data: unknown, now: number): GateResult;
  /** Scan again: unlocks and forgets the last problem. */
  reset(): void;
  readonly locked: boolean;
}

export function createScanGate(): ScanGate {
  let locked = false;
  let firstBad: number | null = null;
  let hinted: string | null = null;
  return {
    get locked() {
      return locked;
    },
    reset() {
      locked = false;
      firstBad = null;
      hinted = null;
    },
    feed(type, data, now) {
      if (locked) return { action: 'ignore' };
      const p = parseScan(type, data);
      if (p.kind === 'gtin') {
        locked = true;
        firstBad = null;
        return { action: 'accept', gtin: p.gtin, code: p.code };
      }
      if (firstBad === null) firstBad = now;
      if (now - firstBad < HINT_AFTER_MS) return { action: 'ignore' };
      const message = parseMessage(p);
      if (hinted === message) return { action: 'ignore' };
      hinted = message;
      return { action: 'hint', message };
    },
  };
}
