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
export const SUPABASE_URL = 'https://iyzcablluxqadfrojgge.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XtYRdAYuGLMGvbOaSWLiXw_i8TD1EM9';

/**
 * Our API on AWS (stepsinfra), for food lookups and recipes. Every call needs
 * the signed-in person's Supabase token; the URL itself is not a secret.
 */
export const STEPS_API_URL = 'https://vbughviry4.execute-api.ap-south-1.amazonaws.com';
