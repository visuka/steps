import { describe, expect, it } from '@jest/globals';

import {
  BAD_CHECK_MESSAGE,
  checkDigit,
  codeType,
  createScanGate,
  displayCode,
  expandUpcE,
  HINT_AFTER_MS,
  isValidGtin,
  manualHint,
  manualState,
  NOT_PRODUCT_MESSAGE,
  offCode,
  parseQr,
  parseScan,
  restrictedReason,
  RESTRICTED_MESSAGE,
  toGtin14,
} from '../barcode';

/** A body with its check digit added (checkDigit is checked against real codes first). */
const withCheck = (body: string) => body + checkDigit(body);

const MARIE = '8901058851298'; // An Indian (890) EAN-13.

describe('check digits', () => {
  it('match real codes of every length', () => {
    for (const code of [MARIE, '8901725181222', '4006381333931', '036000291452', '96385074', '9780306406157']) {
      expect(checkDigit(code.slice(0, -1))).toBe(Number(code.slice(-1)));
      expect(isValidGtin(code)).toBe(true);
    }
  });

  it('catch a wrong last digit, a swapped pair and bad lengths', () => {
    expect(isValidGtin('8901058851299')).toBe(false);
    expect(isValidGtin('8901058815298')).toBe(false);
    expect(isValidGtin('890105885129')).toBe(false); // 12 digits that don't check
    expect(isValidGtin('12345')).toBe(false);
    expect(isValidGtin('89010588512a8')).toBe(false);
  });

  it('GTIN-14 with an indicator digit', () => {
    const case14 = withCheck('1890105885129');
    expect(case14).toHaveLength(14);
    expect(isValidGtin(case14)).toBe(true);
    expect(parseScan('qr', case14)).toEqual({ kind: 'gtin', gtin: case14, code: case14 });
  });
});

describe('UPC-E', () => {
  it('expands by its last digit', () => {
    expect(expandUpcE('04252614')).toBe('042100005264'); // d6 0-2
    expect(expandUpcE('123453')).toBe(withCheck('01230000045')); // d6 3
    expect(expandUpcE('123454')).toBe(withCheck('01234000005')); // d6 4
    expect(expandUpcE('123457')).toBe(withCheck('01234500007')); // d6 5-9
    expect(expandUpcE('0425261')).toBe('042100005264'); // 7 digits: no check digit given
    expect(expandUpcE('1123457')).toBe(withCheck('11234500007')); // number system 1
  });

  it('refuses a wrong check digit or number system', () => {
    expect(expandUpcE('04252615')).toBeNull();
    expect(expandUpcE('2425261')).toBeNull();
    expect(expandUpcE('12345')).toBeNull();
  });

  it('scans as the UPC-A it stands for, expanded or not', () => {
    const want = { kind: 'gtin', gtin: '00042100005264', code: '042100005264' };
    expect(parseScan('upc_e', '04252614')).toEqual(want);
    expect(parseScan('upc_e', '042100005264')).toEqual(want);
    expect(parseScan('upc_e', '04252615')).toEqual({ kind: 'bad_check' });
  });
});

