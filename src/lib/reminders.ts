/** A nudge fires after this long with fewer than REMINDER_MIN_STEPS steps. */
export const REMINDER_WINDOW_MIN = 60;
export const REMINDER_MIN_STEPS = 250;

export interface ReminderSettings {
  enabled: boolean;
  /** Local hours, inclusive start, exclusive end (e.g. 9 to 20). */
  startHour: number;
  endHour: number;
}

export function shouldRemind(input: {
  now: Date;
  stepsLastWindow: number;
  settings: ReminderSettings;
  lastRemindedAt: number | null;
  goalMetToday: boolean;
}): boolean {
  const { now, stepsLastWindow, settings, lastRemindedAt, goalMetToday } = input;
  if (!settings.enabled || goalMetToday) return false;
  const hour = now.getHours();
  if (hour < settings.startHour || hour >= settings.endHour) return false;
  // Never nudge in the first hour of the window: there's no full hour of inactivity yet.
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), settings.startHour);
  if (now.getTime() - windowStart.getTime() < REMINDER_WINDOW_MIN * 60_000) return false;
  if (lastRemindedAt && now.getTime() - lastRemindedAt < REMINDER_WINDOW_MIN * 60_000) return false;
  return stepsLastWindow < REMINDER_MIN_STEPS;
}
