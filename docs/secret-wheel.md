# The Green Needle — hidden wheel

A small, low-contrast wheel-shaped Easter egg floats in the unused whitespace just above **More Games** on the home page. Clicking it opens a free side-game. It is deliberately separate from the official Daily and never writes to `daily_runs`, scores, streaks, rankings, or owner Test Runs.

## Rules

- Every verified, signed-in account receives **1,000 lifetime attempts**, never replenished by refresh, clearing storage, changing names, or new Daily periods.
- Each attempt has exactly **one of 1,000 equal server-selected slots**. Slot `0` is the sole green WIN. At most one prize is awarded per account.
- A single click calls `crilo_secret_wheel_spin(p_count => 1)`. Quick ×10 requests up to ten independently resolved attempts in one atomic transaction and stops immediately if one wins.
- One spin has a **0.1%** success probability. The chance of winning at least once during all 1,000 attempts is `1 - (999/1000)^1000 ≈ 63.23%`. Winning is not guaranteed.
- The wheel’s visual rotation and the thin green WIN stripe are driven **from the server-selected slot** after the server replies. Animation never decides the outcome.

## Rewards

A winner receives the secret **The Green Needle** badge (badge key `secret_wheel_green_needle`, Mythic, category **Exploration & onboarding**) plus the **Mint Orbit** mint-green, star-accented profile halo, automatically equipped on first win. Winners can equip/unequip the halo on their profile; public visitors see the equipped halo. The 346 original badge definitions are left intact, making a 347th badge. The new exploration badge does **not** affect competitive badge leaderboards.

## Security and persistence

Production Supabase migration: `secret_green_needle_wheel_prizes`.

- `public.crilo_secret_wheel_state`: one row per player, `spins_used <= 1000`, `won`, `equipped`, time of win. RLS allows authenticated users to read their own row. Direct client insert/update/delete is revoked.
- `crilo_secret_wheel_spin(integer)`: security-definer RPC. Checks confirmed, nonanonymous identity, account ban, 1–10 requested spins. Uses row-level locking to prevent concurrent overspending or duplicate awards, then draws a server-side integer 0–999 for each attempt. Adds the event, badge, and cosmetic in the same transaction.
- `crilo_secret_wheel_status()`: the signed-in player's persistent attempts and unlock status.
- `crilo_secret_wheel_equip(boolean)`: authenticated winner-only cosmetic state change.
- `crilo_secret_wheel_public_cosmetic(uuid)`: public read-only equipped state of a profile, no private spin data.
- The existing `crilo_v3_record_event` was amended to **reject** `secret_wheel_win` from arbitrary callers. Only a real winning spin inserts that event, then the normal V3 badge award gate validates its persistent proof.

## Front-end

- `index.html`, `secret-wheel.js`, `secret-wheel.css`: discovery point, modal, 1,000-tick canvas and spinner, light/dark/mobile support.
- `profile.html`, `secret-wheel-profile.js`, `secret-wheel-profile.css`: permanent, toggleable Mint Orbit cosmetic.
- `release/346-badges/124-secret-wheel-smoke.cjs` and `.github/workflows/secret-wheel.yml`: isolated syntax/integration checks. They cannot guarantee an authenticated full browser win path without a fixture account.

To inspect data without changing player progress: query `crilo_secret_wheel_state` and the new V3 event/badge rows. Never manually grant the client event to simulate winning: that would bypass the real random roll and is intentionally blocked through the public RPC.
