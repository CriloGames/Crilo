# Nothing Here — Physical Reward Contract

**Design rule:** No reward should spawn on an unrelated button or silently enter the pocket. The controlling action unlocks a specific moving mechanism or physical source; the player clicks the actual visible collectible to carry it. Never duplicate a consumed part.

## All 32 carried items

Four original, player-picked physical pieces:
- **Key teeth:** front sliding drawer.
- **Red thread:** right sliding drawer.
- **Hollow pipe:** recessed top hatch.
- **Brass ring:** underside ring seat.

Three player-made combinations (assembled in the pocket, not spawned on the cube):
- **Key:** key teeth + brass ring.
- **Flute:** hollow pipe + reed; the playable model is docked on the top lid.
- **Kite:** prism + red thread.

Twenty-five 3D rewards, with their *causal* source:
| Item | Mechanism that produces it | Physical mounting point |
|---|---|---|
| Coin | Mouse leaves luggage | Bag tray |
| Reed / biscuit / prism | False bottom opens | Three separate bag tray positions |
| Sugar | Vending machine accepts money | Vending-machine collection tray |
| Collar tag / postcard | Dog gets treat / receives parcel | Dog collar and postal slot |
| Acorn / spring | Squirrel breaks ceramic vase | **Broken vase**, not squirrel |
| Raindrop | Cloud rains | Cloud |
| Paper bird | Watered tree grows | Pot and tree |
| Lens | Elevator reaches hidden fourth floor | Elevator |
| Moth dust | Moth is examined | Moth |
| Star chart | Telescope focuses | Telescope |
| Parcel / envelope | Train arrives / returns a reply | Train |
| Paper tape | Wax cylinder plays through music box | Music box |
| Letter | Pocket watch reads punched tape | Clock |
| Bell | Red switch releases an underside latch | **Underside bell seat**, not the red button |
| Tuning fork | Gauge reaches its third detent | Upper gauge retainer, without obscuring needle |
| Copper shim | Vent sequence retracts shutter | **Open vent cavity**, not a vent button |
| Brass cog | Third front screw releases service hatch | **Hinged brass cog pocket**, not the center optic |
| Hinge washer | Third hinge pin retracts | Remaining fixed hinge seat |
| Wax cylinder | Resonance opens service shutter | **Service cavity**, not its switch |
| Glass iris | Cog powers optical mechanism | Retainer next to glass eye |

The larger surreal transformations (music summons cloud, flute summons door, bird summons moon) remain deliberately fantastic. Material items still need clear, reachable 3D sources.

## Guards

`scripts/verify-nothing-here-live-3d.mjs` checks the original 60 award paths, 32 pocket item types, three recipes, 25 rendered physical rewards, source-to-reward mapping, front cog hatch motion and actual click accessibility. It also tests completed mechanisms, all six faces and transformed solid bounds, including independently measured reward-reward intersections and edge protrusions. Check intermediate unlock states manually, too; broad-phase bounding boxes can exaggerate collisions between intricately interlocked decorative solids.

Update this contract and the automated expected-source mapping together whenever puzzle rewards move.
