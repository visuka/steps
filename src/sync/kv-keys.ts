/**
 * Every kv key the app uses, and whether the cloud backup copies it
 * (docs/backup.md). Backed up: the person's own settings, goal, profile and
 * choices. Never: caches, sign-in, sync state, device-only state and the Walk
 * buddies cache. A new kv key goes in one of the two lists, with its reason;
 * src/sync/__tests__/kv-keys.test.ts fails while one is in neither.
 *
 * The phone keeps the backed-up list in the sync_kv_allow table (refreshed on
 * every open, src/sync/backup-core.ts), which the kv triggers read, so the
 * triggers can't drift from this file.
 */

/** Copied to the cloud and brought back after a reinstall or reset. */
export const BACKED_UP_KV: Readonly<Record<string, string>> = {
  profile: 'Height, weight, goal, units, reminders, water and food settings (the name never goes up; onboarded stays per phone).',
  walkStride: 'The stride learned from their own GPS walks.',
  myDishes: 'Dishes the person put together.',
  portionOverrides: "The person's own portion sizes.",
  foodsNotForMe: 'Foods they marked "Not for me".',
  dayComplete: 'Days they marked as fully logged.',
  'scan.own': 'Which of their own foods they made from a barcode.',
  waterSetupDismissed: 'They put the water set-up away; not asked again.',
  weatherPromptDismissed: 'They put the weather prompt away; not asked again.',
};

/** Never leaves the phone. */
export const LOCAL_ONLY_KV: Readonly<Record<string, string>> = {
  accountId: 'Sign-in: which account owns the data on this phone.',
  appLock: 'Device-only: the fingerprint lock needs this phone\'s own screen lock.',
  appLockAsked: 'Device-only: asked once per phone.',
  sourceId: 'Device-only: which step source this phone has (chosen again in onboarding).',
  backfilledAt: 'Sync state: history filled from this phone\'s step source.',
  lastSyncAt: 'Sync state: last step sync on this phone.',
  vitalsConnected: 'Device-only: health app permission on this phone.',
  vitalsSyncedAt: 'Sync state: last health app read.',
  stepsPublishedThrough: 'Sync state: steps copied into Health Connect on this phone.',
  bpCopiesLeft: "Device-only: copies left in this phone's health app to delete.",
  widgetData: 'Cache: the home-screen widget\'s numbers.',
  goalNotifiedFor: 'Notification state.',
  lastRemindedAt: 'Notification state.',
  lastNotifiedAt: 'Notification state.',
  waterReminders: 'Notification state.',
  nutritionNote: 'Cache: the last food note worked out.',
  nutritionNoteLog: 'Notification state: which food notes were shown.',
  nutritionPushes: 'Notification state.',
  weeklySummaryFor: 'Notification state.',
  nutritionTab: 'Device-only: the Food tab last open.',
  pendingFoods: 'Sync state: food look-ups to repeat.',
  cookingTables: 'Cache: the server\'s cooking tables.',
  'scan.recent': 'Cache: products looked up by barcode.',
  'scan.queue': 'Sync state: barcodes to look up once online.',
  premium: 'Cache: what the server last said about premium.',
  premiumPreviewFree: "Device-only: a tester's preview switch.",
  goodNews: 'Cache: news.',
  weatherNextFetchAt: 'Cache: weather.',
  weatherPlace: 'Cache: where the weather was read for.',
  'buddies.me': 'Walk buddies cache.',
  'buddies.boards': 'Walk buddies cache: the club boards my steps are on (the server keeps the real list).',
  'buddies.stepsSent': 'Sync state: the last steps sent for the club boards from this phone.',
  'buddies.planReminders': "Device-only: the ids of this phone's walk plan reminders (local notifications).",
  'buddies.tipsSeen': 'Device-only: the walk safety tips were shown on this phone.',
  previewSeeded: 'Web design preview only.',
  previewSeededVitals: 'Web design preview only.',
  backupRestoredFor: 'Sync state: the account whose backup came back to this phone (reset wipes it).',
  backupLastAt: 'Sync state: when the backup last finished.',
  profileEdits: 'Sync state: profile changes made here before the backup came back, laid over it then.',
};

export const BACKED_UP_KV_KEYS: readonly string[] = Object.keys(BACKED_UP_KV);

export const isBackedUpKv = (key: string): boolean => Object.prototype.hasOwnProperty.call(BACKED_UP_KV, key);
