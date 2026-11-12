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
- **Perfect Distance:** click the dotted ring, then maintain precisely 82
  logical pixels from a continuously moving point for 11 seconds. Score
  integrates distance error over time; being off the arena counts as missed.
- **Perfect Motion:** watch a cursor for 5.2 seconds. Recreate both its path
  and speed. Score weights accuracy at corresponding times (72%) plus the
  traced path shape (28%); releasing early loses remaining timed accuracy.

The game saves personal-best accuracy separately for each mode, keyed by
owner profile and mode in localStorage. All gameplay is browser-only.
Different challenges cycle through five path variants; the current round
can be retried, or advanced with NEW CHALLENGE.

## Workflow

1. Keep prototypes in Test Games until the owner is happy with gameplay.
2. Run node scripts/verify-test-games.mjs and the GitHub Actions job
   Owner Test Games smoke for owner/guest behavior and all mode mechanics.
3. Visually playtest desktop mouse and mobile touch input in browsers.
4. When explicitly approved, release a **separate public version** with
   its owner-only gameplay gate removed, and add a card in More Games.
5. Keep prototype stats and local progress isolated from public rankings
   and Daily Wheel results.
