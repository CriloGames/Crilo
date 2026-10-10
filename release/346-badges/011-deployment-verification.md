# Crilo 346-badge release — production cutover record

**Release:** October 9–10, 2026 (Pacific/UTC).
**Repository:** `CriloGames/Crilo`.
**Live branch:** `main`.
**Release PR:** [#4](https://github.com/CriloGames/Crilo/pull/4), merged as `550d58d6fd3c3bb036d3b255dd18769dce0a3e0e`.
**Supabase:** `mqozqigwkobnhijvvboy`.
**Migration:** `crilo_verified_official_daily_release_20261009` (applied successfully).

## What is live

1. The production branch includes the authoritative server-spin client path, cache busting and verified spin-session ID on new official Daily submissions.
2. A production `BEFORE INSERT` trigger, `zx_crilo_require_authoritative_official_daily`, is enabled on `public.daily_runs`. A first official Daily missing server proof is rejected with SQLSTATE `23514`. The trigger also discards client-provided final ranks.
3. The existing `zy_crilo_verify_attached_spin_session` trigger authenticates spin session ownership, Daily period, completion, counters, and the ordered outcome history. The server chooses all outcomes with cryptographic randomness.
4. Owner Test Runs still use `crilo_save_owner_test_run`, which writes private `owner_test_runs`. Their results do not award public badges or affect official rankings.
5. The separate `/domain` game and `CNAME` are unmodified.
6. A recovery correction avoids consuming a second spin when the backend already processed a response that was lost in transit. A follow-up patch restores earlier number labels from each authoritative per-spin points field.
7. Automated client/catalog CI is committed in `.github/workflows/346-badge-checks.yml`. The prelaunch PR workflow completed successfully; the main branch workflow is configured to run on further production changes.

## Tests actually completed

- Full rule coverage: 215 run achievements have a legal positive and legal nonqualifying wheel-history fixture; 131 stateful/account rules passed isolated database empty-state and positive-state fixtures.
- Independent random runs: 43,000 pairwise evaluator decisions agreed; an earlier set recorded 215,000 agreement checks. Four compatible historical runs have 860 matching decisions.
- One old 11-segment run was validated with a version-specific replay and preserved. One score-only run with no history remains unverified; no award or score was revoked.
- Actual SQL transaction tested server-spin RPC to completed Daily save, run-trigger validation and badge creation. All test rows were rolled back.
- After production proof migration, an attempted fully specified browser-only official run without a session was rejected; a proper server-generated official run was accepted, and a malicious client-supplied final rank was stripped. An owner private Test Run was accepted. All test writes rolled back.
- JavaScript mock client tests passed ordinary five-number runs, Duck + ×2 + Upgrade + +2 sequence, final score/counters/verified session ID, and safe resynchronization after a lost response.
- GitHub Actions release job passed production JS syntax, official-spin client tests, catalog uniqueness, and positive/negative fixture integrity.

## Safety backup

`crilo_badge_prelaunch.release_backup_registry` and private
`crilo_badge_prelaunch.release_backup_*` tables contain a point-in-time snapshot of:
346 badge definitions, 189 awarded records, 8 saved Daily runs (6 official), 3 profiles,
1 friendship, 6 owner Test Runs, plus V3 user events and the function definitions.
These are rollback evidence and should **not** automatically overwrite post-release player actions.

## Status and unresolved guarantees

**Code and database security cutover: COMPLETE.** The production proof trigger is enabled and transaction-smoke-tested.

**Real authenticated graphical browser / CDN smoke: NOT VERIFIED from this environment.**
The publicly hosted site was not reachable through the available HTTP/browser tooling,
and no owner's authenticated browser session was available. Mobile and iPad layout,
visual 346-card gallery, actual audible notifications, and a real user's Daily must still
be checked in a signed-in graphical browser before advertising "100% production certified".

Behavioral exploration events are authenticated but their client click provenance is not
cryptographically provable. The separately scored Domain game should not be described
as server-randomness-verified. One grandfathered score-only Mythic achievement with no
saved spin history remains intentionally retained but not historically verified.

**Emergency rollback:** `010-rollout-rollback.md`; remove only the new `zx_`
proof trigger if an immediate save outage occurs, then revert the frontend through a new
GitHub commit. Do not delete data or blindly restore historical tables.
