import type { NotifyOptions } from './channels';

export type { ChannelId, NotifyOptions, OpenTarget } from './channels';

/** Web preview: notifications are not part of the product there. */
export async function ensureChannels(): Promise<void> {}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function notifyNow(_title: string, _body: string, _opts: NotifyOptions = {}): Promise<void> {}

export async function scheduleMoodCheckIn(_hour: number | null): Promise<void> {}
