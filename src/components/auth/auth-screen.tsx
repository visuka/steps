import { useState } from 'react';
import { Platform, StyleSheet, Switch } from 'react-native';

import { useAuth } from '@/auth/auth-state';
import { authMessage, isCode, isEmail, normalizeEmail, passwordProblem } from '@/auth/rules';
import { supabase } from '@/auth/supabase';
import { AuthLayout, Field, TextButton } from '@/components/auth/auth-layout';
import { Button, Row } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME } from '@/constants/app';
import { useTheme } from '@/hooks/use-theme';
import { useLock } from '@/state/app-lock';

type Mode = 'signIn' | 'signUp' | 'confirm' | 'forgot' | 'reset';

/**
 * Email and password, with a one-time code to confirm the email and another
 * for "forgot password". The Supabase email templates must send the code
 * (`{{ .Token }}`), not a link; see docs/auth-emails.md.
 */
export function AuthScreen() {
  const auth = useAuth();
  const lock = useLock();
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [adult, setAdult] = useState(false);
  const [codeAccepted, setCodeAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const address = normalizeEmail(email);

  const go = (next: Mode, message: string | null = null) => {
    setMode(next);
    setError(null);
    setNotice(message);
    setCode('');
    if (next !== 'confirm') setPassword('');
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const signIn = () => {
    if (!isEmail(email)) return setError('Enter your email address.');
    if (!password) return setError('Enter your password.');
    run(async () => {
      const { error: e } = await supabase.auth.signInWithPassword({ email: address, password });
      if (e?.code === 'email_not_confirmed') {
        await supabase.auth.resend({ type: 'signup', email: address });
        return go('confirm', authMessage(e));
      }
      if (e) throw e;
      lock.release();
    });
  };

  const signUp = () => {
    if (!isEmail(email)) return setError('Enter your email address.');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (!adult) return setError(`${APP_NAME} is for adults 18 and over.`);
    run(async () => {
      const { data, error: e } = await supabase.auth.signUp({ email: address, password });
      if (e) throw e;
      // Supabase hides whether an email is taken by returning a user with no identities.
      if (data.user && data.user.identities?.length === 0) {
        return setError('This email already has an account. Sign in instead.');
      }
      // Only when "Confirm email" is off in Supabase.
      if (data.session) return lock.release();
      go('confirm');
    });
  };

  const confirmEmail = () => {
    if (!isCode(code)) return setError('Enter the code from the email.');
    run(async () => {
      const { error: e } = await supabase.auth.verifyOtp({ email: address, token: code.trim(), type: 'email' });
      if (e) throw e;
      lock.release();
    });
  };

  const resendConfirm = () =>
    run(async () => {
      const { error: e } = await supabase.auth.resend({ type: 'signup', email: address });
      if (e) throw e;
      setNotice('We sent a new code.');
    });

  const sendResetCode = () => {
    if (!isEmail(email)) return setError('Enter your email address.');
    run(async () => {
      const { error: e } = await supabase.auth.resetPasswordForEmail(address);
      if (e) throw e;
      // Same words whether or not the account exists.
      go('reset', `If ${address} has an account, we sent a code to it. It works once, for 15 minutes.`);
    });
  };

  const resetPassword = () => {
    if (!codeAccepted && !isCode(code)) return setError('Enter the code from the email.');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    run(async () => {
      if (!codeAccepted) {
        // The code signs the person in; keep this screen up until the new password is saved.
        auth.setResetting(true);
        const { error: e } = await supabase.auth.verifyOtp({ email: address, token: code.trim(), type: 'recovery' });
        if (e) {
          auth.setResetting(false);
          throw e;
        }
        setCodeAccepted(true);
      }
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      // Whoever knew the old password is now out of every other phone.
      await supabase.auth.signOut({ scope: 'others' });
      lock.release();
      auth.setResetting(false);
    });
  };

  const cancelReset = () =>
    run(async () => {
      if (codeAccepted) await supabase.auth.signOut({ scope: 'local' });
      setCodeAccepted(false);
      auth.setResetting(false);
      go('signIn');
    });

  const messages = (
    <>
      {notice ? <ThemedText type="small">{notice}</ThemedText> : null}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </>
  );

  if (mode === 'signUp') {
    return (
      <AuthLayout
        icon="person-add-outline"
        title="Create your account"
        subtitle="After this, you open the app with your fingerprint.">
        <Field label="Email" kind="email" value={email} onChangeText={setEmail} />
        <Field label="Password (at least 8 characters)" kind="new-password" value={password} onChangeText={setPassword} />
        <Row label="I'm 18 or older">
          <Switch value={adult} onValueChange={setAdult} trackColor={{ true: theme.accent, false: theme.track }} />
        </Row>
        {messages}
        <Button label={busy ? 'Creating…' : 'Create account'} onPress={signUp} disabled={busy} />
        <TextButton label="I already have an account" onPress={() => go('signIn')} />
      </AuthLayout>
    );
  }

  if (mode === 'confirm') {
    return (
      <AuthLayout
        icon="mail-unread-outline"
        title="Check your email"
        subtitle={`We sent a code to ${address}. Enter it here to confirm the email is yours.`}>
        <Field label="Code" kind="code" value={code} onChangeText={setCode} onSubmitEditing={confirmEmail} />
        {messages}
        <Button label={busy ? 'Checking…' : 'Confirm'} onPress={confirmEmail} disabled={busy} />
        <TextButton label="Send a new code" onPress={resendConfirm} disabled={busy} />
        <TextButton label="Use a different email" onPress={() => go('signUp')} />
      </AuthLayout>
    );
  }

  if (mode === 'forgot') {
    return (
      <AuthLayout
        icon="key-outline"
        title="Forgot password"
        subtitle="Enter your account's email and we'll send you a code to choose a new password.">
        <Field label="Email" kind="email" value={email} onChangeText={setEmail} onSubmitEditing={sendResetCode} />
        {messages}
        <Button label={busy ? 'Sending…' : 'Send code'} onPress={sendResetCode} disabled={busy} />
        <TextButton label="Back to sign in" onPress={() => go('signIn')} />
      </AuthLayout>
    );
  }

  if (mode === 'reset') {
    return (
      <AuthLayout icon="key-outline" title="Choose a new password">
        {codeAccepted ? null : <Field label="Code from the email" kind="code" value={code} onChangeText={setCode} />}
        <Field label="New password (at least 8 characters)" kind="new-password" value={password} onChangeText={setPassword} />
        {messages}
        <Button label={busy ? 'Saving…' : 'Save new password'} onPress={resetPassword} disabled={busy} />
        {codeAccepted ? null : <TextButton label="Send a new code" onPress={sendResetCode} disabled={busy} />}
        <TextButton label="Cancel" onPress={cancelReset} disabled={busy} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout icon="footsteps" title={`Sign in to ${APP_NAME}`}>
      <Field label="Email" kind="email" value={email} onChangeText={setEmail} />
      <Field label="Password" kind="password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
      {messages}
      <Button label={busy ? 'Signing in…' : 'Sign in'} onPress={signIn} disabled={busy} />
      <TextButton label="Forgot password?" onPress={() => go('forgot')} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        New to {APP_NAME}?
      </ThemedText>
      <Button kind="secondary" label="Create an account" onPress={() => go('signUp')} />
      {Platform.OS === 'web' && __DEV__ ? (
        <TextButton label="Look around without an account (preview only)" onPress={auth.skipForPreview} />
      ) : null}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
