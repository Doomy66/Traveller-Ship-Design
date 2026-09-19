# Plan: design ships to High Guard Update 2022

Status: **phases 0 to 5 done, 2026-09-19.** The application runs: the book's thirteen steps down the left, the sheet down the right, problems reported where they happen, save and load as JSON, and print. Four of the book's ships reproduce to the ton and the credit and are built in to open. 83 tests pass.

What is left of the rulebook is space stations (pages 65-70) and exotic technology (80-85). After that, the deck plan thread.

## Goal

Enter a ship the way the book's checklist does (PDF page 10, thirteen steps) and get back the design sheet the book prints for its standard ships (PDF pages 136 onward): a component table with tons and cost per line, hull points, crew, power requirements, purchase cost, and monthly maintenance. The book's own ships are the acceptance tests: the Scout/Courier and Free Trader sheets must come out to the credit.

## Shape of the thing

Three layers, built in this order.

1. **Rules data.** Every table in the Ship Design, Weapons and Screens, Spacecraft Options, Computer and Sensors chapters transcribed into typed TypeScript data, each entry carrying the PDF page it came from. No logic here, just the book.
2. **Design engine.** Pure functions. A `Design` is what the user chose: TL, hull tonnage and configuration, armour, drives, power plant, fuel, bridge, computer, sensors, weapons, options, staterooms, low berths, common area, software. A `Sheet` is what the rules say that costs: per-component tons, cost and power, totals, hull points, crew, maintenance, and a list of problems (over tonnage, under-powered, jump drive on a hull under 100 tons, armour over the TL cap, and so on). `sheet(design)` is deterministic and has no UI in it.
3. **UI.** A stepper following the book's checklist down the left, the live sheet on the right, and problems shown where they arise. Save and load as JSON, print the sheet.

Deck plans from the geomorph tiles are a separate thread after this one. The `[N-dTons]` in the tile filenames is the join to a design's component tonnages, so the engine should keep per-component tonnage in the sheet rather than only totals.

## Phases

### Phase 0: scaffold

- Vite + TypeScript + vitest, Electron shell later, matching PlanetHex. Browser-first.
- `ShipSpec.md` in PlanetHex's numbered-clause style, written alongside phase 1 and 2 so the engine has a contract. Start it with the design sequence and the data model; leave weapons and options as headings.
- README, CHANGELOG, MIT licence, `Info/` as it stands.

### Phase 1: core rules data (PDF pages 9-26)

Transcribe, with page references:

- Hull: Cr50000/ton, hull points per 2.5 t (2 t at 25k-99,999, 1.5 t at 100k+), configuration table (page 12: streamlining, armour volume modifier, hull point modifier, cost modifier), specialised hulls (reinforced, light, military, non-gravity, page 13), additional hulls (double, hamster cage, breakaway, page 13), planetoid rules.
- Armour table (page 13): titanium steel TL7 2.5% Cr50000, crystaliron TL10 1.25% Cr200000, bonded superdense TL14 0.8% Cr500000, molecular bonded TL16 0.5% MCr1.5, plus the maximum protection column and the small-hull armour tonnage multiplier (x4 / x3 / x2 / x1 by hull size).
- Hull options (pages 14-15): heat shielding, radiation shielding, reflec, solar coating, stealth types table.
- Drives (page 17): thrust potential table for manoeuvre and reaction drives (percentage of hull and TL per rating 0-9+), jump potential table (percentage plus 5 tons, TL per rating), costs MCr2 / MCr0.2 / MCr1.5 per ton, jump drive minimum 10 t.
- Power (page 18): basic systems 20% of hull (10% non-gravity), manoeuvre 10% x thrust (x0.25 at thrust 0), jump 10% x jump number; power plant table (fission TL6 8/t MCr0.4 through antimatter TL20 100/t MCr10).
- Fuel (page 19): jump 10% x jump number, power plant 10% of plant size per month (chemical differs), reaction drive 2.5% per thrust per hour.
- Bridge table (page 20), smaller bridge, command bridge, cockpits.
- Computers and cores tables (page 21), /bis and /fib options.
- Sensors table (page 22).
- Crew requirements table (page 24), crew reduction multipliers for 5,001 t and up.
- Staterooms, double occupancy, low berths, emergency low berths, common areas (page 25).
- Airlocks, cargo, finalise (page 26): standard design 10% discount, architect 1%, maintenance = cost / 12,000, construction time.

