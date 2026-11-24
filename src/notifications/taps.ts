/**
 * Notification taps. On a cold start the root layout shows sign-in, the lock
 * or onboarding before the Stack exists, so a tap is queued here and taken by
 * whichever screen mounts the Stack. No native code, so jest can run it.
 *
 * _layout.tsx: tap-listener.ts feeds every tap (the one that opened the app too) to
 * queueTap(tapOf(data)); once the Stack is mounted, onTap((t) => router.push(tapHref(t))).
 * Two kinds: a journal section (this phone's own reminders, {open: 'water' | 'food'}) and a
 * Walk buddies screen (the server's pushes, {open: 'buddies', to: '/buddies/...'}, stepsinfra
 * push.route_data). Only the fixed routes below are followed; anything else is ignored.
 */
import type { OpenTarget } from './channels';

/** A tap: a journal section, or the app path of a Walk buddies screen. */
export type Tap = OpenTarget | `/${string}`;

/** The target in a notification's data, or null. */
export function tapTarget(data: unknown): OpenTarget | null {
  if (typeof data !== 'object' || data === null) return null;
  const open = (data as { open?: unknown }).open;
  return open === 'water' || open === 'food' ? open : null;
}

const ID = '[0-9A-Za-z]{6,24}';

/** The routes the server's pushes name (stepsinfra push.route_data) that the app has as screens. */
const BUDDIES_ROUTES: readonly RegExp[] = [
  /^\/buddies\/requests$/,
  new RegExp(String.raw`^/buddies/chat/[bcf]\.${ID}$`),
  new RegExp(String.raw`^/buddies/club/${ID}(\?seg=(election|goals))?$`),
  new RegExp(`^/buddies/club/${ID}/admin$`),
  new RegExp(`^/buddies/plan/${ID}$`),
];

/** Pushes for Buddies home and the family (no screen of their own) open Buddies on the plus tab. */
const TO_BUDDIES_HOME = new Set(['/buddies', '/buddies/family']);

/** The app path a Walk buddies push opens, or null for anything not on the list. */
export function buddiesRoute(data: unknown): `/${string}` | null {
  if (typeof data !== 'object' || data === null) return null;
  const { open, to } = data as { open?: unknown; to?: unknown };
  if (open !== 'buddies' || typeof to !== 'string' || to.length > 120) return null;
  if (TO_BUDDIES_HOME.has(to)) return '/plus';
  return BUDDIES_ROUTES.some((r) => r.test(to)) ? (to as `/${string}`) : null;
}

/** Any notification's tap: a journal section or a Walk buddies screen, or null. */
export function tapOf(data: unknown): Tap | null {
  return tapTarget(data) ?? buddiesRoute(data);
}

/** Where a tap goes. */
export function journalRoute(target: OpenTarget): { pathname: '/journal'; params: { section: OpenTarget } } {
  return { pathname: '/journal', params: { section: target } };
}

/** What router.push takes for a tap. */
export function tapHref(t: Tap): ReturnType<typeof journalRoute> | `/${string}` {
  return t === 'water' || t === 'food' ? journalRoute(t) : t;
}

let pending: Tap | null = null;
const listeners = new Set<(t: Tap) => void>();

/** Keeps the latest tap until taken; a mounted listener gets it at once. */
export function queueTap(target: Tap | null): void {
  if (!target) return;
  if (listeners.size) {
    pending = null;
    for (const l of listeners) l(target);
  } else {
    pending = target;
  }
}

/** The queued tap, once. */
export function takeTap(): Tap | null {
  const t = pending;
  pending = null;
  return t;
}

/** While mounted, taps go straight to `listener`; a queued one is delivered first. */
export function onTap(listener: (t: Tap) => void): () => void {
  listeners.add(listener);
  const t = takeTap();
  if (t) listener(t);
  return () => {
    listeners.delete(listener);
  };
}
