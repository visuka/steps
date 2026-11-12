# Sign-in with passkeys

Steps has no email or password. On first open the person touches the fingerprint sensor and
Android makes a **passkey**: a key pair whose private half never leaves the phone's secure
hardware and is unlocked by the fingerprint (or the phone's PIN). Google Password Manager keeps an
end-to-end encrypted copy in the person's Google account, so a new phone signed in to the same
Google account signs in with the fingerprint too. iPhones do the same through iCloud Keychain.

Our server only ever sees the public key and a random account id: no email, no name, no
fingerprint. Sign-in runs entirely in our AWS account (ap-south-1); Supabase is gone.

## Pieces

| Piece | Where |
| --- | --- |
| Passkey calls on the phone (Android Credential Manager) | `modules/passkeys` (Kotlin Expo module; iOS not yet: needs an Apple developer account) |
| Sign-in state, tokens, screens | `src/auth/*`, `src/components/auth/*` |
| Sign-in API (`steps-auth` Lambda, Node, `@simplewebauthn/server`) | stepsinfra `StepsAuth` stack, its own HTTP API |
| Token signing key | AWS KMS asymmetric key (P-256): the private key never leaves KMS |
| Passkeys, challenges, refresh tokens | DynamoDB `steps-auth` |
| Checking tokens on every data/food call | stepsinfra authorizer (verifies against the KMS public key) |
| The domain file that ties the app to the passkeys | `https://<rpId>/.well-known/assetlinks.json`, served by the sign-in API on its own host |

## The domain (relying party id)

Every passkey is tied to a domain name we own (the "rpId"), forever: changing it later means
everyone makes a new passkey. Ours will be **`steps.neutcrafts.in`** (stepsinfra
`AuthConfig.rp_id`, set at the deploy that turns sign-in on). Each Neutcrafts app gets its own
subdomain, so passkeys don't mix between apps: the phone only offers a passkey made for that
app's rpId. Only the sign-in API serves that host, since Android reads the domain file from it.

Android only lets our app use passkeys for the rpId if
`https://<rpId>/.well-known/assetlinks.json` lists our package (`com.neutcrafts.steps`) and the
SHA-256 fingerprint of the certificate the app is signed with (for Play Store builds: the Play app
signing key from Play Console; for test APKs: our private CI test key, README "Test signing key").

The server accepts an Android sign-in only from origins
`android:apk-key-hash:<base64url SHA-256 of that same certificate>`.

**Never list React Native's debug key** (fingerprint `FA:C6:17:45:…:3B:9C`). Expo's prebuild
signs release APKs with it by default, and its private key ships in every React Native project.
If it were listed, anyone could build an app named `com.neutcrafts.steps`, sign it with that key,
and sign in with a person's synced passkey after one fingerprint touch. Passkeys are tied to the
rpId forever, so that would expose Play Store users' passkeys too. The server refuses it
(stepsinfra `auth_stack.py` at synth, `config.mjs` when the Lambda starts), and the Android build
warns when it was signed with it.

So test builds must be signed with the private test key. Android won't install an APK signed with
one key over an app signed with another, so each tester uninstalls the old debug-signed build
once, which deletes the app's data on that phone, then installs the new one.

## API (base `AUTH_API_URL`)

All bodies are JSON. WebAuthn options and responses use the standard WebAuthn JSON form
(base64url strings): exactly what Android Credential Manager's `requestJson` and
`registrationResponseJson` / `authenticationResponseJson` use.

```
POST /v1/auth/login/options      {}
  200 {"challengeId": "...", "options": PublicKeyCredentialRequestOptionsJSON}
POST /v1/auth/login/verify       {"challengeId": "...", "credential": AuthenticationResponseJSON}
  200 Tokens
  401 {"error": "unknown_credential"}   no account has this passkey (deleted account, or a sign-up that didn't finish)
  401 {"error": "invalid"}
POST /v1/auth/register/options   {"adult": true}
  200 {"challengeId": "...", "options": PublicKeyCredentialCreationOptionsJSON}
  400 {"error": "adult_required"}
POST /v1/auth/register/verify    {"challengeId": "...", "credential": RegistrationResponseJSON}
  200 Tokens
  400 {"error": "invalid"}
POST /v1/auth/refresh            {"refreshToken": "..."}
  200 Tokens
  401 {"error": "invalid"}
POST /v1/auth/logout             {"refreshToken": "..."}
  204
GET  /.well-known/assetlinks.json
GET  /.well-known/apple-app-site-association   (404 until the Apple team id is set)

Tokens = {"userId": "...", "accessToken": "...", "accessExpiresAt": <epoch ms>, "refreshToken": "..."}
Other errors: 429 {"error": "rate_limited"}, 503 {"error": "not_configured"} (no rpId yet),
              500 {"error": "server_error"}
```

A 500 (ours, or any 5xx from API Gateway when the Lambda fails or times out) means:
- on refresh: keep the refresh token and try again later. Nothing was used up, or the token was
  swapped and the reply lost, which the grace window below covers. The app never signs out on it.
- on sign-in or sign-up: start over from `options`. The challenge is already used.

A 429 with `{"error": "rate_limited"}` is the Lambda's own limit (today only sign-ups: so many
per network per India day), and the app says "try again tomorrow". Any other 429 is API Gateway's
per-second throttle (`{"message": "Too Many Requests"}`), and the app says "wait a minute".