**Reading the tables.** `pdftotext -layout` scrambles the multi-column tables. `pdftotext -raw` reads them in row order and is what the transcription used. `pdftoppm` is not installed, so page images are not an option here. The Scout and Free Trader sheets cross-check most of the numbers.

### Phase 2: engine and fixtures

- `Design` and `Sheet` types, `sheet(design)`.
- Fixtures as vitest tests: **Scout/Courier** (page 161: TL12, 100 t streamlined, crystaliron armour 4, thrust 2, jump 2, fusion TL12 power 60, MCr41.045 total, MCr36.9405 after discount, Cr3079/month, hull 40) and **Free Trader** (page 172: 200 t, armour 2, thrust 1, jump 1, power 75, MCr51.38 / MCr46.242, Cr3854/month, hull 80). Both use Fuel Processor, Fuel Scoops, Cargo Crane, Docking Space, Air/Raft and software, so a minimal slice of Spacecraft Options and the software list is needed even for these two. Bring in only those lines at this phase.
- Then Launch and Ship's Boat (small craft, cockpit rules), Far Trader (page 170), Patrol Corvette (page 188, weapons), Subsidised Merchant (190).

### Phase 3: weapons and screens (PDF pages 27-43)

Turrets and fixed mounts, weapon table, barbettes, bays, spinal mounts, missiles and torpedoes as ammunition lines, screens. Number-of-weapons limits by hull size (page 27). Gunner crew flows from this into the crew table.

### Phase 4: options, computer, sensors (PDF pages 44-64, 74-79)

Spacecraft Options in full, software packages and bandwidth, sensor packages. Each option is a data entry with tons, cost, power and TL, plus any rule that does not fit a flat entry (fuel processor rate, docking space sizing, drop tanks).

### Phase 5: UI

Stepper, live sheet, problems list, JSON save/load, printable sheet in the book's layout. Recent designs list and File System Access API folder handling as PlanetHex does it.

### Phase 6 and beyond

Space stations (65-70). Exotic technology (80-85). Then the deck plan thread using the geomorph tiles.

Customising ships (pages 71-73) was pulled forward and done after phase 3, because the book's capital ships all use drive advantages and disadvantages and none of them could be reproduced without it.

## Decisions needed before phase 0

1. Stack: Vite + TypeScript + vitest, browser-first, Electron later, as PlanetHex. Recommended, and assumed unless told otherwise.
2. First deliverable: phases 0 to 2 with the two fixtures green and no UI beyond a test page. Recommended, so the numbers are right before anything is drawn.
3. Whether the software list and Spacecraft Options entries needed by the fixtures come from High Guard alone or also from the Core Rulebook (which has its own copy). High Guard alone is recommended; note any divergence.

## Progress

- [x] Phase 0 (2026-09-19)
- [x] Phase 1 (2026-09-19): `src/rules/*.ts`, one file per step, typechecks clean
- [x] Phase 2 (2026-09-19): `src/engine/`, both fixtures green, 43 tests
- [x] Phase 3 (2026-09-19): weapons chapter, Patrol Corvette fixture green, 60 tests
- [x] Customising Ships (2026-09-19): grades, traits, refit costs, 72 tests
- [x] Phase 4 (2026-09-19): Spacecraft Options in full, Destroyer Escort fixture green, 79 tests
- [x] Phase 5 (2026-09-19): the interface, saving, printing, 83 tests
