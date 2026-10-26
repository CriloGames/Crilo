# Nothing Here — audio sources and licenses

All audio used by **Nothing Here** is bundled locally under `audio/nothing-here/`.
The files were fetched from a pinned, licensed copy and verified against the
publisher's published SHA-256 manifest before being committed to Crilo's
GitHub Pages repository. No subscription, stream, external CDN, or paid account
is required to play these files.

## Sounds: Kenney (CC0 1.0)

- Creator: [Kenney](https://kenney.nl/)
- Original packs: [Interface Sounds](https://kenney.nl/assets/interface-sounds),
  [Impact Sounds](https://kenney.nl/assets/impact-sounds), and
  [Music Jingles](https://kenney.nl/assets/music-jingles).
- License: [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- Files: eleven Ogg effects under `audio/nothing-here/sfx/`:
  `grab`, `hit-heavy`, `hit-light`, `hit-medium`, `item-pickup`,
  `item-spawn`, `land`, `menu-back`, `menu-confirm`, `menu-move`,
  and `ready`.

Kenney dedicates these sounds to the public domain via CC0. They may be used
commercially and do not require attribution; we give credit voluntarily.

## Background music: qubodup (CC0 1.0)

- Creator: **qubodup**
- Original source: [Two Simple Game Music Loops](https://opengameart.org/content/two-simple-game-music-loops)
  on OpenGameArt.
- Track: `menumusicloop-tiggo.ogg` — the main menu loop.
- Local destination: `audio/nothing-here/music/menu-loop.ogg`.
- License: [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

The original artist allows commercial use and does not require attribution.

## Pinned distribution and integrity

The install workflow is in
`.github/workflows/vendor-nothing-here-audio.yml`, which downloads a fixed
set of the above audio files from the public
[`blancmathis/Super_Bash_Folds`](https://github.com/blancmathis/Super_Bash_Folds)
open-audio distribution at Git revision
`1028a3b739ef54efdcbe5a2ef0ad1714fe569c47`.

That distribution preserves the original CC0 licenses and
[audio source references](https://github.com/blancmathis/Super_Bash_Folds/blob/main/public/assets/audio/LICENSES.md),
and publishes a SHA-256 manifest. Every local binary is checked against that
manifest's recorded hash before GitHub Actions commits it.

## Playback policy

- **Sounds**: enabled by default, off separately if the player chooses.
- **Music**: off for first-time visitors. Playing music requires a click or
  other explicit user action, honoring browser autoplay restrictions.
- Both preferences are stored only for this game in the browser's local storage
  and do not affect other Crilo games.
- Music is a low-volume looping background track. It pauses in background tabs
  and when turned off.
- The sound pack and music are not automatically uploaded to any audio
  identification or rights-management system.

This document is a project licensing record, not a legal guarantee that
an unrelated rights claim can never occur. The assets' publishers explicitly
designate these works CC0.
