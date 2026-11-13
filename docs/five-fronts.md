# Five Fronts — Owner-only single-player alpha

URL: /five-fronts.html, linked only inside the owner-gated Test Games catalog.

## Implemented and playable

- Pick two to six countries: one human (Mossvale) versus 1–5 local AI opponents.
- A seeded land map with five **equal-area, connected hex states** per country.
  All states use the same-sized hexagon. Borders are randomized by connected,
  equal-count swaps; no player starts with more land area than another.
- Seed-randomized starting specializations: metal, oil, food, knowledge,
  population. Every country starts with one farm, one hill, one forest,
  one river and one plain, balancing the basic resource geography while the
  exact position and borders stay unpredictable.
- Terrain changes production and combat: farms, hills, forests, river and plains.
- Select your own state to recruit, fortify, or order troops into one adjacent
  state. Orders take time; attacks resolve using troop counts, terrain, defense,
  technology, logistics and national policy.
- Moving an army requires oil; armies consume food; technology research spends
  knowledge. Population and metal matter for recruiting and fortifying.
- Every five in-game minutes choose one of three policy cards. The local
  simulation pauses until the human chooses. The AI also adopts policies.
- Every two in-game minutes there is a 27% chance of a world disaster affecting
  one country. If it affects the player, a nine-second, **one-chance** response
  minigame appears. A well-timed response mitigates 82% of the casualty/resource
  penalties. TEST EVENT allows the owner to test the challenge immediately.
- The war ends with one victor after all opponents are eliminated or at
  30 in-game minutes, scored by remaining state control and troop strength.
- Two timing modes: normal 30-minute campaign and five-times-faster six-minute
  playtest. Local saved-match resume, pause, responsive map and action log.

## Not implemented yet

**Real-time multiplayer with other humans is NOT part of this version.**
There are no shared matches, networking, matchmaking, invitations, persistence
to Supabase, public rankings, or player-versus-player verification. Everything
runs in the owner's browser, including AI. Saved matches are localStorage-only.

The next phase should be human multiplayer with server-authoritative state
and authenticated lobby actions; never reuse the browser's trust model for
competitive online matches.

## Security / hosting caveat

As with Almost Perfect, Test Games is owner-gated at the interface level
through Supabase auth.getUser() and protected profiles.is_owner. GitHub Pages
assets are publicly readable: nothing in these prototype JS/CSS/HTML files is
secret. Never put a service-role key, secrets, or privileged database API
calls in static game code.

## Quality checks

Run node scripts/verify-five-fronts.cjs. The suite verifies 2–6 player
map connectivity and balanced area across 100 seeds each, resource costs,
movement and arrival, disasters and mitigation, five-minute decisions,
120 full simulations ending with exactly one victor, and owner/guest access
with browserless UI interactions. GitHub Actions also runs this test suite.
Before promotion to More Games, test actual browsers, touch input, visuals,
balancing, and persistent gameplay over real full-length sessions.
