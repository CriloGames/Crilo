# Crilo — 346-Badge Production Certification Report

**Assessment date:** October 9–10, 2026 (Pacific / UTC)
**Repository:** `CriloGames/Crilo`
**Candidate branch:** `release/346-badges-prelaunch`
**Supabase project:** `mqozqigwkobnhijvvboy`
**Decision:** **CONDITIONAL NO-GO for an unconditional 100% production certificate.** Requirement-level rule testing is complete; authenticated website E2E and coordinated security enforcement are not.

## 1. Direct observations of the existing live environment

- `public.badges`: **346** rows (already in the production database before this work).
- `public.crilo_v3_badge_stage`: **346** rows, all status `deployed_pending_browser_smoke`.
- Isolated `crilo_badge_prelaunch.definitions`: **346** rows; badge keys and names are distinct.
- `public.user_badges`: **189** current awards.
- `public.daily_runs`: **8** rows, of which **6** are official Dailies.
- `public.profiles`: **3** profiles at assessment.
- `public.owner_test_runs`: **6** private Test Runs.
- V3 run insert/delete, friend, and exploration triggers were already **enabled**. The older transfer document asserting they were disabled is out of date.
- A `pg_cron` job named `crilo-v3-finalize-daily` was active at **22:02 UTC**.
- `CNAME`, `/domain`, and moderation code were not edited by the changes documented below.
- All six official runs predate authenticated server-spin proof; **none** has `verified_spin_session_id`.

## 2. Rule-level certification: 346 / 346 positive and negative

### Run-level wheel, score, number, and sequence achievements — 215 / 215

Created `006-run-rule-fixtures.json` with a **legal completed positive wheel sequence and a legal completed negative wheel sequence for each rule**. Generated 213 positive witnesses from 100,000 deterministic wheel simulations and constructed two special legal positive witnesses for exact intermediate scores **777** and **888**. All 215 positive and all 215 negative fixture evaluations passed in the **actual isolated PostgreSQL replay/evaluator**.

Additional independent SQL random-run comparison in `qa-randomized-comparison.sql` passed: 200 randomized runs times 215 rules, **43,000** strict-versus-existing V3 decisions with zero mismatches; the pre-existing project QA record documents a separate earlier 1,000-run/215,000-decision check. A historical comparison across four current-format official runs covered another **860** matching rule decisions, with zero disagreements.

A fabricated claimed score, impossible pre-upgrade number, extra event after completion, and 11-sector result were all blocked by the strict evaluator in focused negative tests.

### Account-level achievements — 131 / 131

Created private QA tables and a staged copy of the V3 account evaluator in `005-stateful-account-qa.sql`; executed **131 positive** and **131 empty-state negative** PostgreSQL checks using synthetic, isolated test data. These cover exploration, lifetime runs, lifetime spins, lifetime outcomes, lifetime bases, Daily streaks, drawings, final leaderboard ranks, and all ten social achievements. The QA fixtures do **not** write synthetic friendship endpoints or player records into production.

### Rarity distribution and feasibility

Full catalog: **Trash 1, Common 82, Uncommon 60, Rare 49, Epic 59, Anomaly 36, Mythic 59**.

In the baseline 100,000 simulated official runs, **213 / 215** stochastic rules were observed. The remaining two, exact score **777** and exact score **888**, both have mathematically valid constructive wheel histories independently accepted by PostgreSQL. Thirteen run-level rules were observed fewer than 200 times or not observed in 100,000 runs; **all thirteen are Mythic**, rather than misleadingly labeled a common/ordinary tier. Frequencies at this resolution are rough estimates, *not* proof of exact ultra-rare probabilities.

The prelaunch `rarity-system.js` now correctly describes the **100,000** runs used by the game's embedded reference distribution; the previous label incorrectly stated 2,000,000. The score threshold for Mythic (301+) yielded about **1 in 85** in that reference simulation, close to the requested 1 in 90.

## 3. Existing player data preservation and historical compatibility

Of six official runs, **four** pass current 12-sector strict replay. One historical record has an empty spin array and one uses an older **11-sector** wheel. These two remain untouched and excluded from new current-wheel automatic backfills. An older compatible replay implementation or deliberate grandfather policy is required to certify historical wheel-derived awards from them.

Across all three existing profiles × 346 badges = **1,038** eligibility combinations, the present records included **189** awards. Of those, **166** were supported by current replay/account rule data; **23** were dependent on legacy data that cannot be independently certified under today's rules. No currently supported award was missing, and no other unqualified award was found by this audit. The **23 legacy-dependent awards were retained**, not revoked.

All rollback-scoped live gate tests passed: forged no-run score and exploration claims were rejected, a legitimate run-linked award was accepted, duplicate awarding was suppressed, an owner Test Run did not add public badges, deleting one of several qualifying runs reassigned an award, and deleting the sole qualifying run revoked it. Tests were rolled back before transaction commit.

## 4. Security findings and mitigations

