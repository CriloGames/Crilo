# Balanced V2 wheel achievements — 2026-10-09

**Active:** 22 wheel badges plus 7 score-rarity badges. The old 133 badges are retired. This revision replaces the original 39 proposed wheel requirements; 17 excessively difficult regular-wheel badges were retired. No prior awards were present at migration.

The user requested roughly one Mythic wheel-badge event every three months. We selected THREE streak requirements as Mythic, using the measured 3,000,000-run per-event estimates:

- 4 Ducks consecutively — 0.44513% per Daily
- 3 ×2 consecutively — 0.38387%
- 3 +2 Spins consecutively — 0.37763%

**Joint probability**, separately simulated using 2,000,000 completed runs and the actual dynamic-wheel rules: **1.21065%**, or **1 in 82.6 Daily runs** on average. A joint probability must be measured rather than adding individual rates due to overlap. Upgrades add 4+min(upgrades,8) number slices and lower special landing probabilities.

Remaining requirements:

| Wheel | Total-count thresholds | Consecutive thresholds |
|---|---|---|
| Duck | 2, 3, 4, 5 | 2, 3, 4 (Mythic) |
| ×2 | 1, 2, 3 | 2, 3 (Mythic) |
| +2 Spins | 1, 2, 3, 4 | 2, 3 (Mythic) |
| Upgrade | 1, 2, 3 | 2 |

Assigned rarity tiers from the per-run measured probabilities. No common badge depends on an outcome rarer than 30%; Mythics are the three streaks listed above. We do **not** label excessively rare requirements Mythic while leaving them in normal progression: those requirements were removed from the active catalog.

**Verification:** Server evaluator passed 22/22 positive threshold tests and 22/22 negative tests. An isolated transaction (rolled back) checked badge awarding and run-deletion/reassignment against each of the 22 requirements with unrelated game-validation triggers disabled. Browser-to-database verification remains outstanding. Server scoring badges remain unchanged (7 tiers). The separate first-Daily and social nonstatistical achievements remain future work.
