# Mobile game QA — Crilo

The site has **nine live or owner-playtest gameplay surfaces** checked by
`scripts/verify-all-games-mobile.cjs`. The old `keep-it-up.html` entry
redirects to Pong Toss and is not a separate playable game.

| Game | Page | Mobile interaction checked |
| --- | --- | --- |
| Daily Wheel + Pixel Studio | `index.html` | Touch drawing/editor, controls, navigation, no overflow |
| Pong Toss | `pong-toss.html` | Tap/hold/release shot, fullscreen entry and exit, layout |
| Nothing Here | `secrets.html` | Three.js boot, stage, reset, layout |
| Shape of Sound | `shape-of-sound.html` | Tap shapes, accessible resize handle, mute, layout |
| How Much Was the Domain? | `domain/` | Slider, reveal/next, layout |
| Almost Perfect (private) | `test-games.html` | Owner gate, mode switching, touch-friendly HUD |
| Five Fronts (private) | `five-fronts.html` | Native state picker, recruit, pause/resume |
| Escape the Box (hidden) | `index.html` | Touch open, movement, close |
| Green Needle (hidden) | `ducks.html` | Signed-in touch open and close; no live RPC spins |

## Automated tests

The `All Crilo games mobile interaction QA` GitHub Action runs synthetic,
isolated browser accounts and executes responsive checks and real touch actions
using Playwright Chromium (390px, 360px, and 768px) and WebKit (390px).
It checks offscreen controls, horizontal overflow, and page JavaScript errors.
A push touching any tested game triggers the workflow.

Run locally after `npm install --no-save playwright@1.56.1` and
`npx playwright install chromium webkit`:

```sh
node scripts/verify-all-games-mobile.cjs
```

There are deeper complementary checks:

- `scripts/verify-nothing-here-mobile.mjs` physically touches a 3D item,
  tests inventory, flute, pinch/swipe, dialogs, saving and fullscreen.
- `release/346-badges/056-sound-shapes-browser.cjs` tests ten desktop,
  iPhone, Android and iPad configurations, Web Audio, interactions, merges,
  undo, and persistence.
- `scripts/verify-pong-toss.mjs` and its 3D browser suite test physics and
  input controls. Pong uses CSS fullscreen on coarse-pointer mobile devices.
- `scripts/verify-five-fronts.cjs` simulates maps, army orders, economics
  and complete campaigns without live user data.
- `release/346-badges/178-hidden-box-browser.cjs` tests all 25 puzzles,
  mobile swipe gestures and rewards.
- `release/346-badges/125-secret-wheel-browser.cjs` checks wheel layout
  and dialogs on multiple widths without making authenticated server spins.

## Limits

Browser simulations catch many mobile issues but cannot certify every
physical iPhone, Android handset, display notch, audio device, network, or
system-specific gesture behavior. Nothing Here and Pong Toss are especially
sensitive to WebGL hardware/driver support. The cross-game matrix currently
does not exercise WebGL-based games inside headless WebKit, which is not a
substitute for testing an actual Safari device.

No automated suite can honestly guarantee zero bugs. After major releases,
physically play the 3D games on at least one iPhone and one Android device,
and verify the Game Audio toggle, browser rotation, and background/resume.