describe('linear codes', () => {
  it('pads every length to the same GTIN-14', () => {
    expect(toGtin14('96385074')).toBe('00000096385074');
    expect(parseScan('ean13', MARIE)).toEqual({ kind: 'gtin', gtin: `0${MARIE}`, code: MARIE });
    expect(parseScan('ean8', '96385074')).toEqual({ kind: 'gtin', gtin: '00000096385074', code: '96385074' });
  });

  it('UPC-A reported by iOS as a 13-digit EAN-13 is the same product', () => {
    const a = parseScan('upc_a', '036000291452');
    const b = parseScan('org.gs1.EAN-13', '0036000291452');
    expect(a).toEqual({ kind: 'gtin', gtin: '00036000291452', code: '036000291452' });
    expect(b).toEqual(a);
  });

  it('keeps digits only and says when they do not check', () => {
    expect(parseScan('ean13', ` ${MARIE}\n`)).toMatchObject({ kind: 'gtin' });
    expect(parseScan('ean13', '8901058851299')).toEqual({ kind: 'bad_check' });
    expect(parseScan('ean13', '')).toEqual({ kind: 'not_product' });
    expect(parseScan('ean13', null)).toEqual({ kind: 'not_product' });
  });

  it('names scanner types on every platform', () => {
    expect(codeType('ean13')).toBe('ean13');
    expect(codeType('org.gs1.EAN-13')).toBe('ean13');
    expect(codeType('org.gs1.EAN-8')).toBe('ean8');
    expect(codeType('upc_a')).toBe('upc_a');
    expect(codeType('org.gs1.UPC-E')).toBe('upc_e');
    expect(codeType('org.iso.QRCode')).toBe('qr');
    expect(codeType(32)).toBe('ean13');
    expect(codeType(1024)).toBe('upc_e');
    expect(codeType('code128')).toBe('other');
    expect(codeType(undefined)).toBe('other');
  });
});

describe('restricted codes', () => {
  it.each([
    ['9780306406157', 'book'],
    [withCheck('977123456789'), 'book'],
    [withCheck('979123456789'), 'book'],
    [withCheck('200000000000'), 'store'],
    [withCheck('291234567890'), 'store'],
    [withCheck('991234567890'), 'coupon'],
    [withCheck('981234567890'), 'coupon'],
    [withCheck('984234567890'), 'coupon'],
    [withCheck('23456789012'), 'store'], // UPC-A number system 2
    [withCheck('53456789012'), 'coupon'], // UPC-A number system 5
    [withCheck('0000002'), 'store'], // EAN-8 starting 0
    [withCheck('2000000'), 'store'], // EAN-8 starting 2
  ])('%s is a %s code', (code, reason) => {
    expect(restrictedReason(toGtin14(code))).toBe(reason);
    expect(parseScan('qr', code)).toEqual({ kind: 'restricted', reason });
  });

  it('lets ordinary food codes through', () => {
    for (const code of [MARIE, '8901725181222', '4006381333931', '036000291452', '96385074', withCheck('985123456789')]) {
      expect(restrictedReason(toGtin14(code))).toBeNull();
    }
  });
});

describe('codes as printed and as Open Food Facts files them', () => {
  it('display form', () => {
    expect(displayCode('00000096385074')).toBe('96385074');
    expect(displayCode('00036000291452')).toBe('036000291452');
    expect(displayCode(`0${MARIE}`)).toBe(MARIE);
    expect(displayCode('18901058851295')).toBe('18901058851295');
  });

  it('OFF code: EAN-8, 13 digits, or all 14', () => {
    expect(offCode('00000096385074')).toBe('96385074');
    expect(offCode('00036000291452')).toBe('0036000291452');
    expect(offCode(`0${MARIE}`)).toBe(MARIE);
    expect(offCode('18901058851295')).toBe('18901058851295');
  });
});

