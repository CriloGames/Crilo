# NEW Crilo achievement rarity research (not deployed)

**The previous 133 badges are not reused.** Legacy badge awards remain paused. This is a new catalog *proposal*, derived from 3,000,000 seeded, independent simulated completed Daily runs based on `game.js` (initial 12 segments; Upgrade adds `4+min(upgrades,8)` number segments; Ducks, ×2 and Upgrade refund the spin; +2 Spins grants two spins). See the exported complete CSV in the project conversation for all 112 evaluated thresholds.

## Exact dynamic wheel odds

| Upgrades already won | Total sectors | Duck probability next spin (2 slices) | Each of ×2, Upgrade, +2 Spins (1 slice each) |
|---:|---:|---:|---:|
| 0 | 12 | 16.667% | 8.333% |
| 1 | 17 | 11.765% | 5.882% |
| 2 | 23 | 8.696% | 4.348% |
| 3 | 30 | 6.667% | 3.333% |
| 4 | 38 | 5.263% | 2.632% |
| 5 | 47 | 4.255% | 2.128% |
| 6 | 57 | 3.509% | 1.754% |
| 7 | 68 | 2.941% | 1.471% |

The number slices are always `total sectors - 5`. These are **conditional next-spin probabilities**, not whole-run odds.

## Rarity tiers (from current Crilo UI)

- Common >20%; Uncommon >5% to 20%; Rare >1% to 5%;
- Epic >0.1% to 1%; Legendary >0.01% to 0.1%; Mythic <=0.01%.

## Consecutive outcomes in one full Daily (chance in %)

| Streak | Duck (two slices) | ×2 | +2 Spins | Upgrade |
|---:|---:|---:|---:|---:|
| 1 | 69.45993 | 46.93483 | 43.88183 | 52.97407 |
| 2 | 16.32137 | 4.75080 | 4.67520 | 3.58590 |
| 3 | 2.76033 | 0.38387 | 0.37763 | 0.15020 |
| 4 | 0.44513 | 0.03003 | 0.03147 | 0.00503 |
| 5 | 0.07190 | 0.00233 | 0.00283 | 0.00013 |
| 6 | 0.01187 | 0.00020 | 0.00033 | zero observed |
| 7 | 0.00187 | 0.00003 | 0.00003 | zero observed |

At least one outcome in a full Daily is not the same as landing it on the first spin. Very sparse hits (especially >=5 and >=7) are uncertain: a probability estimate from one or a handful of hits should not be advertised as precise. Zero observed events are **not proven impossible**.

## Proposed distinct rarity badges (thresholds)

Each row gives the requirement number for Common, Uncommon, Rare, Epic, Legendary, Mythic. A dash means no evidenced requirement for that tier; **never invent rarity labels**.

| Event family | Common | Uncommon | Rare | Epic | Legendary | Mythic |
|---|---:|---:|---:|---:|---:|---:|
| Ducks total in one Daily | 2 | 4 | 6 | 8 | 10 | 12 |
| ×2 total in one Daily | 1 | 2 | 4 | 5 | 7 | 8 |
| +2 Spins total in one Daily | 1 | 3 | 4 | 6 | 8 | 10 |
| Upgrades total in one Daily | 1 | 2 | 3 | 4 | — | 5 |
| Ducks consecutive | — | 2 | 3 | 4 | 6 | 7 |
| ×2 consecutive | — | — | 2 | 3 | 4 | 5 |
| +2 Spins consecutive | — | — | 2 | 3 | 4 | 5 |
| Upgrades consecutive | — | — | 2 | 3 | — | 4 |

This proposes **39 distinct badges** with separately calculated frequencies (details in exported CSV). Consecutive means *uninterrupted same special outcome*, with either Duck segment counting as Duck. Duplicate "1 consecutive" badges are omitted because they would exactly reproduce "1 total" badges.

## Non-wheel achievements

First Daily, Daily streaks, friend actions, profile milestones and other player-controlled events: assign **NULL statistical rarity**. Do not infer wheel percentages for these. **No number-specific badges** in this set.

## Production safeguard

Do not change live badge definitions, migrate any old badges, or unpause badge awards based on this research alone. Requirements and a new centralized award/revoke engine must be separately implemented, simulated, validated and approved before release.
