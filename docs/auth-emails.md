# Sign-in emails (Supabase project `steps`)

The app confirms a new account and resets a forgotten password with a code the person types in,
not a link. Supabase's default emails contain a link, so two templates must be changed in the
dashboard: **Authentication → Emails → Templates**.

## Project settings

**Authentication → Sign In / Providers → Email**

| Setting | Value |
| --- | --- |
| Enable Email provider | On |
| Confirm email | On |
| Minimum password length | 8 (matches `MIN_PASSWORD` in `src/auth/rules.ts`) |
| Email OTP Expiration | 900 seconds (15 minutes) |

Anonymous sign-ins stay off.

## Confirm signup

Subject: `Confirm your Steps account`

```html
<h2>Confirm your email</h2>
<p>Enter this code in the Steps app:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>It works once and expires in 15 minutes.</p>
<p>If you didn't create a Steps account, you can ignore this email.</p>
```

## Reset password

Subject: `Your Steps password reset code`

```html
<h2>Reset your password</h2>
<p>Enter this code in the Steps app to choose a new password:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>It works once and expires in 15 minutes.</p>
<p>If you didn't ask for this, ignore this email. Your password stays the same.</p>
```

## Who sends the emails

Supabase's built-in sender is for testing only: a few emails an hour, and only to addresses of
members of the Supabase organisation. Before other people can sign up, set a custom SMTP sender
under **Authentication → Emails → SMTP Settings** (for example a Hostinger mailbox on our domain:
host `smtp.hostinger.com`, port `465`), or Amazon SES later for volume.
