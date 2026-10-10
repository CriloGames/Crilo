# Inappropriate drawing: one public warning and Daily removal

**Implemented October 10, 2026.**

## Owner's decision
Drawing Review requires selecting a policy category (profanity, sexual/genital drawing, hate/extremist symbol, website link, QR code, harassment, other) before **Delete + issue warning** will proceed. The owner must confirm twice. The All-Time/Today leaderboard owner Remove action also requires an explicit category for official Daily removal. Owner Test Run deletion remains separate and does not flag anyone.

## Database transaction
The owner-only `crilo_owner_penalize_daily(run_id, reason)` validates the pending or previously approved official run and applies the following **in one atomic database transaction**:

1. Records the original player's user ID and **original Daily period** in `crilo_daily_penalties`. The unique composite key (user, period) prevents replacing that run, even if it was deleted long after it was played.
2. Creates an account warning in `crilo_account_warnings` (unique user ID: **one public warning**, not an escalating stack of flags). Repeated violations update the internal count and restart the current streak but do not automatically ban.
3. Creates a private, unread `crilo_moderation_notices` record for the player, with the selected reason, original period and removed score.
4. Deletes badge awards specifically linked to the removed run, deletes the official run, and lets existing official-run deletion triggers recalculate all statistics, score totals and badge eligibility. Removes featured badges if they are no longer earned.
5. Explicitly resets cached `player_stats.current_streak` using the warning timestamp. The public profile-metrics API uses that same cutoff, so a past-date violation also resets the **current** streak immediately; a new legitimate Daily after the warning starts a fresh chain.
6. Since the removed Daily row is gone, total lifetime points, score leaderboards, duck totals, spins, and other run-based totals no longer include it.

## Replay and next Daily
The database INSERT guard rejects official runs for a penalized original period. Both `crilo_begin_server_spin_session` and `crilo_server_spin` also reject this specific period, including previously created sessions. Other Daily periods work normally. The Home screen explains the locked period instead of offering another official run.

## Player visibility
The public Statistics profile shows one red `⚑ ACCOUNT FLAGGED` indicator, with a hover/focus/tap explanation of the moderator-selected **predefined reason** and the meaning of the only warning. No private image, personal information, or free-form moderator notes are published.

Only the affected account can retrieve or mark its moderation notifications read through owner-scoped RPCs. The existing notification bell shows the reason, loss of points and streak, original period lock, and warning. Notifications can be acknowledged but stay in the recent history.

This first-warning process does **not** automatically ban anyone. Owners retain their independent account ban powers. Banning an account outright is a separate, stronger moderation decision.

## Verification
- The owner-only functions reject other players and anonymous visitors; anonymous users can read only the **public flag category**, not private notices or violation records.
- `036-owner-warning-penalty-smoke.cjs` checks the database definition, Home lock vs next clean Daily, public profile, private notifications, and owner-only removal paths using synthetic mocks. Other tests cover badge rendering, leaderboard, mobile responsiveness, 1,000-drawing pagination and moderation Test Run isolation.
- A database audit safely used nonexistent run ID `-999999999` to confirm that neither warnings nor player-run records are changed by an unsuccessful or unauthorized request.
- **No live player removal was executed for QA.** An authenticated owner should test the destructive flow deliberately only when they are comfortable issuing a real warning. The browser UI and GitHub Pages deployment still need physical cross-device confirmation where tooling cannot prove it.
