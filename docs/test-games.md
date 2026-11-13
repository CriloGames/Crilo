# Crilo private Test Games

The owner-only playtest catalog is at /test-games.html. It is intentionally
separate from the published More Games listing. The site's shared app.js
adds a TEST GAMES header tab for a verified authenticated owner. The playtest
page independently calls Supabase auth.getUser() and checks the authenticated
profile's protected is_owner flag before revealing the game.

**Hosting limitation:** GitHub Pages serves HTML/JavaScript/CSS as public
static files. This gates the normal in-browser experience and owner navigation,
but is NOT a server-enforced restriction on reading or copying code. Never
put credentials, private game data, server-side privileges or secret assets
into any prototype.

## Prototype 01: Almost Perfect

One game with a dropdown for three modes:

- **Perfect Path:** the route draws itself, then disappears. Trace the route
  from memory. Score measures mean spatial error along equally arc-resampled
  paths and penalizes incorrect length and endpoints.
- **Perfect Distance:** each New Game randomly picks a target distance
  between 62 and 117 logical pixels, at least 18 pixels away from the previous
  target. Memorize the dotted guide and click on it to start; the guide ring,
  tolerance lines, numeric distance and connecting line disappear immediately.
  Only the moving target and cursor remain for the 11-second run. Try Same
  Distance preserves the target distance. The score integrates distance error.
- **Perfect Motion:** watch a cursor for 5.2 seconds. Recreate both its path
  and speed. The accuracy formula blends strict and forgiving time-distance
  measurements and uses the forgiving Perfect Path shape metric. Timing is 72%
  of the score and route shape is 28%; missing time still scores zero. After
  the run, REPLAY BOTH LINES draws the blue reference and recorded orange
  attempt together in real time, using the original movement timings. Replay
  never changes the stored attempt or its score.

Perfect Path and Perfect Motion apply a smooth, monotonic mid-range score
bonus after measuring the run: score + 16 × sin(π × score / 100).
A previous 48% becomes approximately 64%, but 0% and 100% stay
unchanged and better attempts always score higher. Perfect Distance is
not affected.

**Trackpad-friendly drawing:** Perfect Path and Perfect Motion offer a DRAWING
REACH selector (Normal 1x, Medium 1.4x, Trackpad 1.75x by default, and
Long Reach 2.1x). It amplifies *horizontal mouse movement only* inside
the playfield, letting shorter trackpad strokes reach the far endpoint.
The virtual cursor, the displayed stroke, and final scoring all use the
same coordinates; releasing does not jump back to the physical pointer.
Vertical movement is unchanged for precision. Touch input and Perfect
Distance always use their original 1x mapping. The chosen level is saved
locally per owner account and is locked during an active stroke.

During an active run, a large **LIVE ACCURACY / ESTIMATE** readout
appears inside the arena. Perfect Path estimates local stroke accuracy against
the reference curve; Perfect Motion combines estimated spatial and timed
accuracy; Perfect Distance displays cumulative tracking accuracy rather than
revealing the hidden target distance. The readout is provisional and disappears
at completion when the final score appears in the results panel.

Small Web Audio sound effects are synthesized on demand for starting, moving
and finishing each run. SOUND: ON/OFF in the playtest header mutes all effects
immediately. Browsers without Web Audio play silently. There are no external
music files or loops.

The game saves personal-best accuracy separately for each mode, keyed by
owner profile and mode in localStorage. All gameplay is browser-only.
There are no numbered challenges or levels. NEW GAME creates a newly seeded,
randomized path (or target movement) for the selected mode. TRY SAME SHAPE
repeats the exact current target for practice. After grading, the full-size
canvas remains uncovered: blue is the original and orange is the player trace.
A comparison toggle allows showing the player's line on its own. The score
and action buttons are below the canvas.

## Workflow

1. Keep prototypes in Test Games until the owner is happy with gameplay.
2. Run node scripts/verify-test-games.mjs and the GitHub Actions job
   Owner Test Games smoke for owner/guest behavior and all mode mechanics.
3. Visually playtest desktop mouse and mobile touch input in browsers.
4. When explicitly approved, release a **separate public version** with
   its owner-only gameplay gate removed, and add a card in More Games.
5. Keep prototype stats and local progress isolated from public rankings
   and Daily Wheel results.
