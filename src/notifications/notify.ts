import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

import { CHANNELS, type NotifyOptions } from './channels';

export type { ChannelId, NotifyOptions, OpenTarget } from './channels';

const MOOD_CHECK_IN_ID = 'mood-check-in';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channelsReady: Promise<void> | null = null;

/**
 * Creates every channel once per process. Android drops posts to a channel
 * that doesn't exist, and people who allowed notifications for step reminders
 * never pass requestNotificationPermission again, so every post and the app's
 * start call this. Nutrition and weekly posts hide their text on the lock screen.
 */
export function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelsReady ??= Promise.all(
    CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        importance: c.importance === 'low' ? AndroidImportance.LOW : AndroidImportance.DEFAULT,
        lockscreenVisibility: c.private ? AndroidNotificationVisibility.PRIVATE : AndroidNotificationVisibility.PUBLIC,
      }),
    ),
  )
    .then(() => undefined)
    .catch(() => {
      channelsReady = null;
    });
  return channelsReady;
}

export async function requestNotificationPermission(): Promise<boolean> {
  await ensureChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Posts now; `open` makes a tap open that part of the Journal (see taps.ts). */
export async function notifyNow(title: string, body: string, opts: NotifyOptions = {}): Promise<void> {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: opts.open ? { open: opts.open } : {} },
    trigger: Platform.OS === 'android' ? { channelId: opts.channel ?? 'nudges' } : null,
  });
}

/** Daily "how was today?" at `hour`; null turns it off. */
export async function scheduleMoodCheckIn(hour: number | null): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MOOD_CHECK_IN_ID).catch(() => undefined);
  if (hour === null) return;
  await ensureChannels();
  await Notifications.scheduleNotificationAsync({
    identifier: MOOD_CHECK_IN_ID,
    content: { title: 'How was today?', body: 'One tap to log your mood. Steps uses it to spot what gets you walking.' },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: 'nudges' },
  });
}
