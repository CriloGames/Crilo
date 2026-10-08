# Crilo badge artwork: name-mismatch audit and fix queue
Updated 2026-10-08. **Planning document only: do not change achievement definitions, unlock logic, award records, or locked/secret display behavior.**

## Source of truth
Use `docs/achievement-name-reference.md` for names provided by the user and compare against live `public.badges` for missing categories. SVGs currently live in `profile.js` under `customTitleScenes`. The fact that an SVG exists does **not** mean its subject matches the achievement name. Do not infer the display name from the badge key. A partial CSV was supplied (through `score_500`); obtain the remaining rows before confidently auditing Wheel Combos, Hidden Wonders, and remaining Score milestones.

## HIGH PRIORITY: clear or likely name/artwork mismatches to revisit in existing sections

### Bonus Spins — 10 of 10 need a name-specific design review (currently generic milestone/bonus objects)
- `spinplus_1` — **Not Done Yet**: currently wheel with plus. Consider a nearly-finished spinner being given extra spins.
- `spinplus_2` — **Second Wind**: currently two cards. Illustrate a gust of wind refilling an exhausted spinner.
- `spinplus_3` — **Keep Going**: currently a golden cube. Show an endless/forward-moving wheel or running motion.
- `spinplus_5` — **No Rush**: currently star card. Show a relaxed clock, hammock, or snail beside a wheel.
- `spinplus_saved` — **Saved by the Bell**: currently a bookmarked ticket/check. Show an actual ringing bell and last-spin rescue.
- `spins_10` — **Bonus Round**: currently a small wheel. Show a bonus-stage curtain, bonus ticket, or festive round.
- `spins_15` — **Marathon**: currently a gift box. Show a runner crossing a finish line or running shoes.
- `spins_20` — **Can I Go Home Now?**: currently mystery cube. Show a tired spinner reaching for an exit/door.
- `spins_25` — **Why Won't It End?**: currently a ticket. Show a looping clock/never-ending wheel and exasperation.
- `spins_30` — **Overtime**: currently a wheel. Show a clock past closing time or a timecard with extra time.

### Rare Moments — 15 name-specific concept checks (current art is mostly random fantastical rarity objects)
- `rarity_10` — **A Little Unusual**: 10-sided die matches odds, but not specifically the unusual theme; lower priority.
- `rarity_25` — **Rare-ish**: lucky horseshoe communicates luck, loosely related; lower priority.
- `rarity_100` — **What Are the Odds?**: telescope/Saturn is unrelated to calculating odds; use probability dice/calculation.
- `rarity_250` — **Raised Eyebrow**: potion bottle misses facial expression; use a raised eyebrow/curious face.
- `rarity_500` — **Suspicious**: orbiting star misses suspicion; use detective magnifier/side-eye.
- `rarity_1000` — **One in a Thousand**: treasure chest doesn't express 1/1000; use one marked item among many.
- `rarity_2500` — **Getting Weird**: crescent moon only loosely weird; use surreal visual.
- `rarity_5000` — **Seriously?**: crystal ball doesn't show disbelief; use shocked face/question marks.
- `rarity_10000` — **Don't Tell Anyone**: floating island doesn't suggest secrecy; use a shushing figure/secret note.
- `rarity_25000` — **Statistically Concerning**: portal doesn't show statistical concern; use alarming graph/odds.
- `rarity_100000` — **Someone Check the Math**: crystal doesn't show math; use calculator with an impossible answer.
- `rarity_1000000` — **One in a Million**: glowing pod is generic; show a single exceptional one in a huge crowd.
- `rarity_10000000` — **Statistical Anomaly**: starburst is generic; use an outlier dot on a graph.
- `rarity_100000000` — **This Shouldn't Happen**: ringed planet doesn't communicate impossibility; show a broken probability machine.
- `rarity_legendary` — **Chosen by the Wheel**: golden star is generic; depict the wheel selecting a chosen player.
- `score_uncommon`, `score_rare`, `score_epic`, `score_legendary`, `score_mythic`: inspect the five existing symbols together for clear tier distinction; avoid replacing already fitting artwork without review.

