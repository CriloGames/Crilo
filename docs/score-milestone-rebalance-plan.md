# Crilo score milestone rebalance — proposed, NOT applied to production

Based on `rarity-system.js` deterministic 100,000-run distribution on 2026-10-08: Uncommon ~56, Rare ~141, Epic ~326, Legendary ~841, Mythic ~2349. These are approximate simulated thresholds and can change if game rules or simulation change.

**Important:** `badge_key` suffixes encode old thresholds. Preserve keys to retain earned-badge references; do NOT infer required score from badge_key after migration. Supabase currently stores badge names/descriptions and likely handles awarding. Backend award function/trigger must be inspected and updated atomically before activating this plan. Existing awards should remain earned; retroactive awards need explicit policy.

| Stable badge key | New score threshold | Expected rarity |
|---|---:|---|
| score_001 | 1 | Common |
| score_100 | 25 | Common |
| score_250 | 75 | Uncommon |
| score_500 | 125 | Uncommon |
| score_750 | 150 | Rare |
| score_1000 | 200 | Rare |
| score_1500 | 250 | Rare |
| score_2000 | 300 | Rare |
| score_3000 | 350 | Epic |
| score_4000 | 450 | Epic |
| score_5000 | 550 | Epic |
| score_7500 | 700 | Epic |
| score_10000 | 850 | Legendary |
| score_15000 | 1000 | Legendary |
| score_20000 | 1250 | Legendary |
| score_30000 | 1500 | Legendary |
| score_50000 | 1800 | Legendary |
| score_75000 | 2100 | Legendary |
| score_100000 | 2350 | Mythic |
| score_250000 | 3000 | Mythic |

All descriptions should be `Score at least N points in an official run.` Names with numerical implications (such as Five Figures) must be renamed to fit new thresholds. Icons should communicate the badge's final name and rarity, not the old key suffix. Before executing, verify all 20 actual names and the Supabase trigger or function responsible for badge awards.
