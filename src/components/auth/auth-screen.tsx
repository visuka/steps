import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch } from 'react-native';

import { useAuth } from '@/auth/auth-state';
import { newAccountWipesData } from '@/auth/owner';
import { carriedOverAccount } from '@/auth/session-storage';
import type { SignInResult } from '@/auth/sign-in';
import { AuthLayout, TextButton } from '@/components/auth/auth-layout';
import { PhoneAuthScreen } from '@/components/auth/phone-auth-screen';
import { Button, Row } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME, SIGN_IN_MODE } from '@/constants/app';
import { useTheme } from '@/hooks/use-theme';
import { useLock } from '@/state/app-lock';
import { useApp } from '@/state/app-state';

/** The sign-in screens for SIGN_IN_MODE: per phone while testing, passkeys later. */
export function AuthScreen() {
  return SIGN_IN_MODE === 'phone' ? <PhoneAuthScreen /> : <PasskeyAuthScreen />;
}

/**
 * No email, no password: one button signs in with the passkey on the phone.
 * When the phone has none, the same screen asks the 18+ question and makes
 * one. See docs/passkeys.md.
 */
export function PasskeyAuthScreen() {
  const auth = useAuth();
  const lock = useLock();
  const theme = useTheme();
  const [newHere, setNewHere] = useState(false);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { repo } = useApp();
  // "New here?" can also mean the passkey just hasn't reached this phone yet;
  // a new account would then wipe the data already here, so say so first.
  const [wipesData, setWipesData] = useState(false);

  useEffect(() => {
    if (!newHere) return;
    let cancelled = false;
    newAccountWipesData(repo, carriedOverAccount)
      .then((wipes) => {
        if (!cancelled) setWipesData(wipes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [newHere, repo]);

  const run = async (task: () => Promise<SignInResult>) => {
    setBusy(true);
    setError(null);
    const result = await task();
    setBusy(false);
    switch (result.kind) {
      case 'signed-in':
        // The passkey took a fingerprint just now; no need to ask again for the lock.
        lock.release();
        break;
      case 'new-here':
        setNewHere(true);
        setError(result.message ?? null);
        break;
      case 'error':
        setError(result.message);
        // e.g. "request cannot be validated" when assetlinks.json doesn't list this build; never a token.
        if (result.detail) console.warn(`Passkey: ${result.detail}`);
        break;
      // 'cancelled': they closed the sheet on purpose; stay quietly.
    }
  };

  const signIn = () => run(auth.signIn);
  const createAccount = () => run(() => auth.createAccount(adult));

  return (
    <AuthLayout
      icon="footsteps"
      title={newHere ? 'New here?' : `Sign in to ${APP_NAME}`}
      subtitle={newHere ? 'Make a passkey to start. It takes one touch.' : undefined}>
      {newHere ? (
        <Row label="I'm 18 or older">
          <Switch value={adult} onValueChange={setAdult} trackColor={{ true: theme.accent, false: theme.track }} />
        </Row>
      ) : null}
      {newHere && wipesData ? (
        <ThemedText type="small">
          This phone has another account&apos;s data. A new account deletes it from this phone. If you already have a
          passkey, tap “I already have a passkey”.
        </ThemedText>
      ) : null}
      {auth.notice ? <ThemedText type="small">{auth.notice}</ThemedText> : null}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
      <Button
        label={busy ? 'Waiting…' : 'Continue with fingerprint'}
        onPress={newHere ? createAccount : signIn}
        disabled={busy}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        Your fingerprint stays on your phone. A passkey is saved in your Google account, so you can sign in on a new
        phone.
      </ThemedText>
      {newHere ? <TextButton label="I already have a passkey" onPress={signIn} disabled={busy} /> : null}
      {Platform.OS === 'web' && __DEV__ ? (
        <TextButton label="Look around without an account (preview only)" onPress={auth.skipForPreview} />
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
