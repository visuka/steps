/** Web preview: notifications are not part of the product there. */
export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function notifyNow(_title: string, _body: string): Promise<void> {}

export async function scheduleMoodCheckIn(_hour: number | null): Promise<void> {}
