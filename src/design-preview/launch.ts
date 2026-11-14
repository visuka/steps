/**
 * Whether this run of the app was started by the design preview's link. Read
 * once, synchronously, before theme.ts builds its styles: a preview run draws
 * in the link's theme, over sample data only, and never reads or saves the
 * phone's own choices (themes/choice.ts deviceStore() is null for it).
 *
 * Only a cold start counts. A preview link opened while the app is already
 * running reaches the route, but the theme and clock of that run stay as they
 * were, and the route says so (CI force-stops the app before each link).
 *
 * expo-linking is required lazily, so jest and anything without the native
 * module see no preview.
 */

import { parsePreviewUrl, type PreviewParams } from './params';

let launch: PreviewParams | null | undefined;

export function previewLaunch(): PreviewParams | null {
  if (launch !== undefined) return launch;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Linking = require('expo-linking') as { getLinkingURL(): string | null };
    launch = parsePreviewUrl(Linking.getLinkingURL());
  } catch {
    launch = null;
  }
  return launch;
}
