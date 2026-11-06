# Crilo development guardrails

Crilo is published through GitHub Pages. Keep `CNAME` pointing to
`crilo.fun`. Never overwrite or reset users' saved puzzles unless explicitly
requested.

## Nothing Here: mandatory quality gate

The live 3D game is `secrets.html`, `cube-secrets.js` and
`secrets-3d-*.js`. Its persistent localStorage key is
`crilo_nothing_here_cube_v3`.

**Do not consider a 3D change finished just because JavaScript parses or
static maze assertions pass.** A previous circular maze rewrite compiled but crashed
while constructing `THREE.CatmullRomCurve3` because an `Array.from` callback
assumed it received an output array as its third argument.

For any 3D scene or puzzle change:

1. Keep both the logical graph and visible physical paths consistent, and
   preserve valid older save migrations.
2. Run `node --check` on modified JS and
   `node scripts/verify-nothing-here-codes.mjs`.
3. A maze-face change must preserve a fixed ivory plate, a rotating black
   drive cog and toothed carrier, and physical bidirectional pin navigation.
   The current graph has eight rings and a separately-open central mouth.
4. Run a real **Chromium WebGL startup test**:
   `node scripts/verify-nothing-here-startup.mjs`.
   It must load both a fresh game and a saved game without a retry/error
   screen. The test takes screenshots in `test-results/`.
5. For interactions or gameplay changes, run
   `node scripts/verify-nothing-here-second-coin.mjs` and the full
   `scripts/verify-nothing-here-live-3d.mjs` suite.
6. Inspect actual browser screenshots for fit, readability, overlap and
   control reachability, not just code-generated measurements.
7. Prefer opening a pull request; do not merge if the
   **WebGL startup (fresh + saved progress)** check fails. A direct commit
   to `main` cannot be prevented by a post-push GitHub Actions check.
8. If a live browser check cannot be executed, explicitly disclose that
   uncertainty; do **not** claim the game is verified to load.

For local checks, run a static HTTP server at the repository root on port
4173, install Playwright, and provide a Chromium binary. The GitHub Actions
workflow `.github/workflows/nothing-here-startup.yml` runs these checks
automatically on pull requests and pushes to `main`.

Keep all puzzle items physically grounded: no rewards from nowhere, no
unintended overlapping geometry or fake remotely activated controls.