**Confirmed live weakness before this patch:** `game.js` chose official wheel outcomes in the browser. The existing insert replay validator checked arithmetic, but `zy_crilo_verify_attached_spin_session` permitted `verified_spin_session_id=NULL`. Thus score provenance was not reliably server-authoritative. New official spins must use the existing RPC functions `crilo_begin_server_spin_session`, `crilo_get_server_spin_state`, and `crilo_server_spin`, with their already-established session binding and cryptographic server RNG.

**Prepared but deliberately NOT deployed:**

- Release-branch `game.js` now uses those RPCs for authenticated official Dailies, with server state recovery and authoritative spin choice. Owner private Test Runs and guest demo runs retain their original behavior. JavaScript parsed successfully; database-backed server-spin RPC test succeeded and was rolled back.
- `003-verified-official-run-gate.sql` adds a protected official-run insert requirement for a non-null verified spin session and overwrites any client-submitted final rank with NULL. Existing `zy_crilo_verify_attached_spin_session` performs the actual matching of the submitted spin history to that server session.
- `007-official-proof-gate-qa.sql` successfully tested the gate logic on an *isolated QA table*, including rejection of missing proof, rank sanitization, and Test Run exemption.
- Only a **coordinated** frontend/backend rollout is safe. Applying the gate while older live browsers still submit client-only spin histories will prevent legitimate players from saving their Dailies.

**Additional residual risks:** Exploration page-view/click events are sent by an authenticated client through a whitelisted RPC; an authenticated adversary could potentially call those event names directly without genuinely clicking the referenced UI. They are low-stakes exploration achievements but should not be advertised as cryptographically verified. Domain results remain a separate user-submitted score flow, not proof of an actual five-round session without additional instrumentation. Real browser flow and end-user notification tests have not been executed.

## 5. Frontend/UI checks

All 30 exploration event keys were located in frontend code (including `settings.js` and `domain/game.js`). Rarity badge colors and the icon-free rounded style match the current game Info legend's exact seven hex values in source. `profile.js` loads `badges` and `user_badges` without an observed 68-badge cap. However, **source inspection does not verify actual rendering**: mobile clipping, 346-card gallery loading in an authenticated session, theme variants, featured badges, unlocked notifications, sound, and reset UX still need browser tests.

The website and `badge-art-audit.html` were not accessible through the available HTTP browsing tools during this assessment. No authenticated graphical browser session was available.

## 6. Candidate branch deliverables

- `game.js`: new server-spin path for official games (based on latest `main`).
- `index.html`: script cache revision bumps, based on latest `main`.
- `rarity-system.js`: fix inaccurate reference simulation label, based on latest `main`.
- `catalog-rules.json`: reconciled the final six purely textual discrepancies against V3, including ordinal formatting and one-run wording.
- `003-verified-official-run-gate.sql`: **not deployed**, must be coordinated with frontend.
- `004-certification-sql-tests.sql`: staged catalog, replay and historical checks.
- `005-stateful-account-qa.sql`: 131 account-rule positive/negative checks.
- `006-run-rule-fixtures.json`: 215 positive and negative legal spin sequences.
- `007-official-proof-gate-qa.sql`: isolated tested security gate.
- Existing `002-run-evaluator.sql` already had the corrected function terminators and sector count code.
- Supabase isolated schema received **only the six catalog wording changes** and isolated QA tables/function. No live player score or awarded badge was edited persistently.

The release branch has diverged from `main`; reconcile carefully instead of overwriting more recent production changes.

## 7. Exact remaining release gates

1. **Authenticated browser QA:** Owner first login and Daily/Test selection; a normal player's first Daily; multiple spins including Duck, Double, Upgrade and +2; refresh/recovery during a run; completing a Daily; saved server session ID; Test Run isolation; reset; mobile/iPad; error handling.
2. **Badges end to end:** Verified server-run achievement insert, gallery display of all 346, actual correct locked/unlocked colors, notification queue, featured badges, exploration events, friend actions, rank settlement, and account deletion/reassignment.
3. **Security smoke:** Browser submits official run with valid attached session; direct no-session forged run is rejected *after* gate activation; valid old-tab handling, server RNG, duplicate save, cross-user session denial, invalid final-rank payload.
4. **Historical policy:** Explicitly grandfather the 23 legacy-dependent current awards or verify their older gameplay rules; do not silently backfill incompatible/empty spin histories.
5. **Coordinated rollout:** Snapshot DB schema/awards/functions; deploy tested frontend on `main`; smoke-test a real signed-in run; apply `003` in a controlled deployment; smoke-test again; monitor errors; document rollback procedure.
6. **External app verification:** Inspect `https://crilo.fun` with an actual authenticated browser and verify DNS, GitHub Pages and full gallery. That was not achievable here.

**Certification result:** **346/346 run/account badge predicates have successful positive and negative database fixture tests**. Randomly generated and legacy-compatible replays align with the existing evaluator on tested inputs. **Full production E2E and anti-forgery certification remain incomplete; do not advertise an unconditional 100% guarantee or mark the pending release fully certified yet.**
