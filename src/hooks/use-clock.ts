/**
 * The wall clock as React state.
 *
 * React Compiler (app.json experiments.reactCompiler) caches any expression
 * with no reactive input for the life of the component, so a bare
 * `dayKey(new Date())` in a component body is read once, at mount, and never
 * again: Today kept saying "Sun, 15 Nov · Good evening" after midnight while
 * the step number (from app state) had moved to Monday. Read the date through
 * this hook instead; it ticks at every minute boundary and when the app comes
 * back to the front, so the day, the hour and the greeting roll over.
 */
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { dayKey } from '@/lib/dates';

export interface Clock {
  /** Epoch ms, refreshed each minute. */
  now: number;
  /** Today's day key, YYYY-MM-DD, local time. */
  today: string;
  /** The local hour, 0–23. */
  hour: number;
  /** The local year. */
  year: number;
}

function read(at = Date.now()): Clock {
  const d = new Date(at);
  return { now: at, today: dayKey(d), hour: d.getHours(), year: d.getFullYear() };
}

let snapshot: Clock = read();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let appSub: { remove(): void } | null = null;

function publish() {
  snapshot = read();
  listeners.forEach((l) => l());
}

function schedule() {
  const now = Date.now();
  // Just after the next minute boundary.
  timer = setTimeout(() => {
    publish();
    schedule();
  }, 60_000 - (now % 60_000) + 50);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    publish();
    schedule();
    appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') publish();
    });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      appSub?.remove();
      appSub = null;
    }
  };
}

const getSnapshot = () => snapshot;

export function useClock(): Clock {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
