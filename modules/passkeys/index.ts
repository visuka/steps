import { requireOptionalNativeModule } from 'expo';

import { makePasskeys, type PasskeysNative } from './passkeys';

export { isPasskeyError, PasskeyError, type PasskeyErrorCode, type PasskeysApi } from './passkeys';

/** Android only for now; iOS and the web preview report not supported. */
export const Passkeys = makePasskeys(requireOptionalNativeModule<PasskeysNative>('Passkeys'));
