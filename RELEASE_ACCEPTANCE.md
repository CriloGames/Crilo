# Crilo five-gate release acceptance plan

This checklist replaces open-ended micro-audits. A gate is **complete only when all required checks have recorded evidence**. No speculative changes or inflated progress percentages. All tests should use temporary data or rollback transactions.

## Gate 1 — Browser gameplay and recovery
- [x] Chromium starts the local game; wheel and drawing canvases initialize without JavaScript exceptions. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37969481467
- [x] Real-browser guest spin sequences and refresh tests pass. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37970025582 and https://github.com/CriloGames/Crilo/actions/runs/37970143144. Visual landing inspection pending.
- [x] Authenticated spin logic runs in Chromium with mocked server RPC. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37970339088.
- [x] Chromium animation landing angle matches the mocked server-selected segment at pointer (angular tolerance <0.00001 rad). Evidence: https://github.com/CriloGames/Crilo/actions/runs/37972539917.
- [x] Real Supabase RPC chain starts/reuses an authenticated session and spins until completion; stored state matches each RPC outcome (rollback-safe SQL regression, 2026-10-09).
- [x] Complete verified Daily spin-to-insert Supabase database integration passed for an ephemeral authenticated identity (2026-10-09); transaction rolled back, no test auth account retained.
- [x] Full real-page Chromium authenticated five-spin sequence and successful official save with mocked Supabase API. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37973157186.
- [ ] Authenticated server-controlled spin goes from real Supabase RPC through animation through saved official Daily.
  - 2026-10-09 blocker: both existing testable profiles already have an official Daily for the current period; rollback-safe server-to-insert test correctly rejected duplicate submission. Need isolated test identity or a fresh Daily period and actual browser session before completion.
- [x] Lost server response and authoritative-state recovery executes in Chromium with mocked RPC. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37970646915.
- [x] Real Chromium canvas PNG caching and restoration passed. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37970884450.
- [x] Failed official Daily save and successful retry tested in Chromium with mocked database insert. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37971706905.
- [ ] Refresh, disconnect/recover, failed-save retry, and drawing restoration run in browser.
- [x] Owner private-test initialization runs in Chromium without invoking the official spin RPC. Evidence: https://github.com/CriloGames/Crilo/actions/runs/37971202015.
- [x] Rollback-safe Supabase save of an owner private test run did not modify official Daily runs, user_badges, or game_scores (2026-10-09).
- [ ] Owner test runs remain private and independent of the official Daily.

## Gate 2 — Frontend deployment
- [ ] Draft PR #1 reviews/tests pass, then merge and confirm live crilo.fun loads the updated game.
- [ ] Verify production login, guest gameplay, owner mode, Daily save, leaderboard and profile integration.
- [ ] Rollback procedure recorded.

## Gate 3 — Server-verification enforcement
- [ ] With the new frontend active, reject all unverified official Dailies on the server.
- [ ] Reject spoofed score, forged results, reused session and another user's session.
- [ ] Keep owner private test runs functioning and verify one official Daily per user/day.
- [ ] Regression test successful verified official Daily submission.

## Gate 4 — Drawing authenticity
- [ ] Decode PNG bytes server-side, validate dimensions and bounded size, detect blank/nonblank from pixels.
- [ ] Test blank, populated, corrupt, malformed, and oversized drawings.
- [ ] Verify drawing-related badges use trustworthy server-derived classifications.

## Gate 5 — All 133 badges
- [ ] Confirm 133 active badge definitions and legitimate obtainability with one Daily per day.
- [ ] Exercise every applicable award condition via controlled, rollback-safe cases.
- [ ] Confirm artwork SVG and badge name/description for every badge; visually inspect gallery.
- [ ] Test gallery search, category filters, profiles and earned-badge updates.

## Stop rule
Do not mark a gate done because a unit test, source inspection, or smoke test passed. Do not merge the frontend before Gate 1, and do not require server-verification on official runs before the live frontend supports it.
