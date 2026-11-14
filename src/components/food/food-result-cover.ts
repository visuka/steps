import { useSyncExternalStore } from 'react';

/**
 * Whether a food result is covering the tab screen. The result has no bottom bar
 * (spec 7: its buttons sit 24 above the bottom), so the tab bar steps aside while
 * one is up. A count, so two layers never switch the bar back on early.
 */
let covering = 0;
const listeners = new Set<() => void>();

export function setFoodResultCovering(open: boolean): void {
  covering = Math.max(0, covering + (open ? 1 : -1));
  listeners.forEach((l) => l());
}

export function isFoodResultCovering(): boolean {
  return covering > 0;
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useFoodResultCovering(): boolean {
  return useSyncExternalStore(subscribe, isFoodResultCovering, () => false);
}
