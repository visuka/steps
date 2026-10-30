import { useState } from 'react';
import { Switch } from 'react-native';

import { useAuth } from '@/auth/auth-state';
import { authMessage, passwordProblem } from '@/auth/rules';
import { supabase } from '@/auth/supabase';
import { Field } from '@/components/auth/auth-layout';
import { Card } from '@/components/card';
import { confirm } from '@/components/confirm';
import { Button, Row } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useLock } from '@/state/app-lock';

/** Settings → Account: the fingerprint lock, password and signing out. */
export function AccountCard() {
  const { session } = useAuth();
  const lock = useLock();
  const theme = useTheme();
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const email = session?.user.email;
  if (!email) return null;

  const toggleLock = async (on: boolean) => {
    setMessage(null);
    const result = await lock.setEnabled(on);
    if (result === 'failed') setMessage({ text: "That didn't work. Try again.", bad: true });
    if (result === 'no-lock') {
      setMessage({ text: "This phone has no screen lock. Set one in your phone's settings first.", bad: true });
    }
  };

  const changePassword = async () => {
    const problem = passwordProblem(next);
    if (problem) return setMessage({ text: problem, bad: true });
    setBusy(true);
    setMessage(null);
    try {
      const { error: wrong } = await supabase.auth.signInWithPassword({ email, password: current });
      if (wrong) throw wrong.code === 'invalid_credentials' ? { message: 'Your current password is wrong.' } : wrong;
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'others' });
      setChanging(false);
      setCurrent('');
      setNext('');
      setMessage({ text: 'Password changed. Any other phone signed in to this account was signed out.', bad: false });
    } catch (e) {
      setMessage({ text: authMessage(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Account">
      <ThemedText>
        Signed in as <ThemedText type="smallBold">{email}</ThemedText>
      </ThemedText>

      {lock.support === 'ready' || lock.enabled ? (
        <Row label="Lock with fingerprint">
          <Switch
            value={lock.enabled}
            onValueChange={toggleLock}
            trackColor={{ true: theme.accent, false: theme.track }}
          />
        </Row>
      ) : null}
      {lock.support === 'no-lock' && !lock.enabled ? (
        <ThemedText type="small" themeColor="textSecondary">
          Set a screen lock on this phone to open the app with your fingerprint.
        </ThemedText>
      ) : null}

      {changing ? (
        <>
          <Field label="Current password" kind="password" value={current} onChangeText={setCurrent} onCard />
          <Field
            label="New password (at least 8 characters)"
            kind="new-password"
            value={next}
            onChangeText={setNext}
            onCard
          />
          <Button label={busy ? 'Saving…' : 'Save new password'} onPress={changePassword} disabled={busy} />
          <Button kind="secondary" label="Cancel" onPress={() => setChanging(false)} disabled={busy} />
        </>
      ) : (
        <Button kind="secondary" label="Change password" onPress={() => setChanging(true)} />
      )}

      {message ? (
        <ThemedText type="small" style={message.bad ? { color: theme.danger } : undefined}>
          {message.text}
        </ThemedText>
      ) : null}

      <Button
        kind="secondary"
        label="Sign out"
        onPress={() =>
          confirm(
            'Sign out?',
            "You'll need your email and password to sign in again. Your data stays on this phone.",
            () => supabase.auth.signOut({ scope: 'local' }),
            'Sign out',
          )
        }
      />
      <Button
        kind="secondary"
        label="Sign out of all phones"
        onPress={() =>
          confirm(
            'Sign out everywhere?',
            'Every phone signed in to this account, including this one, will need the password again.',
            () => supabase.auth.signOut({ scope: 'global' }),
            'Sign out',
          )
        }
      />
    </Card>
  );
}
