# Crilo authentication email templates

These HTML templates are ready for the **hosted Supabase Auth email template editor**. They do **not** become active by deploying GitHub Pages alone. Supabase sends the email; the site cannot override its body by changing `index.html`.

## Install in the Crilo Supabase project

Project: `mqozqigwkobnhijvvboy`

1. Open [Supabase → Authentication → Email Templates](https://supabase.com/dashboard/project/mqozqigwkobnhijvvboy/auth/templates).
2. Select **Magic Link / Magic link or OTP**.
3. Set the subject to **Your Crilo sign-in link**.
4. Replace the HTML body with the complete contents of [magic-link.html](./magic-link.html). Click **Save**.
5. **Optional:** Only if you use a separate **Confirm signup** email, select that template. Set its subject to **Welcome to Crilo — confirm your email**, replace the HTML body with [confirm-signup.html](./confirm-signup.html), then click **Save**. You do **not** need to paste both HTML files into the same Supabase template.
6. Send a real sign-in link from [crilo.fun](https://crilo.fun) to a testing email address. Check Gmail and iPhone Mail if available, then click the CTA to verify it returns you to Crilo signed in.

Both emails use the supported **`{{ .ConfirmationURL }}`** variable. Leave it unchanged; do not replace it with `https://crilo.fun` or another generic URL because the unique one-time verification token is required.

The main CTA is a full-width yellow button inside the message card, approximately 70 px tall on modern mail apps, with a prominent black border and dark text. A smaller plain-link alternative is provided. The layout uses inline, table-based styling for Gmail, Apple Mail and Outlook; no external fonts, images, scripts, or tracking pixels are required.

**Safety:** Never use a real sign-in URL for a public template preview. The sign-in link is a secret. If sending through Resend SMTP, disable open/click link rewriting or tracking so the verification link is not modified.

## Scope

- `magic-link.html`: regular passwordless sign-in (the primary flow for Crilo).
- `confirm-signup.html`: matches the design for first-time accounts that receive a confirmation email.
- This only changes email presentation. It does not change Supabase Auth sessions, redirect URLs, account creation, or daily-run logic.

## Current rollout status

Templates committed to the site repository, **not yet installed into the hosted Supabase email editor**. The connected tools can edit database/edge functions but do not expose the project's hosted Auth email template settings or management API credentials. Activation requires a dashboard save by the project owner or authorized Auth Management API tooling. Do not claim the sent email has changed until a real email has been tested.
