# Crilo V3: 346-badge production release audit

Date: 2026-10-09
Repository: CriloGames/Crilo
Database: Supabase project mqozqigwkobnhijvvboy
Release status: **LIVE IN DATABASE; browser smoke and GitHub Pages deployment verification still unconfirmed**.

## What was deployed

- All **346** approved achievement definitions in `public.badges` (68 original + 278 proposals).
- 23 normalized server-evaluated rule classes: exact accumulated score, score bands, wheel totals/streaks, wheel sequences, wheel placement, single-run challenges, lifetime results/spins/days, consecutive Dailies, official drawings, rankings, friends, exploration/UI events.
- `public.crilo_v3_badge_stage`: versioned normalized catalog and verifier predicates.
- New official-run INSERT and DELETE award/reconciliation hooks, friend relationship hook, authenticated exploration-event hook.
- Old V2 wheel award/deletion triggers disabled, not dropped. Game validation, player stats, moderation, Test Run exclusion unchanged.
- Frozen rank settlement at Crilo's fixed **22:00 UTC** reset. GitHub Actions scheduled 23:15 UTC with extra fallback attempt upon visiting the leaderboard; cron execution remains unverified.
- Client instrumentation on Home, Leaderboard, Ducks, Profile/Badges, Settings and Domain. Icon-free whole-tile rarity colors exactly match the Score Rarity Info menu.

## Positive and negative tests actually executed

- **215/215** new V3 single-run badge predicates accepted their synthesized qualifying SQL fixtures (not all fixtures are complete browser-run replays); **215/215** failed deliberately nonqualifying SQL fixtures.
- **131/131** account-based badge predicates rejected an invalid/nonexistent account UUID.
- Transactional account fixture: **123/131** account-based positive predicates passed. The other **8 were not fully tested**: two lifetime number counts omitted `numbers_landed` in a mock historical fixture, and six social thresholds require many real profiles/friends not provisioned in this environment. These eight are NOT certified by positive production fixture.
- Existing 68 badges: 68/68 positive and 68/68 negative function boundary tests.
- Two database INSERT/DELETE Test Run security release rehearsals with the entire 346-badge catalog installed temporarily and all changes rolled back. Verified official run award, Test Run suppression, forged Test Run rejection, exploration event award after authenticated event, deleted-run provenance removal.
- Post-release **189/189** award rows audited as backed by legitimate official-run provenance or account requirements. No unsupported awards detected.
- Live `crilo_v3_finalize_periods()` settled six historical official runs successfully. Current eligible badges were recomputed.
- JavaScript syntax checks passed for `badge-events.js`, `game.js`, `settings.js`, `profile.js`, `domain/game.js`.
- Canonical catalog: **346/346** unique badge keys and **346/346** unique badge names; no unrecognized rule kinds.

## Safeguards

- Owner Test Runs do not qualify for official-run badges.
- Server checks stored roll results; player-supplied badge IDs do not bypass the badge award gate.
- Deleted runs trigger removal or reassignment of run-backed awards; account totals re-evaluated.
- Authenticated browser exploration events are whitelisted and idempotent, although a signed-in user with browser developer tools can still call basic exploration-event RPCs manually. Treat simple "visit page" badges as low-stakes achievements rather than anti-cheat certified.
- Backup schema: `crilo_v3_prelaunch_backup_20261009` (68 original definitions, award/featured snapshots, trigger and function definitions).
- No pre-existing scores, Dailies, drawings, or accounts deliberately deleted during deployment.

## Outstanding launch verification — NOT 100% production-certified

1. A **real logged-in browser** must complete an official Daily spin and inspect the on-site badge popup and Profile/Badges immediately afterwards.
2. Owner **Test Run** via browser must show zero new official achievements and no leaderboard entry.
3. Verify a real newly-completed Daily/expired period leaderboard ranking after reset. The scheduled GitHub Action and fallback have been committed but a successful scheduler execution was not observed.
4. Open Profile, Badges, Settings, Ducks, Leaderboard and Domain on desktop and mobile to verify colors, scrolling, layout and authenticated event recording. Client site `crilo.fun` was inaccessible from this tool environment.
5. Complete positive SQL/browser fixtures for two lifetime number-count badges and six high-threshold social achievements.
6. Note that extremely rare wheel events, ranking awards, and social milestones cannot be assigned exact mathematical probabilities without a closed-form derivation or sufficiently large simulation/population.

**Do not label these outstanding steps completed without evidence.** The catalog is already active in Supabase and source is committed to main; no further database insertion is needed.
