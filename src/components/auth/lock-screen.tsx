import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { supabase } from '@/auth/supabase';
import { AuthLayout, TextButton } from '@/components/auth/auth-layout';
import { confirm } from '@/components/confirm';
import { Button } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME } from '@/constants/app';
import { useTheme } from '@/hooks/use-theme';
import { useLock } from '@/state/app-lock';

/**
 * Covers the app (which stays mounted underneath, so a walk keeps recording)
 * and asks for the fingerprint straight away.
 */
export function LockScreen() {
  const { unlock } = useLock();
  const theme = useTheme();
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
        subtitle="Use your fingerprint, face or your phone's screen lock to open it.">
        {failed ? (
          <ThemedText type="small" style={{ color: theme.danger }}>
            That didn&apos;t work. Try again.
          </ThemedText>
        ) : null}
        <Button label="Unlock" onPress={tryUnlock} />
        <TextButton
          label="Sign out instead"
          onPress={() =>
            confirm(
              'Sign out?',
              "You'll need your email and password to sign in again.",
              () => supabase.auth.signOut({ scope: 'local' }),
              'Sign out',
            )
          }
        />
      </AuthLayout>
    </View>
  );
}

/** Asked once on each phone, right after the first sign-in. */
export function LockOffer() {
  const { setEnabled, markAsked } = useLock();
  const theme = useTheme();
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
      subtitle="Keeps your steps, sleep, food and health readings private if someone else picks up your phone. Your face or your phone's screen-lock PIN works too.">
      {problem ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {problem}
        </ThemedText>
      ) : null}
      <Button label={busy ? 'Waiting…' : 'Use fingerprint'} onPress={turnOn} disabled={busy} />
      <TextButton label="Not now" onPress={markAsked} disabled={busy} />
    </AuthLayout>
  );
}
