# Crilo production privileged-RPC review — October 13, 2026

Project: `mqozqigwkobnhijvvboy`. Production website: `crilo.fun`.

## Scope and interpretation

Supabase Security Advisor initially reported 13 `anon`-executable and 87
`authenticated`-executable `SECURITY DEFINER` RPC functions (88 distinct).
This is **not** 100 discovered exploits: many must deliberately be accessible
to guests or signed-in users for the site to work. No public schema CREATE
permission was found for either `anon` or `authenticated`. The public
`profiles.is_owner` column has SELECT, but **not INSERT or UPDATE**, for
those roles. Owner-only RPCs inspected check `auth.uid()` against
`profiles.is_owner`; write/deletion moderation operations use
`crilo_require_owner_mfa()` with verified TOTP and `aal2`.

## Production changes

`sql/security-definer-execution-hardening-20261013.sql` removes unnecessary
API-level EXECUTE from two internal SECURITY DEFINER helpers:

- `crilo_require_owner_mfa()` — only used from other privileged owner
  functions; a direct player RPC has no valid use.
- `crilo_warning_current_streak(uuid)` — used by a privileged stats wrapper,
  moderation operation, and privileged cache-update trigger; direct player RPC
  exposure is unnecessary.

Both remain callable internally by their privileged owner (`postgres`) and
by `service_role`; the guest Daily and public metrics RPCs are unchanged.

The same change pins `search_path` to the empty path for five audited
privileged functions whose application table references are already
schema-qualified. No game odds, badge rules, datasets or rows were changed.

## Intentionally callable privileged APIs — review context

Anonymous API surface remains 13 RPCs: three bearer-token guest-game
operations; public leaderboard/stats/cosmetic/count functions; an intentionally
empty legacy owner-run result; and a strictly allowlisted public telemetry
increment. Bearer guest tokens are randomized, hashed at rest and validated
server-side; telemetry increments are bounded but can be inflated by abusive
traffic. Warning details are intentionally displayed on public player
profiles and therefore must be reviewed as a *product privacy choice* before
changing `crilo_public_warning_status(uuid)`.

Authenticated API surface includes the official server-authoritative wheel
session/spin operations, friend actions, profile settings, owner controls,
badge read/write actions and Domain verified scores. Checks should not be
removed merely to satisfy the advisor lint: many require `SECURITY DEFINER`
to mediate RLS-protected writes. Untrusted callers cannot simply be granted
access to the underlying data. Owner tools and moderation require additional
role checks; sensitive owner operations check MFA.

## Residual launch considerations

- `SECURITY DEFINER` warnings for deliberately exposed functions remain;
  they still warrant targeted negative-authorization/abuse tests. In
  particular, test guest-run creation rate limiting against abusive traffic.
- 22 `RLS enabled, no policy` notices refer to tables intentionally blocked
  from client access; **do not add permissive policies** as a way to clear them.
- The leaked-password-protection warning is largely inapplicable because
  Crilo uses magic-link-only sign-in, but confirm password sign-in stays off.
- Check owner MFA enrollment, post-ban access revocation, guest token abuse,
  database backup/restore and outbound email redirects in production.
- This is a targeted hardening audit, **not** an assertion that all
  functions are immune to every exploit or that launch is risk-free.

## Read-only verification SQL

```sql
SELECT p.oid::regprocedure AS function_name,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
       p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('crilo_require_owner_mfa','crilo_warning_current_streak',
  'crilo_profile_metrics','crilo_public_owner_runs','crilo_owner_test_runs',
  'crilo_save_owner_test_run','crilo_delete_owner_test_runs')
ORDER BY p.proname;
```
