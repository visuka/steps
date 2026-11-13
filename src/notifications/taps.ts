/**
 * Notification taps. On a cold start the root layout shows sign-in, the lock
 * or onboarding before the Stack exists, so a tap is queued here and taken by
 * whichever screen mounts the Stack. No native code, so jest can run it.
 *
 * _layout.tsx: on addNotificationResponseReceivedListener and
 * getLastNotificationResponseAsync, call queueTap(tapTarget(response.notification.request.content.data));
 * once the Stack is mounted, `const t = takeTap(); if (t) router.push(journalRoute(t))`, and
 * subscribe with onTap for taps while it is mounted.
 */
import type { OpenTarget } from './channels';

/** The target in a notification's data, or null. */
export function tapTarget(data: unknown): OpenTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const open = (data as { open?: unknown }).open;
  return open === 'water' || open === 'food' ? open : null;
}

/** Where a tap goes. */
export function journalRoute(target: OpenTarget): { pathname: '/journal'; params: { section: OpenTarget } } {
  return { pathname: '/journal', params: { section: target } };
}

let pending: OpenTarget | null = null;
const listeners = new Set<(t: OpenTarget) => void>();

/** Keeps the latest tap until taken; a mounted listener gets it at once. */
export function queueTap(target: OpenTarget | null): void {
  if (!target) return;
  if (listeners.size) {
    pending = null;
    for (const l of listeners) l(target);
  } else {
    pending = target;
  }
}

/** The queued tap, once. */
export function takeTap(): OpenTarget | null {
  const t = pending;
  pending = null;
  return t;
}

/** While mounted, taps go straight to `listener`; a queued one is delivered first. */
export function onTap(listener: (t: OpenTarget) => void): () => void {
  listeners.add(listener);
  const t = takeTap();
  if (t) listener(t);
  return () => {
    listeners.delete(listener);
  };
}
