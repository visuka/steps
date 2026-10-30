import { dayKey, formatDayLong } from '@/lib/dates';

/** "Morning walk", "Evening walk"… by start time. */
export function walkTitle(startedAt: number): string {
  const h = new Date(startedAt).getHours();
  if (h >= 5 && h < 12) return 'Morning walk';
  if (h >= 12 && h < 17) return 'Afternoon walk';
  if (h >= 17 && h < 21) return 'Evening walk';
  return 'Night walk';
}

/** "Thu, 30 Oct · 6:10 pm". */
export function walkWhen(startedAt: number): string {
  const time = new Date(startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${formatDayLong(dayKey(new Date(startedAt)))} · ${time}`;
}
