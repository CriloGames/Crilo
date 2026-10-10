# Crilo 346-badge release audit — 2026-10-09

## Verification performed
- Catalog: 346/346 distinct badge keys and names, normalized to testable requirements.
- Active Supabase: 68/68 requirement predicates passed positive AND negative read-only tests (39 reached-scores, 22 wheel, 7 score tiers).
- Safe rollback transaction: official awards, owner Test Run suppression, forged Test Run badge rejection, and run-deletion provenance passed; no live QA scores or awards remain.
- Wheel simulation: 1,500,000 complete Dailies; every one of 215 score/wheel proposal predicates observed with a valid completed-run witness. Independent offline tests: 215 positive and 215 negative pass.
- Rare exact-score estimation: additional 30,000,000 independently simulated Dailies for 404, 420, 444, 555, 666, 777, 888, 999; 15,000,000 targeted runs for borderline Duck Loop (4.97422%, Epic).
- Other 131 proposals: 131 positive and 131 negative MOCK predicate tests passed; those are NOT production award or live browser tests.
- Fixed 3 exact logical duplicates, one near duplicate, nonexistent website actions, malformed ordinals, and ranking rarity ordering.
- Reclassified 26 wheel-badge rarities based on actual measured odds; 53 lifetime thresholds have attendance-conditional expected days, not random roll probabilities.

## Required release gate before activating 278 proposals
278 new definitions are **not live**. Need server award evaluators and database security rules for new run sequences, lifetime totals/streaks, finalized leaderboard ranking, accepted friends, valid drawings, and authenticated website interactions. Must implement Test Run suppression and deletion/reassignment for each family and complete browser-to-database E2E testing.

Current observed public run population (6 official runs by 3 players across 3 periods) is much too small for defensible empirical leaderboard probabilities.

**Go / no-go: NO GO for 278 proposed badges.** This file and the accompanying research CSV are staging artifacts, not an activated badge catalog. Keep /domain, CNAME, gameplay records, and current live badges unchanged.

The complete QA workbook, reproducible test scripts and full row-wise evidence were returned to the user as conversation artifacts. This readme is a permanent repo status note.