### Upgrade Mastery — 15 already revised, but audit again for *literal title fit*
- `upgrade_1` Renovation: house now fits.
- `upgrade_2` Better Better: rising bars broadly fit.
- `upgrade_3` Triple Threat: three arrows fit.
- `upgrade_4` Upward Mobility: rising chart fits.
- `upgrade_5` Surely That's Enough: tower conveys accumulation but misses exasperation; add overwhelmed reaction.
- `upgrade_6` Apparently Not: generic rising bars miss the joke; show a tower extending beyond its expected end.
- `upgrade_7` Escalation: rising bars/gem loosely fit; add visibly escalating action.
- `upgrade_8` Overclocked: crystal/core fits power but should convey overclocking via gauge/heat/speed.
- `upgrade_9` Getting Ridiculous: tower fits growth but should look absurdly oversized.
- `upgrade_10` Perfect Ten: numbered star is acceptable, but ten-pin/10/10 visual may fit better.
- `upgrade_12` Structural Concerns: house with arrows doesn't clearly show instability; show cracks/tilt/support.
- `upgrade_15` Building Inspector: checklist fits; add hard hat/magnifier if legible.
- `upgrade_20` Ascended: building with arrow fits loosely; show levitation/clouds.
- `upgrade_25` UP UP UP: upward arrow fits, but **three** arrows would better match the repeated word.
- `upgrade_30` There Is No Ceiling: upward arrow/building fits loosely; show broken/open roof.
Prioritize `upgrade_5`, `upgrade_6`, `upgrade_8`, `upgrade_12`, `upgrade_20`, `upgrade_25`, `upgrade_30` if the user wants another refinement pass.

### Double Trouble — review as next unfinished category (15 keys, names known)
Check whether each existing icon literally matches its name: `double_3` Compound Interest (compounding chart), `double_4` Exponential-ish (curved graph), `double_5` Multiplication Table (times table), `double_7` Calculator Needed (calculator), `double_8` Snowball (growing snowball), `double_10` To the Moon (rocket/moon), `double_back3` Hat Trick (hat/three), `double_zero` Twice Nothing (0 × 2), `double_final` Last Minute Accounting (clock/ledger). Note `double_1` and `double_back2` have the **same displayed name** but different unlock requirements; design different scenes and do not rename without approval.

### Duck Encounters — inspect all 15 against names before redesign
Especially `duck_4` Pond Party, `duck_5` This Is Getting Out of Hand, `duck_10` Duck Army, `duck_15` Migration, `duck_lifetime100` Ornithologist, `duck_sandwich` Duck Sandwich, `duck_upgrade` Evolution, `duck_double` Lucky Duck. These should depict the literal joke, not only a generic duck or count.

## MEDIUM PRIORITY: revisit finished categories when the full catalog is available
- Daily Dedication: `daily_1` Hello, Wheel; `daily_14` Habit Forming; `daily_30` I Live Here Now; `daily_365` See You Tomorrow; `daily_draw` Picasso; `runs_1000` Old Timer. Verify that art tells the joke instead of only showing a streak number.
- Leaderboard Legends: `rank_1` Mom, Get the Camera should have a camera; `rank_2` Basically First should show runner-up humor; `rank_3` I'll Take It should suggest reluctant bronze; `rank_25` Getting Crowded Up Here should depict crowding; `rank_wins_5` Do It Again should show repeat win. Check before editing.
- Score Milestones: `score_100` Pocket Change, `score_2000` Two Grand, `score_4000` Cooking, `score_20000` Wheel Wizard, `score_250000` Call an Accountant. User's partial CSV omits several other score entries; await full catalog.
- Wheel Combos: `seq_repeat3` cube and `seq_special5` starburst are generic; verify actual names before replacing. `seq_numbers_only` 123, `seq_bookends` bookends, `seq_palindrome` symmetry are conceptually aligned but should still be checked against database names.
- Hidden Wonders and Wheel Discovery: **names missing from supplied export**; do not claim a mismatch based on key alone. Request full catalog first.

## Workflow for future batches
1. Look up **exact badge_key + name + description** from reference or live catalog.
2. Compare to the current SVG and mark **match / partial / mismatch / unknown**.
3. Include queued mismatches in the relevant section's next artwork pass; show the user previews before implementing when requested.
4. Preserve badge keys, names, descriptions, unlock logic, earned records, secret behavior, and locked opacity unless separately approved.
5. Update this queue as mismatches are fixed. Artwork progress (146/171 custom icons) is **not** the same as name-matching quality.
