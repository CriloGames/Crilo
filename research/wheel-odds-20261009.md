# Crilo wheel odds — 2,000,000-run research benchmark (2026-10-09)

The analysis independently reproduced the segment transitions in live `game.js`, with the same 250-spin research safety cap as `rarity-system.js` (no simulated runs hit it). All randomness was deterministic seeded uniform sampling. This is a **Monte Carlo estimate**, not an exact full-run enumeration. No player data or scores were changed; badge awards remain paused pending rebuild.

## Exact original wheel

12 equal sectors: seven number sectors (1×3, 2×2, 3×1, 5×1), two Ducks, one ×2, one Upgrade, one +2 Spins. Therefore first-spin probability = 7/12 for a number, 2/12 for a Duck, and 1/12 each for other special sectors. Each Upgrade adds `4+min(upgrades,8)` number segments, values sampled from `[1,1,2,2,3,3,5,5,8,10]`. Number values are multiplied by `3^upgrades`. Duck/×2/Upgrade spin costs zero net spins; +2 Spins adds two after consuming the spin (net +1).

## Full-Daily events: hit counts, estimated odds

| Requirement | Hits / 2,000,000 | Approx. odds |
| --- | ---: | ---: |
| At least 3 Ducks | 350,000 approx. | 1 in 5.71 |
| At least 5 Ducks | 57,617 approx. | 1 in 34.7 |
| At least 7 Ducks | 7,855 approx. | 1 in 255 |
| At least 8 Ducks | 2,828 approx. | 1 in 707 |
| At least 3 ×2s | 86,861 approx. | 1 in 23.0 |
| At least 5 ×2s | 4,935 approx. | 1 in 405 |
| At least 6 ×2s | 1,084 approx. | 1 in 1,845 |
| At least 3 Upgrades | 36,946 approx. | 1 in 54.1 |
| At least 4 Upgrades | 3,208 approx. | 1 in 623 |
| At least 4 +2 Spins | 36,530 approx. | 1 in 54.8 |
| At least 5 +2 Spins | 12,080 approx. | 1 in 166 |
| Consecutive ×2s | 95,120 | 1 in 21.0 |
| Consecutive Ducks | 326,605 | 1 in 6.12 |
| Three consecutive Ducks | 55,590 | 1 in 36.0 |
| Three consecutive ×2s | 7,649 | 1 in 261 |
| Duck–non-Duck–Duck | 257,658 | 1 in 7.76 |
| 3 consecutive specials | 513,503 | 1 in 3.90 |
| 5 consecutive specials | 69,293 | 1 in 28.9 |
| All four special types | 220,362 | 1 in 9.08 |

## Final score thresholds

| Score ≥ | Hits / 2,000,000 | Approx. odds |
| --- | ---: | ---: |
| 100 | 177,036 | 1 in 11.3 |
| 250 | 32,080 | 1 in 62.3 |
| 500 | 7,224 | 1 in 277 |
| 750 | 2,616 | 1 in 765 |
| 1,000 | 1,303 | 1 in 1,535 |
| 2,000 | 197 | 1 in 10,152 |
| 5,000 | 17 | 1 in 117,647 |

Average spin count was 9.099 per Daily. Estimated thresholds for score-tail 20%, 5%, 1%, 0.4%, and 0.2%: **58, 142, 318, 480, 634** respectively (minimum score meeting that percentile). The existing `rarity-system.js` has a separate 100,000-run baseline; do not silently replace its thresholds with these research estimates.

**Badge guidance:** For ordinary under-1-in-500 one-run badges, 7 Ducks, 5 ×2s, 3 Upgrades, 5 +2 Spins, and score≥500 are plausible upper tiers. Requiring 4 Upgrades, 8 Ducks, 6 ×2s or score≥750 is rarer than 1/500. Streaks, social, and ranking badges require separate behavioral models rather than wheel-only odds. These statistics do not imply that the current badge-awarding triggers work.

Sampling uncertainty matters for low hit counts; no hits does not mean impossible. For the full 95%-interval report and complete set of simulated event probabilities, see the owner research exports in the ChatGPT conversation.
