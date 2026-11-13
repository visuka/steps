import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-state';
import { AuthLayout, TextButton } from '@/components/auth/auth-layout';
import { confirm } from '@/components/confirm';
import { Button, Notice, Why } from '@/components/ui';
import { APP_NAME, SIGN_IN_MODE } from '@/constants/app';
import { useLock } from '@/state/app-lock';

/**
 * Covers the app (which stays mounted underneath, so a walk keeps recording)
 * and asks for the fingerprint straight away.
 */
export function LockScreen() {
  const { unlock } = useLock();
  const { signOut } = useAuth();
  const [failed, setFailed] = useState(false);

  const tryUnlock = useCallback(async () => {
    setFailed((await unlock()) === 'failed');
  }, [unlock]);

  // Ask straight away; the button is for a second try.
  useEffect(() => {
    let cancelled = false;
    unlock().then((result) => {
      if (!cancelled) setFailed(result === 'failed');
    });
    return () => {
      cancelled = true;
    };
  }, [unlock]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <AuthLayout
        icon="lock-closed"
        title={`${APP_NAME} is locked`}
        subtitle="Open it with your fingerprint, face or screen lock.">
        {failed ? <Notice tone="problem" text="That didn't work. Try again." /> : null}
        <Button label="Unlock" icon="finger-print" onPress={tryUnlock} />
        {/* Phone sign-in has no sign-out: without the email there'd be no way back in. */}
        {SIGN_IN_MODE === 'passkey' ? (
          <TextButton
            label="Sign out instead"
            onPress={() =>
              confirm(
                'Sign out?',
                "You'll need your fingerprint to sign in again. Your data stays on this phone.",
                () => signOut(),
                'Sign out',
              )
            }
          />
        ) : null}
      </AuthLayout>
    </View>
  );
}

/** Asked once on each phone, right after the first sign-in. */
export function LockOffer() {
  const { setEnabled, markAsked } = useLock();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const turnOn = async () => {
    setBusy(true);
    const result = await setEnabled(true);
    setBusy(false);
    // 'ok' and 'no-lock' both save the answer, which moves the app on.
    if (result === 'failed') setProblem("That didn't work. Try again.");
  };

  return (
    <AuthLayout
      icon="finger-print"
      title={`Open ${APP_NAME} with your fingerprint?`}
      subtitle="Keeps your health data private if someone picks up your phone.">
      {problem ? <Notice tone="problem" text={problem} /> : null}
      <Button label="Use fingerprint" icon="finger-print" loading={busy} onPress={turnOn} />
      <Why
        title="Fingerprint lock"
        text="Keeps your steps, sleep, food and health readings private if someone else picks up your phone. Your face or your phone's screen-lock PIN works too."
      />
      <TextButton label="Not now" onPress={markAsked} disabled={busy} />
    </AuthLayout>
  );
}
