import { useEffect, useState } from 'react';
import { Switch } from 'react-native';

import { type AccountInfo, fetchAccountInfo } from '@/auth/account';
import { useAuth } from '@/auth/auth-state';
import { accountCode, passkeyName } from '@/auth/rules';
import { authFetch, isAuthApiError } from '@/auth/session';
import { TextButton } from '@/components/auth/auth-layout';
import { EmailConfirm } from '@/components/auth/email-confirm';
import { Card } from '@/components/card';
import { confirm } from '@/components/confirm';
import { Button, Row } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { APP_NAME, SIGN_IN_MODE, STEPS_API_URL } from '@/constants/app';
import { useTheme } from '@/hooks/use-theme';
import { useLock } from '@/state/app-lock';
import { useApp } from '@/state/app-state';

const phone = SIGN_IN_MODE === 'phone';

/**
 * Settings → Account: the fingerprint lock and deleting the account; with
 * passkeys also signing out, with phone sign-in the email instead (no
 * sign-out: without the email there would be no way back in).
 */
export function AccountCard() {
  const auth = useAuth();
  const { resetAll } = useApp();
  const lock = useLock();
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const userId = auth.userId;
  if (!userId) return null;

  const toggleLock = async (on: boolean) => {
    setMessage(null);
    const result = await lock.setEnabled(on);
    if (result === 'failed') setMessage("That didn't work. Try again.");
    if (result === 'no-lock') setMessage("This phone has no screen lock. Set one in your phone's settings first.");
  };

  const removeAccount = async () => {
    setBusy(true);
    setMessage(null);
    const result = await auth.deleteAccount(resetAll);
    // On success the sign-in screen replaces this one and says what happened.
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  };

  const deleteWarning = phone
    ? `This deletes your ${APP_NAME} account and everything it saved on our server, including your email, and clears the app's history, logs and settings on this phone. Data in your health app stays. It can't be undone.`
    : `This deletes your ${APP_NAME} account and everything it saved on our server, and clears the app's history, logs and settings on this phone. Data in your health app stays. It can't be undone. Afterwards you can remove the passkey “${passkeyName(userId)}” in Google Password Manager.`;

  return (
    <Card title="Account">
      {phone ? <AccountEmail /> : <ThemedText>Signed in with a passkey</ThemedText>}
      <ThemedText type="small" themeColor="textSecondary">
        Account code <ThemedText type="smallBold">{accountCode(userId)}</ThemedText>
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

      {message ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {message}
        </ThemedText>
      ) : null}

      {phone ? null : (
        <Button
          kind="secondary"
          label="Sign out"
          disabled={busy}
          onPress={() =>
            confirm(
              'Sign out?',
              "You'll need your fingerprint to sign in again. Your data stays on this phone.",
              () => auth.signOut(),
              'Sign out',
            )
          }
        />
      )}
      <Button
        kind="danger"
        label={busy ? 'Deleting…' : 'Delete account'}
        disabled={busy}
        onPress={() => confirm('Delete your account?', deleteWarning, removeAccount, 'Delete')}
      />
    </Card>
  );
}

/** The account's email and whether it's confirmed (GET /v1/me), with "Confirm your email" when it isn't. */
function AccountEmail() {
  const auth = useAuth();
  const theme = useTheme();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAccountInfo(authFetch, STEPS_API_URL).then(
      (next) => {
        if (cancelled) return;
        setInfo(next);
        setLoadError(null);
      },
      (e: unknown) => {
        if (cancelled) return;
        setLoadError(
          isAuthApiError(e) && e.code === 'offline'
            ? "Couldn't check your email: no internet connection."
            : "Couldn't check your email right now.",
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (confirming) {
    return (
      <EmailConfirm
        initialEmail={info?.email ?? ''}
        send={(address) => auth.sendEmailCode(address, 'later')}
        check={(_address, code) => auth.confirmEmail(code)}
        onDone={(address) => {
          setInfo({ email: address, emailVerified: true });
          setConfirming(false);
        }}
        onCard>
        <TextButton label="Cancel" onPress={() => setConfirming(false)} />
      </EmailConfirm>
    );
  }

  if (loadError) {
    return (
      <>
        <ThemedText type="small" style={{ color: theme.danger }}>
          {loadError}
        </ThemedText>
        <TextButton
          label="Try again"
          onPress={() => {
            setLoadError(null);
            setAttempt((n) => n + 1);
          }}
        />
      </>
    );
  }

  if (!info) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Checking your email…
      </ThemedText>
    );
  }

  if (info.email && info.emailVerified) {
    return (
      <>
        <ThemedText>
          Email <ThemedText type="smallBold">{info.email}</ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Confirmed. It gets your account back if you change phones.
        </ThemedText>
      </>
    );
  }

  return (
    <>
      {info.email ? (
        <ThemedText>
          Email <ThemedText type="smallBold">{info.email}</ThemedText> (not confirmed yet)
        </ThemedText>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        Confirm your email so you can get your account back if you change phones or reset this one.
      </ThemedText>
      <Button kind="secondary" label="Confirm your email" onPress={() => setConfirming(true)} />
    </>
  );
}
