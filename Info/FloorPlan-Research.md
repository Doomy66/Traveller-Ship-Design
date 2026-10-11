# Floor plans: research notes

Started 2026-10-11. Groundwork for the floor plan designer, before its own plan and spec are written. Nothing here is decided yet; the decisions go in the floor plan's own documents.

## What the book says (High Guard 2022, PDF pages 100-101)

Paraphrased. The repo carries no Mongoose text.

- Everything with tonnage goes on the plan except armour, reinforced bulkheads and the hull itself.
- A deck or area holding nothing but fuel can be left off the plan, though it still shapes the exterior.
- Two squares per ton, so a square is half a ton. The ship as a whole may run 10% either way, because corridors, lifts, machinery and the like are not in the design sequence.
- A stateroom is four tons but typically six squares. The other two tons' worth go to corridors and access.
- More than one deck is normal, and every deck needs a way in: floor or ceiling hatches, or lifts.
- Common areas: about one square per two staterooms is a sensible start.
- Ammunition belongs near the weapon it feeds. Anything needing the outside (airlocks, carried craft, escape pods, launch tubes, probe drones) can reach it through the floor or ceiling, not only a side wall.
- Screens may be spread through the hull and left off the plan, or put in one place.
- Very large ships may use a coarser scale to fit a page.
- The book's own method: sketch the exterior, check total tonnage, place the drives and power plant first, then staterooms, then label everything.

The square is the standard Traveller deck square: 1.5 m (5 ft) on a side. Two squares to a ton implies a deck height of about 3 m.

## The assets: `D:\SandPit\ShipParts`

1.4 GB, unzipped beside the zips. The same six archives described in [Resources.md](Resources.md), now on this machine.

| Folder | What it is |
|---|---|
| `AdventureClass` | 2,461 Adventure Class geomorph tiles in numbered folders. Filenames carry tonnage as `[N-dTons]` |
| `CustomTiles/Custom Tiles` | Larger pre-built tiles (bridges, cores, ends) |
| `CustomTiles/Symbols` | **The useful part for now.** One folder per room type, about 2,500 PNGs |
| `Geomorphs` | The original geomorph tiles, baseplates, finished example starships as PNG |
| `GeomorphsStarships2`, `3` | Layered `.psd` sources of 23 finished ships |
| `drive-download-...` | The Starship Symbols as CAD (`.dwg`, `.dxf`) and PDF, and a deck plan template |

### The symbols

Folders under `CustomTiles/Symbols`: Battery, Bridge, Briefing Room, Brig & Security, Cargo, Classroom, Computer, Dock (Small Craft), Drop Capsule, Empty Room, Engineering, Fresher, Fuel, Furniture/Consoles/Equipment, Galley & Mess, Lab, Lounge, Low Berth, Machinery, Medical, Misc, Offices, Retail, Sensors, Ship's Locker, Shop & Repair Area, Staterooms, Storage, Utility, Weaponry.

The ones asked for first:

| Wanted | Where | Count |
|---|---|---|
| Staterooms | `Staterooms/Stateroom NNN` | 24, at 5x10, 10x10 and 10x15 ft. Also barracks and pod beds |
| Doors | `Misc/Door NNN [10x30]` | 4 |
| Iris hatches | `Misc/Iris Valves NNN [5x5]` | 19 |
| Lifts | `Misc/Elevator NNN` | 5, from 5x5 to 20x20 ft |
| Stairs | `Misc/Stairs NNN` | 13 |
| Airlocks | `Misc/Airlock NNN`, `Extendable Airlock NNN` | 10 + 7 |
| Chairs | `Furniture, Consoles, & Equipment/Couch & Chairs NNN` | 33 |
| Consoles | `.../Console NNN`, `Azhanti Style Bridge Console NNN` | 54 + 22 |
| Beds, tables, desks, freshers | same folder | 6, 16, 11, 3 |

**Scale.** Every symbol is 60 pixels per 5 ft square, the same as the geomorph tiles, so 12 pixels per foot. The bracketed size in the filename is the symbol's footprint in feet, width by height: `[10x10]` is two squares by two. Most images are padded with one square of transparent margin on every side (a 10x10 ft stateroom is a 240 px image around 120 px of drawing); the smallest, like the 5x5 iris valves, are not. The real footprint has to come from the filename, not the image size.

**Style.** Black line art on a transparent background, Robert Pearce's Starship Symbols style. They sit on any floor colour or grid.

**Licence.** Robert Pearce's Traveller Geomorphs and Starship Symbols, rendered to PNG by Eric B. Smith, under Creative Commons Attribution Non-Commercial 4.0. Both must be credited wherever the art appears. Non-commercial only, which matches this project's PolyForm Noncommercial licence. Bundling a subset in the public repo is allowed by the licence with attribution; whether to do it is a decision, not yet taken.

## The join to the ship designer

A floor plan starts from a saved `.ship`. The sheet already lists every component as a line with its tonnage (`SheetLine.tons`), which is exactly the list a plan has to place. The two places the sheet's lines need care:

- **Lines without tonnage** (software, fuel scoops, most mounts on firmpoints) do not go on the plan.
- **Lines with quantity** (`Stateroom x10`, `Full Hangar (40 tons) x24`) are one line on the sheet but many rooms on a plan.

Armour is a sheet line with tonnage that the book says to leave off. Fuel is one the designer may choose to leave off.
