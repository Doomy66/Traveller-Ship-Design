# Floor plans: the plan

The floor plan designer is the second major part of the project. [FloorPlanSpec.md](../FloorPlanSpec.md) is its contract. [FloorPlan-Research.md](FloorPlan-Research.md) has what the book says, what the symbol archive holds, and the scale and licence of the art.

## Decisions taken, 2026-10-11

| Question | Decision | Consequence |
|---|---|---|
| How separate from the ship designer | A screen in this app | Code in `src/floorplan/`, own spec, one adapter file to the engine (FP 1.2), so it can still be lifted out |
| Where the art comes from | Bundle a small set | A few dozen symbols copied to `public/floorplan/symbols/` with a CC BY-NC licence file and credits |
| How rooms are drawn | Paint squares | Any shape. Walls drawn round each region automatically |
| How strict the counting is | Book guidance | Two squares a ton, staterooms six squares, the ship 10% either way, shortfalls are warnings |
| Where the plan is saved | Inside the `.ship` | An optional `floorPlan` field the engine ignores (FP 4.4) |
| How components are remembered | A stable key per sheet line | ShipSpec 5.2.2 and 5.2.3: keys and counts |
| Fuel | Listed, optional | Placed or not, never a shortfall (FP 3.5) |
| Several decks | One shared grid, with an overlay | Any deck shown faintly under the current one to line up shafts and hulls (FP 4.3.1, 10.7) |

## Phases

Each phase ends with the tests passing, the build clean and a commit, as the ship designer's did.

**FP0. Spec and plan.** This file and the spec. Done when the author has answered the open questions in FP 11.

**FP1. Keys and the manifest.** Give every sheet line a stable key, with a ShipSpec clause and tests that keys survive a change of figures. Write `manifest.ts`: design in, components with targets out, following FP 3. Test it against all four fixtures and the catalogue: every line with tonnage appears once, hull and armour do not, targets follow the stateroom and rounding rules. No interface yet.

**FP2. The plan model and `check`.** The plan type, the `floorPlan` field, loading and saving. `check(manifest, plan)` for FP 5 and FP 9: placed against target, the whole-ship band, room counts, orphaned squares. Tests build plans in code. Still no interface.

**FP3. The editor.** The second screen. One deck, the manifest panel, paint and erase and corridor brushes, walls and floor colours and labels drawn in SVG, problems above the deck. Then several decks with tabs. This is where the screen gets designed properly before it is built, after the lesson the design form taught.

**FP4. Access and doors.** Doors and iris valves on edges, lifts, hatches and stairs joining decks, the FP 6 checks.

**FP5. Symbols.** Choose and copy the symbol set, write the licence file and credits, read footprints from filenames, place and rotate furniture.

**FP6. Export.** PNG, SVG and print.

**Later.** The geomorph tiles, a drawn hull outline, the FP 6.3 reachability checks, a coarser scale for very large ships, and suggesting a first layout from the manifest.

## Where we are

FP1 done, 2026-10-11. Every sheet line has a key and, where it stands for several things, a count. `src/floorplan/manifest.ts` turns a design into the components to place, tested against all 40 ships, and a test keeps every other floor plan file away from the engine. Next is FP2, the plan model and `check`.

Still open: the size target, a drawn hull outline, and stamping symbols as a way to place a component (FP 11).
