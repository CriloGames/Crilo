# Crilo private Test Games

The owner-only playtest catalog is `/test-games.html`. It is not linked in
the public More Games collection. The shared `app.js` header adds a TEST
GAMES tab after authenticated owner-profile verification. The test page
independently checks Supabase `auth.getUser()` and the current profile's
protected `is_owner` column, and leaves the game hidden/inert otherwise.

**Important limitation:** GitHub Pages serves static HTML, CSS and JS
publicly. This is owner-only *navigation and in-browser access*, not
private source code or a server-enforced executable boundary. Never store
secrets or privileged data in prototype assets; do not add privileged
RPCs without database-side owner authorization.

## Prototype 01: The Last Light

- One illuminated ellipse in a black tracking arena.
- Move into it and click to start. Leaving its moving boundary ends the run.
- Its motion has momentum, modest cursor reaction and slow shape changes.
- Esc pauses; a touch pointer can drag and lift to pause.
- Gentle, Standard and Intense modes offer useful playtesting comparisons.
- Best survival time is browser-local and keyed by authenticated owner ID
  and difficulty. No Daily results, badges, public scores or Supabase writes.

## Workflow

1. Keep new prototypes under Test Games while evaluating their feel.
2. Test with an owner session, a regular account and a signed-out browser.
3. Run `node scripts/verify-test-games.mjs` for the offline access and input
   regression suite; perform actual browser and phone tests as well.
4. When the owner explicitly approves a prototype, move it to its own public
   game URL, remove the owner-only *gameplay* gate for that published version,
   and then add a card to `index.html#more-games`.
5. Keep unfinished experiments, owner test scores and prototype debugging
   separate from public rankings and progress.
