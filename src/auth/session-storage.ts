import * as SecureStore from 'expo-secure-store';

import { chunkedStorage, type SessionStorage } from '@/auth/chunked-storage';

/**
 * The sign-in session lives in the Android Keystore / iOS Keychain, never in
 * plain app storage. Android deletes it on uninstall, so a reinstall asks for
 * the password again.
 */
export const sessionStorage: SessionStorage | undefined = chunkedStorage({
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
});
