# Version history

The version in [package.json](package.json) is the one number that reaches a
user. Dates are the day the release was tagged.

## Unreleased

- **Floor plans.** A Floor plan button beside Design lays the ship out on
  Traveller's deck squares. Pick a component and paint its squares, two to the
  ton, six for a stateroom, in any shape and on as many decks as you like. The
  left panel shows each component placed against wanted. Doors and iris valves
  go in walls; lifts, hatches and stairs join decks, and an overlay shows the
  deck above faintly underneath so shafts line up. Furniture and fitted
  staterooms come from Robert Pearce's Starship Symbols. Each deck exports as
  SVG or PNG, Print gives every deck a page, and the plan saves inside the
  `.ship`. `FloorPlanSpec.md` is its contract.
- **A library of ship pieces.** 155 of them, in one list on the right: turrets,
  launch tubes and barbettes, engineering sections of 4 to 63 tons, standard
  rooms (a 6-ton workshop, a 4-ton medical bay, laboratory, briefing room and
  brig, an armoury, offices and storage), plain empty rooms from 5 by 5 feet to
  20 by 40, machinery,
  batteries and computers, staterooms, bunks and suites, freshers, medical beds
  and an autodoc, lounges, galleys and gaming tables, lockers, consoles, cargo,
  and an arboretum with trees and a fountain. Every piece turns (R) and
  flips (F), before or after placing.
- **Geomorph tiles for larger ships.** Load geomorph folder points the screen at
  your own copy of Robert Pearce's Adventure Class geomorphs, and every tile in
  it can be laid on the deck. Paint the components over them; the tiles draw
  the walls.
- **Move.** Drag tiles, furniture, doors and whole rooms by half squares; R
  turns, F flips, Delete removes, the arrow keys nudge half a square (a whole
  one with Shift).
- **Half squares when moving.** Painting and placing are in whole squares; Move
  slides rooms, doors and pieces by half squares to line them up. Rooms are
  still counted in squares.
- **Numbered rooms.** Components are numbered down the left, and rooms can be
  labelled by number, with a key on exported and printed plans, or by name
  while designing.
- **Print the whole ship.** Print gives the design sheet the first page and
  each deck of the floor plan a page after it, from either screen.
- **Openings.** An Open stretch of wall, clicked or dragged like a door, takes
  the line out between two rooms so they run into one another.
- **Wide doors and iris valves.** Drag along a wall for a door wider than a
  square; doors on neighbouring squares stay separate. Iris valves go in walls
  or in floors and ceilings, drawn with the symbols' own iris valves.
- **A way in.** A landing screen in the style PlanetHex and MainLine share: a
  new design, a file, one of the book's ships, or back to the one open. The name
  in the bar returns to it without losing anything.
- **A standard footer.** Help, release notes, suggestions and the version; links
  to PlanetHex and MainLine; and Mongoose Publishing's fair use notice in full.
- **One header across the family.** The start screen's mark and name, and the
  20px mark and gold name heading the working screens, the same size in
  MainLine, PlanetHex and the Traveller Ship Designer.
- **Squadrons of craft.** A carried craft has a number, so 24 fighters are one
  line in the form and two on the sheet rather than forty-eight. Each still has
  its own berth, pilot and engine room.
- **Carry one of your own designs.** *From a saved design* adds a craft with its
  tonnage, price and engine room read from its file. The price is the design's
  full one: the carrier's standard design discount covers its craft, so the
  discounted price on the craft's own sheet would be discounted twice.
- **A catalogue of 36 more ships**, from Mainline: the Dragon from High Guard,
  28 classic and fan designs rebuilt to High Guard 2022 (Rampart to Azhanti High
  Lightning), and seven original designs, among them the Snub and Snub 2
  fighters. They sit under *Example ships* beside
  the book's four, grouped, and `src/catalogue/SOURCES.md` says where each one
  came from and what was changed to make it legal.
- **Suggest a layout.** One button lays every component down as a room of its
  size along a corridor, bridge forward and drives aft, with a door to each and
  a lift where the ship needs two decks. Fuel is left for you to draw or not.
  It lays floors, doors and lifts only; the furniture is yours to choose, and
  rooms the library has a fitted room for are drawn its shape, ready for it.
