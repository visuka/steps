import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform } from 'react-native';

import { useAuth } from '@/auth/auth-state';
import { newAccountWipesData } from '@/auth/owner';
import type { EmailSendResult } from '@/auth/phone-sign-in';
import { carriedOverAccount } from '@/auth/session-storage';
import { AuthLayout, Field, TextButton } from '@/components/auth/auth-layout';
import { EmailConfirm } from '@/components/auth/email-confirm';
import { Button, Notice, Surface, ToggleRow, Why } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { useTheme } from '@/hooks/use-theme';
import { useLock } from '@/state/app-lock';
import { useApp } from '@/state/app-state';

/**
 * Sign-in per phone (docs/phone-signin.md): the 18+ switch and an email make
 * an account after the phone's fingerprint check; "I already have an
 * account" gets one back with a code from the email. A reinstall signs in by
 * itself with the restore key in Block Store ("Welcome back").
 */
export function PhoneAuthScreen() {
  const auth = useAuth();
  const lock = useLock();
  const theme = useTheme();
  const { repo } = useApp();
  const [screen, setScreen] = useState<'welcome' | 'recover'>('welcome');
  const [adult, setAdult] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // The keyboard's Go key still works while the button is off; this stops a second account.
  const working = useRef(false);
  const [error, setError] = useState<string | null>(null);
  // How sending the first code went, for the email step that follows.
  const [firstSend, setFirstSend] = useState<EmailSendResult | null>(null);
  // A new account would wipe another account's data on this phone; say so first.
  const [wipesData, setWipesData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    newAccountWipesData(repo, carriedOverAccount)
      .then((wipes) => {
        if (!cancelled) setWipesData(wipes);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const createAccount = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await auth.createPhoneAccount(adult, email);
      if (result.kind === 'signed-in' || result.kind === 'restored') {
        // The fingerprint check just ran; no need to ask again for the lock.
        lock.release();
      }
      if (result.kind === 'signed-in') setFirstSend(result.sent);
      else if (result.kind === 'error') setError(result.message);
      // 'restored': back in this phone's account, and the app opens by itself.
      // 'cancelled': they closed the fingerprint prompt on purpose; stay quietly.
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const messages = (
    <>
      {auth.notice ? <Notice text={auth.notice} /> : null}
      {error ? <Notice tone="problem" text={error} /> : null}
    </>
  );

  // The account exists now (the session has started); the welcome screen
  // stays until the request that made it is done.
  if (auth.confirmingEmail && !busy) {
    if (firstSend?.kind === 'unavailable') {
      return (
        <AuthLayout icon="checkmark-circle-outline" title="Your account is ready">
          <Notice text={firstSend.message} />
          <Button label="Continue" onPress={auth.doneWithFirstEmail} />
        </AuthLayout>
      );
    }
    return (
      <AuthLayout icon="mail-unread-outline" title="Confirm your email">
        <EmailConfirm
          key={firstSend?.kind ?? 'none'}
          initialEmail={auth.confirmingEmail}
          sentTo={firstSend?.kind === 'sent' ? firstSend.email : null}
          initialError={firstSend?.kind === 'error' ? firstSend.message : null}
          send={(address) => auth.sendEmailCode(address, 'first')}
          check={(_address, code) => auth.confirmEmail(code)}
          onDone={auth.doneWithFirstEmail}
          emailText="We'll send a 6-digit code. Your email gets your account back on a new phone.">
          <TextButton label="Confirm later in Settings" onPress={auth.doneWithFirstEmail} />
        </EmailConfirm>
      </AuthLayout>
    );
  }

  if (auth.restore.state === 'restoring') {
    return (
      <AuthLayout icon="footsteps" title="Welcome back" subtitle="Signing you in on this phone…">
        <ActivityIndicator color={theme.primary} size="large" />
      </AuthLayout>
    );
  }

  if (screen === 'recover') {
    return (
      <AuthLayout icon="key-outline" title="Find your account">
        <EmailConfirm
          initialEmail={email}
          send={auth.startRecovery}
          check={auth.finishRecovery}
          // Signed in: the app opens by itself.
          onDone={() => undefined}
          checkLabel="Sign in"
          emailText="The email you confirmed for your account. We'll send it a 6-digit code."
          // The server answers the same whether or not an account has the email.
          sentText={(address) =>
            `If ${address} belongs to a ${APP_NAME} account, we sent a 6-digit code to it. It works for 10 minutes.`
          }>
          {auth.notice ? <Notice text={auth.notice} /> : null}
          <TextButton label="Back" onPress={() => setScreen('welcome')} />
        </EmailConfirm>
      </AuthLayout>
    );
  }

  if (auth.restore.state === 'failed') {
    // No new account from here: it would write over this phone's key (src/auth/phone-sign-in.ts).
    const found = auth.restore.found;
    return (
      <AuthLayout
        icon="footsteps"
        title={found ? 'Welcome back' : `Welcome to ${APP_NAME}`}
        subtitle={
          found
            ? "Your account is saved on this phone, but we couldn't sign you in."
            : "We couldn't check this phone for your account."
        }>
        {auth.notice ? <Notice text={auth.notice} /> : null}
        <Notice tone="problem" text={auth.restore.message} />
        <Button label="Try again" icon="refresh" onPress={auth.retryRestore} />
        <TextButton label="Use my email instead" onPress={() => setScreen('recover')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon="footsteps" title={`Welcome to ${APP_NAME}`} subtitle="Make your account on this phone.">
      <Surface level={1}>
        <ToggleRow title="I'm 18 or older" value={adult} onValueChange={setAdult} />
      </Surface>
      <Field
        label="Email"
        kind="email"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={createAccount}
        editable={!busy}
        supporting="Gets your account back on a new phone. Nothing else."
      />
      {wipesData ? (
        <Notice
          tone="problem"
          text="A new account deletes another account's data on this phone. Have one? Tap “I already have an account”."
        />
      ) : null}
      {messages}
      <Button label="Continue" loading={busy} onPress={createAccount} />
      <Why
        title="Your fingerprint"
        label="What happens next?"
        text="Next, your phone checks your fingerprint or PIN. It stays on your phone. We send a code to confirm your email, nothing else."
      />
      <TextButton label="I already have an account" onPress={() => setScreen('recover')} disabled={busy} />
      {Platform.OS === 'web' && __DEV__ ? (
        <TextButton label="Look around without an account (preview only)" onPress={auth.skipForPreview} />
      ) : null}
    </AuthLayout>
  );
}