describe('QR codes', () => {
  const gtin = `0${MARIE}`;
  const want = { kind: 'gtin', gtin, code: MARIE };

  it.each([
    [`https://id.gs1.org/01/${gtin}`],
    [`https://id.gs1.org/01/${gtin}/10/ABC123/21/xyz?linkType=gs1:pip`],
    [`https://brand.example.in/products/01/${gtin}/22/2A`],
    [`HTTPS://example.com/01/${MARIE}#top`],
    [`https://example.com/gtin/${gtin}`],
    [`https%3A%2F%2Fid.gs1.org%2F01%2F${gtin}`],
    [`https://id.gs1.org/%30%31/${gtin}`],
    [`(01)${gtin}(17)270101(10)B1`],
    [`01${gtin}17270101\u001d10B1`],
    [`]Q301${gtin}`],
    [`]d201${gtin}\u001d10LOT`],
    [MARIE],
    [` ${gtin} `],
  ])('reads %s', (data) => {
    expect(parseQr(data)).toEqual(want);
    expect(parseScan('qr', data)).toEqual(want);
  });

  it('Digital Link with a misread number is a bad check, not a product', () => {
    expect(parseQr('https://id.gs1.org/01/08901058851299')).toEqual({ kind: 'bad_check' });
  });

  it.each([
    ['https://example.com/menu'],
    ['https://wa.me/919999999999'],
    ['upi://pay?pa=shop@upi&am=10'],
    ['WIFI:S:home;T:WPA;P:secret;;'],
    ['https://id.gs1.org/01/12345/'], // too short for a GTIN
    ['hello'],
    ['12345'],
    ['https://example.com/01/'],
  ])('%s is not a product code (never opened)', (data) => {
    expect(parseQr(data)).toEqual({ kind: 'not_product' });
  });
});

describe('typing the number', () => {
  it('checks as it goes', () => {
    expect(manualState('')).toEqual({ status: 'empty' });
    expect(manualState('8901')).toEqual({ status: 'typing', digits: '8901' });
    expect(manualState('8901 0588 51298')).toEqual({ status: 'ok', digits: MARIE, gtin: `0${MARIE}`, code: MARIE });
    expect(manualState('96385074')).toMatchObject({ status: 'ok', code: '96385074' });
    expect(manualState('036000291452')).toMatchObject({ status: 'ok', gtin: '00036000291452' });
    expect(manualState('8901058851299')).toEqual({ status: 'bad_check', digits: '8901058851299' });
    expect(manualState('9780306406157')).toEqual({ status: 'restricted', digits: '9780306406157' });
    expect(manualState('123456789012345')).toMatchObject({ status: 'too_long' });
    // 12 digits that don't check may be a 13-digit number half typed.
    expect(manualState('890105885129')).toMatchObject({ status: 'typing' });
  });

  it('says what is wrong', () => {
    expect(manualHint(manualState('8901058851299'))).toBe(BAD_CHECK_MESSAGE);
    expect(manualHint(manualState('9780306406157'))).toBe(RESTRICTED_MESSAGE);
    expect(manualHint(manualState('89010588'))).toMatch(/13 digits/);
    expect(manualHint(manualState('8901'))).toBeNull();
    expect(manualHint(manualState(MARIE))).toBeNull();
  });
});

describe('the scan gate', () => {
  it('locks on the first product code', () => {
    const gate = createScanGate();
    expect(gate.feed('ean13', MARIE, 0)).toEqual({ action: 'accept', gtin: `0${MARIE}`, code: MARIE });
    expect(gate.locked).toBe(true);
    expect(gate.feed('ean13', '4006381333931', 10)).toEqual({ action: 'ignore' });
    gate.reset();
    expect(gate.feed('ean13', '4006381333931', 20)).toMatchObject({ action: 'accept' });
  });

  it('waits before a hint, and gives each hint once', () => {
    const gate = createScanGate();
    expect(gate.feed('qr', 'https://example.com/menu', 1000)).toEqual({ action: 'ignore' });
    expect(gate.feed('qr', 'https://example.com/menu', 1000 + HINT_AFTER_MS - 1)).toEqual({ action: 'ignore' });
    expect(gate.feed('qr', 'https://example.com/menu', 1000 + HINT_AFTER_MS)).toEqual({ action: 'hint', message: NOT_PRODUCT_MESSAGE });
    expect(gate.feed('qr', 'https://example.com/menu', 5000)).toEqual({ action: 'ignore' });
    expect(gate.feed('ean13', '8901058851299', 5100)).toEqual({ action: 'hint', message: BAD_CHECK_MESSAGE });
    // A good code after bad ones is still taken at once.
    expect(gate.feed('ean13', MARIE, 5200)).toMatchObject({ action: 'accept' });
  });
});
