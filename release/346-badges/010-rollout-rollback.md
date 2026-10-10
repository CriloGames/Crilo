# Crilo 346-badge rollout and rollback

## Baseline and backup
Private Supabase backup tables: `crilo_badge_prelaunch.release_backup_*`.
Registry `crilo_badge_prelaunch.release_backup_registry` records original row counts for public badges,
user_badges, daily_runs, profiles, friend_requests, owner_test_runs and V3 user events.
The baseline snapshot is a **point-in-time** safety copy, not a table to automatically restore over new player activity.
The backup schema has no browser-role access.

## Frontend rollout
Merge `release/346-badges-prelaunch` into `main`. GitHub Pages serves `main`.
Only these production frontend files should differ: `game.js`, `index.html`,
and `rarity-system.js`; the remaining additions are QA documents, fixtures and a CI workflow.
Do not touch CNAME, /domain or the drawing moderation implementation.

## Database enforcement
When frontend deployment is confirmed, apply
`release/346-badges/003-verified-official-run-gate.sql`.
It refuses official Daily inserts without `verified_spin_session_id` and clears user-supplied `final_rank`.
The existing `zy_crilo_verify_attached_spin_session` trigger checks the user, period,
finished session, counters and the exact ordered spin outcomes.
The enforcement migration must not be applied before server-spin enabled client code is served.

## Mandatory post-cutover smoke tests
- Log in as a normal player and ensure the official Daily begins and spins with no JS exception.
- Save five or more official spins and confirm `verified_spin_session_id IS NOT NULL`.
- Confirm the correct server-authored score, counters and awarded badge appear on profile.
- As owner, run an unlimited Test Run and verify it never reaches `daily_runs` or `user_badges`.
- Reload midway through an official run and verify the server recovers the correct spin count.
- Attempt a fabricated official insert without session proof; expect PostgreSQL SQLSTATE 23514.
- Confirm 346 visible badge definitions, lock states, rarity tints, search/filter, social badges and leaderboard.
- Check mobile sizing and drawing moderation. Preserve all existing history.

## Immediate rollback of the proof gate (emergency only)
```sql
DROP TRIGGER IF EXISTS zx_crilo_require_authoritative_official_daily
 ON public.daily_runs;
-- The trigger function may remain as a harmless unreferenced function.
```
This temporarily restores the earlier client-score forgery risk and should only be used
to restore saves if verified server spins fail. Do not delete or rewrite Daily results to roll back.
Then revert `game.js`, `index.html` and `rarity-system.js` using a new GitHub commit
reverting the release merge. Use cache-busting versions, not a force push.
Do not restore the snapshot tables over activity generated after the backup; reconcile individual
new records if needed.

## Certification limitation
Rule-level positive/negative tests cannot prove that a browser actually rendered 346 cards
or that each social and exploration UI action fired. There is one grandfathered Mythic score award
with no spin history; it remains retained and explicitly unverified. Keep production 100% certification
conditional on the real authenticated device smoke suite.
