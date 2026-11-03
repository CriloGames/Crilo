# Nothing Here — Real 3D workbench

This is a **separate physical 3D prototype**, not a replacement for `/secrets.html`.
The original 60-secret game and its localStorage progress remain untouched.

## Website preview

**https://crilo.fun/secrets-3d-preview.html**

The preview is already deployed to GitHub Pages. It uses a pinned ESM import map to load:

- `three@0.186.1` — physical meshes, materials, raycasting, shadows
- `gsap@3.15.0` — actual sliding and hinged animations

`three-mesh-bvh@0.9.16` is included in the local workbench dependency set
for future high-detail raycasting. It is not yet necessary for the lightweight preview.

The physical workbench models a genuinely hollow shell using separate wall segments
around three openings. Both drawers have actual sidewalls, bottoms, and backs;
the hatch is a volumetric piece rotating about a hinge.

## Local install

Requires Node.js 22 or newer.

```bash
git clone https://github.com/CriloGames/Crilo.git
cd Crilo/three-workbench
npm install
npm run check:deps
```

Never commit `node_modules`. NPM creates it locally. Exact dependency versions are
recorded in `package.json`.

To run the standalone browser prototype locally, serve the repository's **root**:

```bash
cd ..
python3 -m http.server 4173
```

Open `http://localhost:4173/secrets-3d-preview.html`. Internet access is needed for
the pinned CDN ESM modules; a later production bundling step can remove that dependency.

## Structural and visual quality assurance

Nothing Here now has an **optional** triangle-accurate collision inspector:

1. Open `https://crilo.fun/secrets.html?inspect3d=1` (developer use only).
2. Select **Check actual surfaces** in the inspection toolbar.
3. Review the report in the browser's Developer Tools console. It first checks
   visible 3D bounds and uses **three-mesh-bvh** to confirm intersections
   between distinct real geometry surfaces. AABBs alone can over-report.
4. Toggle Models, Rewards, Mechanisms, or All to draw their 3D bounds.
   This remains invisible during ordinary gameplay.

The GitHub Actions physical 3D workflow runs `scripts/verify-nothing-here-live-3d.mjs`,
which now includes the detailed BVH audit for all 15 miniatures, 25
collectibles, and representative moving mechanisms.

It also runs `three-workbench/scripts/verify-visual-regression.mjs`, which uses
**pixelmatch** and **pngjs** to photograph all six faces in locked,
partly-unlocked and fully-unlocked scenes. It pixel-compares restored views
against their saved-state reference frames and stores raw/difference PNGs
as the `nothing-here-real-3d-previews` GitHub Actions artifact.

The screenshots compare **within one controlled CI run**, not across releases
with approved golden master images. This reliably detects unexpected differences
after reloading a saved game, but does not automatically certify visual taste.

No player-facing dependency is installed; these libraries run only in QA.

## Optional Blender

For custom modeled assets, install Blender from https://www.blender.org/download/.
On macOS, download the macOS build, open the DMG, and move Blender into Applications.
Export models as `.glb` (glTF 2.0) and import with Three.js `GLTFLoader`.
Blender is **not** required to use this prototype or to keep developing its 3D meshes.

## Verification

The GitHub Actions workflow `.github/workflows/nothing-here-3d.yml` installs
all three npm dependencies, verifies their imports, syntax-checks the WebGL source,
and tests both open/close mechanism sequences plus mobile rendering in Chromium.
It saves screenshots as CI artifacts.

Only migrate an existing secret into the WebGL renderer when its click/keyboard
interactions, puzzle dependency, and saved-game compatibility are covered by tests.
