/**
 * Feeds notification taps into the tap queue (taps.ts): the tap that opened
 * the app, and every tap while it runs. The root layout starts it once (never
 * in a design-preview run); the screen that mounts the Stack takes the taps
 * with onTap. The same tap seen twice (the launch one can come both ways) is
 * queued once.
 */
import * as Notifications from 'expo-notifications';

import { queueTap, tapOf } from './taps';

let lastId: string | null = null;

function take(r: Notifications.NotificationResponse | null): void {
  if (!r) return;
  const id = r.notification.request.identifier;
  if (id && id === lastId) return;
  lastId = id;
  queueTap(tapOf(r.notification.request.content.data));
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    // Older native modules have no clear: the identifier check above keeps it to once.
  }
}

/** Starts listening; returns the stop. */
export function listenForTaps(): () => void {
  try {
    take(Notifications.getLastNotificationResponse());
  } catch {
    // No launch tap to read on this phone.
  }
  const sub = Notifications.addNotificationResponseReceivedListener(take);
  return () => sub.remove();
}
