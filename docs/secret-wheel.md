# The Green Needle — hidden wheel (October 2026)

## Experience

The single interactive Easter-egg wheel is hidden among many small, low-contrast wheel decorations across Crilo. The decoys are irregularly spaced and sized, are not interactive, and cannot award anything. The sole working hidden wheel is on Play. All are deliberately subtle, including in dark mode and on phones.

Opening the Green Needle shows a one-in-one-thousand wheel with a **single SPIN button**. The game is free, has **unlimited lifetime spins**, never shows a Quick ×10 option, and always resolves exactly one spin per click. There is no reset period or attempt cap **before the first win**. Each spin has an independent **0.1%** winning chance; after a win, the server permanently disables further spins.

The server returns the result for every spin. JavaScript only animates the wheel to that result. The first winning spin triggers an accessible prize notification and a confetti animation (honoring reduced-motion settings).

## Prize

The original **The Green Needle** Mythic secret badge remains the badge prize. Its key is \`secret_wheel_green_needle\`.

The cosmetic is now **individually chosen username letter colors**. The old Mint Orbit profile halo is no longer loaded. The new color editor is hidden in Settings within the "Display name & color" card until the database has confirmed that the account won. A winner can choose a color for each character, preview the design and save via an entitlement-checked RPC. The account header, public profile, friends and leaderboards render the earned colors, escaped and validated against the saved username. If a username is changed, the color editor can update its selection for the new characters; an invalid-length saved array falls back to the player's normal single color.

## Database

Supabase migration \`secret_wheel_unlimited_single_spin_letter_color_reward\`:
- The former 1,000-spin check was removed, \`spins_used\` is now a nonnegative \`bigint\`, and previously recorded attempts are preserved.
- \`crilo_secret_wheel_spin(p_count integer default 1)\` **rejects every requested count other than one**. It authenticates a verified account, checks bans, serializes spins for a player with a row lock, and chooses one of 1,000 outcomes server-side. Only the **first** green outcome inserts the existing server-verifiable \`secret_wheel_win\` event and grants the secret badge. Subsequent spins cannot duplicate the award.
- \`crilo_secret_wheel_status()\` returns \`signed_in\`, \`spins_used\`, and \`won\`; it never reports a cap or time-to-reset.
- \`profiles.name_letter_colors\` stores the chosen per-character hex colors (or null when unused).
- \`crilo_secret_wheel_set_name_colors(jsonb)\` is a verified-account, server-checked winner-only function. The input must be a JSON array of valid \`#RRGGBB\` colors with exactly one entry per current username character. The RPC locks the profile while checking and saving. Normal browser sessions cannot directly update the profile column or wheel-state table.

No secret spin writes to Daily runs, leaderboard points, owner Test Runs, or Daily streaks. The secret badge remains in the exploration category, not competitive badge rankings.

## Source and regression tests

- \`secret-wheel.js\`, \`secret-wheel.css\`: server-based single-spin UI, win notification, confetti, win details.
- \`secret-wheel-ambient.js\`, \`secret-wheel-ambient.css\`: visible-only decoys and the single hidden clickable entry, scattered on Crilo pages.
- \`app.js\`: loads ambient wheels and includes an escaped, validated per-letter name renderer.
- \`settings.html\`, \`settings.js\`, \`secret-name-colors.css\`: winner-only per-letter editor.
- \`profile.js\`, \`leaderboard.js\`, \`friends.js\`: public name colors; no old halo.
- \`release/346-badges/124-secret-wheel-smoke.cjs\`: static integration regression.
- \`release/346-badges/125-secret-wheel-browser.cjs\`: unauthenticated Chromium checks of decoys, accessibility, layout and locked settings over multiple viewport widths.
- \`.github/workflows/secret-wheel.yml\`: CI execution.

The isolated browser QA checks **do not demonstrate a genuine signed-in winning spin**; that requires a verified test account and a real server-generated result. The client cannot force a win.

## October 2026 winner leaderboard and audio

The **Green Needle dialog only** reveals an expandable winner leaderboard *directly below the spin button* once the current account's award is verified. Its two tabs, **Least Spins** and **Most Spins**, sort winners by the number of individual spins required to hit green. Each returns at most **250** server-ranked winners. Rankings are not embedded in the public Crilo leaderboards or other pages. The spin button becomes permanently disabled and reads **✓ YOU WON**.

Supabase migration `green_needle_winner_locked_top_250_leaderboards` adds `winning_spin_count` (persistent integer count on the exact winning attempt), changes the server spin RPC to reject further attempts once `won=true` and implements `crilo_secret_wheel_leaderboard(p_order)`, callable only by authenticated winners. The leaderboard output includes the player's chosen display colors when available. Sorting ties by win timestamp and account ID is deterministic. Previously recorded winners (if any) have a best-effort backfill from their recorded total; post-win spins made before this change cannot be reconstructed exactly.

Minimal Web Audio cues: a soft start tone, a quiet landing tone and a short two-note win sound. There is **no repetitive ticking**. The game respects site-level mute and `sound_enabled` settings. The badge and per-letter name-color prize remain unchanged.
