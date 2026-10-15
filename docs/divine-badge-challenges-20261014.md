# Ten more Divine badges — difficulty calibration (October 14, 2026)

## Goal
Add ten distinct but earnable Divine achievements to Crilo without changing spin odds, official scoring, old badges or Test Run isolation. Divine is an intentionally authored prestige tier above Mythic. Its rarity is **not** determined from the ordinary individual badge drop-band classifier.

## Monte Carlo method
For each of **8,000,000** independent seeded simulated official Dailies, model the existing 24-sector wheel: start five spins; wheel outcomes six 20s, four 40s, two 60s, two 80s, four Ducks, two ×2, two Upgrades, and two +2 Spins. ×2 doubles current points and returns a spin; Duck returns a spin; +2 grants two spins; Upgrade triples subsequent number gains, returns a spin, and adds paired number segments using the documented distribution. The prototype uses C++ `mt19937` seed `0x22101026`, selecting sectors and upgrade values by modulo and imposes a 250-outcome safety cap. Probabilities are approximate per-run estimates, not guaranteed chances and not based on live player behavior.

## Results
| New Divine badge | Exact official-run condition | Hits / 8,000,000 | Approx. chance per Daily |
|:--|:--|--:|--:|
| Fourfold Fortune | 4 consecutive ×2 | 2,434 | 0.030425% |
| Royal Flock | 5 consecutive Ducks | 5,828 | 0.072850% |
| Perpetual Bonus | 4 consecutive +2 Spins | 2,491 | 0.031137% |
| Fifth Ascension | 5 Upgrades within one Daily | 825 | 0.010313% |
| Sixfold Echo | 6 ×2 results within one Daily | 4,455 | 0.055688% |
| The Great Migration | 10 Ducks within one Daily | 1,308 | 0.016350% |
| Celestial Jackpot | 10,000+ from one numbered spin | 2,426 | 0.030325% |
| The Perfect Orbit | Duck → ×2 → Upgrade → +2 Spins → Duck | 433 | 0.005412% |
| Cosmic Alignment | ×2 → Upgrade → ×2 → Upgrade | 1,282 | 0.016025% |
| Twenty Thousand Suns | 20,000+ final Daily points | 3,522 | 0.044025% |

Each measured condition occurred in hundreds or thousands of simulated Dailies, and all are below 0.1% per Daily, comparable to the initial four Divine run-based badges. They are distinct unlock requirements, including sequence order, totals, streaks, numbered-spin gain, and final score. An official Daily can award multiple badges if multiple conditions are met; these rates are marginal probabilities, not independent drop chances.

## Implementation and safety
- Database definitions: `release/346-badges/148-ten-divine-wheel-feats.sql` — ten active `crilo_v3_badge_stage` rules and their matching `badges` rows. All are keyed, upsertable and non-secret.
- Unlock checks use the existing `public.crilo_v3_run_matches` rule types (`event_total`, `event_streak`, `sequence`, `challenge` #159, `score_band`). They are awarded only via existing verified official Daily triggers. Owner Test Runs do not count. No scoring/wheel/auth rules are altered.
- Artwork: `badge-collection.js` defines 15 unique Divine SVG medal scenes, including the 10 new ones. Profile, collection, featured badges and new reward dialogs share these scenes and the near-black neon Divine theme.
- Badge totals: live total is derived from `badges` rows where `is_active` and `is_earnable`, not hard-coded. Following the ten additions the production catalog was verified at **362 active badges, 15 Divine**.
- Every new rule received a positive and negative test using the production rule evaluator. All 20 assertions passed. No historical badges or scores were rewritten.

Existing `Divine Consistency` is a five-qualifying-Daily milestone, so it cannot be described by a single-Daily percentage. It and the original four Divine medals remain unchanged.