- **Rooms turn, flip and change deck.** Select a painted room with Move: R
  turns it, F flips it, and Room to deck (or Page Up and Page Down) sends it to
  another deck, into empty space there.
- **0t items.** Fixed mounts, the computer and fuel scoops are listed on the
  floor plan though they take no tonnage, to mark where they are if you like.
- **Fuel is optional in the totals too.** Fuel not drawn comes off the plan's
  target before the ten per cent either way is worked out.
- **Elevators and hatches join decks.** The library's elevators, stairwells and
  hatches, a new Hatch tool, and geomorph tiles with lifts, stairs or vertical
  access all count as ways between decks wherever they overlap.
- **Many at once.** Shift and a drag with Move picks up everything in a box, rooms, furniture and doors together, to drag, nudge or delete; with Erase it clears the box, pieces and all.
- **Decks for the suggested layout.** A box beside Suggest a layout sets how many decks it spreads the ship over, starting at the number that suits the ship.
- **Rooms of their own.** A weapon mounted several times, each carried craft's berth, and fitted rooms bought more than once are each a room, painted and checked one by one as staterooms are, and Suggest a layout lays them so. Its other rooms are rectangles where their size allows, never longer than six to one.
- **Pieces shown or hidden.** Show and Hide, beside the room labels, put the furniture, fittings and tiles on the plan or leave them off, on screen, in exports and in print.
- **Room labels off.** Beside Names and Numbers, Off draws the plan without room labels, on screen, in exports and in print.
- **Walls.** A Wall tool in the walls section draws a wall where there is none, to split a room; drag across or down for a long one.
- **The description prints beside the sheet**, to the right of the components.
- **One weapon to a firmpoint.** A small craft's firmpoint now holds one weapon, and only one may be a single turret, as High Guard says. Four catalogue fighters broke the rule and are cut back: the Snub and Snub 2 keep a missile rack, the Wasp a pulse laser and a missile rack, the Kia its fusion gun turret with the missile rack in a fixed mount. Their carriers are repriced.
- **The floor plan's total leaves armour out.** Armour and hull options that take tons are never drawn, so they no longer count against the plan; nor do squares painted to mark a 0t item.
- **No stateroom wanted for a fighter pilot.** A small craft under 100 tons
  without a jump drive is not somewhere anyone lives, and is no longer warned
  about berths. A 100-ton yacht still is.

## 0.1.0 — 2026-09-20

The first thing that runs. A ship goes in through the book's own thirteen steps
and its sheet comes out beside it, redrawn on every change.

- **The design chapters, whole.** Ship Design, Weapons and Screens, Spacecraft
  Options and Customising Ships, transcribed table by table under `src/rules/`
  with every entry citing the page it came from.
- **Four of the book's ships reproduce exactly**, to the ton and to the credit:
  the Scout/Courier, the Free Trader, the Patrol Corvette and the Chrysanthemum
  Destroyer Escort. All four are in the application to open and pull apart, and
  all four are tests.
- **Problems are reported at the top of the sheet**, as errors, warnings or
  notes, each naming the clause of `ShipSpec.md` it comes from. A designer who
  has just broken something should not have to scroll past a correct-looking
  sheet to be told.
- **The sheet carries power and bandwidth** beside tonnage and cost, so what a
  component draws is read off the same row as what it costs.
- **A place to say what the ship is for**, under its name on the sheet, where the
  book puts its own prose. It saves with the design and prints with the sheet.
- **Save and load** through the File System Access API where the browser has it,
  and as a download where it does not. A design is written as `.ship`, so a
  folder of them reads as a folder of ships; the contents are JSON. A save that
  works says so, which the download path has no other way to tell you. Print
  gives the sheet the page.

Three things the book gets wrong or leaves unsaid, found by making its own ships
add up, are recorded in the spec rather than quietly accommodated: the Free
Trader's missing ton, the engineer rule that does not round the way it reads,
and ammunition that takes room in a ship without adding to its price.

Space stations and exotic technology are not in yet, and neither are deck
plans.
