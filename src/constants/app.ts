/**
 * Working name until the brand is chosen. Changing it here, plus `name`,
 * `ios.bundleIdentifier` and `android.package` in app.json, renames the app.
 */
export const APP_NAME = 'Steps';

/** Shared with the iOS widget extension; must match app.json and targets/widget. */
export const APP_GROUP = 'group.com.neutcrafts.steps';

export const ANDROID_WIDGET_NAME = 'StepsToday';
export const IOS_WIDGET_KIND = 'StepsWidget';

/** Our sign-in API (stepsinfra `StepsAuth` stack, ap-south-1; docs/phone-signin.md). */
export const AUTH_API_URL: string = 'https://jnfq4me6g7.execute-api.ap-south-1.amazonaws.com';

/**
 * How people sign in (docs/phone-signin.md):
 * - `phone`: per phone, with an email to get the account back and Google
 *   Block Store to survive a reinstall. Used while testing.
 * - `passkey`: passkeys (docs/passkeys.md); built, and back once the
 *   sign-in server has its domain (`rp_id`).
 */
export type SignInMode = 'phone' | 'passkey';
export const SIGN_IN_MODE: SignInMode = 'phone';

/** Our data and food API (stepsinfra `StepsApi` stack, ap-south-1). */
export const STEPS_API_URL: string = 'https://vbughviry4.execute-api.ap-south-1.amazonaws.com';
