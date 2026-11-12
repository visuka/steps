import { type ReactNode, useEffect, useRef, useState } from 'react';

import { cleanCode, resendWaitSeconds } from '@/auth/rules';
import { Field, TextButton } from '@/components/auth/auth-layout';
import { Button } from '@/components/controls';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Sent = { kind: 'sent'; email: string } | { kind: 'unavailable' | 'error'; message: string };
type Checked = { kind: 'error'; message: string } | { kind: 'confirmed' | 'signed-in' };

/**
 * An email, then the 6-digit code sent to it. Shared by the new account's
 * email step, "I already have an account" and Settings → "Confirm your
 * email"; the caller says what sending and checking do. Renders its parts
 * straight into the caller's frame (AuthLayout or Card).
 */
export function EmailConfirm({
  initialEmail,
  sentTo = null,
  initialError = null,
  send,
  check,
  onDone,
  sentText = (email) => `We sent a 6-digit code to ${email}. It works for 10 minutes.`,
  emailText = "Enter your email. We'll send you a 6-digit code to confirm it.",
  checkLabel = 'Confirm',
  onCard,
  children,
}: {
  initialEmail: string;
  /** The code already went to this address: start at the code. */
  sentTo?: string | null;
  /** Why the first send didn't work, shown on the email step. */
  initialError?: string | null;
  send(email: string): Promise<Sent>;
  check(email: string, code: string): Promise<Checked>;
  onDone(email: string): void;
  sentText?: (email: string) => string;
  emailText?: string;
  checkLabel?: string;
  onCard?: boolean;
  /** More actions under the step, e.g. "Confirm later in Settings". */
  children?: ReactNode;
}) {
  const theme = useTheme();
  const [step, setStep] = useState<'email' | 'code'>(sentTo ? 'code' : 'email');
  const [email, setEmail] = useState(sentTo ?? initialEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  // The keyboard's Done key still works while the buttons are off. A second
  // email/start would replace the code already on its way, and use up one of
  // the day's few codes.
  const working = useRef(false);
  const [error, setError] = useState<string | null>(initialError);
  // When the last code went out, so "Send a new code" waits for it first.
  const [sentAt, setSentAt] = useState<number | null>(() => (sentTo ? Date.now() : null));
  const [now, setNow] = useState(() => Date.now());
  const wait = sentAt === null ? 0 : resendWaitSeconds(sentAt, now);

  // Ticks once a second while the wait runs, for the countdown on the button.
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(timer);
  }, [wait, now]);

  /** One request at a time; `work` says what to show once it's back. */
  const oneAtATime = async (work: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const sendCode = (address: string) =>
    oneAtATime(async () => {
      const result = await send(address);
      if (result.kind !== 'sent') {
        setError(result.message);
        return;
      }
      const at = Date.now();
      setEmail(result.email);
      setCode('');
      setStep('code');
      setSentAt(at);
      setNow(at);
    });

  const submit = () =>
    oneAtATime(async () => {
      const result = await check(email, code);
      if (result.kind === 'error') {
        setError(result.message);
        return;
      }
      onDone(email);
    });

  const differentEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
  };

  const problem = error ? (
    <ThemedText type="small" style={{ color: theme.danger }}>
      {error}
    </ThemedText>
  ) : null;

  if (step === 'email') {
    return (
      <>
        <ThemedText type="small" themeColor="textSecondary">
          {emailText}
        </ThemedText>
        <Field
          label="Email"
          kind="email"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => sendCode(email)}
          onCard={onCard}
          editable={!busy}
        />
        {problem}
        <Button label={busy ? 'Sending…' : 'Send code'} onPress={() => sendCode(email)} disabled={busy} />
        {children}
      </>
    );
  }

  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {sentText(email)}
      </ThemedText>
      <Field
        label="Code from the email"
        kind="code"
        value={code}
        onChangeText={(text) => setCode(cleanCode(text))}
        onSubmitEditing={submit}
        onCard={onCard}
        editable={!busy}
      />
      {problem}
      <Button label={busy ? 'Checking…' : checkLabel} onPress={submit} disabled={busy} />
      <TextButton
        label={wait > 0 ? `Send a new code in ${wait} s` : 'Send a new code'}
        onPress={() => sendCode(email)}
        disabled={busy || wait > 0}
      />
      <TextButton label="Use a different email" onPress={differentEmail} disabled={busy} />
      {children}
    </>
  );
}
