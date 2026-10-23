# Desktop email verification

Signup and password recovery use Supabase email OTP. Users read their email on
any device and enter the code on the browser where they started the operation.
Both the analyzer and PDF studio use `scripts/auth-ui.js`.

Recovery has a separate, temporary session stored in the initiating tab's
sessionStorage. Verifying a recovery code does not replace an existing account's
normal session. Only a successful password update signs in the recovered account.
Passwords and verification codes are never saved in browser storage. Supabase
enforces token expiry and one-time use; the UI also provides a resend cooldown.

## Coordinated rollout

The new frontend and email templates must ship together. The old frontend expects
email links; a code-only template is incompatible with that old interface.

1. Publish the updated `pages-deploy/` frontend.
2. In the project's Supabase Authentication → Emails → Templates, replace
   **Confirm sign up** with `supabase/email-templates/confirmation.html` and
   **Reset password** with `supabase/email-templates/recovery.html`.
3. Use the corresponding bilingual subjects in `scripts/configure-auth-email.py`.
   Keep existing SMTP and email-confirmation requirements unchanged.
4. Verify signup and recovery with a test account: read the message on a phone,
   enter its code on desktop, then finish signup or set a new password there.
   Check invalid/expired codes, resend, and logging in with the new password.

Alternatively, with a Supabase management access token supplied securely via
`SUPABASE_ACCESS_TOKEN`, run `python scripts/configure-auth-email.py` for a read-only
check, then append `--apply` to update only those two templates and their subjects.
The apply command preserves a local, git-ignored backup. Never commit access tokens
or paste them into chat. The public frontend anon key is not a management token.

Legacy recovery links still open the password form on the device that opens them.
New code-only emails avoid that device switch. Other Supabase email types retain
their current behavior.

## Verification

`npm test` includes mocked provider tests for signup, recovery, expired codes,
cooldown, tab persistence, account isolation, and late responses after cancellation.
Browser checks use intercepted provider requests and synthetic accounts; they do
not send real email or prove live SMTP delivery. Complete step 4 after rollout.
