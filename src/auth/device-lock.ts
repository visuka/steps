import * as LocalAuthentication from 'expo-local-authentication';

/**
 * - `ready`: the phone has a fingerprint, face or screen-lock PIN to check.
 * - `no-lock`: the phone has no screen lock at all, so there's nothing to check against.
 */
export type LockSupport = 'ready' | 'no-lock' | 'unsupported';

export async function lockSupport(): Promise<LockSupport> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level === LocalAuthentication.SecurityLevel.NONE ? 'no-lock' : 'ready';
  } catch {
    return 'unsupported';
  }
}

export type UnlockResult = 'ok' | 'cancelled' | 'no-lock' | 'failed';

/** Shows the phone's own prompt: fingerprint or face, with the screen-lock PIN as the fallback. */
export async function unlockWithDevice(promptMessage: string): Promise<UnlockResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
    if (result.success) return 'ok';
    if (result.error === 'not_enrolled' || result.error === 'passcode_not_set' || result.error === 'not_available') {
      return 'no-lock';
    }
    if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
      return 'cancelled';
    }
    return 'failed';
  } catch {
    return 'failed';
  }
}
