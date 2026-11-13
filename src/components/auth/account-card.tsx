import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { type AccountInfo, fetchAccountInfo } from '@/auth/account';
import { useAuth } from '@/auth/auth-state';
import { accountCode, passkeyName } from '@/auth/rules';
import { authFetch, isAuthApiError } from '@/auth/session';
import { TextButton } from '@/components/auth/auth-layout';
import { EmailConfirm } from '@/components/auth/email-confirm';
import { confirm } from '@/components/confirm';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, type IconName, Notice, ToggleRow } from '@/components/ui';
import { APP_NAME, SIGN_IN_MODE, STEPS_API_URL } from '@/constants/app';
import { Spacing } from '@/constants/theme';
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
      {phone ? <AccountEmail /> : <Line icon="key-outline" title="Signed in with a passkey" />}
      <Line icon="id-card-outline" title={accountCode(userId)} supporting="Account code" />

      {lock.support === 'ready' || lock.enabled ? (
        <View style={styles.bleed}>
          <ToggleRow icon="finger-print" title="Lock with fingerprint" value={lock.enabled} onValueChange={toggleLock} />
        </View>
      ) : null}
      {lock.support === 'no-lock' && !lock.enabled ? (
        <Notice text="Set a screen lock on this phone to open the app with your fingerprint." />
      ) : null}

      {message ? <Notice tone="problem" text={message} /> : null}

      {phone ? null : (
        <Button
          variant="tonal"
          label="Sign out"
          icon="log-out-outline"
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
        variant="outlined"
        danger
        label="Delete account"
        loading={busy}
        onPress={() => confirm('Delete your account?', deleteWarning, removeAccount, 'Delete')}
      />
    </Card>
  );
}

/** A plain line of the account: an icon, the value, and what it is. */
function Line({
  icon,
  title,
  supporting,
  trailing,
}: {
  icon: IconName;
  title: string;
  supporting?: string;
  trailing?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.line} accessible accessibilityLabel={supporting ? `${supporting}: ${title}` : title}>
      <Ionicons name={icon} size={24} color={theme.onSurfaceVariant} />
      <View style={styles.lineText}>
        <ThemedText type="bodyLarge" numberOfLines={1}>
          {title}
        </ThemedText>
        {supporting ? (
          <ThemedText type="bodyMedium" themeColor="onSurfaceVariant">
            {supporting}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
    </View>
  );
}

/** The account's email and whether it's confirmed (GET /v1/me), with "Confirm your email" when it isn't. */
function AccountEmail() {
  const auth = useAuth();
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
        <Notice tone="problem" text={loadError} />
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
      <Notice text="Checking your email…" />
    );
  }

  if (info.email && info.emailVerified) {
    return (
      <Line icon="mail-outline" title={info.email} supporting="Email · confirmed" trailing={<ConfirmedMark />} />
    );
  }

  return (
    <>
      {info.email ? <Line icon="mail-outline" title={info.email} supporting="Email · not confirmed yet" /> : null}
      <Notice text="Confirm it to get your account back on a new phone." />
      <Button variant="tonal" label="Confirm your email" onPress={() => setConfirming(true)} />
    </>
  );
}

function ConfirmedMark() {
  const theme = useTheme();
  return <Ionicons name="checkmark-circle" size={20} color={theme.steps} accessibilityLabel="Confirmed" />;
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56 },
  lineText: { flex: 1, gap: Spacing.half },
  // The switch row spans the card's full width, like a list row.
  bleed: { marginHorizontal: -Spacing.three },
});
