import { describe, expect, it } from '@jest/globals';

import { SCREEN_READER_MS, SHOW_MS, snackbarTimeout } from '../snackbar-timing';

describe('snackbarTimeout', () => {
  it('keeps the plain 6 s without an action', () => {
    expect(snackbarTimeout({ hasAction: false, recommended: 20000, screenReader: true })).toBe(SHOW_MS);
  });

  it("honours Android's Time to take action when there is an action", () => {
    expect(snackbarTimeout({ hasAction: true, recommended: null, screenReader: false })).toBe(SHOW_MS);
    expect(snackbarTimeout({ hasAction: true, recommended: 20000, screenReader: false })).toBe(20000);
    expect(snackbarTimeout({ hasAction: true, recommended: 1000, screenReader: false })).toBe(SHOW_MS);
  });

  it('waits much longer with a screen reader on', () => {
    expect(snackbarTimeout({ hasAction: true, recommended: null, screenReader: true })).toBe(SCREEN_READER_MS);
    expect(snackbarTimeout({ hasAction: true, recommended: 120000, screenReader: true })).toBe(120000);
  });
});
