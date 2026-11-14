import { describe, expect, it } from '@jest/globals';

import { CLEAN_SPEC } from '@/constants/themes/clean-spec';

import { NAV, SLOT_VISUAL_HEIGHT, barHeight, barTopInWrapper, fabTopInWrapper, slotTouch, wrapperHeight } from '../nav-style';

describe('bottom bar (spec 5.7)', () => {
  it('has the spec sizes', () => {
    expect(NAV.height).toBe(72);
    expect(NAV.hairline).toBe(1);
    expect(NAV.sidePadding).toBe(16);
    expect(NAV.slotWidth).toBe(48);
    expect(NAV.iconSize).toBe(20);
    expect(NAV.iconDotGap).toBe(4);
    expect(NAV.dot).toBe(4);
    expect(NAV.dotRadius).toBe(2);
    expect(SLOT_VISUAL_HEIGHT).toBe(28);
  });

  it('adds the system inset to the height', () => {
    expect(barHeight(0)).toBe(72);
    expect(barHeight(34)).toBe(106);
  });

  it('every slot can be tapped on at least 48 x 48', () => {
    const t = slotTouch();
    expect(t.width).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
    expect(t.height).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
    expect(NAV.fab).toBeGreaterThanOrEqual(CLEAN_SPEC.sizes.nav.minTouch);
  });

  it('draws the FAB 56 x 56, radius 28, with the spec shadow', () => {
    expect(NAV.fab).toBe(56);
    expect(NAV.fabRadius).toBe(28);
    expect(NAV.fabIconSize).toBe(20);
    expect(NAV.fabLift).toBe(7.5);
    expect(NAV.fabShadow).toBe(CLEAN_SPEC.shadow.fab);
  });

  describe.each([0, 24, 34])('FAB in the wrapper, bottom inset %i', (inset) => {
    const barTop = barTopInWrapper(inset);
    const barBottom = barTop + barHeight(inset);
    const fabTop = fabTopInWrapper(inset);

    it('puts the bar at the bottom of the wrapper', () => {
      expect(barBottom).toBe(wrapperHeight(inset));
    });

    it('puts the FAB top 7.5 above the bar outer top edge', () => {
      expect(barTop - fabTop).toBe(7.5);
    });

    it('puts the FAB centre 15.5 above the bar centre (72 dp bar)', () => {
      const barCentre = barTop + NAV.height / 2;
      const fabCentre = fabTop + NAV.fab / 2;
      expect(barCentre - fabCentre).toBe(15.5);
    });

    it('keeps the whole FAB inside the wrapper so Android delivers its touches', () => {
      expect(fabTop).toBeGreaterThanOrEqual(0);
      expect(fabTop + NAV.fab).toBeLessThanOrEqual(wrapperHeight(inset));
    });
  });
});
