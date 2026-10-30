/**
 * Working name until the brand is chosen. Changing it here, plus `name`,
 * `ios.bundleIdentifier` and `android.package` in app.json, renames the app.
 */
export const APP_NAME = 'Steps';

/** Shared with the iOS widget extension; must match app.json and targets/widget. */
export const APP_GROUP = 'group.com.neutcrafts.steps';

export const ANDROID_WIDGET_NAME = 'StepsToday';
export const IOS_WIDGET_KIND = 'StepsWidget';

/**
 * Supabase project `steps` (account neutcrafts@gmail.com), used only for
 * sign-in. Both values are public by design and ship inside the app; the
 * secret key and database password never go in this repo.
 */
export const SUPABASE_URL = 'https://hqzroexjsskwryylmccy.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_M-VF4875RISU23zQjj8uQQ_VfCoJ7yn';