Account deletion stays `DELETE /v1/me` on the data API (Bearer access token). It marks the
account deleted first, then deletes the person's data, then their passkey records and refresh
tokens, and answers `{"dataDeleted": true, "accountDeleted": true | false}` or 500 (try again).
- `accountDeleted: false`: the data is gone and the account is shut for good, but some sign-in
  records aren't. The app relies on that: the server answers `false` only when no refresh or
  sign-in can ever work for the account again (its steps-auth PROFILE is gone; the DELETED
  marker alone isn't enough, since it expires), and 500 when it didn't get that far. The app
  stays signed in so "Delete account" can try again with the same access token, and notes the
  account id in the secure store (`steps.deletePending`). If the retry finds the session ended
  (its refresh refused, e.g. after a restart, since the access token lives only in memory), the
  app counts the deletion as done and says so, instead of asking the person to sign in again,
  which can't work any more. Any sign-in, sign-up or refresh the server allows clears the note:
  the account is open then, so the note no longer explains a refused refresh.
- With no note, a refused refresh during "Delete account" can mean either: the session ended for
  another reason, or an earlier delete went through and its reply was lost. The app can't tell, so
  it asks the person to sign in again, and says that if the passkey no longer works the account is
  already deleted and uninstalling clears the phone.
- Once the account is gone, the data API answers a token that outlives it with
  401 `{"error": "unauthorized"}` (`POST /v1/days`, `GET /v1/me`) and writes nothing. authFetch
  then refreshes once, the refresh is refused, and that phone signs out.
- After a deletion the app also clears its data on this phone (the "Delete all app data" reset):
  the person asked for their account and data to be gone.

The passkey itself lives in the person's Google account; the app tells them they can remove it in
Google Password Manager.

## Rules

- Options: user verification **required** (fingerprint or PIN), resident (discoverable) keys
  required, attestation `none`, algorithms ES256 and RS256, 5-minute timeout. Login uses an empty
  `allowCredentials`, so the phone offers whichever Steps passkey it has.
- A challenge is used once (deleted on verify, conditionally) and expires after 5 minutes.
- Access token: JWT ES256 signed in KMS, 1 hour, `iss steps-auth`, `aud steps-api`,
  `sub` = account id. Refresh token: 32 random bytes, stored only as a SHA-256 hash, 90 days,
  rotated on every use; presenting a used one revokes that whole chain, except as below.
- **Grace window for lost replies (server).** The server can swap the token while its reply never
  reaches the phone (a dropped mobile connection, a Lambda timeout after the swap, the app killed
  mid-request), so the phone sends the old token again. If that token was swapped less than 60 s
  ago (stepsinfra `GRACE_SECONDS`) and the token it was swapped for has never been used, the
  answer is a new token, and the unused one stops working for good (logged `"outcome":"grace"`).
  The 60 s run from the first swap, so retries can't stretch them. Any other reuse signs that
  phone out: 60 s or later (`late`), the swapped-for token already used (`next_used`), or a token
  a retry replaced (`replaced`). The checks and writes are one transaction, so of two retries at
  once only one token stays working; a refresh that loses that race twice answers 500 and wrote
  nothing.
- **Retrying inside it (app, `src/auth/session-core.ts`).** Only one refresh is ever in flight. A
  refresh request gives up after 20 s (`REFRESH_TIMEOUT_MS`): the Lambda stops at 10 s, so by
  then the reply is lost. After no answer, a 5xx or a reply it can't read, the app keeps the
  token, tells the callers at once, and tries again by itself with the same token after 15 s (`REFRESH_RETRY_PAUSE_MS`),
  longer than the Lambda can run, so two tries never overlap on the server. Callers in that pause
  wait for the retry instead of sending the token again. Retries start no later than 45 s after
  the first try (`REFRESH_RETRY_WINDOW_MS`), which leaves 15 s for a slow network to deliver them
  inside the 60 s. After that the next caller presents the same token, the only one the phone has.
  Only `invalid` (401) signs out; a 429 is left for the next call. After the app was killed, the
  next start's first refresh uses the stored token, which works if it comes within the 60 s.
- The app works out how long an access token has left from `accessExpiresAt` minus the reply's
  HTTP `Date` header, so a phone clock that is off doesn't matter. Keep the `Date` header on the
  sign-in API's replies (API Gateway sends it). An `expiresIn` field would also do.
- New accounts need `adult: true` (the "I'm 18 or older" switch), as before.
- On the phone: refresh token in the Android Keystore (expo-secure-store); the fingerprint app
  lock on opening stays as it was.
- App flow: try sign-in first; if the phone has no Steps passkey, ask the 18+ question and make one.
