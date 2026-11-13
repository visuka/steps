# Phone sign-in with email recovery (testing phase)

Decided 2026-11-12: until testing is done, Steps signs in **per phone** instead of with passkeys.
Passkeys stay built and switched off (`rp_id` unset); they come back later and add a passkey to the
same account.

## What the person sees

1. **First open:** "I'm 18 or older" switch, an **email** field ("to get your account back if you
   change phones"), **Continue** → the phone's fingerprint check → account created on our server.
   Then a 6-digit code goes to the email; typing it confirms the email. If email can't be sent
   right now, the account still works and Settings shows "Confirm your email".
2. **Every open:** the fingerprint app lock, as today.
3. **Reinstall on the same phone, or a new phone restored from a Google backup:** Google Block
   Store still holds this phone's **restore key**, so the app signs straight back in.
4. **Anything else (new phone without backup, factory reset):** "I already have an account" →
   email → 6-digit code → back in the same account, and the new phone gets its own restore key.
5. No Sign out button in this mode (there would be no way back in without the email).
   Delete account stays, and also clears the Block Store key and the phone's data.

## Server (stepsinfra, the `steps-auth` Lambda; no authorizer on these routes)

All bodies JSON. `Tokens` and errors as in `docs/passkeys.md`, plus `restoreKey` where shown.
"Bearer" = the access token in `Authorization`, checked by the Lambda itself (same rules as the
authorizer: ES256, KMS public key, iss/aud/exp).

```
POST /v1/auth/device/register    {"adult": true}
  200 Tokens + {"restoreKey": "<43-char base64url>"}
  400 {"error": "adult_required"}
POST /v1/auth/device/restore     {"restoreKey": "..."}
  200 Tokens                       (same account; the key stays the same)
  401 {"error": "invalid"}         unknown key, deleted account
POST /v1/auth/email/start        Bearer, {"email": "..."}
  202 {}                           always the same answer (see below)
  400 {"error": "bad_email"}
  503 {"error": "email_unavailable"}   email is off, or SES refused, throttled or timed out the send
POST /v1/auth/email/finish       Bearer, {"code": "123456"}
  200 {"email": "...", "verified": true}
  400 {"error": "bad_code"}        wrong, expired or too many tries
POST /v1/auth/recover/start      {"email": "..."}
  202 {}                           whether or not an account has it, also when the send failed
  503 {"error": "email_unavailable"}   only while email is off (the same for every address)
POST /v1/auth/recover/finish     {"email": "...", "code": "123456"}
  200 Tokens + {"restoreKey": "..."}   a new key for this phone
  400 {"error": "bad_code"}
GET  /v1/me (data API)           now also returns {"email": "...", "emailVerified": bool}
```

Rules:
- **Restore key:** 32 random bytes, base64url; stored only as a SHA-256 hash (`RESTORE#<hash>` →
  user, plus an item under the user for deletion). One per phone; not rotated (Block Store's cloud
  copy can be older than the phone's, and a rotated key would then fail). Deleted with the account.
- **Codes:** 6 digits, 10 minutes, single use, 5 tries, stored only as a salted hash. A new code
  replaces the old one. Limits: 5 codes per account or email per day, plus a per-IP cap (hashed IP,
  as for sign-ups).
- **One account per email:** a verified email belongs to one account (conditional write on
  `EMAIL#<hash>`). `email/start` with an email another account already verified sends that address
  a short note ("someone tried to add this email to a new Steps account; if it was you, use
  'I already have an account'") instead of a code, and answers 202 like any other. `recover/start`
  sends a code only when a verified account has the email; otherwise nothing, still 202.
- **After a recovery** the address gets a note: "Your Steps account was opened on another phone.
  If that wasn't you, reply to this email." (no links).
- **Email sending:** Amazon SES (`ap-south-1`), from `Steps <no-reply@neutcrafts.in>` through the
  configuration set `steps-mail`, sent as the `steps-auth` Lambda's own IAM role: there is no
  mailbox password anywhere. Email off (`AuthConfig.send_email = False`) → `email_unavailable` on
  both sending routes. A send SES refuses, throttles or doesn't finish in time → `email/start`
  answers `email_unavailable`, `recover/start` still 202; the code is removed and not counted.
  Plain text + simple HTML, no links, no tracking. Logs never contain addresses, codes or keys
  (only SES's error name). Until SES production access, only verified addresses receive
  (stepsinfra README, "Email (Amazon SES)").
- **Account deletion** (`DELETE /v1/me`) also deletes the email and restore-key items. If deleting
  the steps-auth PROFILE fails, write the DELETED marker again **without expiry** and answer
  `accountDeleted: false`; if that write fails too, answer 500. So `accountDeleted: false` always
  means the account can never sign in again.
- Deleted accounts: restore, recover and email routes refuse them (PROFILE check + DELETED marker).

## App

- **Block Store** (Kotlin, `com.google.android.gms:play-services-auth-blockstore`): store, read and
  delete one entry `steps_restore_key`, with cloud backup on. iOS/web: not supported (returns
  nothing).
- `SIGN_IN_MODE = 'phone'` in `src/constants/app.ts`; the passkey screens stay in the code, unused.
- Start-up when signed out: read Block Store → `device/restore` → signed in ("Welcome back").
  An `invalid` answer deletes the Block Store entry and shows the first-open screen.
- First open: 18+ switch, email, Continue → local fingerprint check (expo-local-authentication;
  no screen lock set → explain and stop) → `device/register` → keep the refresh token (secure
  store) and the restore key (Block Store) → `email/start` → code screen → `email/finish`.
  "Use a different email" and "Send a new code" (after 30 s) on the code screen.
- "I already have an account" → email → `recover/start` → code → `recover/finish` → keep tokens and
  the new restore key.
- Settings → Account: the email and whether it is confirmed; "Confirm your email" when not;
  Delete account (also deletes the Block Store entry and the phone's data). No Sign out.
- The food lookups use `authFetch` from `src/auth/session.ts`.
