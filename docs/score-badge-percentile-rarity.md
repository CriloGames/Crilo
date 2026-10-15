# Crilo 24-sector wheel and rarity (October 14, 2026)

All 12 original outcomes are duplicated for 24 starting sectors: six 20s, four 40s, two 60s, two 80s, four Ducks, two ×2, two Upgrades and two +2 Spins. This preserves event odds exactly. Upgrades triple the number multiplier, refund the spin and add 2 identical sectors per random sample for each 4 + min(upgrades,8) additional number outcomes, drawn from [20,20,40,40,60,60,80,80,120,160].

Six million deterministic independent simulated Dailies (seed 0x22101026) estimated the score percentiles:

| Rarity | Inclusive score interval | Simulated share |
|:--|--:|--:|
| Trash | 0–120 | 1.24030% |
| Common | 121–440 | 48.96935% |
| Uncommon | 441–860 | 25.22275% |
| Rare | 861–1,620 | 14.64972% |
| Epic | 1,621–2,460 | 4.99390% |
| Anomaly | 2,461–5,440 | 3.92732% |
| Mythic | 5,441–14,420 | 0.89677% |
| Divine | 14,421+ | 0.09990% |

Reachable scores normally increase by 20, so new reachable thresholds are 140, 460, 880, 1640, 2480, 5460, and 14440. Displayed odds are Monte Carlo estimates, not guaranteed prizes. Badge drop rarity remains a separate scale. Previously awarded badges are retained and legacy scores are recalculated from spin histories; old score-only rows without spin history are recorded in a private migration audit and scaled 20× as a documented approximation, not misrepresented as authoritative replays.
