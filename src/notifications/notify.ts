import * as Notifications from 'expo-notifications';
import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'nudges';
const MOOD_CHECK_IN_ID = 'mood-check-in';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Move reminders and goals',
      importance: AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function notifyNow(title: string, body: string): Promise<void> {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
  });
}

/** Daily "how was today?" at `hour`; null turns it off. */
export async function scheduleMoodCheckIn(hour: number | null): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(MOOD_CHECK_IN_ID).catch(() => undefined);
  if (hour === null) return;
  await Notifications.scheduleNotificationAsync({
    identifier: MOOD_CHECK_IN_ID,
    content: { title: 'How was today?', body: 'One tap to log your mood. Steps uses it to spot what gets you walking.' },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL_ID },
  });
}
